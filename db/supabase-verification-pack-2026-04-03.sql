-- Supabase verification pack for CCE migrations
-- Run after:
-- 1) db/supabase-reconciliation-2026-04-03.sql
-- 2) db/supabase-additions-2026-04-03.sql

-- ============================================================
-- 0) Context
-- ============================================================
SELECT NOW() AS checked_at_utc;

-- ============================================================
-- 1) Missing tables (should return zero rows)
-- ============================================================
WITH expected_tables AS (
  SELECT * FROM (VALUES
    ('users'),
    ('leads'),
    ('decision_makers'),
    ('analysis_history'),
    ('campaigns'),
    ('campaign_recipients'),
    ('crm_integrations'),
    ('slack_integrations'),
    ('cost_tracking'),
    ('integrations'),
    ('shared_leads'),
    ('webhooks'),
    ('webhook_logs'),
    ('event_triggers'),
    ('custom_connectors'),
    ('news_articles'),
    ('admin_audit_log')
  ) AS t(table_name)
)
SELECT et.table_name AS missing_table
FROM expected_tables et
LEFT JOIN information_schema.tables it
  ON it.table_schema = 'public'
 AND it.table_name = et.table_name
WHERE it.table_name IS NULL
ORDER BY et.table_name;

-- ============================================================
-- 2) Missing critical columns (should return zero rows)
-- ============================================================
WITH expected_columns AS (
  SELECT * FROM (VALUES
    ('users', 'app_role'),
    ('users', 'subscription_tier'),
    ('users', 'credits_balance'),
    ('users', 'credits_remaining'),
    ('campaigns', 'open_count'),
    ('campaigns', 'click_count'),
    ('campaigns', 'total_opened'),
    ('campaigns', 'total_clicked'),
    ('campaign_recipients', 'email'),
    ('news_articles', 'image_url'),
    ('news_articles', 'published_at'),
    ('news_articles', 'fetched_at'),
    ('admin_audit_log', 'actor_id'),
    ('admin_audit_log', 'action')
  ) AS t(table_name, column_name)
)
SELECT ec.table_name, ec.column_name AS missing_column
FROM expected_columns ec
LEFT JOIN information_schema.columns ic
  ON ic.table_schema = 'public'
 AND ic.table_name = ec.table_name
 AND ic.column_name = ec.column_name
WHERE ic.column_name IS NULL
ORDER BY ec.table_name, ec.column_name;

-- ============================================================
-- 3) Missing constraints (should return zero rows)
-- ============================================================
WITH expected_constraints AS (
  SELECT * FROM (VALUES
    ('public.users', 'users_app_role_check')
  ) AS t(table_ref, constraint_name)
)
SELECT ec.table_ref, ec.constraint_name AS missing_constraint
FROM expected_constraints ec
LEFT JOIN pg_constraint pc
  ON pc.conname = ec.constraint_name
 AND pc.conrelid = ec.table_ref::regclass
WHERE pc.oid IS NULL;

-- ============================================================
-- 4) Missing indexes (should return zero rows)
-- ============================================================
WITH expected_indexes AS (
  SELECT * FROM (VALUES
    ('idx_users_email_lower'),
    ('idx_campaign_recipients_campaign_lower_email'),
    ('idx_admin_audit_log_actor_id'),
    ('idx_admin_audit_log_created_at'),
    ('idx_news_articles_published_at')
  ) AS t(index_name)
)
SELECT ei.index_name AS missing_index
FROM expected_indexes ei
LEFT JOIN pg_indexes pi
  ON pi.schemaname = 'public'
 AND pi.indexname = ei.index_name
WHERE pi.indexname IS NULL
ORDER BY ei.index_name;

