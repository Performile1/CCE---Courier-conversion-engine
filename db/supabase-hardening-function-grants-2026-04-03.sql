-- Supabase hardening: function execute grants
-- Run after db/supabase-additions-2026-04-03.sql

BEGIN;

-- Revoke overly broad execute privileges.
REVOKE EXECUTE ON FUNCTION public.current_app_role(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_campaign_open(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_campaign_click(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon;

-- Keep intended runtime grants.
GRANT EXECUTE ON FUNCTION public.current_app_role(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_campaign_open(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_campaign_click(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, UUID, TEXT, JSONB) TO authenticated, service_role;

COMMIT;
