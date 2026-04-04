-- Lead payload snapshot for full LeadCard persistence
-- Recommended follow-up after schema reconciliation

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_payload JSONB;

COMMENT ON COLUMN public.leads.lead_payload IS
  'Current full LeadData snapshot used as the server-side source of truth for LeadCard while explicit relational columns are phased in selectively.';

CREATE INDEX IF NOT EXISTS idx_leads_lead_payload_gin
  ON public.leads
  USING GIN (lead_payload);