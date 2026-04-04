-- Shared exclusions + reservoir buckets
-- Run after the reconciliation scripts and lead_payload migration

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_bucket TEXT NOT NULL DEFAULT 'active';

UPDATE public.leads
SET lead_bucket = 'active'
WHERE lead_bucket IS NULL OR btrim(lead_bucket) = '';

CREATE INDEX IF NOT EXISTS idx_leads_user_bucket_analysis_date
  ON public.leads(user_id, lead_bucket, analysis_date DESC);

CREATE TABLE IF NOT EXISTS public.shared_exclusions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exclusion_type TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shared_exclusions_type_check CHECK (exclusion_type IN ('customer', 'history')),
  CONSTRAINT shared_exclusions_type_value_unique UNIQUE (exclusion_type, normalized_value)
);

CREATE INDEX IF NOT EXISTS idx_shared_exclusions_type
  ON public.shared_exclusions(exclusion_type, normalized_value);

ALTER TABLE public.shared_exclusions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shared_exclusions' AND policyname = 'shared_exclusions_authenticated_all'
  ) THEN
    CREATE POLICY shared_exclusions_authenticated_all
    ON public.shared_exclusions
    FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_exclusions TO authenticated;