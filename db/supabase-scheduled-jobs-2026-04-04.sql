-- Scheduled jobs for unattended cron execution
-- Run after the existing reconciliation/additions scripts

CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_mode TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  last_result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_user_id ON public.scheduled_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run ON public.scheduled_jobs(enabled, next_run_at);

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scheduled_jobs' AND policyname = 'scheduled_jobs_manage_own'
  ) THEN
    CREATE POLICY scheduled_jobs_manage_own
    ON public.scheduled_jobs
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_jobs TO authenticated;