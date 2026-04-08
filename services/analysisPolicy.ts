import { AnalysisPolicy, SourcePolicyConfig } from '../types.js';

export const DEFAULT_ANALYSIS_TRUSTED_DOMAINS = [
  'allabolag.se',
  'kreditrapporten.se',
  'boolag.se',
  'ratsit.se',
  'bolagsverket.se',
  'ehandel.se',
  'market.se',
  'breakit.se'
];

export const DEFAULT_ANALYSIS_CATEGORY_PAGE_HINTS: Record<string, string[]> = {
  financial: ['bokslut', 'omsattning', 'resultat', 'soliditet', 'likviditet', 'annual report'],
  revenue: ['omsattning', 'nettoomsattning', 'bokslut'],
  omsattning: ['omsattning', 'nettoomsattning', 'bokslut'],
  profit: ['resultat', 'arets resultat', 'efter finansnetto'],
  resultat: ['resultat', 'arets resultat', 'efter finansnetto'],
  solidity: ['soliditet', 'bokslut', 'arsredovisning'],
  likviditet: ['likviditet', 'bokslut', 'arsredovisning'],
  riskstatus: ['anmarkning', 'kfm', 'skuldsaldo', 'skuldsattningsgrad', 'status', 'arende', 'arsredovisning', 'registrerat'],
  status: ['status', 'likvidation', 'konkurs', 'rekonstruktion', 'arende', 'registrerat'],
  betalningsanmarkning: ['betalningsanmarkning', 'anmarkning', 'kfm'],
  skuldsaldo: ['skuldsaldo', 'kfm', 'kronofogden'],
  skuldsattningsgrad: ['skuldsattningsgrad', 'skuld', 'eget kapital'],
  addresses: ['adress', 'besoksadress', 'postadress', 'kontakt', 'karta'],
  adresser: ['adress', 'besoksadress', 'lageradress', 'kontakt'],
  logistics: ['frakt', 'leverans', 'retur', 'lager', 'warehouse', 'distribution', 'logistikcenter'],
  decisionMakers: ['ledning', 'styrelse', 'ceo', 'vd', 'kontaktperson', 'linkedin'],
  beslutsfattare: ['ledning', 'styrelse', 'vd', 'kontaktperson', 'linkedin'],
  payment: ['checkout', 'betalning', 'klarna', 'stripe', 'adyen', 'payment methods'],
  betalning: ['checkout', 'betalning', 'klarna', 'stripe', 'adyen', 'payment methods'],
  checkout: ['checkout', 'leverans', 'frakt', 'betalning'],
  webSoftware: ['platform', 'tech stack', 'shopify', 'woocommerce', 'norce', 'scripts'],
  plattform: ['platform', 'shopify', 'woocommerce', 'norce', 'centra', 'scripts'],
  tasystem: ['nshift', 'unifaun', 'centiro', 'ingrid', 'logtrade'],
  news: ['nyheter', 'pressmeddelande', 'expansion', 'forvarv', 'arende', 'arsredovisning', 'nyemission', 'registrerat']
};

export const DEFAULT_BATCH_ENRICHMENT_LIMIT = 10;

const MARKET_ALIASES: Record<string, AnalysisPolicy['market']> = {
  global: 'GLOBAL',
  se: 'SE',
  sweden: 'SE',
  sverige: 'SE',
  uk: 'UK',
  gb: 'UK',
  unitedkingdom: 'UK',
  dach: 'DACH',
  de: 'DACH',
  germany: 'DACH',
  at: 'DACH',
  austria: 'DACH',
  ch: 'DACH',
  switzerland: 'DACH'
};

function normalizeScopeKey(value?: string): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
}

function inferMarket(scope?: string): AnalysisPolicy['market'] {
  const normalized = normalizeScopeKey(scope);
  return MARKET_ALIASES[normalized] || 'GLOBAL';
}

function resolveScopedSourcePolicies(sourcePolicies?: SourcePolicyConfig, activeScope?: string): SourcePolicyConfig | undefined {
  if (!sourcePolicies) return sourcePolicies;

  const normalizedScope = normalizeScopeKey(activeScope);
  const inferredMarket = inferMarket(activeScope);
  const countryOverrides = normalizedScope
    ? (
        sourcePolicies.countrySourcePolicies?.[normalizedScope]
        || sourcePolicies.countrySourcePolicies?.[String(activeScope || '')]
        || sourcePolicies.countrySourcePolicies?.[normalizedScope.toUpperCase()]
        || sourcePolicies.countrySourcePolicies?.[inferredMarket.toLowerCase()]
        || sourcePolicies.countrySourcePolicies?.[inferredMarket]
      )
    : undefined;

  if (!countryOverrides) {
    return sourcePolicies;
  }

  return {
    ...sourcePolicies,
    ...countryOverrides,
    trustedDomains: countryOverrides.trustedDomains?.length ? countryOverrides.trustedDomains : sourcePolicies.trustedDomains,
    categoryPageHints: {
      ...(sourcePolicies.categoryPageHints || {}),
      ...(countryOverrides.categoryPageHints || {})
    },
    customCategories: {
      ...(sourcePolicies.customCategories || {}),
      ...(countryOverrides.customCategories || {})
    },
    categoryFieldMappings: {
      ...(sourcePolicies.categoryFieldMappings || {}),
      ...(countryOverrides.categoryFieldMappings || {})
    }
  };
}

