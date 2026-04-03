-- Supabase schema reconciliation for CCE
-- Generated from current codebase expectations on 2026-04-03.
-- This is intended for existing projects that may already have partial schema.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS credits_remaining INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS monthly_openrouter_cost NUMERIC(12,4) NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS salesforce_account_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS salesforce_contact_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON public.users (LOWER(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS org_number TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sni_code TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS revenue TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS employees INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS analysis_model TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS hallucination_score INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS hallucination_details JSONB;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS decision_making_efficiency NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS competitive_positioning NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS market_opportunity NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS analysis_date TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS segment TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS revenue_year TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS profit TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ecommerce_platform TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS payment_provider TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS carriers TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS potential_sek NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS freight_budget TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS annual_packages INTEGER;

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

CREATE TABLE IF NOT EXISTS public.decision_makers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS direct_phone TEXT;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS linkedin TEXT;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS verification_method TEXT;
ALTER TABLE public.decision_makers ADD COLUMN IF NOT EXISTS verification_note TEXT;

CREATE TABLE IF NOT EXISTS public.analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS analysis_type TEXT;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS completion_tokens INTEGER;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(12,6);
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS result_summary TEXT;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS raw_analysis JSONB;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS tokens_used INTEGER;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS cost NUMERIC(12,6);
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS success BOOLEAN;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON public.analysis_history(user_id);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS lead_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS total_recipients INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS total_opened INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS total_clicked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS open_rate NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS click_rate NUMERIC(8,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);

CREATE TABLE IF NOT EXISTS public.crm_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL,
  api_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_integrations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.crm_integrations ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.crm_integrations ADD COLUMN IF NOT EXISTS last_sync TIMESTAMPTZ;
ALTER TABLE public.crm_integrations ADD COLUMN IF NOT EXISTS synced_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.crm_integrations ADD COLUMN IF NOT EXISTS sync_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_integrations_user_type ON public.crm_integrations(user_id, crm_type);

CREATE TABLE IF NOT EXISTS public.slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.slack_integrations ADD COLUMN IF NOT EXISTS workspace_name TEXT;
ALTER TABLE public.slack_integrations ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE public.slack_integrations ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.slack_integrations ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.slack_integrations ADD COLUMN IF NOT EXISTS notifications JSONB NOT NULL DEFAULT '{"leadCreated":true,"hallucinationAlert":true,"campaignStarted":true,"campaignCompleted":true,"crmSynced":true}'::jsonb;
ALTER TABLE public.slack_integrations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_slack_integrations_user_id ON public.slack_integrations(user_id);

CREATE TABLE IF NOT EXISTS public.cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cost_tracking ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE public.cost_tracking ADD COLUMN IF NOT EXISTS model_or_action TEXT;
ALTER TABLE public.cost_tracking ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.cost_tracking ADD COLUMN IF NOT EXISTS input_tokens INTEGER;
ALTER TABLE public.cost_tracking ADD COLUMN IF NOT EXISTS output_tokens INTEGER;
ALTER TABLE public.cost_tracking ADD COLUMN IF NOT EXISTS tokens_input INTEGER;
ALTER TABLE public.cost_tracking ADD COLUMN IF NOT EXISTS tokens_output INTEGER;
ALTER TABLE public.cost_tracking ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0;
ALTER TABLE public.cost_tracking ADD COLUMN IF NOT EXISTS cost NUMERIC(12,6) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_id ON public.cost_tracking(user_id);

CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_user_type ON public.integrations(user_id, integration_type);

CREATE TABLE IF NOT EXISTS public.shared_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  lead_data JSONB NOT NULL,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shared_leads ADD COLUMN IF NOT EXISTS original_lead_id UUID;
ALTER TABLE public.shared_leads ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.shared_leads ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shared_leads_recipient_id ON public.shared_leads(recipient_id);
CREATE INDEX IF NOT EXISTS idx_shared_leads_sender_id ON public.shared_leads(sender_id);

CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhooks ADD COLUMN IF NOT EXISTS last_triggered TIMESTAMPTZ;
ALTER TABLE public.webhooks ADD COLUMN IF NOT EXISTS secret TEXT;

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON public.webhooks(user_id);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS status_code INTEGER;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS status_text TEXT;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);

CREATE TABLE IF NOT EXISTS public.event_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  webhook_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_triggers ADD COLUMN IF NOT EXISTS custom_logic TEXT;

CREATE INDEX IF NOT EXISTS idx_event_triggers_user_id ON public.event_triggers(user_id);

CREATE TABLE IF NOT EXISTS public.custom_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.custom_connectors ADD COLUMN IF NOT EXISTS auth_type TEXT NOT NULL DEFAULT 'apikey';
ALTER TABLE public.custom_connectors ADD COLUMN IF NOT EXISTS auth_config JSONB;
ALTER TABLE public.custom_connectors ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.custom_connectors ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_custom_connectors_user_id ON public.custom_connectors(user_id);

CREATE TABLE IF NOT EXISTS public.news_articles (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  country TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS reliability INTEGER DEFAULT 90;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS content TEXT;

CREATE INDEX IF NOT EXISTS idx_news_articles_country ON public.news_articles(country);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON public.news_articles(published_at DESC);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_makers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_directory_read') THEN
    CREATE POLICY users_directory_read ON public.users FOR SELECT TO authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_self_insert') THEN
    CREATE POLICY users_self_insert ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_self_update') THEN
    CREATE POLICY users_self_update ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leads' AND policyname = 'leads_manage_own') THEN
    CREATE POLICY leads_manage_own ON public.leads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'decision_makers' AND policyname = 'decision_makers_manage_via_lead') THEN
    CREATE POLICY decision_makers_manage_via_lead ON public.decision_makers FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM public.leads l WHERE l.id = decision_makers.lead_id AND l.user_id = auth.uid())
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.leads l WHERE l.id = decision_makers.lead_id AND l.user_id = auth.uid())
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'analysis_history' AND policyname = 'analysis_history_manage_own') THEN
    CREATE POLICY analysis_history_manage_own ON public.analysis_history FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'campaigns' AND policyname = 'campaigns_manage_own') THEN
    CREATE POLICY campaigns_manage_own ON public.campaigns FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'campaign_recipients' AND policyname = 'campaign_recipients_manage_via_campaign') THEN
    CREATE POLICY campaign_recipients_manage_via_campaign ON public.campaign_recipients FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.user_id = auth.uid())
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.user_id = auth.uid())
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_integrations' AND policyname = 'crm_integrations_manage_own') THEN
    CREATE POLICY crm_integrations_manage_own ON public.crm_integrations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'slack_integrations' AND policyname = 'slack_integrations_manage_own') THEN
    CREATE POLICY slack_integrations_manage_own ON public.slack_integrations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cost_tracking' AND policyname = 'cost_tracking_manage_own') THEN
    CREATE POLICY cost_tracking_manage_own ON public.cost_tracking FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'integrations' AND policyname = 'integrations_manage_own') THEN
    CREATE POLICY integrations_manage_own ON public.integrations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_leads' AND policyname = 'shared_leads_read_sender_or_recipient') THEN
    CREATE POLICY shared_leads_read_sender_or_recipient ON public.shared_leads FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_leads' AND policyname = 'shared_leads_insert_sender') THEN
    CREATE POLICY shared_leads_insert_sender ON public.shared_leads FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_leads' AND policyname = 'shared_leads_update_recipient') THEN
    CREATE POLICY shared_leads_update_recipient ON public.shared_leads FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_leads' AND policyname = 'shared_leads_delete_recipient') THEN
    CREATE POLICY shared_leads_delete_recipient ON public.shared_leads FOR DELETE TO authenticated USING (recipient_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'webhooks' AND policyname = 'webhooks_manage_own') THEN
    CREATE POLICY webhooks_manage_own ON public.webhooks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'webhook_logs' AND policyname = 'webhook_logs_manage_via_webhook') THEN
    CREATE POLICY webhook_logs_manage_via_webhook ON public.webhook_logs FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM public.webhooks w WHERE w.id = webhook_logs.webhook_id AND w.user_id = auth.uid())
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.webhooks w WHERE w.id = webhook_logs.webhook_id AND w.user_id = auth.uid())
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_triggers' AND policyname = 'event_triggers_manage_own') THEN
    CREATE POLICY event_triggers_manage_own ON public.event_triggers FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'custom_connectors' AND policyname = 'custom_connectors_manage_own') THEN
    CREATE POLICY custom_connectors_manage_own ON public.custom_connectors FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'news_articles' AND policyname = 'news_articles_recent_read') THEN
    CREATE POLICY news_articles_recent_read ON public.news_articles FOR SELECT TO authenticated USING (
      published_at >= NOW() - INTERVAL '30 days' OR created_at >= NOW() - INTERVAL '7 days'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'news_articles' AND policyname = 'news_articles_insert_authenticated') THEN
    CREATE POLICY news_articles_insert_authenticated ON public.news_articles FOR INSERT TO authenticated WITH CHECK (TRUE);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_leads_updated_at') THEN
    CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_campaigns_updated_at') THEN
    CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_integrations_updated_at') THEN
    CREATE TRIGGER trg_crm_integrations_updated_at BEFORE UPDATE ON public.crm_integrations FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_slack_integrations_updated_at') THEN
    CREATE TRIGGER trg_slack_integrations_updated_at BEFORE UPDATE ON public.slack_integrations FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_integrations_updated_at') THEN
    CREATE TRIGGER trg_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_custom_connectors_updated_at') THEN
    CREATE TRIGGER trg_custom_connectors_updated_at BEFORE UPDATE ON public.custom_connectors FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_event_triggers_updated_at') THEN
    CREATE TRIGGER trg_event_triggers_updated_at BEFORE UPDATE ON public.event_triggers FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
END $$;

COMMIT;