-- ============================================================
-- 5) Missing functions (should return zero rows)
-- ============================================================
WITH expected_functions AS (
  SELECT * FROM (VALUES
    ('set_row_updated_at', 'trigger'),
    ('current_app_role', 'text'),
    ('is_admin', 'boolean'),
    ('sync_user_profile_from_auth', 'trigger'),
    ('log_admin_action', 'uuid'),
    ('increment_campaign_open', 'campaigns'),
    ('increment_campaign_click', 'campaigns')
  ) AS t(function_name, expected_return)
),
found_functions AS (
  SELECT
    p.proname AS function_name,
    pg_catalog.format_type(p.prorettype, NULL) AS return_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT ef.function_name, ef.expected_return
FROM expected_functions ef
LEFT JOIN found_functions ff
  ON ff.function_name = ef.function_name
WHERE ff.function_name IS NULL
ORDER BY ef.function_name;

-- ============================================================
-- 6) Missing triggers (should return zero rows)
-- ============================================================
WITH expected_triggers AS (
  SELECT * FROM (VALUES
    ('public', 'users', 'trg_users_updated_at'),
    ('public', 'leads', 'trg_leads_updated_at'),
    ('public', 'campaigns', 'trg_campaigns_updated_at'),
    ('public', 'crm_integrations', 'trg_crm_integrations_updated_at'),
    ('public', 'slack_integrations', 'trg_slack_integrations_updated_at'),
    ('public', 'integrations', 'trg_integrations_updated_at'),
    ('public', 'custom_connectors', 'trg_custom_connectors_updated_at'),
    ('public', 'event_triggers', 'trg_event_triggers_updated_at'),
    ('auth', 'users', 'trg_sync_user_profile_from_auth')
  ) AS t(trigger_schema, table_name, trigger_name)
)
SELECT et.trigger_schema, et.table_name, et.trigger_name AS missing_trigger
FROM expected_triggers et
LEFT JOIN information_schema.triggers it
  ON it.trigger_schema = et.trigger_schema
 AND it.event_object_table = et.table_name
 AND it.trigger_name = et.trigger_name
WHERE it.trigger_name IS NULL
ORDER BY et.trigger_schema, et.table_name, et.trigger_name;

-- ============================================================
-- 7) Missing policies (should return zero rows)
-- ============================================================
WITH expected_policies AS (
  SELECT * FROM (VALUES
    ('users', 'users_directory_read'),
    ('users', 'users_self_insert'),
    ('users', 'users_self_update'),
    ('users', 'users_admin_update'),
    ('leads', 'leads_manage_own'),
    ('leads', 'leads_admin_all'),
    ('campaigns', 'campaigns_manage_own'),
    ('campaigns', 'campaigns_admin_all'),
    ('campaign_recipients', 'campaign_recipients_manage_via_campaign'),
    ('campaign_recipients', 'campaign_recipients_admin_all'),
    ('admin_audit_log', 'admin_audit_log_admin_read'),
    ('admin_audit_log', 'admin_audit_log_admin_insert')
  ) AS t(table_name, policy_name)
)
SELECT ep.table_name, ep.policy_name AS missing_policy
FROM expected_policies ep
LEFT JOIN pg_policies pp
  ON pp.schemaname = 'public'
 AND pp.tablename = ep.table_name
 AND pp.policyname = ep.policy_name
WHERE pp.policyname IS NULL
ORDER BY ep.table_name, ep.policy_name;

-- ============================================================
-- 8) RLS enabled checks
-- ============================================================
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'users','leads','decision_makers','analysis_history','campaigns','campaign_recipients',
    'crm_integrations','slack_integrations','cost_tracking','integrations','shared_leads',
    'webhooks','webhook_logs','event_triggers','custom_connectors','news_articles','admin_audit_log'
  )
ORDER BY c.relname;

-- ============================================================
-- 9) Execute grants for authenticated role (sanity check)
-- ============================================================
SELECT
  routine_schema,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name IN (
    'increment_campaign_open',
    'increment_campaign_click',
    'current_app_role',
    'is_admin',
    'log_admin_action'
  )
ORDER BY routine_name, grantee;

-- 9b) Unexpected PUBLIC/anon execute grants (should return zero rows)
SELECT
  routine_schema,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name IN (
    'increment_campaign_open',
    'increment_campaign_click',
    'current_app_role',
    'is_admin',
    'log_admin_action'
  )
  AND grantee IN ('PUBLIC', 'anon')
ORDER BY routine_name, grantee;

-- ============================================================
-- 10) Data integrity checks
-- ============================================================

-- 10a) Duplicate campaign recipients by case-insensitive email (should return zero rows)
SELECT
  campaign_id,
  LOWER(email) AS normalized_email,
  COUNT(*) AS duplicate_count
FROM public.campaign_recipients
GROUP BY campaign_id, LOWER(email)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 10b) Invalid app roles (should return zero rows)
SELECT id, email, app_role
FROM public.users
WHERE app_role NOT IN ('admin', 'user', 'viewer');

-- 10c) Role distribution (informational)
SELECT app_role, COUNT(*) AS user_count
FROM public.users
GROUP BY app_role
ORDER BY app_role;

-- ============================================================
-- 11) Optional smoke tests (run manually in secure context)
-- ============================================================
-- SELECT public.current_app_role();
-- SELECT public.is_admin();
-- SELECT public.log_admin_action('verification_smoke_test', NULL, NULL, '{"source":"verification-pack"}'::jsonb);