function normalizeDomains(domains: string[] | undefined, fallback: string[]): string[] {
  const values = Array.isArray(domains) && domains.length ? domains : fallback;
  return Array.from(new Set(values.map((domain) => String(domain || '').trim().toLowerCase()).filter(Boolean)));
}

function normalizeCategoryHints(input?: Record<string, string[]>): Record<string, string[]> {
  const merged = {
    ...DEFAULT_ANALYSIS_CATEGORY_PAGE_HINTS,
    ...(input || {})
  };

  return Object.fromEntries(
    Object.entries(merged).map(([category, hints]) => [
      category,
      Array.from(new Set((Array.isArray(hints) ? hints : []).map((hint) => String(hint || '').trim()).filter(Boolean)))
    ])
  );
}

type AnalysisPolicyMode = 'batch' | 'deep-dive';

function buildAnalysisPolicy(
  sourcePolicies?: SourcePolicyConfig,
  activeScope?: string,
  mode: AnalysisPolicyMode = 'deep-dive'
): AnalysisPolicy {
  const effectivePolicies = resolveScopedSourcePolicies(sourcePolicies, activeScope);
  const market = inferMarket(activeScope);
  const configuredMatchingStrategy = effectivePolicies?.matchingStrategy || (effectivePolicies?.strictCompanyMatch === false ? 'relaxed' : 'strict');
  const matchingStrategy = mode === 'batch'
    ? (configuredMatchingStrategy === 'strict' ? 'balanced' : configuredMatchingStrategy)
    : configuredMatchingStrategy;
  const earliestNewsYear = Math.max(2000, Number(effectivePolicies?.earliestNewsYear || (new Date().getFullYear() - 1)));

  return {
    id: `shared-${market.toLowerCase()}-${mode}-policy`,
    version: 1,
    name: `Shared ${market} ${mode === 'batch' ? 'Batch' : 'Deep Dive'} Analysis Policy`,
    market,
    enabled: true,
    matching: {
      strategy: matchingStrategy,
      minConfidenceThreshold: Number(effectivePolicies?.minConfidenceThreshold ?? (mode === 'batch' ? 0.5 : 0.65)),
      allowFuzzyWithoutOrgNumber: matchingStrategy !== 'strict',
      rejectConflictingEntities: mode === 'batch' ? matchingStrategy === 'strict' : true
    },
    sources: {
      trustedDomains: normalizeDomains(effectivePolicies?.trustedDomains, DEFAULT_ANALYSIS_TRUSTED_DOMAINS),
      categoryPageHints: normalizeCategoryHints(effectivePolicies?.categoryPageHints),
      weighting: {
        registry: 1,
        officialSite: 0.8,
        industryMedia: 0.5,
        generalWeb: 0.2
      },
      categories: {
        financial: normalizeDomains(effectivePolicies?.financial, ['allabolag.se', 'ratsit.se', 'kreditrapporten.se', 'boolag.se', 'bolagsverket.se']),
        addresses: normalizeDomains(effectivePolicies?.addresses, ['hitta.se', 'eniro.se', 'allabolag.se', 'bolagsverket.se']),
        decisionMakers: normalizeDomains(effectivePolicies?.decisionMakers, ['linkedin.com', 'allabolag.se', 'ratsit.se']),
        payment: normalizeDomains(effectivePolicies?.payment, ['klarna.com', 'stripe.com', 'adyen.com']),
        webSoftware: normalizeDomains(effectivePolicies?.webSoftware, ['shopify.com', 'woocommerce.com', 'norce.io', 'centra.com']),
        news: normalizeDomains(effectivePolicies?.news, ['ehandel.se', 'market.se', 'breakit.se', 'bolagsverket.se'])
      }
    },
    news: {
      recentWindowMonths: 12,
      historicalWindowMonths: 36,
      earliestNewsYear,
      requireVerifiedRecentForPrimarySummary: mode !== 'batch'
    },
    batch: {
      maxEnrichmentLimit: Math.max(1, Number(effectivePolicies?.batchEnrichmentLimit || DEFAULT_BATCH_ENRICHMENT_LIMIT)),
      discoverySampleRate: 1,
      prioritizationWeights: {
        revenue: 1,
        techSignal: 1,
        newsSignal: 1,
        icpMatch: 1,
        contactSignal: 0.5
      }
    },
    fallbacks: {
      allowEstimatedFinancials: true,
      allowHistoricalNewsFallback: true,
      allowJobPostingTechInference: true,
      allowGeneralWebForContacts: mode === 'batch'
    }
  };
}

export function buildAnalysisPolicyFromSourcePolicyConfig(
  sourcePolicies?: SourcePolicyConfig,
  activeScope?: string
): AnalysisPolicy {
  return buildAnalysisPolicy(sourcePolicies, activeScope, 'deep-dive');
}

export function buildBatchAnalysisPolicyFromSourcePolicyConfig(
  sourcePolicies?: SourcePolicyConfig,
  activeScope?: string
): AnalysisPolicy {
  return buildAnalysisPolicy(sourcePolicies, activeScope, 'batch');
}

export function buildDeepDiveAnalysisPolicyFromSourcePolicyConfig(
  sourcePolicies?: SourcePolicyConfig,
  activeScope?: string
): AnalysisPolicy {
  return buildAnalysisPolicy(sourcePolicies, activeScope, 'deep-dive');
}
