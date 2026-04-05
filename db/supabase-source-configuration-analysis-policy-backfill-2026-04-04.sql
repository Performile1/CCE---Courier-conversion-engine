-- Backfill policy-driven analysis fields into public.app_shared_settings.source_configuration
-- Safe to run multiple times. Existing explicit values win over these defaults.

WITH default_policy AS (
  SELECT jsonb_build_object(
    'trustedDomains', to_jsonb(ARRAY[
      'allabolag.se',
      'kreditrapporten.se',
      'boolag.se',
      'ratsit.se',
      'bolagsverket.se',
      'ehandel.se',
      'market.se',
      'breakit.se'
    ]::text[]),
    'categoryPageHints', jsonb_build_object(
      'financial', to_jsonb(ARRAY['bokslut', 'omsattning', 'resultat', 'soliditet', 'likviditet', 'annual report']::text[]),
      'revenue', to_jsonb(ARRAY['omsattning', 'nettoomsattning', 'bokslut']::text[]),
      'omsattning', to_jsonb(ARRAY['omsattning', 'nettoomsattning', 'bokslut']::text[]),
      'profit', to_jsonb(ARRAY['resultat', 'arets resultat', 'efter finansnetto']::text[]),
      'resultat', to_jsonb(ARRAY['resultat', 'arets resultat', 'efter finansnetto']::text[]),
      'solidity', to_jsonb(ARRAY['soliditet', 'bokslut', 'arsredovisning']::text[]),
      'likviditet', to_jsonb(ARRAY['likviditet', 'bokslut', 'arsredovisning']::text[]),
      'riskstatus', to_jsonb(ARRAY['anmarkning', 'kfm', 'skuldsaldo', 'skuldsattningsgrad', 'status', 'arende', 'arsredovisning', 'registrerat']::text[]),
      'status', to_jsonb(ARRAY['status', 'likvidation', 'konkurs', 'rekonstruktion', 'arende', 'registrerat']::text[]),
      'betalningsanmarkning', to_jsonb(ARRAY['betalningsanmarkning', 'anmarkning', 'kfm']::text[]),
      'skuldsaldo', to_jsonb(ARRAY['skuldsaldo', 'kfm', 'kronofogden']::text[]),
      'skuldsattningsgrad', to_jsonb(ARRAY['skuldsattningsgrad', 'skuld', 'eget kapital']::text[]),
      'addresses', to_jsonb(ARRAY['adress', 'besoksadress', 'postadress', 'kontakt', 'karta']::text[]),
      'adresser', to_jsonb(ARRAY['adress', 'besoksadress', 'lageradress', 'kontakt']::text[]),
      'decisionMakers', to_jsonb(ARRAY['ledning', 'styrelse', 'ceo', 'vd', 'kontaktperson', 'linkedin']::text[]),
      'beslutsfattare', to_jsonb(ARRAY['ledning', 'styrelse', 'vd', 'kontaktperson', 'linkedin']::text[]),
      'payment', to_jsonb(ARRAY['checkout', 'betalning', 'klarna', 'stripe', 'adyen', 'payment methods']::text[]),
      'betalning', to_jsonb(ARRAY['checkout', 'betalning', 'klarna', 'stripe', 'adyen', 'payment methods']::text[]),
      'checkout', to_jsonb(ARRAY['checkout', 'leverans', 'frakt', 'betalning']::text[]),
      'webSoftware', to_jsonb(ARRAY['platform', 'tech stack', 'shopify', 'woocommerce', 'norce', 'scripts']::text[]),
      'plattform', to_jsonb(ARRAY['platform', 'shopify', 'woocommerce', 'norce', 'centra', 'scripts']::text[]),
      'tasystem', to_jsonb(ARRAY['nshift', 'unifaun', 'centiro', 'ingrid', 'logtrade']::text[]),
      'news', to_jsonb(ARRAY['nyheter', 'pressmeddelande', 'expansion', 'forvarv', 'arende', 'arsredovisning', 'nyemission', 'registrerat']::text[])
    ),
    'batchEnrichmentLimit', 10,
    'matchingStrategy', 'strict',
    'minConfidenceThreshold', 0.65
  ) AS value
),
seed_row AS (
  INSERT INTO public.app_shared_settings (setting_key, value, updated_at)
  SELECT 'source_configuration', value, NOW()
  FROM default_policy
  ON CONFLICT (setting_key) DO NOTHING
  RETURNING 1
)
UPDATE public.app_shared_settings AS settings
SET value = (
  WITH defaults AS (
    SELECT value FROM default_policy
  ),
  existing_country_policies AS (
    SELECT CASE
      WHEN jsonb_typeof(settings.value->'countrySourcePolicies') = 'object' THEN settings.value->'countrySourcePolicies'
      ELSE '{}'::jsonb
    END AS value
  ),
  merged_country_policies AS (
    SELECT COALESCE(
      jsonb_object_agg(
        country_key,
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(country_value, '{trustedDomains}', COALESCE(country_value->'trustedDomains', defaults.value->'trustedDomains'), true),
                '{categoryPageHints}',
                COALESCE(defaults.value->'categoryPageHints', '{}'::jsonb) || COALESCE(country_value->'categoryPageHints', '{}'::jsonb),
                true
              ),
              '{batchEnrichmentLimit}', COALESCE(country_value->'batchEnrichmentLimit', defaults.value->'batchEnrichmentLimit'), true
            ),
            '{matchingStrategy}', COALESCE(country_value->'matchingStrategy', defaults.value->'matchingStrategy'), true
          ),
          '{minConfidenceThreshold}', COALESCE(country_value->'minConfidenceThreshold', defaults.value->'minConfidenceThreshold'), true
        )
      ),
      '{}'::jsonb
    ) AS value
    FROM existing_country_policies,
         defaults,
         jsonb_each(existing_country_policies.value) AS policies(country_key, country_value)
  )
  SELECT jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(settings.value, '{}'::jsonb),
            '{trustedDomains}',
            COALESCE(settings.value->'trustedDomains', defaults.value->'trustedDomains'),
            true
          ),
          '{categoryPageHints}',
          COALESCE(defaults.value->'categoryPageHints', '{}'::jsonb) || COALESCE(settings.value->'categoryPageHints', '{}'::jsonb),
          true
        ),
        '{batchEnrichmentLimit}',
        COALESCE(settings.value->'batchEnrichmentLimit', defaults.value->'batchEnrichmentLimit'),
        true
      ),
      '{matchingStrategy}',
      COALESCE(settings.value->'matchingStrategy', defaults.value->'matchingStrategy'),
      true
    ),
    '{minConfidenceThreshold}',
    COALESCE(settings.value->'minConfidenceThreshold', defaults.value->'minConfidenceThreshold'),
    true
  ) || jsonb_build_object(
    'countrySourcePolicies',
    CASE
      WHEN (SELECT value FROM merged_country_policies) = '{}'::jsonb THEN COALESCE(settings.value->'countrySourcePolicies', '{}'::jsonb)
      ELSE (SELECT value FROM merged_country_policies)
    END
  )
  FROM defaults
)
, updated_at = NOW()
WHERE settings.setting_key = 'source_configuration';