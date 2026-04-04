-- App configuration + backups in DB and Storage
-- Run after the reconciliation scripts and prior 2026-04-04 migrations

CREATE TABLE IF NOT EXISTS public.app_user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_user_settings_user_key_unique UNIQUE (user_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_app_user_settings_user_key
  ON public.app_user_settings(user_id, setting_key);

ALTER TABLE public.app_user_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_user_settings' AND policyname = 'app_user_settings_manage_own'
  ) THEN
    CREATE POLICY app_user_settings_manage_own
    ON public.app_user_settings
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_settings TO authenticated;

CREATE TABLE IF NOT EXISTS public.app_shared_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_shared_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_shared_settings' AND policyname = 'app_shared_settings_authenticated_all'
  ) THEN
    CREATE POLICY app_shared_settings_authenticated_all
    ON public.app_shared_settings
    FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_shared_settings TO authenticated;

CREATE TABLE IF NOT EXISTS public.backup_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lead_count INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  payload_snapshot JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_records_user_created
  ON public.backup_records(user_id, created_at DESC);

ALTER TABLE public.backup_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'backup_records' AND policyname = 'backup_records_manage_own'
  ) THEN
    CREATE POLICY backup_records_manage_own
    ON public.backup_records
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_records TO authenticated;

INSERT INTO storage.buckets (id, name, public)
SELECT 'system-backups', 'system-backups', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'system-backups'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'system_backups_read_own'
  ) THEN
    CREATE POLICY system_backups_read_own
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'system-backups' AND name LIKE auth.uid()::text || '/%');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'system_backups_insert_own'
  ) THEN
    CREATE POLICY system_backups_insert_own
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'system-backups' AND name LIKE auth.uid()::text || '/%');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'system_backups_update_own'
  ) THEN
    CREATE POLICY system_backups_update_own
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'system-backups' AND name LIKE auth.uid()::text || '/%')
    WITH CHECK (bucket_id = 'system-backups' AND name LIKE auth.uid()::text || '/%');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'system_backups_delete_own'
  ) THEN
    CREATE POLICY system_backups_delete_own
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'system-backups' AND name LIKE auth.uid()::text || '/%');
  END IF;
END $$;