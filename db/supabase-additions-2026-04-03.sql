-- Follow-up Supabase additions for CCE
-- Run this after db/supabase-reconciliation-2026-04-03.sql

BEGIN;

-- 1) Role model in public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS app_role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_app_role_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_app_role_check
      CHECK (app_role IN ('admin', 'user', 'viewer'));
  END IF;
END $$;

-- Backfill app_role from auth metadata if present
UPDATE public.users u
SET app_role = COALESCE(
  NULLIF(LOWER(au.raw_app_meta_data ->> 'app_role'), ''),
  NULLIF(LOWER(au.raw_app_meta_data ->> 'role'), ''),
  u.app_role,
  'user'
)
FROM auth.users au
WHERE au.id = u.id
  AND (
    au.raw_app_meta_data ? 'app_role'
    OR au.raw_app_meta_data ? 'role'
  );

-- 2) Helper functions for role-aware RLS and app logic
CREATE OR REPLACE FUNCTION public.current_app_role(uid UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT app_role FROM public.users WHERE id = uid), 'viewer');
$$;

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT app_role = 'admin' FROM public.users WHERE id = uid), FALSE);
$$;

-- 3) Keep public.users in sync from auth.users metadata on insert/update
CREATE OR REPLACE FUNCTION public.sync_user_profile_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(
    NULLIF(LOWER(NEW.raw_app_meta_data ->> 'app_role'), ''),
    NULLIF(LOWER(NEW.raw_app_meta_data ->> 'role'), ''),
    'user'
  );

  IF v_role NOT IN ('admin', 'user', 'viewer') THEN
    v_role := 'user';
  END IF;

  INSERT INTO public.users (id, email, full_name, app_role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    v_role,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    app_role = EXCLUDED.app_role,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_user_profile_from_auth'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_user_profile_from_auth
    AFTER INSERT OR UPDATE OF email, raw_app_meta_data, raw_user_meta_data
    ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_profile_from_auth();
  END IF;
END $$;

-- 4) Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_email TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_id ON public.admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_log'
      AND policyname = 'admin_audit_log_admin_read'
  ) THEN
    CREATE POLICY admin_audit_log_admin_read
    ON public.admin_audit_log
    FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_log'
      AND policyname = 'admin_audit_log_admin_insert'
  ) THEN
    CREATE POLICY admin_audit_log_admin_insert
    ON public.admin_audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.is_admin(auth.uid())
      AND actor_id = auth.uid()
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_target_email TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin privileges required';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, target_email, payload)
  VALUES (auth.uid(), p_action, p_target_user_id, p_target_email, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 5) Atomic campaign counters to avoid race conditions
CREATE OR REPLACE FUNCTION public.increment_campaign_open(p_campaign_id UUID)
RETURNS public.campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.campaigns;
BEGIN
  UPDATE public.campaigns
  SET
    open_count = COALESCE(open_count, 0) + 1,
    total_opened = COALESCE(total_opened, 0) + 1,
    open_rate = CASE
      WHEN COALESCE(total_recipients, 0) > 0
      THEN ROUND(((COALESCE(total_opened, 0) + 1)::numeric / total_recipients::numeric) * 100, 2)
      ELSE COALESCE(open_rate, 0)
    END,
    updated_at = NOW()
  WHERE id = p_campaign_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'campaign not found: %', p_campaign_id;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_click(p_campaign_id UUID)
RETURNS public.campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.campaigns;
BEGIN
  UPDATE public.campaigns
  SET
    click_count = COALESCE(click_count, 0) + 1,
    total_clicked = COALESCE(total_clicked, 0) + 1,
    click_rate = CASE
      WHEN COALESCE(total_recipients, 0) > 0
      THEN ROUND(((COALESCE(total_clicked, 0) + 1)::numeric / total_recipients::numeric) * 100, 2)
      ELSE COALESCE(click_rate, 0)
    END,
    updated_at = NOW()
  WHERE id = p_campaign_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'campaign not found: %', p_campaign_id;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_campaign_open(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_campaign_click(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, UUID, TEXT, JSONB) TO authenticated;

-- 6) Stronger uniqueness / integrity
WITH ranked_recipients AS (
  SELECT
    ctid,
    campaign_id,
    LOWER(email) AS normalized_email,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_id, LOWER(email)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.campaign_recipients
)
DELETE FROM public.campaign_recipients cr
USING ranked_recipients rr
WHERE cr.ctid = rr.ctid
  AND rr.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_lower_email
  ON public.campaign_recipients (campaign_id, LOWER(email));

-- 7) Admin override policies across owner-scoped tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leads' AND policyname='leads_admin_all') THEN
    CREATE POLICY leads_admin_all ON public.leads FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campaigns' AND policyname='campaigns_admin_all') THEN
    CREATE POLICY campaigns_admin_all ON public.campaigns FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campaign_recipients' AND policyname='campaign_recipients_admin_all') THEN
    CREATE POLICY campaign_recipients_admin_all ON public.campaign_recipients FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crm_integrations' AND policyname='crm_integrations_admin_all') THEN
    CREATE POLICY crm_integrations_admin_all ON public.crm_integrations FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='slack_integrations' AND policyname='slack_integrations_admin_all') THEN
    CREATE POLICY slack_integrations_admin_all ON public.slack_integrations FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='integrations' AND policyname='integrations_admin_all') THEN
    CREATE POLICY integrations_admin_all ON public.integrations FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shared_leads' AND policyname='shared_leads_admin_all') THEN
    CREATE POLICY shared_leads_admin_all ON public.shared_leads FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='webhooks' AND policyname='webhooks_admin_all') THEN
    CREATE POLICY webhooks_admin_all ON public.webhooks FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='webhook_logs' AND policyname='webhook_logs_admin_all') THEN
    CREATE POLICY webhook_logs_admin_all ON public.webhook_logs FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_triggers' AND policyname='event_triggers_admin_all') THEN
    CREATE POLICY event_triggers_admin_all ON public.event_triggers FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_connectors' AND policyname='custom_connectors_admin_all') THEN
    CREATE POLICY custom_connectors_admin_all ON public.custom_connectors FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='analysis_history' AND policyname='analysis_history_admin_all') THEN
    CREATE POLICY analysis_history_admin_all ON public.analysis_history FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='decision_makers' AND policyname='decision_makers_admin_all') THEN
    CREATE POLICY decision_makers_admin_all ON public.decision_makers FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cost_tracking' AND policyname='cost_tracking_admin_all') THEN
    CREATE POLICY cost_tracking_admin_all ON public.cost_tracking FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='users_admin_update') THEN
    CREATE POLICY users_admin_update ON public.users FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

COMMIT;