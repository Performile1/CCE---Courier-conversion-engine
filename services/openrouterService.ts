import axiosBase from 'axios';
import { supabase } from './supabaseClient.js';
import {
  repairJson, parseJsonSafely, parseRevenueToTKR, parseRevenueToTKROptional,
  pickString, pickNumber, normalizeDomain, normalizeCompanyForComparison,
  buildCompanyAliases, normalizeOrgNumber, extractOrgNumberFromText,
  isLikelyGenericPersonName, isConflictingCompanyVariant, looksLikeCompanyNewsText,
  parseResultDate, parseLikelyPublishedDate, formatTkr, parseLooseNumber,
  parseAmountToTkr, escapeRegExp, parseLabeledMetricText, parseLabeledFreeText,
  normalizeAddressCandidate, parseFinancialHistoryFromEvidence, deriveProfitMargin,
  deriveFinancialTrend, deriveRiskProfileFromMetrics, detectStructuredLabels,
  normalizeDecisionMakerName, normalizeDecisionMakerTitle, scoreDecisionMaker,
  dedupeDecisionMakers, MARKET_LABELS, parseStoreCount, extractMarketLabels,
  normalizeFinancialHistoryEntries, findPatternMatch, extractEvidenceSnippet,
  containsAnyKeyword, extractEmailsFromText, extractPhoneNumbersFromText,
  normalizeRoleToken, roleMatchesFocus, parseLabeledTkrValue, parseLabeledAddress,
  inferEmailPattern, dedupeMessages
} from './openrouter/parseUtils.js';
import {
  TechSolutionPattern,
  FINANCIAL_SOURCE_DOMAINS, ADDRESS_SOURCE_DOMAINS, CONTACT_SOURCE_DOMAINS,
  PAYMENT_SOURCE_DOMAINS, WEBSOFTWARE_SOURCE_DOMAINS, DEFAULT_TRUSTED_DOMAINS,
  DEFAULT_CATEGORY_PAGE_HINTS, STEP_DEFAULT_PROVIDER, STEP_AFFECTED_FIELDS,
  STEP_LABELS, mapProviderToDiagnosticEngine, classifyDiagnosticSourceType,
  buildAnalysisStepDiagnostics, buildAnalysisStepFieldCoverage, hydrateAnalysisStep,
  upsertAnalysisStep, countEvidence, createStructuredProcessingError, getErrorMessage,
  getProcessingErrorCode, determineAnalysisCompleteness, getEffectiveTechSolutionConfig,
  getTechPatterns, getTechKeywords, roundCoverageScore, classifyCoverageWeight,
  getSourceCoverageExtractionMethod, buildSourceCoverageEntry
} from './openrouter/stepUtils.js';
import { SYSTEM_INSTRUCTION } from "../prompts/systemInstructions.js";
import { MASTER_DEEP_SCAN_PROMPT } from "../prompts/deepAnalysis.js";
import { BATCH_PROSPECTING_INSTRUCTION } from "../prompts/batchProspecting.js";
import { calculateRickardMetrics, determineSegmentByPotential } from "../utils/calculations.js";
import { SearchFormData, LeadData, SNIPercentage, ThreePLProvider, NewsSourceMapping, DecisionMaker, SourcePolicyConfig, SourceCoverageEntry, SourcePerformanceEntry, DataConfidence, FinancialYear, VerifiedRegistrySnapshot, VerifiedFieldEvidence, VerifiedLeadField, NewsItem, TechDetections, Segment, TechSolutionCategory, TechSolutionConfig, AnalysisPolicy, AnalysisStep, AnalysisStepName, AnalysisErrorCode, AnalysisStepProvider, CarrierSettings, SourceCoverageExtractionMethod, AnalysisDiagnosticEngine, AnalysisDiagnosticSourceType, BatchLeadFilterDiagnostics } from "../types.js";
import { buildAnalysisPolicyFromSourcePolicyConfig, buildBatchAnalysisPolicyFromSourcePolicyConfig, DEFAULT_ANALYSIS_CATEGORY_PAGE_HINTS, DEFAULT_ANALYSIS_TRUSTED_DOMAINS, DEFAULT_BATCH_ENRICHMENT_LIMIT } from './analysisPolicy.js';
import { DEFAULT_TECH_SOLUTION_CONFIG, getTechSolutionsByCategory, normalizeTechSolutionConfig, TECH_SOLUTION_CATEGORY_LABELS } from './techSolutionConfig.js';
import { selectPricingProductForLead } from './pricingService.js';

/**
 * Returns the current auth bearer token.
 * - Browser context: Supabase session access_token
 * - Server context (cron-runner): CRON_SECRET env var (shared server secret)
 */
async function getAuthToken(): Promise<string> {
  if (typeof window === 'undefined') {
    return process.env.CRON_SECRET || '';
  }
  try {
    const { data } = await (supabase as any).auth.getSession();
    return (data as any).session?.access_token || '';
  } catch {
    return '';
  }
}

/** Custom axios instance — automatically injects Authorization header for /api/ calls */
const axios = axiosBase.create();
axios.interceptors.request.use(async (config) => {
  if (config.url && /\/api\/(openrouter|tavily|crawl)/.test(config.url)) {
    const token = await getAuthToken();
    if (token) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * OPENROUTER SERVICE - Cost-Aware Model Selection Engine
 * Replaces Google Gemini with OpenRouter for better hallucination control
 */

export type ModelName =
  | 'llama-3.1-70b'
  | 'deepseek-chat-v3-0324'
  | 'qwen-3.6-plus-free'
  | 'google-gemini-free'
  | 'gemini-3-flash-preview'
  | 'claude-3.7-sonnet'
  | 'deepseek-r1'
  | 'grok-4.20'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'mistral-7b';

const MODEL_CONFIG: Record<ModelName, { displayName: string; costPer1kTokens: number; maxTokens: number }> = {
  'llama-3.1-70b': { displayName: 'Llama 3.1 70B (Fast)', costPer1kTokens: 0.0007, maxTokens: 8000 },
  'deepseek-chat-v3-0324': { displayName: 'DeepSeek V3 0324 (Balanced)', costPer1kTokens: 0.0006, maxTokens: 8192 },
  'qwen-3.6-plus-free': { displayName: 'Qwen 3.6 Plus Free (Workhorse)', costPer1kTokens: 0, maxTokens: 8192 },
  'google-gemini-free': { displayName: 'Gemini 2.0 Flash (Budget)', costPer1kTokens: 0.0001, maxTokens: 2000 },
  'gemini-3-flash-preview': { displayName: 'Gemini 3 Flash Preview (Modern Google)', costPer1kTokens: 0.0017, maxTokens: 8192 },
  'claude-3.7-sonnet': { displayName: 'Claude 3.7 Sonnet (Premium)', costPer1kTokens: 0.009, maxTokens: 8192 },
  'deepseek-r1': { displayName: 'DeepSeek R1 (Reasoning)', costPer1kTokens: 0.0016, maxTokens: 8192 },
  'grok-4.20': { displayName: 'Grok 4.20 (2M Context)', costPer1kTokens: 0.0039, maxTokens: 8192 },
  'gpt-4-turbo': { displayName: 'GPT-4 Turbo (Most Reliable)', costPer1kTokens: 0.01, maxTokens: 4096 },
  'gpt-3.5-turbo': { displayName: 'GPT-3.5 Turbo (Budget)', costPer1kTokens: 0.0005, maxTokens: 4096 },
  'mistral-7b': { displayName: 'Mistral 7B (Fast)', costPer1kTokens: 0.0002, maxTokens: 8000 }
};

let selectedModel: ModelName = 'llama-3.1-70b';
let totalCostAccumulated = 0;

export function setSelectedModel(model: ModelName): void {
  if (MODEL_CONFIG[model]) {
    selectedModel = model;
  }
}

export function getSelectedModel(): ModelName {
  return selectedModel;
}

export function getCostTracker(): { model: ModelName; totalCost: number; costPerModel: Record<ModelName, number> } {
  return {
    model: selectedModel,
    totalCost: totalCostAccumulated,
    costPerModel: {
      'llama-3.1-70b': 0,
      'deepseek-chat-v3-0324': 0,
      'qwen-3.6-plus-free': 0,
      'google-gemini-free': 0,
      'gemini-3-flash-preview': 0,
      'claude-3.7-sonnet': 0,
      'deepseek-r1': 0,
      'grok-4.20': 0,
      'gpt-4-turbo': 0,
      'gpt-3.5-turbo': 0,
      'mistral-7b': 0
    }
  };
}

export function resetCostTracker(): void {
  totalCostAccumulated = 0;
}

const MIN_INTERVAL = 300; // Keep fast by default; rely on adaptive backoff on 429
let lastCallTime = 0;
function buildFailedBatchLead(rawLead: any, activeModel: ModelName, errorCode: AnalysisErrorCode, errorMessage: string): LeadData | null {
  const companyName = pickString(rawLead?.companyName, rawLead?.company_name, rawLead?.name);
  const orgNumber = pickString(rawLead?.orgNumber, rawLead?.org_number, rawLead?.organizationNumber);

  if (!companyName && !orgNumber) {
    return null;
  }

  const summary = errorCode === 'parse_failed'
    ? 'Leadet kunde inte materialiseras eftersom modelldata inte gick att tolka.'
    : 'Leadet kunde inte materialiseras eftersom kandidatdatan inte matchade förväntat schema.';
  const capturedAt = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    companyName: companyName || orgNumber,
    orgNumber: orgNumber || '',
    websiteUrl: '',
    address: '',
    segment: Segment.UNKNOWN,
    revenue: '',
    freightBudget: '',
    legalStatus: '',
    creditRatingLabel: '',
    carriers: '',
    decisionMakers: [],
    source: 'ai',
    aiModel: activeModel,
    halluccinationScore: 0,
    hallucinationScore: 0,
    processingStatus: 'failed',
    processingErrorCode: errorCode,
    processingErrorMessage: errorMessage,
    analysisWarnings: [errorMessage],
    analysisTelemetry: ['Leadet markerades som failed i batchmaterialisering i stället för att tyst filtreras bort.'],
    analysisCompleteness: 'thin',
    analysisSteps: [hydrateAnalysisStep({
      step: 'identity',
      status: 'failed',
      provider: STEP_DEFAULT_PROVIDER.identity,
      label: STEP_LABELS.identity,
      errorCode,
      startedAt: capturedAt,
      completedAt: capturedAt,
      durationMs: 0,
      evidenceCount: countEvidence(companyName, orgNumber),
      confidence: 0,
      sourceDomains: [],
      sourceUrls: [],
      affectedFields: [],
      summary
    })]
  } as LeadData;
}

function normalizeLatestFinancialHistory(history: FinancialYear[]): FinancialYear[] {
  return [...(Array.isArray(history) ? history : [])]
    .filter((entry) => /^20\d{2}$/.test(String(entry?.year || '').trim()))
    .sort((a, b) => Number(b.year) - Number(a.year))
    .slice(0, 3);
}

function buildBatchExclusionSets(exclusionList: string[]): { orgNumbers: Set<string>; companyNames: Set<string> } {
  const orgNumbers = new Set<string>();
  const companyNames = new Set<string>();

  for (const entry of exclusionList || []) {
    const value = String(entry || '').trim();
    if (!value) continue;

    const normalizedOrg = normalizeOrgNumber(value);
    if (normalizedOrg.length >= 10) {
      orgNumbers.add(normalizedOrg);
    }

    const normalizedName = normalizeCompanyForComparison(value);
    if (normalizedName) {
      companyNames.add(normalizedName);
      for (const alias of buildCompanyAliases(value)) {
        const aliasName = normalizeCompanyForComparison(alias);
        if (aliasName) companyNames.add(aliasName);
      }
    }
  }

  return { orgNumbers, companyNames };
}

function isRawBatchLeadExcluded(rawLead: any, exclusionSets: { orgNumbers: Set<string>; companyNames: Set<string> }): boolean {
  const orgNumber = normalizeOrgNumber(pickString(rawLead?.orgNumber, rawLead?.org_number, rawLead?.organizationNumber));
  if (orgNumber && exclusionSets.orgNumbers.has(orgNumber)) {
    return true;
  }

  const rawCompanyName = pickString(rawLead?.companyName, rawLead?.company_name, rawLead?.name);
  if (!rawCompanyName) {
    return false;
  }

  const candidates = new Set<string>();
  candidates.add(normalizeCompanyForComparison(rawCompanyName));
  for (const alias of buildCompanyAliases(rawCompanyName)) {
    candidates.add(normalizeCompanyForComparison(alias));
  }

  for (const normalizedCandidate of candidates) {
    if (normalizedCandidate && exclusionSets.companyNames.has(normalizedCandidate)) {
      return true;
    }
  }

  return false;
}

function buildDeepDivePreferredDomains(
  newsSourceMappings: NewsSourceMapping[],
  effectivePolicies: SourcePolicyConfig,
  effectiveAnalysisPolicy: AnalysisPolicy
): string[] {
  const customDomains = Object.values(effectivePolicies.customCategories || {}).flat();
  return Array.from(new Set([
    ...getPreferredDomains(newsSourceMappings, effectivePolicies, effectiveAnalysisPolicy),
    ...effectivePolicies.news,
    ...effectivePolicies.financial,
    ...effectivePolicies.addresses,
    ...effectivePolicies.decisionMakers,
    ...effectivePolicies.payment,
    ...effectivePolicies.webSoftware,
    ...customDomains
  ].map(normalizeDomain).filter(Boolean)));
}

async function resolveAnalysisIdentity(
  companyNameOrOrg: string,
  preferredDomains: string[],
  effectiveAnalysisPolicy: AnalysisPolicy
): Promise<{
  strictCompanyMatchEnabled: boolean;
  resolvedIdentity: { canonicalName: string; orgNumber: string; aliases: string[] };
  strictCompanyName: string;
  strictOrgNumber: string;
  identityLabel: string;
  searchQuery: string;
  stepStatus: AnalysisStep['status'];
  stepSummary: string;
  stepData: Partial<AnalysisStep>;
}> {
  const identityStartedAt = Date.now();
  const strictCompanyMatchEnabled = effectiveAnalysisPolicy.matching.strategy !== 'relaxed';
  const resolvedIdentity = strictCompanyMatchEnabled
    ? await resolveCompanyIdentity(companyNameOrOrg, preferredDomains)
    : {
        canonicalName: companyNameOrOrg,
        orgNumber: extractOrgNumberFromText(companyNameOrOrg),
        aliases: buildCompanyAliases(companyNameOrOrg)
      };
  const strictCompanyName = resolvedIdentity.canonicalName || companyNameOrOrg;
  const strictOrgNumber = resolvedIdentity.orgNumber || extractOrgNumberFromText(companyNameOrOrg);
  const identityLabel = strictOrgNumber ? `${strictCompanyName} (${strictOrgNumber})` : strictCompanyName;

  return {
    strictCompanyMatchEnabled,
    resolvedIdentity,
    strictCompanyName,
    strictOrgNumber,
    identityLabel,
    searchQuery: `${identityLabel} (${preferredDomains.join(', ')}, LinkedIn)`,
    stepStatus: strictCompanyMatchEnabled ? 'success' : 'fallback_used',
    stepSummary: strictCompanyMatchEnabled ? 'Bolagsidentitet matchad.' : 'Relaxed matching användes för bolagsidentitet.',
    stepData: {
      durationMs: Date.now() - identityStartedAt,
      evidenceCount: countEvidence(resolvedIdentity.orgNumber, resolvedIdentity.aliases),
      confidence: strictCompanyMatchEnabled ? 0.9 : 0.6,
      sourceDomains: preferredDomains.slice(0, 5),
      sourceUrls: []
    }
  };
}

async function fetchSourceGroundingBundle(
  identityLabel: string,
  effectivePolicies: SourcePolicyConfig,
  effectiveAnalysisPolicy: AnalysisPolicy
): Promise<{
  sourceBundle: Awaited<ReturnType<typeof fetchCategoryExactPageEvidenceBundle>>;
  sourceGroundingEvidence: string;
  stepStatus: AnalysisStep['status'];
  stepSummary: string;
  stepData: Partial<AnalysisStep>;
}> {
  const sourceGroundingStartedAt = Date.now();
  const sourceBundle = await fetchCategoryExactPageEvidenceBundle(identityLabel, effectivePolicies, effectiveAnalysisPolicy);
  const sourceGroundingEvidence = sourceBundle.promptEvidence;

  return {
    sourceBundle,
    sourceGroundingEvidence,
    stepStatus: sourceGroundingEvidence ? 'success' : 'partial',
    stepSummary: sourceGroundingEvidence ? 'Source grounding hämtades.' : 'Source grounding gav begränsat underlag.',
    stepData: {
      durationMs: Date.now() - sourceGroundingStartedAt,
      evidenceCount: countEvidence(sourceBundle.coverage, sourceBundle.domainHits),
      confidence: sourceGroundingEvidence ? 0.85 : 0.4,
      sourceDomains: Object.keys(sourceBundle.domainHits || {}),
      sourceUrls: (sourceBundle.coverage || []).map((entry) => entry.url || '').filter(Boolean)
    }
  };
}

async function fetchVerifiedFinancialBundle(
  strictOrgNumber: string,
  strictCompanyName: string
): Promise<{
  financialEvidence: VerifiedFinancialEvidence;
  stepStatus: AnalysisStep['status'];
  stepSummary: string;
  stepData: Partial<AnalysisStep>;
  telemetryMessage: string;
}> {
  const financialStartedAt = Date.now();
  const financialEvidence = await fetchVerifiedFinancials(strictOrgNumber, strictCompanyName);

  return {
    financialEvidence,
    stepStatus: financialEvidence.confidence === 'verified' ? 'success' : 'partial',
    stepSummary: financialEvidence.confidence === 'verified'
      ? 'Verifierad finansiell registerdata hämtad.'
      : 'Finansiell registerdata kunde inte verifieras fullt ut.',
    stepData: {
      durationMs: Date.now() - financialStartedAt,
      evidenceCount: countEvidence(financialEvidence.parsed),
      confidence: financialEvidence.confidence === 'verified' ? 1 : 0.35,
      sourceDomains: financialEvidence.sourceUrl ? [normalizeDomain(financialEvidence.sourceUrl)] : [],
      sourceUrls: financialEvidence.sourceUrl ? [financialEvidence.sourceUrl] : [],
      errorCode: financialEvidence.confidence === 'verified' ? undefined : 'registry_unavailable'
    },
    telemetryMessage: financialEvidence.confidence === 'verified'
      ? 'Finansiell registerdata verifierad.'
      : 'Finansiell registerdata saknas eller kunde inte verifieras.'
  };
}

async function fetchCommercialSignalsBundle(
  companyName: string,
  domain: string,
  activeCarrier: string,
  techSolutionConfig: TechSolutionConfig | undefined,
  analysisPolicy: AnalysisPolicy | undefined,
  sourceGroundingEvidence: string,
  financialEvidenceText: string
): Promise<{
  checkoutCrawlResult: CheckoutEvidence;
  paymentEvidence: VerifiedPaymentEvidence;
  techProfile: StructuredTechProfile;
  retailEvidence: RetailFootprintEvidence;
  detectedEmailPattern: string;
  telemetryMessages: string[];
  logisticsStep: { status: AnalysisStep['status']; summary: string; data: Partial<AnalysisStep> };
  checkoutStep: { status: AnalysisStep['status']; summary: string; data: Partial<AnalysisStep> };
  paymentStep: { status: AnalysisStep['status']; summary: string; data: Partial<AnalysisStep> };
  techStep: { status: AnalysisStep['status']; summary: string; data: Partial<AnalysisStep> };
}> {
  const commercialSignalsStartedAt = Date.now();
  const [checkoutCrawlResult, paymentEvidence, techProfile, retailFootprint, detectedEmailPattern] = await Promise.all([
    fetchCheckoutPositions(domain, activeCarrier, techSolutionConfig),
    fetchVerifiedPaymentSetup(domain, techSolutionConfig),
    fetchStructuredTechProfile(domain, techSolutionConfig),
    fetchRetailFootprint(domain),
    detectEmailPattern(domain, `${sourceGroundingEvidence || ''} ${financialEvidenceText || ''}`.trim())
  ]);

  const retailFallback = (!retailFootprint.storeCount && !retailFootprint.activeMarkets.length && !retailFootprint.visitingAddress && !retailFootprint.warehouseAddress && analysisPolicy?.matching?.strategy !== 'strict')
    ? await fetchRetailFallbackSignals(companyName, domain, analysisPolicy)
    : null;
  const checkoutFallbackUsed = !checkoutCrawlResult.positions.length
    && analysisPolicy?.matching?.strategy !== 'strict'
    && Boolean(
      paymentEvidence.paymentProvider
      || paymentEvidence.checkoutSolution
      || techProfile.paymentProviders.length
      || techProfile.checkoutSolutions.length
    );
  const checkoutFallbackUrl = paymentEvidence.sourceUrl || techProfile.sourceUrl;
  const retailEvidence = retailFallback && retailFallback.fallbackUsed
    ? {
        ...retailFootprint,
        ...retailFallback,
        activeMarkets: retailFallback.activeMarkets.length ? retailFallback.activeMarkets : retailFootprint.activeMarkets,
        confidence: retailFallback.confidence,
        failureContext: retailFallback.failureContext || retailFootprint.failureContext
      }
    : retailFootprint;

  return {
    checkoutCrawlResult,
    paymentEvidence,
    techProfile,
    retailEvidence,
    detectedEmailPattern,
    telemetryMessages: [
      retailEvidence.storeCount || retailEvidence.activeMarkets.length || retailEvidence.visitingAddress || retailEvidence.warehouseAddress
        ? (retailEvidence.fallbackUsed ? 'Logistiksignal kompletterades via relaxed fallback-sökning.' : 'Logistiksignal verifierad via officiell crawl.')
        : 'Logistikcrawl gav inga verifierade lager-, butiks- eller adressignaler.',
      checkoutCrawlResult.positions.length
        ? `Checkout crawl verifierade ${checkoutCrawlResult.positions.length} checkout-positioner.`
        : checkoutFallbackUsed
          ? 'Checkoutsignal räddades via script/head-detektion trots missad varukorgscrawl.'
        : 'Checkout crawl gav inga verifierade checkout-positioner.',
      paymentEvidence.paymentProvider || paymentEvidence.checkoutSolution
        ? 'Payment-detection hittade verifierad betalsetup.'
        : 'Payment-detection hittade ingen verifierad betalsetup.',
      techProfile.platforms.length || techProfile.taSystems.length || techProfile.paymentProviders.length || techProfile.checkoutSolutions.length
        ? 'Tech-profil verifierad via crawl.'
        : 'Tech-profil gav inga verifierade träffar.',
      detectedEmailPattern
        ? 'E-postmönster identifierat.'
        : 'E-postmönster kunde inte identifieras.'
    ],
    logisticsStep: {
      status: retailEvidence.storeCount || retailEvidence.activeMarkets.length || retailEvidence.visitingAddress || retailEvidence.warehouseAddress
        ? (retailEvidence.fallbackUsed ? 'fallback_used' : 'success')
        : 'partial',
      summary: retailEvidence.storeCount || retailEvidence.activeMarkets.length || retailEvidence.visitingAddress || retailEvidence.warehouseAddress
        ? (retailEvidence.fallbackUsed ? 'Logistiksignal räddades via relaxed fallback.' : 'Logistiksignal verifierad via officiell crawl.')
        : 'Logistikcrawl gav inga verifierade lager-, butiks- eller adressignaler.',
      data: {
        durationMs: Date.now() - commercialSignalsStartedAt,
        evidenceCount: countEvidence(retailEvidence.storeCount, retailEvidence.activeMarkets, retailEvidence.visitingAddress, retailEvidence.warehouseAddress),
        confidence: retailEvidence.confidence === 'verified' ? 0.8 : retailEvidence.confidence === 'estimated' ? 0.45 : 0.2,
        sourceDomains: retailEvidence.sourceUrl ? [normalizeDomain(retailEvidence.sourceUrl)] : [],
        sourceUrls: retailEvidence.sourceUrl ? [retailEvidence.sourceUrl] : [],
        errorCode: retailEvidence.failureContext ? 'no_source_hits' : undefined,
        diagnostics: retailEvidence.failureContext
          ? {
              engine: retailEvidence.fallbackUsed ? 'llm_inference' : 'crawl',
              durationMs: Date.now() - commercialSignalsStartedAt,
              sources: retailEvidence.sourceUrl ? [{ url: retailEvidence.sourceUrl, weight: retailEvidence.confidence === 'verified' ? 0.8 : 0.45, type: retailEvidence.fallbackUsed ? 'secondary' : 'primary' }] : [],
              errorContext: {
                code: retailEvidence.failureContext.code,
                message: retailEvidence.failureContext.message
              }
            }
          : undefined
      }
    },
    checkoutStep: {
      status: checkoutCrawlResult.positions.length ? 'success' : checkoutFallbackUsed ? 'fallback_used' : 'partial',
      summary: checkoutCrawlResult.positions.length
        ? 'Checkout crawl verifierade checkout-positioner.'
        : checkoutFallbackUsed
          ? 'Checkoutsignal räddades via script/head-detektion trots missad varukorgscrawl.'
          : 'Checkout crawl gav inga verifierade checkout-positioner.',
      data: {
        durationMs: Date.now() - commercialSignalsStartedAt,
        evidenceCount: checkoutCrawlResult.positions.length || (checkoutFallbackUsed ? countEvidence(paymentEvidence.paymentProvider, paymentEvidence.checkoutSolution, techProfile.paymentProviders, techProfile.checkoutSolutions) : 0),
        confidence: checkoutCrawlResult.positions.length ? 0.9 : checkoutFallbackUsed ? 0.45 : 0.25,
        sourceDomains: checkoutCrawlResult.sourceUrl
          ? [normalizeDomain(checkoutCrawlResult.sourceUrl)]
          : (checkoutFallbackUrl ? [normalizeDomain(checkoutFallbackUrl)] : []),
        sourceUrls: checkoutCrawlResult.sourceUrl
          ? [checkoutCrawlResult.sourceUrl]
          : (checkoutFallbackUrl ? [checkoutFallbackUrl] : []),
        errorCode: checkoutCrawlResult.failureContext ? 'timeout' : (checkoutFallbackUsed ? 'crawl_blocked' : undefined),
        fallbackFromStep: checkoutFallbackUsed ? 'payment' : undefined,
        diagnostics: checkoutCrawlResult.failureContext
          ? {
              engine: checkoutFallbackUsed ? 'llm_inference' : 'crawl',
              durationMs: Date.now() - commercialSignalsStartedAt,
              sources: [
                ...(checkoutCrawlResult.sourceUrl ? [{ url: checkoutCrawlResult.sourceUrl, weight: 0.8, type: 'primary' as const }] : []),
                ...(checkoutFallbackUsed && checkoutFallbackUrl ? [{ url: checkoutFallbackUrl, weight: 0.45, type: 'secondary' as const }] : [])
              ],
              errorContext: {
                code: checkoutCrawlResult.failureContext.code,
                message: checkoutFallbackUsed
                  ? `${checkoutCrawlResult.failureContext.message} Fallback använde script/head-signaler från payment/tech.`
                  : checkoutCrawlResult.failureContext.message
              }
            }
          : checkoutFallbackUsed
            ? {
                engine: 'llm_inference',
                durationMs: Date.now() - commercialSignalsStartedAt,
                sources: checkoutFallbackUrl ? [{ url: checkoutFallbackUrl, weight: 0.45, type: 'secondary' }] : [],
                errorContext: {
                  code: 'CHECKOUT_FALLBACK_SCRIPT_DETECTION',
                  message: `Varukorgscrawl gav inga positioner. Fallback använde policyhints för checkout och script/head-detektion från ${normalizeDomain(checkoutFallbackUrl || domain)}.`
                }
              }
            : undefined
      }
    },
    paymentStep: {
      status: paymentEvidence.paymentProvider || paymentEvidence.checkoutSolution ? 'success' : 'partial',
      summary: paymentEvidence.paymentProvider || paymentEvidence.checkoutSolution ? 'Payment-detection hittade verifierad betalsetup.' : 'Payment-detection hittade ingen verifierad betalsetup.',
      data: {
        durationMs: Date.now() - commercialSignalsStartedAt,
        evidenceCount: countEvidence(paymentEvidence.paymentProvider, paymentEvidence.checkoutSolution),
        confidence: paymentEvidence.paymentProvider || paymentEvidence.checkoutSolution ? 0.85 : 0.25,
        sourceDomains: paymentEvidence.sourceUrl ? [normalizeDomain(paymentEvidence.sourceUrl)] : [],
        sourceUrls: paymentEvidence.sourceUrl ? [paymentEvidence.sourceUrl] : [],
        diagnostics: paymentEvidence.failureContext
          ? {
              engine: 'crawl',
              durationMs: Date.now() - commercialSignalsStartedAt,
              sources: paymentEvidence.sourceUrl ? [{ url: paymentEvidence.sourceUrl, weight: 0.8, type: 'primary' }] : [],
              errorContext: {
                code: paymentEvidence.failureContext.code,
                message: paymentEvidence.failureContext.message
              }
            }
          : undefined
      }
    },
    techStep: {
      status: techProfile.platforms.length || techProfile.taSystems.length || techProfile.paymentProviders.length || techProfile.checkoutSolutions.length ? 'success' : 'partial',
      summary: techProfile.platforms.length || techProfile.taSystems.length || techProfile.paymentProviders.length || techProfile.checkoutSolutions.length ? 'Tech-profil verifierad via crawl.' : 'Tech-profil gav inga verifierade träffar.',
      data: {
        durationMs: Date.now() - commercialSignalsStartedAt,
        evidenceCount: countEvidence(techProfile.platforms, techProfile.taSystems, techProfile.paymentProviders, techProfile.checkoutSolutions),
        confidence: techProfile.platforms.length || techProfile.taSystems.length || techProfile.paymentProviders.length || techProfile.checkoutSolutions.length ? 0.8 : 0.2,
        sourceDomains: techProfile.sourceUrl ? [normalizeDomain(techProfile.sourceUrl)] : [],
        sourceUrls: techProfile.sourceUrl ? [techProfile.sourceUrl] : [],
        diagnostics: techProfile.failureContext
          ? {
              engine: 'crawl',
              durationMs: Date.now() - commercialSignalsStartedAt,
              sources: techProfile.sourceUrl ? [{ url: techProfile.sourceUrl, weight: 0.8, type: 'primary' }] : [],
              errorContext: {
                code: techProfile.failureContext.code,
                message: techProfile.failureContext.message
              }
            }
          : undefined
      }
    }
  };
}

async function fetchVerifiedContactsBundle(
  companyName: string,
  orgNumber: string,
  focusRoles: string[],
  preferredDomains: string[],
  domain: string
): Promise<{
  contacts: Array<{ name: string; title: string; email: string; linkedin: string; directPhone: string; verificationNote: string }>;
  confidence: 'verified' | 'estimated' | 'missing';
  stepStatus: AnalysisStep['status'];
  stepSummary: string;
  stepData: Partial<AnalysisStep>;
  telemetryMessage: string;
}> {
  const contactsStartedAt = Date.now();
  const result = await fetchDecisionMakersTargeted(companyName, orgNumber, focusRoles, preferredDomains, domain);

  return {
    contacts: result.contacts,
    confidence: result.confidence,
    stepStatus: result.contacts.length ? 'success' : 'partial',
    stepSummary: result.contacts.length ? 'Beslutsfattare kompletterades.' : 'Beslutsfattarsökning gav inga extra kontakter.',
    stepData: {
      durationMs: Date.now() - contactsStartedAt,
      evidenceCount: result.contacts.length,
      confidence: result.contacts.length ? 0.8 : 0.25,
      sourceDomains: preferredDomains.slice(0, 5),
      sourceUrls: result.contacts.map((contact) => contact.linkedin).filter(Boolean)
    },
    telemetryMessage: result.contacts.length
      ? `Beslutsfattarsökning kompletterade med ${result.contacts.length} kontakter.`
      : 'Beslutsfattarsökning gav inga extra kontakter.'
  };
}

async function fetchVerifiedNewsBundle(
  companyName: string,
  preferredDomains: string[],
  options: {
    orgNumber?: string;
    contactNames?: string[];
    strictCompanyMatch: boolean;
    earliestNewsYear?: number;
    analysisPolicy?: AnalysisPolicy;
    sourcePolicies?: SourcePolicyConfig;
  }
): Promise<{
  verifiedNews: VerifiedNewsEvidence;
  stepStatus: AnalysisStep['status'];
  stepSummary: string;
  stepData: Partial<AnalysisStep>;
  telemetryMessage: string;
}> {
  const verifiedNews = await fetchLatestNews(companyName, preferredDomains, options);

  return {
    verifiedNews,
    stepStatus: verifiedNews.summary ? 'success' : 'partial',
    stepSummary: verifiedNews.summary ? 'Nyhetssökning hittade verifierade nyheter.' : 'Nyhetssökning gav inga verifierade nyheter.',
    stepData: {
      evidenceCount: verifiedNews.items.length,
      confidence: verifiedNews.summary ? 0.8 : 0.25,
      sourceDomains: verifiedNews.sources || [],
      sourceUrls: verifiedNews.items.map((item) => item.url).filter(Boolean)
    },
    telemetryMessage: verifiedNews.summary
      ? 'Nyhetssökning hittade verifierade nyheter.'
      : 'Nyhetssökning gav inga verifierade nyheter.'
  };
}

function materializeLeadFromEvidence(input: {
  activeModel: ModelName;
  strictCompanyName: string;
  strictOrgNumber: string;
  strictCompanyMatchEnabled: boolean;
  resolvedIdentity: { canonicalName: string; orgNumber: string; aliases: string[] };
  root: any;
  companyData: any;
  financials: any;
  logistics: any;
  contactsRaw: any[];
  sourceBundle: Awaited<ReturnType<typeof fetchCategoryExactPageEvidenceBundle>>;
  sourceGroundingEvidence: string;
  financialEvidence: VerifiedFinancialEvidence;
  checkoutCrawlResult: CheckoutEvidence;
  paymentEvidence: VerifiedPaymentEvidence;
  techProfile: StructuredTechProfile;
  retailEvidence: RetailFootprintEvidence;
  detectedEmailPattern: string;
  dmSupplement: Array<{ name: string; title: string; email: string; linkedin: string; directPhone: string; verificationNote: string }>;
  dmConfidence: 'verified' | 'estimated' | 'missing';
  verifiedNews: VerifiedNewsEvidence;
  crawlTechEvidence: string;
  analysisWarnings: string[];
  analysisTelemetry: string[];
  analysisSteps: AnalysisStep[];
  sniPercentages: SNIPercentage[];
  activeCarrier: string;
  marketSettings?: CarrierSettings[];
  techSolutionConfig?: TechSolutionConfig;
}): LeadData {
  const {
    activeModel,
    strictCompanyName,
    strictOrgNumber,
    strictCompanyMatchEnabled,
    resolvedIdentity,
    root,
    companyData,
    financials,
    logistics,
    contactsRaw,
    sourceBundle,
    sourceGroundingEvidence,
    financialEvidence,
    checkoutCrawlResult,
    paymentEvidence,
    techProfile,
    retailEvidence,
    detectedEmailPattern,
    dmSupplement,
    dmConfidence,
    verifiedNews,
    crawlTechEvidence,
    analysisWarnings,
    analysisTelemetry,
    analysisSteps,
    sniPercentages,
    activeCarrier,
    marketSettings,
    techSolutionConfig
  } = input;

  const registryFields = financialEvidence.parsed || {};
  const sniCode = pickString(companyData?.sni_code, companyData?.sniCode, companyData?.sni);
  const verifiedFinancialHistory = normalizeLatestFinancialHistory(
    registryFields.financialHistory?.length
      ? registryFields.financialHistory
      : normalizeFinancialHistoryEntries(financials?.history || [], financialEvidence.evidenceText)
  );
  const historyRevenueTKR = verifiedFinancialHistory[0]?.revenue ? parseRevenueToTKR(verifiedFinancialHistory[0].revenue) : undefined;
  const historyProfitTKR = verifiedFinancialHistory[0]?.profit ? parseRevenueToTKR(verifiedFinancialHistory[0].profit) : undefined;
  const modelRevenueValue = pickNumber(companyData?.revenue_tkr, companyData?.revenueTKR, companyData?.revenue);
  const revenueTKR = registryFields.revenueTkr ?? historyRevenueTKR ?? parseRevenueToTKROptional(modelRevenueValue);
  const profitTKR = registryFields.profitTkr ?? historyProfitTKR ?? parseRevenueToTKROptional(financials?.history?.[0]?.profit);
  const verifiedSolidity = pickString(registryFields.solidity, financials?.solidity, financials?.equity_ratio);
  const verifiedLiquidityRatio = pickString(registryFields.liquidityRatio, financials?.liquidity_ratio, financials?.liquidityRatio);
  const verifiedDebtBalance = pickString(registryFields.debtBalance, financials?.debt_balance_tkr, financials?.debtBalance);
  const verifiedDebtEquityRatio = pickString(registryFields.debtEquityRatio, financials?.debt_equity_ratio, financials?.debtEquityRatio);
  const verifiedPaymentRemarks = pickString(registryFields.paymentRemarks, financials?.payment_remarks, financials?.paymentRemarks);
  const verifiedLegalStatus = pickString(registryFields.legalStatus, companyData?.legal_status, companyData?.legalStatus);
  const verifiedActiveMarkets = retailEvidence.activeMarkets;
  const verifiedMarketCount = verifiedActiveMarkets.length || undefined;
  const verifiedStoreCount = retailEvidence.storeCount;
  const metrics = revenueTKR !== undefined
    ? calculateRickardMetrics(revenueTKR, sniCode || '', sniPercentages, verifiedMarketCount || 1, {
        marketSettings,
        activeCarrier
      })
    : undefined;
  const verifiedProfitMargin = pickString(registryFields.profitMargin)
    || deriveProfitMargin(verifiedFinancialHistory, pickString(financials?.profit_margin, financials?.profitMargin));
  const derivedFinancialTrend = financialEvidence.confidence === 'verified'
    ? deriveFinancialTrend(verifiedFinancialHistory, pickString(companyData?.financial_trend, companyData?.financialTrend))
    : pickString(companyData?.financial_trend, companyData?.financialTrend);
  const derivedRiskProfile = financialEvidence.confidence === 'verified'
    ? deriveRiskProfileFromMetrics({
        legalStatus: verifiedLegalStatus,
        paymentRemarks: verifiedPaymentRemarks,
        debtBalance: verifiedDebtBalance,
        debtEquityRatio: verifiedDebtEquityRatio,
        solidity: verifiedSolidity,
        liquidityRatio: verifiedLiquidityRatio,
        vatRegistered: Boolean(companyData?.vat_registered || companyData?.vatRegistered)
      }, pickString(companyData?.risk_profile, companyData?.riskProfile))
    : pickString(companyData?.risk_profile, companyData?.riskProfile);

  const latestNewsFromModelRaw = pickString(
    root?.latest_news,
    root?.latestNews,
    companyData?.latest_news,
    companyData?.latestNews,
    root?.news_summary,
    root?.newsSummary
  );
  const strictAliases = resolvedIdentity.aliases.length ? resolvedIdentity.aliases : buildCompanyAliases(strictCompanyName);
  const latestNewsFromModel = strictCompanyMatchEnabled
    ? (looksLikeCompanyNewsText(
        latestNewsFromModelRaw,
        strictAliases,
        pickString(companyData?.org_nr, companyData?.orgNumber, companyData?.organization_number, strictOrgNumber)
      )
        ? latestNewsFromModelRaw
        : '')
    : latestNewsFromModelRaw;

  const modelTechEvidence = pickString(logistics?.tech_evidence, logistics?.techEvidence);

  const capturedAt = new Date().toISOString();
  const riskFieldEvidence = financialEvidence.confidence === 'verified'
    ? {
        legalStatus: buildRiskFieldEvidence('legalStatus', verifiedLegalStatus, financialEvidence.evidenceText, financialEvidence.sourceUrl, capturedAt),
        paymentRemarks: buildRiskFieldEvidence('paymentRemarks', pickString(financials?.payment_remarks, financials?.paymentRemarks), financialEvidence.evidenceText, financialEvidence.sourceUrl, capturedAt),
        debtBalance: buildRiskFieldEvidence('debtBalance', verifiedDebtBalance, financialEvidence.evidenceText, financialEvidence.sourceUrl, capturedAt),
        debtEquityRatio: buildRiskFieldEvidence('debtEquityRatio', pickString(financials?.debt_equity_ratio, financials?.debtEquityRatio), financialEvidence.evidenceText, financialEvidence.sourceUrl, capturedAt)
      }
    : undefined;

  const verifiedRegistrySnapshot: VerifiedRegistrySnapshot | undefined = financialEvidence.confidence === 'verified'
    ? {
        sourceUrl: financialEvidence.sourceUrl,
        sourceLabel: financialEvidence.sourceUrl ? normalizeDomain(financialEvidence.sourceUrl) : 'allabolag.se',
        orgNumber: pickString(registryFields.orgNumber, strictOrgNumber),
        registeredAddress: pickString(registryFields.registeredAddress),
        revenue: revenueTKR ? `${revenueTKR.toLocaleString('sv-SE')} tkr` : '',
        profit: profitTKR || profitTKR === 0 ? `${profitTKR.toLocaleString('sv-SE')} tkr` : '',
        fieldEvidence: riskFieldEvidence,
        capturedAt
      }
    : undefined;

  const llmContacts: DecisionMaker[] = (Array.isArray(contactsRaw) ? contactsRaw : []).map((contact: any) => ({
    name: contact.name || '',
    title: contact.title || '',
    email: contact.email || '',
    linkedin: contact.linkedin || '',
    directPhone: contact.direct_phone || contact.directPhone || '',
    verificationNote: ''
  }));
  const decisionMakers: DecisionMaker[] = dedupeDecisionMakers([
    ...llmContacts,
    ...dmSupplement.map((contact) => ({
      name: contact.name,
      title: contact.title,
      email: contact.email,
      linkedin: contact.linkedin,
      directPhone: contact.directPhone,
      verificationNote: contact.verificationNote
    }))
  ], 6);
  const decisionMakerSourceUrl = decisionMakers
    .find((contact) => contact.verificationNote?.includes('Källa: '))
    ?.verificationNote?.split('Källa: ')[1]?.split(' | ')[0];
  const decisionMakerEvidenceText = decisionMakers.map((contact) => contact.verificationNote || '').filter(Boolean).join(' | ');
  const verifiedPrimaryAddress = pickVerifiedAddressValue(registryFields.registeredAddress, retailEvidence.visitingAddress);
  const verifiedVisitingAddress = pickVerifiedAddressValue(retailEvidence.visitingAddress, registryFields.registeredAddress);
  const verifiedWarehouseAddress = pickVerifiedAddressValue(retailEvidence.warehouseAddress);
  const coverage = sourceBundle.coverage || [];
  const contactEvidence = dmSupplement.find((contact) => contact.linkedin || contact.verificationNote);
  const finalLatestNews = verifiedNews.summary || '';

  const verifiedFieldEvidence: Partial<Record<VerifiedLeadField, VerifiedFieldEvidence>> = {
    revenue: buildFieldEvidence(revenueTKR !== undefined ? `${revenueTKR.toLocaleString('sv-SE')} tkr` : '', financialEvidence.sourceUrl, financialEvidence.evidenceText, capturedAt),
    profit: buildFieldEvidence(profitTKR !== undefined ? `${profitTKR.toLocaleString('sv-SE')} tkr` : '', financialEvidence.sourceUrl, financialEvidence.evidenceText, capturedAt),
    financialHistory: buildFieldEvidence(verifiedFinancialHistory, financialEvidence.sourceUrl, financialEvidence.evidenceText, capturedAt),
    solidity: buildFieldEvidence(verifiedSolidity, financialEvidence.sourceUrl, financialEvidence.evidenceText, capturedAt),
    liquidityRatio: buildFieldEvidence(verifiedLiquidityRatio, financialEvidence.sourceUrl, financialEvidence.evidenceText, capturedAt),
    profitMargin: buildFieldEvidence(verifiedProfitMargin, financialEvidence.sourceUrl, financialEvidence.evidenceText, capturedAt),
    legalStatus: riskFieldEvidence?.legalStatus,
    paymentRemarks: riskFieldEvidence?.paymentRemarks,
    debtBalance: riskFieldEvidence?.debtBalance,
    debtEquityRatio: riskFieldEvidence?.debtEquityRatio,
    address: buildFieldEvidence(verifiedPrimaryAddress, financialEvidence.sourceUrl || retailEvidence.sourceUrl, financialEvidence.evidenceText || retailEvidence.evidenceSnippet, capturedAt),
    visitingAddress: buildFieldEvidence(verifiedVisitingAddress, retailEvidence.sourceUrl || financialEvidence.sourceUrl, retailEvidence.evidenceSnippet || financialEvidence.evidenceText, capturedAt),
    warehouseAddress: buildFieldEvidence(verifiedWarehouseAddress, retailEvidence.sourceUrl, retailEvidence.evidenceSnippet, capturedAt),
    checkoutOptions: buildFieldEvidence(checkoutCrawlResult.positions, checkoutCrawlResult.sourceUrl || buildCoverageFieldEvidence(['checkoutOptions'], coverage, checkoutCrawlResult.positions, capturedAt)?.sourceUrl, checkoutCrawlResult.evidenceSnippet, capturedAt),
    ecommercePlatform: buildFieldEvidence(pickString(techProfile.platforms[0], logistics?.ecommerce_platform, logistics?.ecommercePlatform), techProfile.sourceUrl || buildCoverageFieldEvidence(['ecommercePlatform'], coverage, techProfile.platforms[0], capturedAt)?.sourceUrl, techProfile.evidenceSnippet, capturedAt),
    taSystem: buildFieldEvidence(pickString(techProfile.taSystems[0], logistics?.ta_system, logistics?.taSystem), techProfile.sourceUrl || buildCoverageFieldEvidence(['taSystem'], coverage, techProfile.taSystems[0], capturedAt)?.sourceUrl, techProfile.evidenceSnippet, capturedAt),
    paymentProvider: buildFieldEvidence(paymentEvidence.paymentProvider || pickString(techProfile.paymentProviders[0], logistics?.payment_provider, logistics?.paymentProvider), paymentEvidence.sourceUrl || techProfile.sourceUrl || buildCoverageFieldEvidence(['paymentProvider'], coverage, paymentEvidence.paymentProvider || techProfile.paymentProviders[0], capturedAt)?.sourceUrl, paymentEvidence.evidenceSnippet || techProfile.evidenceSnippet, capturedAt),
    checkoutSolution: buildFieldEvidence(paymentEvidence.checkoutSolution || pickString(techProfile.checkoutSolutions[0], logistics?.checkout_solution, logistics?.checkoutSolution), paymentEvidence.sourceUrl || techProfile.sourceUrl || buildCoverageFieldEvidence(['checkoutSolution'], coverage, paymentEvidence.checkoutSolution || techProfile.checkoutSolutions[0], capturedAt)?.sourceUrl, paymentEvidence.evidenceSnippet || techProfile.evidenceSnippet, capturedAt),
    activeMarkets: buildFieldEvidence(verifiedActiveMarkets, retailEvidence.sourceUrl, retailEvidence.evidenceSnippet, capturedAt),
    storeCount: buildFieldEvidence(verifiedStoreCount, retailEvidence.sourceUrl, retailEvidence.evidenceSnippet, capturedAt),
    decisionMakers: buildFieldEvidence(contactEvidence?.name, contactEvidence?.linkedin || buildCoverageFieldEvidence(['decisionMakers'], coverage, contactEvidence?.name, capturedAt)?.sourceUrl, contactEvidence?.verificationNote, capturedAt),
    latestNews: buildFieldEvidence(verifiedNews.items[0]?.title || finalLatestNews, verifiedNews.items[0]?.url || buildCoverageFieldEvidence(['latestNews'], coverage, verifiedNews.items[0]?.title || finalLatestNews, capturedAt)?.sourceUrl, finalLatestNews, capturedAt),
    emailPattern: buildCoverageFieldEvidence(['emailPattern'], coverage, detectedEmailPattern, capturedAt)
  };

  const lead: LeadData = {
    id: crypto.randomUUID(),
    companyName: pickString(companyData?.name, companyData?.companyName, companyData?.company_name) || strictCompanyName,
    orgNumber: pickString(registryFields.orgNumber, companyData?.org_nr, companyData?.orgNumber, companyData?.organization_number, strictOrgNumber),
    domain: pickString(companyData?.domain, companyData?.website, companyData?.url),
    sniCode,
    address: verifiedPrimaryAddress,
    visitingAddress: verifiedVisitingAddress,
    warehouseAddress: verifiedWarehouseAddress,
    revenue: revenueTKR !== undefined ? `${revenueTKR.toLocaleString('sv-SE')} tkr` : '',
    revenueYear: pickString(companyData?.revenue_year, companyData?.revenueYear),
    profit: profitTKR !== undefined ? `${profitTKR.toLocaleString('sv-SE')} tkr` : '',
    activeMarkets: verifiedActiveMarkets,
    marketCount: verifiedMarketCount,
    estimatedAOV: metrics?.estimatedAOV,
    b2bPercentage: undefined,
    b2cPercentage: undefined,
    financialHistory: verifiedFinancialHistory,
    solidity: verifiedSolidity,
    liquidityRatio: verifiedLiquidityRatio,
    profitMargin: verifiedProfitMargin,
    debtEquityRatio: verifiedDebtEquityRatio,
    debtBalance: verifiedDebtBalance,
    paymentRemarks: verifiedPaymentRemarks,
    isBankruptOrLiquidated: Boolean(financials?.is_bankrupt_or_liquidated || financials?.isBankruptOrLiquidated),
    financialSource: pickString(financials?.financial_source, financials?.source) || (financialEvidence.sourceUrl ? `Verifierad registerkälla: ${normalizeDomain(financialEvidence.sourceUrl)}` : '') || (sourceGroundingEvidence ? 'Kategori-styrd Tavily+Crawl4ai' : 'Officiella källor'),
    ecommercePlatform: pickString(techProfile.platforms[0], logistics?.ecommerce_platform, logistics?.ecommercePlatform),
    paymentProvider: paymentEvidence.paymentProvider || pickString(techProfile.paymentProviders[0], logistics?.payment_provider, logistics?.paymentProvider),
    checkoutSolution: paymentEvidence.checkoutSolution || pickString(techProfile.checkoutSolutions[0], logistics?.checkout_solution, logistics?.checkoutSolution),
    taSystem: pickString(techProfile.taSystems[0], logistics?.ta_system, logistics?.taSystem),
    techEvidence: [modelTechEvidence, crawlTechEvidence, techProfile.evidenceSnippet, paymentEvidence.evidenceSnippet, sourceGroundingEvidence].filter(Boolean).join(' | ').slice(0, 2000),
    techDetections: {
      platforms: techProfile.platforms,
      taSystems: techProfile.taSystems,
      paymentProviders: Array.from(new Set([...(techProfile.paymentProviders || []), ...(paymentEvidence.paymentProvider ? [paymentEvidence.paymentProvider] : [])])),
      checkoutSolutions: Array.from(new Set([...(techProfile.checkoutSolutions || []), ...(paymentEvidence.checkoutSolution ? [paymentEvidence.checkoutSolution] : [])]))
    },
    carriers: Array.isArray(logistics?.carriers) ? logistics.carriers.join(', ') : pickString(logistics?.carriers),
    strategicPitch: pickString(logistics?.strategic_pitch, logistics?.strategicPitch),
    latestNews: finalLatestNews || latestNewsFromModel || '',
    newsItems: verifiedNews.items,
    decisionMakers,
    potentialSek: metrics?.shippingBudgetSEK,
    freightBudget: metrics ? `${metrics.potentialTKR.toLocaleString('sv-SE')} tkr` : '',
    annualPackages: metrics?.annualPackages,
    annualPackageEstimateSource: metrics?.annualPackageEstimateSource,
    pos1Volume: metrics?.pos1Volume,
    pos2Volume: metrics?.pos2Volume,
    segment: metrics ? determineSegmentByPotential(metrics.shippingBudgetSEK) : Segment.UNKNOWN,
    analysisDate: new Date().toISOString(),
    source: 'ai',
    legalStatus: verifiedLegalStatus,
    vatRegistered: Boolean(companyData?.vat_registered || companyData?.vatRegistered),
    creditRatingLabel: pickString(companyData?.credit_rating, companyData?.creditRating),
    creditRatingMotivation: pickString(companyData?.credit_rating_motivation, companyData?.creditRatingMotivation),
    riskProfile: derivedRiskProfile,
    financialTrend: derivedFinancialTrend,
    industry: pickString(companyData?.industry, companyData?.industry_name),
    industryDescription: pickString(companyData?.industry_description, companyData?.industryDescription),
    websiteUrl: pickString(companyData?.domain, companyData?.website, companyData?.url) ? `https://${pickString(companyData?.domain, companyData?.website, companyData?.url).replace(/^https?:\/\//, '')}` : '',
    businessModel: pickString(companyData?.business_model, companyData?.businessModel),
    storeCount: verifiedStoreCount,
    checkoutOptions: checkoutCrawlResult.confidence === 'crawled' && checkoutCrawlResult.positions.length > 0
      ? checkoutCrawlResult.positions.map((item) => ({ position: item.pos, carrier: item.carrier, service: item.service, price: item.price, inCheckout: item.inCheckout }))
      : (logistics?.checkout_positions || logistics?.checkoutPositions || []).map((item: any, index: number) => ({ position: pickNumber(item?.pos, item?.position) ?? index + 1, carrier: item.carrier || '', service: item.service || '', price: item.price || '', inCheckout: true })),
    conversionScore: pickNumber(logistics?.conversion_score, logistics?.conversionScore),
    deepScanPerformed: false,
    aiModel: activeModel,
    halluccinationScore: 0,
    hallucinationScore: 0,
    sourceCoverage: sourceBundle.coverage,
    processingStatus: analysisWarnings.length ? 'partial' : 'ready',
    emailPattern: detectedEmailPattern,
    verifiedRegistrySnapshot,
    verifiedFieldEvidence,
    analysisWarnings: dedupeMessages([
      ...analysisWarnings,
      financialEvidence.confidence !== 'verified' ? 'Finansiell registerdata saknas eller är inte verifierad.' : '',
      !sourceGroundingEvidence ? 'Source grounding gav begränsat eller inget externt underlag.' : '',
      !finalLatestNews ? 'Inga verifierade nyheter hittades inom nuvarande source-regler.' : '',
      !verifiedPrimaryAddress && !verifiedVisitingAddress && !verifiedWarehouseAddress ? 'Ingen verifierad adress hittades.' : '',
      !verifiedWarehouseAddress ? 'Ingen verifierad lageradress hittades.' : '',
      !verifiedActiveMarkets.length ? 'Inga verifierade marknader hittades.' : '',
      verifiedStoreCount === undefined ? 'Verifierat butikantal hittades inte.' : '',
      !detectedEmailPattern ? 'E-postmönster kunde inte identifieras.' : '',
      !checkoutCrawlResult.positions.length ? 'Checkout crawl hittade inga verifierade checkout-positioner.' : '',
      !(paymentEvidence.paymentProvider || paymentEvidence.checkoutSolution) ? 'Ingen verifierad betalsetup hittades.' : '',
      !(techProfile.platforms.length || techProfile.taSystems.length || techProfile.paymentProviders.length || techProfile.checkoutSolutions.length) ? 'Ingen verifierad tech-profil hittades.' : ''
    ]),
    analysisTelemetry: dedupeMessages(analysisTelemetry),
    analysisSteps,
    analysisCompleteness: determineAnalysisCompleteness({
      revenue: revenueTKR !== undefined ? `${revenueTKR}` : '',
      websiteUrl: pickString(companyData?.domain, companyData?.website, companyData?.url),
      decisionMakers,
      latestNews: finalLatestNews || latestNewsFromModel || '',
      checkoutCount: checkoutCrawlResult.positions.length,
      techDetections: [...techProfile.platforms, ...techProfile.taSystems, ...techProfile.paymentProviders, ...techProfile.checkoutSolutions],
      warnings: dedupeMessages(analysisWarnings)
    }),
    dataConfidence: {
      financial: financialEvidence.confidence,
      checkout: checkoutCrawlResult.confidence,
      contacts: llmContacts.length >= 2 ? 'estimated' as const : dmConfidence,
      addresses: (verifiedPrimaryAddress || verifiedVisitingAddress || verifiedWarehouseAddress) ? 'verified' as const : 'missing' as const,
      payment: paymentEvidence.confidence,
      news: verifiedNews.confidence,
      emailPattern: detectedEmailPattern ? 'found' as const : 'missing' as const
    } as DataConfidence
  };

  const pricingProduct = marketSettings?.length ? selectPricingProductForLead(lead, marketSettings) : undefined;
  lead.pricingProductName = pricingProduct?.productName;
  lead.pricingProductSource = pricingProduct?.source;
  lead.pricingBasis = 'volume-only';

  return lead;
}

function extractModelDraft(rawData: any): {
  root: any;
  companyData: any;
  financials: any;
  logistics: any;
  contactsRaw: any[];
} {
  const root = (rawData?.lead && typeof rawData.lead === 'object') ? rawData.lead : rawData;

  return {
    root,
    companyData: root?.company_data || root?.companyData || root?.company || {},
    financials: root?.financials || root?.financialData || root?.financial_data || {},
    logistics: root?.logistics || root?.logisticsData || root?.logistics_data || {},
    contactsRaw: root?.contacts || root?.decisionMakers || root?.decision_makers || []
  };
}

function materializeBatchLeadDraft(input: {
  rawLead: any;
  activeModel: ModelName;
  activeCarrier: string;
  shouldEnrich: boolean;
  domain: string;
  websiteUrl: string;
  metrics?: ReturnType<typeof calculateRickardMetrics>;
  annualPackages?: number;
  pos1Volume?: number;
  pos2Volume?: number;
  sniCode: string;
  effectiveRevenueTkr?: number;
  verifiedPrimaryAddress: string;
  verifiedVisitingAddress: string;
  verifiedWarehouseAddress: string;
  verifiedMarketCount?: number;
  verifiedActiveMarkets: string[];
  verifiedStoreCount?: number;
  verifiedLegalStatus: string;
  verifiedFinancialHistory: FinancialYear[];
  verifiedSolidity: string;
  verifiedLiquidityRatio: string;
  verifiedDebtBalance: string;
  verifiedDebtEquityRatio: string;
  verifiedPaymentRemarks: string;
  registryFields: VerifiedRegistryFields;
  historyProfitTKR?: number;
  financialEvidence: VerifiedFinancialEvidence;
  retailEvidence: RetailFootprintEvidence;
  checkoutEvidence: CheckoutEvidence;
  paymentEvidence: VerifiedPaymentEvidence;
  techProfile: StructuredTechProfile;
  newsEvidence: VerifiedNewsEvidence;
  decisionMakers: DecisionMaker[];
  decisionMakerSourceUrl?: string;
  decisionMakerEvidenceText: string;
  emailPattern: string;
  strategicPitch: string;
  derivedRiskProfile: string;
  derivedTrend: string;
  logisticsMetrics: any;
  analysisWarnings: string[];
  analysisTelemetry: string[];
  dmConfidence: 'verified' | 'estimated' | 'missing';
  verifiedRegistrySnapshot?: VerifiedRegistrySnapshot;
  verifiedFieldEvidence?: Partial<Record<VerifiedLeadField, VerifiedFieldEvidence>>;
}): LeadData {
  const {
    rawLead,
    activeModel,
    activeCarrier,
    shouldEnrich,
    domain,
    websiteUrl,
    metrics,
    annualPackages,
    pos1Volume,
    pos2Volume,
    sniCode,
    effectiveRevenueTkr,
    verifiedPrimaryAddress,
    verifiedVisitingAddress,
    verifiedWarehouseAddress,
    verifiedMarketCount,
    verifiedActiveMarkets,
    verifiedStoreCount,
    verifiedLegalStatus,
    verifiedFinancialHistory,
    verifiedSolidity,
    verifiedLiquidityRatio,
    verifiedDebtBalance,
    verifiedDebtEquityRatio,
    verifiedPaymentRemarks,
    registryFields,
    historyProfitTKR,
    financialEvidence,
    retailEvidence,
    checkoutEvidence,
    paymentEvidence,
    techProfile,
    newsEvidence,
    decisionMakers,
    decisionMakerSourceUrl,
    decisionMakerEvidenceText,
    emailPattern,
    strategicPitch,
    derivedRiskProfile,
    derivedTrend,
    logisticsMetrics,
    analysisWarnings,
    analysisTelemetry,
    dmConfidence,
    verifiedRegistrySnapshot,
    verifiedFieldEvidence
  } = input;

  const batchStepTimestamp = new Date().toISOString();

  return {
    ...rawLead,
    id: crypto.randomUUID(),
    companyName: pickString(rawLead.companyName, rawLead.company_name, rawLead.name),
    orgNumber: pickString(registryFields.orgNumber, rawLead.orgNumber, rawLead.org_number, rawLead.organizationNumber),
    phoneNumber: pickString(rawLead.phoneNumber, rawLead.phone_number),
    sniCode,
    revenue: effectiveRevenueTkr !== undefined ? `${effectiveRevenueTkr.toLocaleString('sv-SE')} tkr` : '',
    address: verifiedPrimaryAddress,
    visitingAddress: verifiedVisitingAddress,
    warehouseAddress: verifiedWarehouseAddress,
    domain,
    websiteUrl,
    decisionMakers,
    carriers: Array.isArray(rawLead.carriers) ? rawLead.carriers.join(', ') : pickString(rawLead.carriers),
    checkoutOptions: checkoutEvidence.confidence === 'crawled' && checkoutEvidence.positions.length > 0
      ? checkoutEvidence.positions.map(cp => ({
          position: cp.pos,
          carrier: cp.carrier,
          service: cp.service,
          price: cp.price,
          inCheckout: cp.inCheckout
        }))
      : (rawLead.checkoutOptions || []),
    latestNews: newsEvidence.summary || '',
    newsItems: newsEvidence.items,
    marketCount: verifiedMarketCount,
    activeMarkets: verifiedActiveMarkets,
    storeCount: verifiedStoreCount,
    annualPackages: metrics ? annualPackages : undefined,
    annualPackageEstimateSource: pickNumber(logisticsMetrics?.estimatedAnnualPackages, logisticsMetrics?.estimated_annual_packages)
      ? 'llm-logistics'
      : metrics?.annualPackageEstimateSource,
    pos1Volume: metrics ? pos1Volume : undefined,
    pos2Volume: metrics ? pos2Volume : undefined,
    strategicPitch,
    freightBudget: metrics ? `${metrics.potentialTKR.toLocaleString('sv-SE')} tkr` : '',
    potentialSek: metrics?.shippingBudgetSEK,
    legalStatus: verifiedLegalStatus,
    creditRatingLabel: pickString(rawLead.creditRatingLabel, rawLead.credit_rating),
    riskProfile: derivedRiskProfile,
    financialTrend: derivedTrend,
    segment: metrics ? determineSegmentByPotential(metrics.shippingBudgetSEK) : (rawLead.segment || Segment.UNKNOWN),
    source: 'ai',
    analysisDate: '',
    aiModel: activeModel,
    halluccinationScore: 0,
    hallucinationScore: 0,
    processingStatus: shouldEnrich ? (analysisWarnings.length ? 'partial' : 'ready') : 'partial',
    paymentProvider: paymentEvidence.paymentProvider || pickString(techProfile.paymentProviders[0], rawLead.paymentProvider, rawLead.payment_provider),
    checkoutSolution: paymentEvidence.checkoutSolution || pickString(techProfile.checkoutSolutions[0], rawLead.checkoutSolution, rawLead.checkout_solution),
    ecommercePlatform: pickString(techProfile.platforms[0], rawLead.ecommercePlatform, rawLead.ecommerce_platform),
    taSystem: pickString(techProfile.taSystems[0], rawLead.taSystem, rawLead.ta_system),
    techDetections: {
      platforms: techProfile.platforms,
      taSystems: techProfile.taSystems,
      paymentProviders: Array.from(new Set([...(techProfile.paymentProviders || []), ...(paymentEvidence.paymentProvider ? [paymentEvidence.paymentProvider] : [])])),
      checkoutSolutions: Array.from(new Set([...(techProfile.checkoutSolutions || []), ...(paymentEvidence.checkoutSolution ? [paymentEvidence.checkoutSolution] : [])]))
    },
    techEvidence: [pickString(rawLead.techEvidence, rawLead.tech_evidence), techProfile.evidenceSnippet, paymentEvidence.evidenceSnippet].filter(Boolean).join(' | ').slice(0, 2000),
    profit: (registryFields.profitTkr ?? historyProfitTKR) !== undefined
      ? `${(registryFields.profitTkr ?? historyProfitTKR)!.toLocaleString('sv-SE')} tkr`
      : pickString(rawLead.profit),
    financialHistory: verifiedFinancialHistory,
    solidity: verifiedSolidity,
    liquidityRatio: verifiedLiquidityRatio,
    debtBalance: verifiedDebtBalance,
    debtEquityRatio: verifiedDebtEquityRatio,
    paymentRemarks: verifiedPaymentRemarks,
    profitMargin: pickString(registryFields.profitMargin)
      || deriveProfitMargin(verifiedFinancialHistory, pickString(rawLead.profitMargin, rawLead.profit_margin))
      || pickString(rawLead.profitMargin, rawLead.profit_margin),
    financialSource: financialEvidence.confidence === 'verified'
      ? `Verifierad registerkälla: ${normalizeDomain(financialEvidence.sourceUrl || 'allabolag.se')}`
      : pickString(rawLead.financialSource),
    verifiedRegistrySnapshot,
    verifiedFieldEvidence,
    emailPattern,
    analysisWarnings: dedupeMessages([
      ...analysisWarnings,
      financialEvidence.confidence !== 'verified' ? 'Finansiell registerdata saknas eller är inte verifierad.' : '',
      !verifiedPrimaryAddress && !verifiedVisitingAddress && !verifiedWarehouseAddress ? 'Ingen verifierad adress hittades.' : '',
      !verifiedWarehouseAddress ? 'Ingen verifierad lageradress hittades.' : '',
      !verifiedActiveMarkets.length ? 'Inga verifierade marknader hittades.' : '',
      verifiedStoreCount === undefined ? 'Verifierat butikantal hittades inte.' : '',
      !newsEvidence.summary ? 'Inga verifierade nyheter hittades för leadet.' : '',
      !emailPattern ? 'E-postmönster kunde inte identifieras.' : '',
      !checkoutEvidence.positions.length ? 'Checkout crawl hittade inga verifierade checkout-positioner.' : '',
      !(paymentEvidence.paymentProvider || paymentEvidence.checkoutSolution) ? 'Ingen verifierad betalsetup hittades.' : ''
    ]),
    analysisTelemetry: dedupeMessages(analysisTelemetry),
    analysisSteps: [
      {
        step: 'financials',
        provider: STEP_DEFAULT_PROVIDER.financials,
        label: STEP_LABELS.financials,
        status: financialEvidence.confidence === 'verified' ? 'success' : shouldEnrich ? 'partial' : 'skipped',
        startedAt: batchStepTimestamp,
        completedAt: batchStepTimestamp,
        durationMs: 0,
        evidenceCount: countEvidence(financialEvidence.parsed),
        confidence: financialEvidence.confidence === 'verified' ? 1 : shouldEnrich ? 0.35 : 0,
        sourceDomains: financialEvidence.sourceUrl ? [normalizeDomain(financialEvidence.sourceUrl)] : [],
        sourceUrls: financialEvidence.sourceUrl ? [financialEvidence.sourceUrl] : [],
        affectedFields: STEP_AFFECTED_FIELDS.financials,
        summary: financialEvidence.confidence === 'verified' ? 'Verifierad finansiell data hittad.' : shouldEnrich ? 'Finansiell verifiering gav begränsat utfall.' : 'Finansiell verifiering hoppades över i quick-scan.'
      },
      {
        step: 'logistics',
        provider: STEP_DEFAULT_PROVIDER.logistics,
        label: STEP_LABELS.logistics,
        status: verifiedStoreCount || verifiedActiveMarkets.length || verifiedVisitingAddress || verifiedWarehouseAddress
          ? (retailEvidence.fallbackUsed ? 'fallback_used' : 'success')
          : shouldEnrich ? 'partial' : 'skipped',
        startedAt: batchStepTimestamp,
        completedAt: batchStepTimestamp,
        durationMs: 0,
        evidenceCount: countEvidence(verifiedStoreCount, verifiedActiveMarkets, verifiedVisitingAddress, verifiedWarehouseAddress),
        confidence: retailEvidence.confidence === 'verified' ? 0.8 : retailEvidence.confidence === 'estimated' ? 0.45 : shouldEnrich ? 0.2 : 0,
        sourceDomains: retailEvidence.sourceUrl ? [normalizeDomain(retailEvidence.sourceUrl)] : [],
        sourceUrls: retailEvidence.sourceUrl ? [retailEvidence.sourceUrl] : [],
        affectedFields: STEP_AFFECTED_FIELDS.logistics,
        errorCode: retailEvidence.failureContext ? 'no_source_hits' : undefined,
        diagnostics: retailEvidence.failureContext
          ? {
              engine: retailEvidence.fallbackUsed ? 'llm_inference' : 'crawl',
              durationMs: 0,
              sources: retailEvidence.sourceUrl ? [{ url: retailEvidence.sourceUrl, weight: retailEvidence.confidence === 'verified' ? 0.8 : 0.45, type: retailEvidence.fallbackUsed ? 'secondary' : 'primary' }] : [],
              errorContext: {
                code: retailEvidence.failureContext.code,
                message: retailEvidence.failureContext.message
              }
            }
          : undefined,
        summary: verifiedStoreCount || verifiedActiveMarkets.length || verifiedVisitingAddress || verifiedWarehouseAddress
          ? (retailEvidence.fallbackUsed ? 'Logistiksignal räddades via relaxed fallback.' : 'Logistiksignal verifierad via officiell crawl.')
          : shouldEnrich ? 'Logistikcrawl gav inga verifierade lager-, butiks- eller adressignaler.' : 'Logistikcrawl hoppades över i quick-scan.'
      },
      {
        step: 'checkout',
        provider: STEP_DEFAULT_PROVIDER.checkout,
        label: STEP_LABELS.checkout,
        status: checkoutEvidence.positions.length ? 'success' : shouldEnrich ? 'partial' : 'skipped',
        startedAt: batchStepTimestamp,
        completedAt: batchStepTimestamp,
        durationMs: 0,
        evidenceCount: checkoutEvidence.positions.length,
        confidence: checkoutEvidence.positions.length ? 0.85 : shouldEnrich ? 0.25 : 0,
        sourceDomains: checkoutEvidence.sourceUrl ? [normalizeDomain(checkoutEvidence.sourceUrl)] : [],
        sourceUrls: checkoutEvidence.sourceUrl ? [checkoutEvidence.sourceUrl] : [],
        affectedFields: STEP_AFFECTED_FIELDS.checkout,
        summary: checkoutEvidence.positions.length ? 'Checkout crawl hittade verifierade positioner.' : shouldEnrich ? 'Checkout crawl gav inga verifierade positioner.' : 'Checkout crawl hoppades över i quick-scan.'
      },
      {
        step: 'payment',
        provider: STEP_DEFAULT_PROVIDER.payment,
        label: STEP_LABELS.payment,
        status: paymentEvidence.paymentProvider || paymentEvidence.checkoutSolution ? 'success' : shouldEnrich ? 'partial' : 'skipped',
        startedAt: batchStepTimestamp,
        completedAt: batchStepTimestamp,
        durationMs: 0,
        evidenceCount: countEvidence(paymentEvidence.paymentProvider, paymentEvidence.checkoutSolution),
        confidence: paymentEvidence.confidence === 'verified' ? 0.85 : shouldEnrich ? 0.25 : 0,
        sourceDomains: paymentEvidence.sourceUrl ? [normalizeDomain(paymentEvidence.sourceUrl)] : [],
        sourceUrls: paymentEvidence.sourceUrl ? [paymentEvidence.sourceUrl] : [],
        affectedFields: STEP_AFFECTED_FIELDS.payment,
        summary: paymentEvidence.paymentProvider || paymentEvidence.checkoutSolution ? 'Verifierad betalsetup hittad.' : shouldEnrich ? 'Ingen verifierad betalsetup hittades.' : 'Betalsetup hoppades över i quick-scan.'
      },
      {
        step: 'tech_stack',
        provider: STEP_DEFAULT_PROVIDER.tech_stack,
        label: STEP_LABELS.tech_stack,
        status: techProfile.platforms.length || techProfile.taSystems.length || techProfile.paymentProviders.length || techProfile.checkoutSolutions.length ? 'success' : shouldEnrich ? 'partial' : 'skipped',
        startedAt: batchStepTimestamp,
        completedAt: batchStepTimestamp,
        durationMs: 0,
        evidenceCount: countEvidence(techProfile.platforms, techProfile.taSystems, techProfile.paymentProviders, techProfile.checkoutSolutions),
        confidence: techProfile.confidence === 'verified' ? 0.8 : shouldEnrich ? 0.25 : 0,
        sourceDomains: techProfile.sourceUrl ? [normalizeDomain(techProfile.sourceUrl)] : [],
        sourceUrls: techProfile.sourceUrl ? [techProfile.sourceUrl] : [],
        affectedFields: STEP_AFFECTED_FIELDS.tech_stack,
        summary: techProfile.platforms.length || techProfile.taSystems.length || techProfile.paymentProviders.length || techProfile.checkoutSolutions.length ? 'Tech-profil hittade verifierade signaler.' : shouldEnrich ? 'Tech-profil gav inga verifierade signaler.' : 'Tech-profil hoppades över i quick-scan.'
      },
      {
        step: 'news',
        provider: STEP_DEFAULT_PROVIDER.news,
        label: STEP_LABELS.news,
        status: newsEvidence.summary ? 'success' : shouldEnrich ? 'partial' : 'skipped',
        startedAt: batchStepTimestamp,
        completedAt: batchStepTimestamp,
        durationMs: 0,
        evidenceCount: newsEvidence.items.length,
        confidence: newsEvidence.summary ? 0.8 : shouldEnrich ? 0.25 : 0,
        sourceDomains: newsEvidence.sources || [],
        sourceUrls: newsEvidence.items.map((item) => item.url).filter(Boolean),
        affectedFields: STEP_AFFECTED_FIELDS.news,
        summary: newsEvidence.summary ? 'Nyheter verifierades.' : shouldEnrich ? 'Nyhetssökning gav inga verifierade nyheter.' : 'Nyhetssökning hoppades över i quick-scan.'
      },
      {
        step: 'contacts',
        provider: STEP_DEFAULT_PROVIDER.contacts,
        label: STEP_LABELS.contacts,
        status: decisionMakers.length ? (dmConfidence === 'verified' ? 'success' : 'partial') : shouldEnrich ? 'partial' : 'skipped',
        startedAt: batchStepTimestamp,
        completedAt: batchStepTimestamp,
        durationMs: 0,
        evidenceCount: decisionMakers.length,
        confidence: dmConfidence === 'verified' ? 0.85 : decisionMakers.length ? 0.4 : 0,
        sourceDomains: decisionMakers.map((contact) => contact.linkedin || '').filter(Boolean).map((value) => normalizeDomain(value)),
        sourceUrls: decisionMakers.map((contact) => contact.linkedin || '').filter(Boolean),
        affectedFields: STEP_AFFECTED_FIELDS.contacts,
        summary: decisionMakers.length ? 'Beslutsfattardata tillgänglig.' : shouldEnrich ? 'Beslutsfattarsökning gav inga verifierade kontakter.' : 'Beslutsfattarsökning hoppades över i quick-scan.'
      }
    ].map((step) => hydrateAnalysisStep(step as AnalysisStep)),
    analysisCompleteness: shouldEnrich
      ? determineAnalysisCompleteness({
          revenue: effectiveRevenueTkr !== undefined ? `${effectiveRevenueTkr}` : '',
          websiteUrl,
          decisionMakers,
          latestNews: newsEvidence.summary || '',
          checkoutCount: checkoutEvidence.positions.length,
          techDetections: [...techProfile.platforms, ...techProfile.taSystems, ...techProfile.paymentProviders, ...techProfile.checkoutSolutions],
          warnings: dedupeMessages(analysisWarnings)
        })
      : 'thin',
    dataConfidence: {
      financial: financialEvidence.confidence,
      checkout: checkoutEvidence.confidence,
      contacts: dmConfidence,
      addresses: (verifiedPrimaryAddress || verifiedVisitingAddress || verifiedWarehouseAddress) ? 'verified' : 'missing',
      payment: paymentEvidence.confidence,
      news: newsEvidence.confidence,
      emailPattern: emailPattern ? 'found' : 'missing'
    }
  } as LeadData;
}

async function buildBatchLeadEvidenceBundle(input: {
  rawLead: any;
  index: number;
  batchEnrichmentLimit: number;
  activeCarrier: string;
  techSolutionConfig?: TechSolutionConfig;
  effectivePolicies: SourcePolicyConfig;
  preferredDomains: string[];
  focusRoles: string[];
  sniPercentages: SNIPercentage[];
  marketSettings?: CarrierSettings[];
}): Promise<{
  logisticsMetrics: any;
  domain: string;
  websiteUrl: string;
  sniCode: string;
  metrics?: ReturnType<typeof calculateRickardMetrics>;
  annualPackages?: number;
  pos1Volume?: number;
  pos2Volume?: number;
  strategicPitch: string;
  shouldEnrich: boolean;
  analysisWarnings: string[];
  analysisTelemetry: string[];
  financialEvidence: VerifiedFinancialEvidence;
  checkoutEvidence: CheckoutEvidence;
  paymentEvidence: VerifiedPaymentEvidence;
  newsEvidence: VerifiedNewsEvidence;
  techProfile: StructuredTechProfile;
  retailEvidence: RetailFootprintEvidence;
  emailPattern: string;
  decisionMakers: DecisionMaker[];
  dmConfidence: 'verified' | 'estimated' | 'missing';
  registryFields: VerifiedRegistryFields;
  verifiedFinancialHistory: FinancialYear[];
  historyProfitTKR?: number;
  effectiveRevenueTkr?: number;
  verifiedSolidity: string;
  verifiedLiquidityRatio: string;
  verifiedDebtBalance: string;
  verifiedDebtEquityRatio: string;
  verifiedPaymentRemarks: string;
  verifiedLegalStatus: string;
  verifiedActiveMarkets: string[];
  verifiedMarketCount?: number;
  verifiedStoreCount?: number;
  derivedTrend: string;
  derivedRiskProfile: string;
  verifiedRegistrySnapshot?: VerifiedRegistrySnapshot;
  decisionMakerSourceUrl?: string;
  decisionMakerEvidenceText: string;
  verifiedPrimaryAddress: string;
  verifiedVisitingAddress: string;
  verifiedWarehouseAddress: string;
  verifiedFieldEvidence?: Partial<Record<VerifiedLeadField, VerifiedFieldEvidence>>;
}> {
  const {
    rawLead,
    index,
    batchEnrichmentLimit,
    activeCarrier,
    techSolutionConfig,
    effectivePolicies,
    preferredDomains,
    focusRoles,
    sniPercentages,
    marketSettings
  } = input;

  const logisticsMetrics = rawLead.logisticsMetrics || rawLead.logistics_metrics || {};
  const revenueRaw = pickString(rawLead.revenue, rawLead.revenue_tkr, rawLead.revenueTKR);
  const rev = parseRevenueToTKR(revenueRaw);
  const marketCount = pickNumber(rawLead.marketCount, rawLead.market_count) || 1;
  const sniCode = pickString(rawLead.sniCode, rawLead.sni_code, rawLead.sni);
  let metrics: ReturnType<typeof calculateRickardMetrics> | undefined = calculateRickardMetrics(rev, sniCode, sniPercentages, marketCount, {
    marketSettings,
    activeCarrier
  });

  const annualPackages = metrics?.annualPackages || pickNumber(logisticsMetrics?.estimatedAnnualPackages, logisticsMetrics?.estimated_annual_packages);
  const pos1Volume = metrics?.pos1Volume || pickNumber(logisticsMetrics?.pos1_volume, logisticsMetrics?.pos1Volume);
  const pos2Volume = metrics?.pos2Volume || pickNumber(logisticsMetrics?.pos2_volume, logisticsMetrics?.pos2Volume);
  const strategicPitch = pickString(logisticsMetrics?.strategic_pitch, logisticsMetrics?.strategicPitch);

  const domainRaw = pickString(rawLead.domain, rawLead.website, rawLead.websiteUrl, rawLead.url);
  const domain = domainRaw.replace(/^https?:\/\//, '');
  const websiteUrl = domain ? `https://${domain}` : '';
  const baseDecisionMakers = (rawLead.decisionMakers || rawLead.decision_makers || rawLead.contacts || []).map((contact: any) => ({
    name: pickString(contact?.name),
    title: pickString(contact?.title),
    email: pickString(contact?.email),
    linkedin: pickString(contact?.linkedin),
    directPhone: pickString(contact?.direct_phone, contact?.directPhone),
    verificationNote: ''
  }));

  const shouldEnrich = index < batchEnrichmentLimit;
  const analysisWarnings: string[] = [];
  const analysisTelemetry: string[] = [];
  let financialEvidence: VerifiedFinancialEvidence = { evidenceText: '', confidence: 'missing', parsed: {} };
  let checkoutEvidence: CheckoutEvidence = { positions: [], evidenceSnippet: '', confidence: 'missing' };
  let paymentEvidence: VerifiedPaymentEvidence = { paymentProvider: '', checkoutSolution: '', evidenceSnippet: '', confidence: 'missing' };
  let newsEvidence: VerifiedNewsEvidence = { summary: '', confidence: 'missing', sources: [], items: [] };
  let techProfile: StructuredTechProfile = { platforms: [], taSystems: [], paymentProviders: [], checkoutSolutions: [], evidenceSnippet: '', confidence: 'missing' };
  let retailEvidence: RetailFootprintEvidence = { activeMarkets: [], evidenceSnippet: '', confidence: 'missing' };
  let emailPattern = '';
  let dmSupplement: Array<{ name: string; title: string; email: string; linkedin: string; directPhone: string; verificationNote: string }> = [];
  let dmConfidence: 'verified' | 'estimated' | 'missing' = baseDecisionMakers.length ? 'estimated' : 'missing';

  if (shouldEnrich) {
    try {
      const [financialBundle, commercialBundle, newsBundle] = await Promise.all([
        fetchVerifiedFinancialBundle(pickString(rawLead.orgNumber, rawLead.org_number, rawLead.organizationNumber), pickString(rawLead.companyName, rawLead.company_name, rawLead.name)),
        fetchCommercialSignalsBundle(
          pickString(rawLead.companyName, rawLead.company_name, rawLead.name),
          domain,
          activeCarrier,
          techSolutionConfig,
          buildBatchAnalysisPolicyFromSourcePolicyConfig(effectivePolicies),
          pickString(rawLead.companyName, rawLead.company_name, rawLead.name),
          pickString(rawLead.orgNumber, rawLead.org_number, rawLead.organizationNumber)
        ),
        fetchVerifiedNewsBundle(
          pickString(rawLead.companyName, rawLead.company_name, rawLead.name),
          effectivePolicies.news,
          {
            orgNumber: pickString(rawLead.orgNumber, rawLead.org_number, rawLead.organizationNumber),
            strictCompanyMatch: effectivePolicies.strictCompanyMatch !== false,
            earliestNewsYear: effectivePolicies.earliestNewsYear,
            analysisPolicy: buildBatchAnalysisPolicyFromSourcePolicyConfig(effectivePolicies),
            sourcePolicies: effectivePolicies
          }
        )
      ]);
      financialEvidence = financialBundle.financialEvidence;
      checkoutEvidence = commercialBundle.checkoutCrawlResult;
      paymentEvidence = commercialBundle.paymentEvidence;
      techProfile = commercialBundle.techProfile;
      retailEvidence = commercialBundle.retailEvidence;
      emailPattern = commercialBundle.detectedEmailPattern;
      newsEvidence = newsBundle.verifiedNews;
      analysisTelemetry.push(financialBundle.telemetryMessage);
      commercialBundle.telemetryMessages.forEach((message) => analysisTelemetry.push(message));
      analysisTelemetry.push(newsBundle.telemetryMessage);
    } catch {
      analysisWarnings.push('Extern enrichment misslyckades. Leadet bygger främst på quick-scan-data.');
      analysisTelemetry.push('Extern enrichment misslyckades och föll tillbaka till quick-scan-data.');
    }

    if (!baseDecisionMakers.length) {
      try {
        const contactsBundle = await fetchVerifiedContactsBundle(
          pickString(rawLead.companyName, rawLead.company_name, rawLead.name),
          pickString(rawLead.orgNumber, rawLead.org_number, rawLead.organizationNumber),
          focusRoles,
          preferredDomains,
          domain
        );
        dmSupplement = contactsBundle.contacts;
        dmConfidence = contactsBundle.confidence;
        analysisTelemetry.push(contactsBundle.telemetryMessage);
      } catch {
        dmSupplement = [];
        analysisWarnings.push('Beslutsfattarsökning misslyckades i batch enrichment.');
      }
    }
  } else {
    analysisWarnings.push(`Endast quick-scan användes i batch. Full enrichment körs på de första ${batchEnrichmentLimit} leadsen i varje körning.`);
    analysisTelemetry.push('Leadet markerades som quick-scan på grund av batchbegränsning.');
  }

  const registryFields = financialEvidence.parsed || {};
  const verifiedFinancialHistory = normalizeLatestFinancialHistory(
    registryFields.financialHistory?.length
      ? registryFields.financialHistory
      : normalizeFinancialHistoryEntries(rawLead.financialHistory || [], financialEvidence.evidenceText)
  );
  const historyRevenueTKR = verifiedFinancialHistory[0]?.revenue
    ? parseRevenueToTKR(verifiedFinancialHistory[0].revenue)
    : undefined;
  const historyProfitTKR = verifiedFinancialHistory[0]?.profit
    ? parseRevenueToTKR(verifiedFinancialHistory[0].profit)
    : undefined;
  const effectiveRevenueTkr = registryFields.revenueTkr ?? historyRevenueTKR ?? (rawLead.revenue ? parseRevenueToTKROptional(rawLead.revenue) : undefined);
  const effectiveMarketCount = retailEvidence.activeMarkets.length || marketCount;
  metrics = effectiveRevenueTkr !== undefined
    ? calculateRickardMetrics(effectiveRevenueTkr, sniCode || '', sniPercentages, effectiveMarketCount || 1, {
        marketSettings,
        activeCarrier
      })
    : undefined;
  const verifiedSolidity = pickString(registryFields.solidity, rawLead.solidity, rawLead.equity_ratio);
  const verifiedLiquidityRatio = pickString(registryFields.liquidityRatio, rawLead.liquidityRatio, rawLead.liquidity_ratio);
  const verifiedDebtBalance = pickString(registryFields.debtBalance, rawLead.debtBalance, rawLead.debt_balance_tkr);
  const verifiedDebtEquityRatio = pickString(registryFields.debtEquityRatio, rawLead.debtEquityRatio, rawLead.debt_equity_ratio);
  const verifiedPaymentRemarks = pickString(registryFields.paymentRemarks, rawLead.paymentRemarks, rawLead.payment_remarks);
  const verifiedLegalStatus = pickString(registryFields.legalStatus, rawLead.legalStatus, rawLead.legal_status);
  const verifiedActiveMarkets = retailEvidence.activeMarkets;
  const verifiedMarketCount = verifiedActiveMarkets.length || undefined;
  const verifiedStoreCount = retailEvidence.storeCount;
  const decisionMakers: DecisionMaker[] = dedupeDecisionMakers([
    ...baseDecisionMakers,
    ...dmSupplement.map((contact) => ({ name: contact.name, title: contact.title, email: contact.email, linkedin: contact.linkedin, directPhone: contact.directPhone, verificationNote: contact.verificationNote }))
  ], 6);
  const derivedTrend = financialEvidence.confidence === 'verified'
    ? deriveFinancialTrend(verifiedFinancialHistory, pickString(rawLead.financialTrend, rawLead.financial_trend))
    : pickString(rawLead.financialTrend, rawLead.financial_trend);
  const derivedRiskProfile = financialEvidence.confidence === 'verified'
    ? deriveRiskProfileFromMetrics({
        legalStatus: verifiedLegalStatus,
        paymentRemarks: verifiedPaymentRemarks,
        debtBalance: verifiedDebtBalance,
        debtEquityRatio: verifiedDebtEquityRatio,
        solidity: verifiedSolidity,
        liquidityRatio: verifiedLiquidityRatio,
        vatRegistered: typeof rawLead.vatRegistered === 'boolean' ? rawLead.vatRegistered : rawLead.vat_registered
      }, pickString(rawLead.riskProfile, rawLead.risk_profile))
    : pickString(rawLead.riskProfile, rawLead.risk_profile);

  const capturedAt = new Date().toISOString();
  const riskFieldEvidence = financialEvidence.confidence === 'verified'
    ? {
        legalStatus: buildRiskFieldEvidence('legalStatus', verifiedLegalStatus, financialEvidence.evidenceText, financialEvidence.sourceUrl, capturedAt),
        paymentRemarks: buildRiskFieldEvidence('paymentRemarks', pickString(rawLead.paymentRemarks, rawLead.payment_remarks), financialEvidence.evidenceText, financialEvidence.sourceUrl, capturedAt),
        debtBalance: buildRiskFieldEvidence('debtBalance', verifiedDebtBalance, financialEvidence.evidenceText, financialEvidence.sourceUrl, capturedAt),
        debtEquityRatio: buildRiskFieldEvidence('debtEquityRatio', pickString(rawLead.debtEquityRatio, rawLead.debt_equity_ratio), financialEvidence.evidenceText, financialEvidence.sourceUrl, capturedAt)
      }
    : undefined;

  const verifiedRegistrySnapshot: VerifiedRegistrySnapshot | undefined = financialEvidence.confidence === 'verified'
    ? {
        sourceUrl: financialEvidence.sourceUrl,
        sourceLabel: financialEvidence.sourceUrl ? normalizeDomain(financialEvidence.sourceUrl) : 'allabolag.se',
        orgNumber: pickString(registryFields.orgNumber, rawLead.orgNumber, rawLead.org_number, rawLead.organizationNumber),
        registeredAddress: pickString(registryFields.registeredAddress),
        revenue: registryFields.revenueTkr !== undefined ? `${registryFields.revenueTkr.toLocaleString('sv-SE')} tkr` : '',
        profit: registryFields.profitTkr !== undefined ? `${registryFields.profitTkr.toLocaleString('sv-SE')} tkr` : '',
        fieldEvidence: riskFieldEvidence,
        capturedAt
      }
    : undefined;

  const decisionMakerSourceUrl = decisionMakers
    .find((contact) => contact.verificationNote?.includes('Källa: '))
    ?.verificationNote?.split('Källa: ')[1]?.split(' | ')[0];
  const decisionMakerEvidenceText = decisionMakers
    .map((contact) => contact.verificationNote || '')
    .filter(Boolean)
    .join(' | ');

  const verifiedPrimaryAddress = pickVerifiedAddressValue(registryFields.registeredAddress, retailEvidence.visitingAddress);
  const verifiedVisitingAddress = pickVerifiedAddressValue(retailEvidence.visitingAddress, registryFields.registeredAddress);
  const verifiedWarehouseAddress = pickVerifiedAddressValue(retailEvidence.warehouseAddress);

  const verifiedFieldEvidence: Partial<Record<VerifiedLeadField, VerifiedFieldEvidence>> | undefined = (() => {
    const evidence: Partial<Record<VerifiedLeadField, VerifiedFieldEvidence>> = {
      revenue: buildFieldEvidence(
        effectiveRevenueTkr !== undefined ? `${effectiveRevenueTkr.toLocaleString('sv-SE')} tkr` : '',
        financialEvidence.sourceUrl,
        financialEvidence.evidenceText,
        capturedAt,
        financialEvidence.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      profit: buildFieldEvidence(
        (registryFields.profitTkr ?? historyProfitTKR) !== undefined ? `${(registryFields.profitTkr ?? historyProfitTKR)!.toLocaleString('sv-SE')} tkr` : '',
        financialEvidence.sourceUrl,
        financialEvidence.evidenceText,
        capturedAt,
        financialEvidence.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      financialHistory: buildFieldEvidence(
        verifiedFinancialHistory,
        financialEvidence.sourceUrl,
        financialEvidence.evidenceText,
        capturedAt,
        financialEvidence.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      solidity: buildFieldEvidence(
        verifiedSolidity,
        financialEvidence.sourceUrl,
        financialEvidence.evidenceText,
        capturedAt,
        financialEvidence.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      liquidityRatio: buildFieldEvidence(
        verifiedLiquidityRatio,
        financialEvidence.sourceUrl,
        financialEvidence.evidenceText,
        capturedAt,
        financialEvidence.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      profitMargin: buildFieldEvidence(
        pickString(registryFields.profitMargin)
          || deriveProfitMargin(verifiedFinancialHistory, pickString(rawLead.profitMargin, rawLead.profit_margin))
          || pickString(rawLead.profitMargin, rawLead.profit_margin),
        financialEvidence.sourceUrl,
        financialEvidence.evidenceText,
        capturedAt,
        financialEvidence.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      legalStatus: riskFieldEvidence?.legalStatus,
      paymentRemarks: riskFieldEvidence?.paymentRemarks,
      debtBalance: riskFieldEvidence?.debtBalance,
      debtEquityRatio: riskFieldEvidence?.debtEquityRatio,
      address: buildFieldEvidence(
        verifiedPrimaryAddress,
        financialEvidence.sourceUrl || retailEvidence.sourceUrl,
        retailEvidence.evidenceSnippet || financialEvidence.evidenceText,
        capturedAt,
        verifiedPrimaryAddress ? 'verified' : 'missing'
      ),
      visitingAddress: buildFieldEvidence(
        verifiedVisitingAddress,
        retailEvidence.sourceUrl || financialEvidence.sourceUrl,
        retailEvidence.evidenceSnippet || financialEvidence.evidenceText,
        capturedAt,
        verifiedVisitingAddress ? 'verified' : 'missing'
      ),
      warehouseAddress: buildFieldEvidence(
        verifiedWarehouseAddress,
        retailEvidence.sourceUrl,
        retailEvidence.evidenceSnippet,
        capturedAt,
        verifiedWarehouseAddress ? 'verified' : 'missing'
      ),
      checkoutOptions: buildFieldEvidence(
        checkoutEvidence.positions,
        checkoutEvidence.sourceUrl,
        checkoutEvidence.evidenceSnippet,
        capturedAt,
        checkoutEvidence.confidence === 'crawled' ? 'verified' : 'estimated'
      ),
      ecommercePlatform: buildFieldEvidence(
        pickString(techProfile.platforms[0], rawLead.ecommercePlatform, rawLead.ecommerce_platform),
        techProfile.sourceUrl,
        techProfile.evidenceSnippet,
        capturedAt,
        techProfile.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      taSystem: buildFieldEvidence(
        pickString(techProfile.taSystems[0], rawLead.taSystem, rawLead.ta_system),
        techProfile.sourceUrl,
        techProfile.evidenceSnippet,
        capturedAt,
        techProfile.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      paymentProvider: buildFieldEvidence(
        paymentEvidence.paymentProvider || pickString(techProfile.paymentProviders[0], rawLead.paymentProvider, rawLead.payment_provider),
        paymentEvidence.sourceUrl || techProfile.sourceUrl,
        paymentEvidence.evidenceSnippet || techProfile.evidenceSnippet,
        capturedAt,
        paymentEvidence.confidence === 'verified' ? 'verified' : techProfile.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      checkoutSolution: buildFieldEvidence(
        paymentEvidence.checkoutSolution || pickString(techProfile.checkoutSolutions[0], rawLead.checkoutSolution, rawLead.checkout_solution),
        paymentEvidence.sourceUrl || techProfile.sourceUrl,
        paymentEvidence.evidenceSnippet || techProfile.evidenceSnippet,
        capturedAt,
        paymentEvidence.confidence === 'verified' ? 'verified' : techProfile.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      activeMarkets: buildFieldEvidence(
        verifiedActiveMarkets,
        retailEvidence.sourceUrl,
        retailEvidence.evidenceSnippet,
        capturedAt,
        retailEvidence.confidence === 'verified' && verifiedActiveMarkets.length ? 'verified' : 'missing'
      ),
      storeCount: buildFieldEvidence(
        verifiedStoreCount,
        retailEvidence.sourceUrl,
        retailEvidence.evidenceSnippet,
        capturedAt,
        verifiedStoreCount !== undefined ? 'verified' : 'missing'
      ),
      decisionMakers: buildFieldEvidence(
        decisionMakers,
        decisionMakerSourceUrl,
        decisionMakerEvidenceText,
        capturedAt,
        dmConfidence === 'verified' ? 'verified' : 'estimated'
      ),
      latestNews: buildFieldEvidence(
        newsEvidence.items,
        newsEvidence.items[0]?.url,
        newsEvidence.summary,
        capturedAt,
        newsEvidence.confidence === 'verified' ? 'verified' : 'estimated'
      ),
      emailPattern: buildFieldEvidence(
        emailPattern,
        domain ? `https://${domain}` : undefined,
        emailPattern,
        capturedAt,
        emailPattern ? 'verified' : 'missing'
      )
    };

    return Object.values(evidence).some(Boolean) ? evidence : undefined;
  })();

  return {
    logisticsMetrics,
    domain,
    websiteUrl,
    sniCode,
    metrics,
    annualPackages,
    pos1Volume,
    pos2Volume,
    strategicPitch,
    shouldEnrich,
    analysisWarnings,
    analysisTelemetry,
    financialEvidence,
    checkoutEvidence,
    paymentEvidence,
    newsEvidence,
    techProfile,
    retailEvidence,
    emailPattern,
    decisionMakers,
    dmConfidence,
    registryFields,
    verifiedFinancialHistory,
    historyProfitTKR,
    effectiveRevenueTkr,
    verifiedSolidity,
    verifiedLiquidityRatio,
    verifiedDebtBalance,
    verifiedDebtEquityRatio,
    verifiedPaymentRemarks,
    verifiedLegalStatus,
    verifiedActiveMarkets,
    verifiedMarketCount,
    verifiedStoreCount,
    derivedTrend,
    derivedRiskProfile,
    verifiedRegistrySnapshot,
    decisionMakerSourceUrl,
    decisionMakerEvidenceText,
    verifiedPrimaryAddress,
    verifiedVisitingAddress,
    verifiedWarehouseAddress,
    verifiedFieldEvidence
  };
}

function getConfiguredTrustedDomains(sourcePolicies?: SourcePolicyConfig, analysisPolicy?: AnalysisPolicy): string[] {
  const configuredDomains = analysisPolicy?.sources?.trustedDomains?.length
    ? analysisPolicy.sources.trustedDomains
    : (sourcePolicies?.trustedDomains?.length ? sourcePolicies.trustedDomains : DEFAULT_TRUSTED_DOMAINS);

  return Array.from(new Set(configuredDomains
    .map((domain) => normalizeDomain(domain))
    .filter(Boolean)));
}

function getConfiguredCategoryPageHints(sourcePolicies?: SourcePolicyConfig, analysisPolicy?: AnalysisPolicy): Record<string, string[]> {
  return {
    ...DEFAULT_CATEGORY_PAGE_HINTS,
    ...(sourcePolicies?.categoryPageHints || {}),
    ...(analysisPolicy?.sources?.categoryPageHints || {})
  };
}

function getPolicyHintsForCategory(
  category: string,
  analysisPolicy?: AnalysisPolicy,
  sourcePolicies?: SourcePolicyConfig,
  fallbackHints: string[] = []
): string[] {
  const configured = getConfiguredCategoryPageHints(sourcePolicies, analysisPolicy);
  return Array.from(new Set([
    ...(configured[category] || []),
    ...fallbackHints
  ].map((hint) => String(hint || '').trim()).filter(Boolean)));
}

function getBatchEnrichmentLimit(sourcePolicies?: SourcePolicyConfig, analysisPolicy?: AnalysisPolicy): number {
  const configured = Number(analysisPolicy?.batch?.maxEnrichmentLimit ?? sourcePolicies?.batchEnrichmentLimit);
  return Number.isFinite(configured) && configured > 0 ? Math.max(1, Math.round(configured)) : DEFAULT_BATCH_ENRICHMENT_LIMIT;
}

function resolveApiBaseUrl(): string {
  const configuredBaseUrl = String(
    (import.meta as any)?.env?.VITE_BASE_URL
    || process.env.VITE_BASE_URL
    || process.env.FRONTEND_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    || ''
  ).trim();
  return configuredBaseUrl.replace(/\/$/, '');
}

function buildApiUrl(path: string): string {
  const baseUrl = resolveApiBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

async function throttle() {
  const now = Date.now();
  const diff = now - lastCallTime;
  if (diff < MIN_INTERVAL) {
    await new Promise(res => setTimeout(res, MIN_INTERVAL - diff));
  }
  lastCallTime = Date.now();
}

/**
 * JSON REPAIR ENGINE (Same as Gemini)
 */
async function resolveCompanyIdentity(
  companyOrOrgInput: string,
  preferredDomains: string[]
): Promise<{ canonicalName: string; orgNumber: string; aliases: string[] }> {
  const rawInput = String(companyOrOrgInput || '').trim();
  if (!rawInput) return { canonicalName: '', orgNumber: '', aliases: [] };

  const orgInInput = extractOrgNumberFromText(rawInput);
  const registryDomains = ['allabolag.se', 'ratsit.se', 'bolagsverket.se'];
  const domainScope = Array.from(new Set([...registryDomains, ...preferredDomains.slice(0, 3)]));
  const siteQuery = domainScope.map((d) => `site:${normalizeDomain(d)}`).join(' OR ');

  const query = orgInInput
    ? `${orgInInput} (${siteQuery}) företagsnamn organisationsnummer`
    : `"${rawInput}" (${siteQuery}) ("org.nr" OR organisationsnummer OR "AB")`;

  try {
    const response = await axios.post(
      buildApiUrl('/api/tavily'),
      {
        query,
        action: 'search',
        maxResults: 8
      },
      {
        timeout: 12000
      }
    );

    const results: any[] = Array.isArray(response.data?.results) ? response.data.results : [];
    if (!results.length) {
      return {
        canonicalName: rawInput,
        orgNumber: orgInInput,
        aliases: buildCompanyAliases(rawInput)
      };
    }

    const orgCandidate = orgInInput || results
      .map((r) => extractOrgNumberFromText(`${pickString(r?.title)} ${pickString(r?.content)} ${pickString(r?.url)}`))
      .find(Boolean) || '';

    const firstRelevant = results.find((r) => {
      const text = `${pickString(r?.title)} ${pickString(r?.content)} ${pickString(r?.url)}`.toLowerCase();
      return !text.includes('fastighet') && !text.includes('holding');
    }) || results[0];

    const title = pickString(firstRelevant?.title);
    const inferredName = title
      .replace(/\|.*$/, '')
      .replace(/\-.*$/, '')
      .replace(/org\.nr.*$/i, '')
      .replace(/organisationsnummer.*$/i, '')
      .trim();

    const canonicalName = inferredName || rawInput;
    const aliases = buildCompanyAliases(canonicalName);

    return {
      canonicalName,
      orgNumber: orgCandidate,
      aliases
    };
  } catch {
    return {
      canonicalName: rawInput,
      orgNumber: orgInInput,
      aliases: buildCompanyAliases(rawInput)
    };
  }
}

function getPreferredDomains(newsSourceMappings: NewsSourceMapping[], sourcePolicies?: SourcePolicyConfig, analysisPolicy?: AnalysisPolicy, sniCode?: string): string[] {
  const normalizedSni = (sniCode || '').trim();
  const fromMappings = newsSourceMappings
    .filter((m) => {
      const prefix = (m.sniPrefix || '').trim();
      if (!prefix || prefix === '*') return true;
      return normalizedSni.startsWith(prefix);
    })
    .flatMap((m) => m.sources || []);

  const merged = [...getConfiguredTrustedDomains(sourcePolicies, analysisPolicy), ...fromMappings]
    .map((d) => normalizeDomain(d))
    .filter(Boolean);

  return Array.from(new Set(merged));
}

function getSourcePriorityBlock(preferredDomains: string[], sourcePolicies?: SourcePolicyConfig, analysisPolicy?: AnalysisPolicy): string {
  const merged = Array.from(new Set([...preferredDomains, ...getConfiguredTrustedDomains(sourcePolicies, analysisPolicy)]));
  const pickByCategory = (domains: string[]) => domains.filter((d) => merged.includes(d));

  const financial = pickByCategory(FINANCIAL_SOURCE_DOMAINS);
  const address = pickByCategory(ADDRESS_SOURCE_DOMAINS);
  const contacts = pickByCategory(CONTACT_SOURCE_DOMAINS);

  return [
    `Finansiell data: ${financial.join(', ') || FINANCIAL_SOURCE_DOMAINS.join(', ')}`,
    `Adresser: ${address.join(', ') || ADDRESS_SOURCE_DOMAINS.join(', ')}`,
    `Kontaktpersoner: ${contacts.join(', ') || CONTACT_SOURCE_DOMAINS.join(', ')}`
  ].join('\n');
}

function mergeSourcePolicies(sourcePolicies?: SourcePolicyConfig, activeCountry?: string): SourcePolicyConfig {
  const defaultFieldMappings: Record<string, string[]> = {
    financial: ['revenue', 'revenueYear', 'profit', 'financialHistory', 'solidity', 'liquidityRatio', 'profitMargin', 'creditRatingLabel', 'debtBalance', 'debtEquityRatio', 'paymentRemarks', 'legalStatus', 'financialSource', 'freightBudget'],
    revenue: ['revenue', 'revenueYear'],
    omsattning: ['revenue', 'revenueYear', 'financialHistory'],
    profit: ['profit', 'profitMargin'],
    resultat: ['profit', 'profitMargin', 'financialHistory'],
    solidity: ['solidity'],
    liquidityRatio: ['liquidityRatio'],
    likviditet: ['liquidityRatio'],
    riskstatus: ['legalStatus', 'paymentRemarks', 'debtBalance', 'debtEquityRatio', 'riskProfile', 'creditRatingLabel'],
    status: ['legalStatus'],
    betalningsanmarkning: ['paymentRemarks'],
    skuldsaldo: ['debtBalance'],
    skuldsattningsgrad: ['debtEquityRatio'],
    addresses: ['address', 'visitingAddress', 'warehouseAddress', 'segment'],
    adresser: ['address', 'visitingAddress', 'warehouseAddress'],
    decisionMakers: ['decisionMakers', 'emailPattern', 'strategicPitch'],
    beslutsfattare: ['decisionMakers', 'emailPattern', 'dataConfidence.contacts'],
    payment: ['paymentProvider', 'checkoutSolution', 'checkoutOptions', 'carriers', 'conversionScore', 'frictionAnalysis', 'dmtMatrix', 'recoveryPotentialSek', 'dataConfidence.payment'],
    betalning: ['paymentProvider', 'checkoutSolution', 'dataConfidence.payment'],
    checkout: ['checkoutOptions', 'carriers', 'conversionScore', 'frictionAnalysis', 'dmtMatrix', 'recoveryPotentialSek', 'dataConfidence.checkout'],
    webSoftware: ['ecommercePlatform', 'taSystem', 'techEvidence', 'storeCount', 'activeMarkets', 'marketCount', 'b2bPercentage', 'b2cPercentage'],
    plattform: ['ecommercePlatform', 'techEvidence'],
    tasystem: ['taSystem', 'techEvidence'],
    news: ['latestNews', 'sourceCoverage', 'analysisDate', 'dataConfidence.news'],
    nyheter: ['latestNews', 'sourceCoverage', 'analysisDate', 'dataConfidence.news']
  };

  const countryKey = (activeCountry || '').trim().toLowerCase();
  const countryOverrides = countryKey && countryKey !== 'global'
    ? (sourcePolicies?.countrySourcePolicies?.[countryKey] || sourcePolicies?.countrySourcePolicies?.[activeCountry || ''])
    : undefined;

  const pickList = (
    override?: string[],
    global?: string[],
    fallback: string[] = []
  ) => (override && override.length ? override : (global && global.length ? global : fallback));

  return {
    financial: pickList(countryOverrides?.financial, sourcePolicies?.financial, FINANCIAL_SOURCE_DOMAINS),
    addresses: pickList(countryOverrides?.addresses, sourcePolicies?.addresses, ADDRESS_SOURCE_DOMAINS),
    decisionMakers: pickList(countryOverrides?.decisionMakers, sourcePolicies?.decisionMakers, CONTACT_SOURCE_DOMAINS),
    payment: pickList(countryOverrides?.payment, sourcePolicies?.payment, PAYMENT_SOURCE_DOMAINS),
    webSoftware: pickList(countryOverrides?.webSoftware, sourcePolicies?.webSoftware, WEBSOFTWARE_SOURCE_DOMAINS),
    news: pickList(countryOverrides?.news, sourcePolicies?.news, ['ehandel.se', 'market.se', 'breakit.se']),
    trustedDomains: pickList(countryOverrides?.trustedDomains, sourcePolicies?.trustedDomains, DEFAULT_TRUSTED_DOMAINS),
    categoryPageHints: {
      ...DEFAULT_CATEGORY_PAGE_HINTS,
      ...(sourcePolicies?.categoryPageHints || {}),
      ...(countryOverrides?.categoryPageHints || {})
    },
    batchEnrichmentLimit: countryOverrides?.batchEnrichmentLimit ?? sourcePolicies?.batchEnrichmentLimit ?? DEFAULT_BATCH_ENRICHMENT_LIMIT,
    strictCompanyMatch: countryOverrides?.strictCompanyMatch ?? sourcePolicies?.strictCompanyMatch ?? true,
    earliestNewsYear: countryOverrides?.earliestNewsYear ?? sourcePolicies?.earliestNewsYear ?? (new Date().getFullYear() - 1),
    customCategories: {
      ...(sourcePolicies?.customCategories || {}),
      ...(countryOverrides?.customCategories || {})
    },
    categoryFieldMappings: {
      ...defaultFieldMappings,
      ...(sourcePolicies?.categoryFieldMappings || {}),
      ...(countryOverrides?.categoryFieldMappings || {})
    },
    countrySourcePolicies: sourcePolicies?.countrySourcePolicies || {}
  };
}

function getSourcePriorityByPartBlock(sourcePolicies?: SourcePolicyConfig): string {
  const effective = mergeSourcePolicies(sourcePolicies);
  const baseLines = [
    `Finansiell data (omsättning/resultat): ${effective.financial.join(', ')}`,
    `Adresser: ${effective.addresses.join(', ')}`,
    `Beslutsfattare: ${effective.decisionMakers.join(', ')}`,
    `Payment/checkout: ${effective.payment.join(', ')}`,
    `Websoftware/plattform: ${effective.webSoftware.join(', ')}`,
    `Nyheter: ${effective.news.join(', ')}`
  ];

  const customLines = Object.entries(effective.customCategories || {})
    .filter(([name, sources]) => name && Array.isArray(sources) && sources.length > 0)
    .map(([name, sources]) => `${name}: ${sources.join(', ')}`);

  return [...baseLines, ...customLines].join('\n');
}

function getCategoryFieldMappingBlock(sourcePolicies?: SourcePolicyConfig): string {
  const effective = mergeSourcePolicies(sourcePolicies);
  const mappings = effective.categoryFieldMappings || {};
  const lines = Object.entries(mappings)
    .filter(([category, fields]) => category && Array.isArray(fields) && fields.length > 0)
    .map(([category, fields]) => `${category} -> ${fields.join(', ')}`);

  return lines.join('\n');
}

function getCategoryDomains(sourcePolicies: SourcePolicyConfig): Record<string, string[]> {
  const custom = sourcePolicies.customCategories || {};
  return {
    financial: sourcePolicies.financial,
    addresses: sourcePolicies.addresses,
    decisionMakers: sourcePolicies.decisionMakers,
    payment: sourcePolicies.payment,
    webSoftware: sourcePolicies.webSoftware,
    news: sourcePolicies.news,
    ...custom
  };
}

async function fetchCategoryExactPageEvidence(companyName: string, sourcePolicies: SourcePolicyConfig): Promise<string> {
  return (await fetchCategoryExactPageEvidenceBundle(companyName, sourcePolicies)).promptEvidence;
}

function updateSourcePerformance(domainHits: Record<string, number>): void {
  try {
    const key = 'dhl_source_performance';
    const existing: Record<string, SourcePerformanceEntry> = JSON.parse(localStorage.getItem(key) || '{}');
    const now = new Date().toISOString();

    Object.entries(domainHits).forEach(([domain, hits]) => {
      const prev = existing[domain];
      existing[domain] = {
        domain,
        goodHits: (prev?.goodHits || 0) + hits,
        lastSeen: now
      };
    });

    localStorage.setItem(key, JSON.stringify(existing));
  } catch {
    // Ignore localStorage errors
  }
}

async function fetchCategoryExactPageEvidenceBundle(
  companyName: string,
  sourcePolicies: SourcePolicyConfig,
  analysisPolicy?: AnalysisPolicy
): Promise<{ promptEvidence: string; coverage: SourceCoverageEntry[]; domainHits: Record<string, number> }> {
  if (!companyName) return { promptEvidence: '', coverage: [], domainHits: {} };

  const categoryDomains = getCategoryDomains(sourcePolicies);
  const snippets: string[] = [];
  const coverage: SourceCoverageEntry[] = [];
  const domainHits: Record<string, number> = {};
  const preferredSet = new Set(
    Object.values(categoryDomains).flat().map(normalizeDomain).filter(Boolean)
  );

  const categories = Object.keys(categoryDomains).slice(0, 6);
  const configuredPageHints = getConfiguredCategoryPageHints(sourcePolicies, analysisPolicy);
  for (const category of categories) {
    const domains = (categoryDomains[category] || []).map(normalizeDomain).filter(Boolean).slice(0, 4);
    if (!domains.length) continue;

    const pageHints = configuredPageHints[category] || ['about', 'kontakt', 'nyheter'];
    const siteQuery = domains.map((d) => `site:${d}`).join(' OR ');
    const hintQuery = pageHints.slice(0, 3).join(' OR ');
    const query = `${companyName} (${siteQuery}) (${hintQuery})`;

    try {
      const tavilyResponse = await axios.post(
        buildApiUrl('/api/tavily'),
        {
          query,
          action: 'search',
          maxResults: 3
        },
        {
          timeout: 12000
        }
      );

      const urls: string[] = (tavilyResponse.data?.results || [])
        .map((r: any) => pickString(r?.url))
        .filter(Boolean)
        .slice(0, 4);

      let externalUrls: string[] = [];
      try {
        const broadResponse = await axios.post(
          buildApiUrl('/api/tavily'),
          {
            query: `${companyName} ${pageHints.slice(0, 2).join(' ')}`,
            action: 'search',
            maxResults: 4
          },
          {
            timeout: 9000
          }
        );

        const candidateUrls: string[] = (broadResponse.data?.results || [])
          .map((r: any) => pickString(r?.url))
          .filter((url: string) => Boolean(url));

        const normalizedCandidates: Array<{ raw: string; domain: string }> = candidateUrls
          .map((url: string) => ({ raw: url, domain: normalizeDomain(url) }))
          .filter((candidate: { raw: string; domain: string }) => candidate.domain && !preferredSet.has(candidate.domain));

        externalUrls = normalizedCandidates
          .slice(0, 2)
          .map((candidate: { raw: string; domain: string }) => candidate.raw);
      } catch {
        externalUrls = [];
      }

      if (!urls.length && !externalUrls.length) continue;

      [...urls, ...externalUrls].forEach((url) => {
        const domain = normalizeDomain(url);
        if (!domain) return;
        domainHits[domain] = (domainHits[domain] || 0) + 1;

        const mappedFields = sourcePolicies.categoryFieldMappings?.[category] || ['unknown'];
        const isPreferred = preferredSet.has(domain);
        mappedFields.forEach((field) => {
          coverage.push(buildSourceCoverageEntry({
            category,
            field,
            domain,
            url,
            isPreferred,
            analysisPolicy
          }));
        });
      });

      let crawlSnippet = '';
      try {
        const crawlResponse = await axios.post(
          buildApiUrl('/api/crawl'),
          {
            url: urls[0],
            actionType: 'crawl',
            includeLinks: false,
            includeImages: false,
            maxDepth: 1
          },
          {
            timeout: 15000
          }
        );

        crawlSnippet = pickString(crawlResponse.data?.content).slice(0, 300);
      } catch {
        crawlSnippet = '';
      }

      const fields = (sourcePolicies.categoryFieldMappings?.[category] || []).join(', ');
      snippets.push(`${category} [${fields || 'no-field-mapping'}]: ${urls.join(' | ')}${crawlSnippet ? ` | snippet: ${crawlSnippet}` : ''}`);
    } catch {
      continue;
    }
  }

  updateSourcePerformance(domainHits);

  return {
    promptEvidence: snippets.join('\n'),
    coverage,
    domainHits
  };
}

function getTechWatchlistText(config?: TechSolutionConfig): string {
  const effective = getEffectiveTechSolutionConfig(config);
  const categories: TechSolutionCategory[] = ['ecommercePlatforms', 'checkoutSolutions', 'paymentProviders', 'taSystems', 'logisticsSignals'];

  return categories.map((category) => {
    const values = getTechSolutionsByCategory(effective, category)
      .map((solution) => `${solution.label} (${solution.keywords.join(', ')})`)
      .join(', ');
    return `${TECH_SOLUTION_CATEGORY_LABELS[category]}: ${values}`;
  }).join('\n');
}

function detectTechSignals(content: string, config?: TechSolutionConfig): string[] {
  const haystack = (content || '').toLowerCase();
  if (!haystack) return [];

  const keywords = getTechKeywords(config);
  return keywords.filter((k) => haystack.includes(k.toLowerCase()));
}

async function fetchTechEvidenceFromCrawl(domain: string, config?: TechSolutionConfig): Promise<string> {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return '';

  try {
    const response = await axios.post(
      buildApiUrl('/api/crawl'),
      {
        url: `https://${normalizedDomain}`,
        actionType: 'crawl',
        includeLinks: true,
        includeImages: false,
        maxDepth: 1
      },
      {
        timeout: 20000
      }
    );

    const content = response.data?.content || '';
    const hits = detectTechSignals(content, config);
    if (!hits.length) return '';

    return `Verifierade tekniska signaler via Crawl4ai: ${hits.slice(0, 8).join(', ')}`;
  } catch (error) {
    return '';
  }
}

type VerifiedRegistryFields = {
  orgNumber?: string;
  registeredAddress?: string;
  revenueTkr?: number;
  profitTkr?: number;
  financialHistory?: FinancialYear[];
  solidity?: string;
  liquidityRatio?: string;
  profitMargin?: string;
  debtBalance?: string;
  debtEquityRatio?: string;
  paymentRemarks?: string;
  legalStatus?: string;
};

type VerifiedFinancialEvidence = {
  evidenceText: string;
  confidence: 'verified' | 'estimated' | 'missing';
  sourceUrl?: string;
  parsed: VerifiedRegistryFields;
  failureContext?: { code: string; message: string; url?: string };
};

type VerifiedPaymentEvidence = {
  paymentProvider?: string;
  checkoutSolution?: string;
  evidenceSnippet: string;
  confidence: 'verified' | 'estimated' | 'missing';
  sourceUrl?: string;
  failureContext?: { code: string; message: string; url?: string };
};

type CheckoutEvidence = {
  positions: Array<{ carrier: string; pos: number; service: string; price: string; inCheckout: boolean }>;
  evidenceSnippet: string;
  confidence: 'crawled' | 'estimated' | 'missing';
  sourceUrl?: string;
  failureContext?: { code: string; message: string; url?: string };
};

type VerifiedNewsEvidence = {
  summary: string;
  confidence: 'verified' | 'estimated' | 'missing';
  sources: string[];
  items: NewsItem[];
  failureContext?: { code: string; message: string; url?: string };
};

type RetailFootprintEvidence = {
  storeCount?: number;
  activeMarkets: string[];
  visitingAddress?: string;
  warehouseAddress?: string;
  evidenceSnippet: string;
  confidence: 'verified' | 'estimated' | 'missing';
  sourceUrl?: string;
  failureContext?: { code: string; message: string; url?: string };
  fallbackUsed?: boolean;
};

type StructuredTechProfile = TechDetections & {
  evidenceSnippet: string;
  confidence: 'verified' | 'estimated' | 'missing';
  sourceUrl?: string;
  failureContext?: { code: string; message: string; url?: string };
};

function buildFailureContext(error: any, attemptedUrl?: string, emptyMessage?: string): { code: string; message: string; url?: string } {
  const rawMessage = String(error?.response?.data?.error || error?.message || emptyMessage || 'No data returned').trim();
  const lowered = rawMessage.toLowerCase();
  const status = Number(error?.response?.status || 0);

  let code = 'UNKNOWN_FAILURE';
  if (error?.code === 'ECONNABORTED' || lowered.includes('timeout') || lowered.includes('timed out') || lowered.includes('navigation')) {
    code = 'NAVIGATION_TIMEOUT';
  } else if (status === 403 || status === 401 || lowered.includes('cloudflare') || lowered.includes('forbidden') || lowered.includes('access denied') || lowered.includes('bot')) {
    code = 'BOT_CHALLENGE';
  } else if (status === 404 || lowered.includes('404')) {
    code = 'PAGE_NOT_FOUND';
  } else if (lowered.includes('selector')) {
    code = 'SELECTOR_NOT_FOUND';
  } else if (lowered.includes('rate')) {
    code = 'RATE_LIMITED';
  } else if (lowered.includes('empty') || lowered.includes('no data') || lowered.includes('no content')) {
    code = 'EMPTY_RESULT';
  }

  return {
    code,
    message: rawMessage || 'No data returned',
    url: attemptedUrl
  };
}

async function fetchRetailFallbackSignals(
  companyName: string,
  domain: string,
  analysisPolicy?: AnalysisPolicy
): Promise<RetailFootprintEvidence> {
  const fallbackTerms = Array.from(new Set([
    ...getPolicyHintsForCategory('logistics', analysisPolicy, undefined, ['lager', 'warehouse', 'distribution', 'logistikcenter']),
    ...getPolicyHintsForCategory('news', analysisPolicy, undefined, ['butiker', 'stores', 'expansion']),
    'lager',
    'warehouse',
    'distribution',
    'logistikcenter',
    'fraktvillkor',
    'butiker',
    'stores'
  ].filter(Boolean))).slice(0, 8);
  const query = `"${companyName}" (${fallbackTerms.map((term) => `"${term}"`).join(' OR ')})`;

  try {
    const response = await axios.post(
      buildApiUrl('/api/tavily'),
      { query, action: 'search', maxResults: 5 },
      { timeout: 12000 }
    );
    const results: any[] = response.data?.results || [];
    if (!results.length) {
      return {
        activeMarkets: [],
        evidenceSnippet: '',
        confidence: 'missing',
        failureContext: buildFailureContext(null, undefined, 'Relaxed logistics search returned no fallback sources.')
      };
    }

    const combinedContent = results
      .map((item: any) => `${pickString(item?.title)}\n${pickString(item?.content)}`)
      .filter(Boolean)
      .join('\n\n');
    const sourceUrl = pickString(results[0]?.url);
    const activeMarkets = extractMarketLabels(combinedContent);
    const storeCount = parseStoreCount(combinedContent);
    const visitingAddress = parseLabeledAddress(combinedContent, ['besöksadress', 'head office', 'huvudkontor', 'adress']);
    const warehouseAddress = parseLabeledAddress(combinedContent, ['lageradress', 'centrallager', 'warehouse', 'distributionscenter', 'logistikcenter']);
    const evidenceKeywords = [
      ...(warehouseAddress ? ['lager'] : []),
      ...(storeCount ? ['butiker'] : []),
      ...(activeMarkets.length ? [activeMarkets[0]] : [])
    ];

    return {
      storeCount,
      activeMarkets,
      visitingAddress,
      warehouseAddress,
      evidenceSnippet: evidenceKeywords.length ? extractEvidenceSnippet(combinedContent, evidenceKeywords) : combinedContent.slice(0, 280),
      confidence: (storeCount || activeMarkets.length || visitingAddress || warehouseAddress) ? 'estimated' : 'missing',
      sourceUrl: sourceUrl || undefined,
      fallbackUsed: Boolean(storeCount || activeMarkets.length || visitingAddress || warehouseAddress),
      failureContext: (storeCount || activeMarkets.length || visitingAddress || warehouseAddress)
        ? undefined
        : buildFailureContext(null, sourceUrl || undefined, 'Relaxed logistics fallback found sources but no extractable logistics signals.')
    };
  } catch (error) {
    return {
      activeMarkets: [],
      evidenceSnippet: '',
      confidence: 'missing',
      failureContext: buildFailureContext(error, undefined, 'Relaxed logistics fallback failed.')
    };
  }
}

const RISK_FIELD_KEYWORDS: Record<'legalStatus' | 'paymentRemarks' | 'debtBalance' | 'debtEquityRatio', string[]> = {
  legalStatus: ['status', 'likvidation', 'konkurs', 'rekonstruktion'],
  paymentRemarks: ['betalningsanmärkning', 'betalningsanmarkning', 'anmärkning', 'anmarkning'],
  debtBalance: ['skuldsaldo', 'kfm', 'kronofogden'],
  debtEquityRatio: ['skuldsättningsgrad', 'skuldsattningsgrad', 'skuld', 'eget kapital']
};

function buildRiskFieldEvidence(
  field: 'legalStatus' | 'paymentRemarks' | 'debtBalance' | 'debtEquityRatio',
  value: string,
  evidenceText: string,
  sourceUrl: string | undefined,
  capturedAt: string
): VerifiedFieldEvidence | undefined {
  if (!value || !sourceUrl) return undefined;

  const keywords = RISK_FIELD_KEYWORDS[field];
  if (!containsAnyKeyword(evidenceText, keywords)) return undefined;

  return {
    sourceUrl,
    sourceLabel: normalizeDomain(sourceUrl),
    snippet: extractEvidenceSnippet(evidenceText, keywords),
    capturedAt,
    confidence: 'verified'
  };
}

function buildFieldEvidence(
  value: unknown,
  sourceUrl: string | undefined,
  snippet: string | undefined,
  capturedAt: string,
  confidence: 'verified' | 'estimated' | 'missing' = 'verified'
): VerifiedFieldEvidence | undefined {
  if (!sourceUrl) return undefined;
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;

  return {
    sourceUrl,
    sourceLabel: normalizeDomain(sourceUrl),
    snippet: pickString(snippet),
    capturedAt,
    confidence
  };
}

function buildCoverageFieldEvidence(
  fields: VerifiedLeadField[],
  coverage: SourceCoverageEntry[],
  value: unknown,
  capturedAt: string,
  snippet?: string
): VerifiedFieldEvidence | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;

  const match = coverage
    .filter((entry) => fields.includes(entry.field as VerifiedLeadField) && entry.url)
    .sort((a, b) => {
      const preferredDelta = Number(b.isPreferred) - Number(a.isPreferred);
      if (preferredDelta !== 0) return preferredDelta;
      return b.confidenceScore - a.confidenceScore;
    })[0];

  if (!match?.url) return undefined;

  return {
    sourceUrl: match.url,
    sourceLabel: match.source,
    snippet: pickString(snippet),
    capturedAt,
    confidence: 'verified'
  };
}

function pickVerifiedAddressValue(...values: Array<string | undefined | null>): string {
  return pickString(...values);
}

function parseVerifiedRegistryFields(text: string, requestedOrgNumber?: string): VerifiedRegistryFields {
  const source = String(text || '');
  if (!source) return {};

  const detectedOrg = extractOrgNumberFromText(source);
  const normalizedRequestedOrg = normalizeOrgNumber(requestedOrgNumber || '');
  const normalizedDetectedOrg = normalizeOrgNumber(detectedOrg);

  if (normalizedRequestedOrg && normalizedDetectedOrg && normalizedRequestedOrg !== normalizedDetectedOrg) {
    return {};
  }

  return {
    orgNumber: detectedOrg || requestedOrgNumber,
    registeredAddress: parseLabeledAddress(source, ['registrerad adress', 'adress', 'besöksadress', 'postadress']),
    revenueTkr: parseLabeledTkrValue(source, ['omsättning', 'nettoomsättning']),
    profitTkr: parseLabeledTkrValue(source, ['resultat efter finansnetto', 'efter finansnetto', 'årets resultat', 'resultat']),
    financialHistory: parseFinancialHistoryFromEvidence(source),
    solidity: parseLabeledMetricText(source, ['soliditet']),
    liquidityRatio: parseLabeledMetricText(source, ['likviditet', 'kassalikviditet']),
    profitMargin: parseLabeledMetricText(source, ['vinstmarginal']),
    debtBalance: parseLabeledMetricText(source, ['skuldsaldo', 'skuld hos kronofogden']),
    debtEquityRatio: parseLabeledMetricText(source, ['skuldsättningsgrad', 'skuldsattningsgrad']),
    paymentRemarks: parseLabeledFreeText(source, ['betalningsanmärkning', 'betalningsanmarkning', 'anmärkning']),
    legalStatus: parseLabeledFreeText(source, ['status', 'bolagsstatus'])
  };
}

// ── Phase 1: Verified Financial Data from Allabolag/Ratsit ────────────────
async function fetchVerifiedFinancials(
  orgNumber: string,
  companyName: string
): Promise<VerifiedFinancialEvidence> {
  const cleanOrg = normalizeOrgNumber(orgNumber);
  if (!cleanOrg && !companyName) return { evidenceText: '', confidence: 'missing', parsed: {} };
  try {
    const orgFormatted = cleanOrg.length >= 10
      ? `${cleanOrg.slice(0, 6)}-${cleanOrg.slice(6, 10)}`
      : cleanOrg;
    const searchQuery = cleanOrg
      ? `site:allabolag.se "${orgFormatted}" OR "${cleanOrg}" omsättning resultat soliditet`
      : `site:allabolag.se "${companyName}" (omsättning OR resultat OR soliditet OR bokslut)`;

    const tavilyResponse = await axios.post(
      buildApiUrl('/api/tavily'),
      { query: searchQuery, action: 'search', maxResults: 3 },
      { timeout: 10000 }
    );
    const results: any[] = tavilyResponse.data?.results || [];
    const allabolagUrl = results
      .map((r: any) => pickString(r?.url))
      .find(url => url.includes('allabolag.se') || url.includes('ratsit.se'));

    const snippets: string[] = [];
    // Use Tavily content snippets as initial evidence
    for (const r of results.slice(0, 2)) {
      const content = pickString(r?.content).slice(0, 800);
      const url = pickString(r?.url);
      if (content && (content.match(/\d[\s.]\d{3}/) || content.toLowerCase().includes('omsättning') || content.toLowerCase().includes('tkr'))) {
        snippets.push(`[${normalizeDomain(url)}]\n${content}`);
      }
    }
    // Direct crawl of the registry page for richer structured data
    if (allabolagUrl) {
      try {
        const crawlResp = await axios.post(
          buildApiUrl('/api/crawl'),
          { url: allabolagUrl, actionType: 'crawl', includeLinks: false, includeImages: false, maxDepth: 1 },
          { timeout: 15000 }
        );
        const crawled = pickString(crawlResp.data?.content).slice(0, 1500);
        if (crawled) snippets.unshift(`[${normalizeDomain(allabolagUrl)} — DIREKT CRAWL]\n${crawled}`);
      } catch { /* fall back to Tavily snippet */ }
    }
    if (!snippets.length) return { evidenceText: '', confidence: 'missing', parsed: {} };
    const evidenceText = snippets.join('\n\n---\n\n');
    return {
      evidenceText,
      confidence: 'verified',
      sourceUrl: allabolagUrl,
      parsed: parseVerifiedRegistryFields(evidenceText, cleanOrg)
    };
  } catch {
    return { evidenceText: '', confidence: 'missing', parsed: {} };
  }
}

// ── Phase 2: Checkout Position Crawl ─────────────────────────────────────
async function fetchCheckoutPositions(
  domain: string,
  focusCarrier: string,
  techSolutionConfig?: TechSolutionConfig
) : Promise<CheckoutEvidence> {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return { positions: [], evidenceSnippet: '', confidence: 'missing' };
  const pathsToTry = ['/checkout', '/kassan', '/varukorg', '/cart', '/leverans', '/frakt'];
  let checkoutContent = '';
  let sourceUrl = '';
  let lastFailure: { code: string; message: string; url?: string } | undefined;
  for (const path of pathsToTry) {
    const url = `https://${normalizedDomain}${path}`;
    try {
      const resp = await axios.post(
        buildApiUrl('/api/crawl'),
        { url, actionType: 'crawl', includeLinks: false, includeImages: false, maxDepth: 1 },
        { timeout: 15000 }
      );
      const content = pickString(resp.data?.content);
      if (content && content.length > 200) {
        checkoutContent = content.slice(0, 2500);
        sourceUrl = url;
        break;
      }
      lastFailure = buildFailureContext(null, url, `Crawl returned insufficient checkout content for ${url}.`);
    } catch (error) {
      lastFailure = buildFailureContext(error, url, 'Checkout crawl failed.');
    }
  }
  if (!checkoutContent) return { positions: [], evidenceSnippet: '', confidence: 'missing', failureContext: lastFailure };
  const haystack = checkoutContent.toLowerCase();
  const allCarriers = getTechPatterns(techSolutionConfig, 'logisticsSignals').flatMap((pattern) => pattern.keywords);
  const foundCarriers = allCarriers.filter(c => haystack.includes(c.toLowerCase()));
  const positions: Array<{ carrier: string; pos: number; service: string; price: string; inCheckout: boolean }> = foundCarriers.map((carrier, i) => ({
    carrier, pos: i + 1, service: '', price: '', inCheckout: true
  }));
  // Explicit "not in checkout" flag for the focus carrier
  const focusNorm = focusCarrier.toLowerCase();
  const focusFound = foundCarriers.some(c => c.toLowerCase().includes(focusNorm) || focusNorm.includes(c.toLowerCase()));
  if (!focusFound && focusCarrier) {
    positions.push({ carrier: focusCarrier, pos: 0, service: 'EJ I CHECKOUT', price: '—', inCheckout: false });
  }
  return { positions, evidenceSnippet: checkoutContent.slice(0, 500), confidence: 'crawled', sourceUrl: sourceUrl || undefined, failureContext: !positions.length ? lastFailure : undefined };
}

async function fetchVerifiedPaymentSetup(domain: string, techSolutionConfig?: TechSolutionConfig): Promise<VerifiedPaymentEvidence> {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return { paymentProvider: '', checkoutSolution: '', evidenceSnippet: '', confidence: 'missing' };
  }

  const pathsToTry = ['/', '/checkout', '/kassan', '/cart', '/varukorg', '/betalning', '/payment'];
  let bestUrl = '';
  let combinedContent = '';
  let lastFailure: { code: string; message: string; url?: string } | undefined;

  for (const path of pathsToTry) {
    const url = `https://${normalizedDomain}${path}`;
    try {
      const resp = await axios.post(
        buildApiUrl('/api/crawl'),
        { url, actionType: 'crawl', includeLinks: false, includeImages: false, maxDepth: 1 },
        { timeout: 15000 }
      );
      const content = pickString(resp.data?.content);
      if (!content) continue;
      if (!bestUrl) bestUrl = url;
      combinedContent += `\n${content.slice(0, 2500)}`;
    } catch (error) {
      lastFailure = buildFailureContext(error, url, 'Payment crawl failed.');
      continue;
    }
  }

  const haystack = combinedContent.toLowerCase();
  if (!haystack.trim()) {
    return { paymentProvider: '', checkoutSolution: '', evidenceSnippet: '', confidence: 'missing', failureContext: lastFailure };
  }

  const paymentMatch = findPatternMatch(haystack, getTechPatterns(techSolutionConfig, 'paymentProviders'));
  const checkoutMatch = findPatternMatch(haystack, getTechPatterns(techSolutionConfig, 'checkoutSolutions'));
  const keywords = [paymentMatch.keyword, checkoutMatch.keyword].filter(Boolean) as string[];

  if (!paymentMatch.label && !checkoutMatch.label) {
    return {
      paymentProvider: '',
      checkoutSolution: '',
      evidenceSnippet: '',
      confidence: 'missing',
      sourceUrl: bestUrl || undefined,
      failureContext: lastFailure || buildFailureContext(null, bestUrl || undefined, 'Payment signals were not found in crawled content.')
    };
  }

  return {
    paymentProvider: paymentMatch.label || checkoutMatch.label?.replace(/\s+Checkout$/i, '') || '',
    checkoutSolution: checkoutMatch.label || '',
    evidenceSnippet: extractEvidenceSnippet(combinedContent, keywords),
    confidence: 'verified',
    sourceUrl: bestUrl || undefined
  };
}

async function fetchStructuredTechProfile(domain: string, techSolutionConfig?: TechSolutionConfig): Promise<StructuredTechProfile> {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return { platforms: [], taSystems: [], paymentProviders: [], checkoutSolutions: [], evidenceSnippet: '', confidence: 'missing' };
  }

  const pathsToTry = ['/', '/checkout', '/kassan', '/cart', '/varukorg'];
  let combinedContent = '';
  let sourceUrl = '';
  let lastFailure: { code: string; message: string; url?: string } | undefined;
  for (const path of pathsToTry) {
    const url = `https://${normalizedDomain}${path}`;
    try {
      const resp = await axios.post(
        buildApiUrl('/api/crawl'),
        { url, actionType: 'crawl', includeLinks: false, includeImages: false, maxDepth: 1 },
        { timeout: 15000 }
      );
      const content = pickString(resp.data?.content);
      if (content) {
        if (!sourceUrl) sourceUrl = url;
        combinedContent += `\n${content.slice(0, 2500)}`;
      }
    } catch (error) {
      lastFailure = buildFailureContext(error, url, 'Tech crawl failed.');
      continue;
    }
  }

  const platforms = detectStructuredLabels(combinedContent, getTechPatterns(techSolutionConfig, 'ecommercePlatforms'));
  const taSystems = detectStructuredLabels(combinedContent, getTechPatterns(techSolutionConfig, 'taSystems'));
  const paymentProviders = detectStructuredLabels(combinedContent, getTechPatterns(techSolutionConfig, 'paymentProviders'));
  const checkoutSolutions = detectStructuredLabels(combinedContent, getTechPatterns(techSolutionConfig, 'checkoutSolutions'));
  const keywords = [...platforms, ...taSystems, ...paymentProviders, ...checkoutSolutions].slice(0, 6);

  return {
    platforms,
    taSystems,
    paymentProviders,
    checkoutSolutions,
    evidenceSnippet: keywords.length ? extractEvidenceSnippet(combinedContent, keywords) : '',
    confidence: (platforms.length || taSystems.length || paymentProviders.length || checkoutSolutions.length) ? 'verified' : 'missing',
    sourceUrl: sourceUrl || undefined,
    failureContext: (platforms.length || taSystems.length || paymentProviders.length || checkoutSolutions.length) ? undefined : lastFailure || buildFailureContext(null, sourceUrl || undefined, 'Tech crawl found no structured tech signals.')
  };
}

async function fetchRetailFootprint(domain: string): Promise<RetailFootprintEvidence> {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return { activeMarkets: [], evidenceSnippet: '', confidence: 'missing' };
  }

  const pathsToTry = ['/', '/butiker', '/stores', '/vara-butiker', '/store-locator', '/om-oss', '/about', '/kontakt', '/contact', '/kontakta-oss', '/kundservice', '/customer-service', '/leverans', '/shipping', '/villkor', '/terms'];
  let combinedContent = '';
  let sourceUrl = '';
  let lastFailure: { code: string; message: string; url?: string } | undefined;
  for (const path of pathsToTry) {
    const url = `https://${normalizedDomain}${path}`;
    try {
      const resp = await axios.post(
        buildApiUrl('/api/crawl'),
        { url, actionType: 'crawl', includeLinks: false, includeImages: false, maxDepth: 1 },
        { timeout: 15000 }
      );
      const content = pickString(resp.data?.content);
      if (content) {
        if (!sourceUrl) sourceUrl = url;
        combinedContent += `\n${content.slice(0, 2500)}`;
      }
    } catch (error) {
      lastFailure = buildFailureContext(error, url, 'Retail crawl failed.');
      continue;
    }
  }

  const activeMarkets = extractMarketLabels(combinedContent);
  const storeCount = parseStoreCount(combinedContent);
  const visitingAddress = parseLabeledAddress(combinedContent, ['besöksadress', 'visiting address', 'huvudadress', 'head office', 'huvudkontor', 'adress']);
  const warehouseAddress = parseLabeledAddress(combinedContent, ['lageradress', 'centrallager', 'warehouse', 'lager', 'distributionscenter', 'logistikcenter']);
  const evidenceKeywords = [
    ...(activeMarkets.length ? [activeMarkets[0]] : []),
    ...(storeCount ? ['butiker'] : []),
    ...(warehouseAddress ? ['lager'] : []),
    ...(visitingAddress ? ['adress'] : [])
  ];

  return {
    storeCount,
    activeMarkets,
    visitingAddress,
    warehouseAddress,
    evidenceSnippet: evidenceKeywords.length ? extractEvidenceSnippet(combinedContent, evidenceKeywords) : '',
    confidence: (storeCount || activeMarkets.length || visitingAddress || warehouseAddress) ? 'verified' : 'missing',
    sourceUrl: sourceUrl || undefined,
    failureContext: (storeCount || activeMarkets.length || visitingAddress || warehouseAddress) ? undefined : lastFailure || buildFailureContext(null, sourceUrl || undefined, 'Retail crawl found no logistics signals on the official site.')
  };
}

// ── Phase 3: Role-Targeted Decision Maker Search ──────────────────────────
async function fetchDecisionMakersTargeted(
  companyName: string,
  orgNumber: string,
  focusRoles: string[],
  preferredDomains: string[],
  companyDomain?: string
): Promise<{
  contacts: Array<{ name: string; title: string; email: string; linkedin: string; directPhone: string; verificationNote: string }>;
  confidence: 'verified' | 'estimated' | 'missing';
}> {
  if (!companyName) return { contacts: [], confidence: 'missing' };
  const aliases = buildCompanyAliases(companyName);
  const roleSynonyms = [...focusRoles.filter(Boolean), 'VD', 'logistikchef', 'inköpschef', 'e-handelschef', 'COO'];
  const roleClause = roleSynonyms.slice(0, 5).map(r => `"${r}"`).join(' OR ');
  const orgNormalized = normalizeOrgNumber(orgNumber);
  const queries = [
    `"${companyName}" (${roleClause}) site:linkedin.com`,
    `"${companyName}" (styrelse OR ledning OR vd) site:allabolag.se`,
    orgNormalized ? `"${orgNormalized}" (VD OR styrelseledamot OR logistikchef) site:ratsit.se` : null,
    `"${companyName}" (${roleClause}) LinkedIn`,
    `"${companyName}" (${roleClause})`
  ].filter(Boolean) as string[];

  const allowedDomains = new Set(
    ['linkedin.com', 'allabolag.se', 'ratsit.se', 'hitta.se', 'eniro.se', ...preferredDomains]
      .map(normalizeDomain)
      .filter(Boolean)
  );
  const found: Array<{ name: string; title: string; email: string; linkedin: string; directPhone: string; verificationNote: string; score: number }> = [];
  const seenNames = new Set<string>();
  for (const query of queries) {
    try {
      const resp = await axios.post(buildApiUrl('/api/tavily'), { query, action: 'search', maxResults: 5 }, { timeout: 12000 });
      const results: any[] = resp.data?.results || [];
      for (const r of results) {
        const text = `${pickString(r?.title)} ${pickString(r?.content)}`;
        const url = pickString(r?.url);
        const domain = normalizeDomain(url);
        if (domain && !allowedDomains.has(domain)) continue;
        const lowered = `${text} ${url}`.toLowerCase();
        const nameMatches = text.match(/\b([A-ZÅÄÖ][a-zåäö-]+\s+[A-ZÅÄÖ][a-zåäö-]+)\b/g) || [];
        const roleMatches = text.match(/(VD|CEO|logistikchef|inköpschef|e-handelschef|CMO|CFO|COO|styrelseordförande|styrelseledamot|Supply Chain|Head of Logistics)/gi) || [];
        if (!nameMatches.length || !roleMatches.length) continue;
        const aliasMatch = aliases.some(alias => lowered.includes(alias.toLowerCase()));
        const orgMatch = orgNormalized ? normalizeOrgNumber(lowered).includes(orgNormalized) : false;
        const linkedinVerified = url.includes('linkedin.com') && aliasMatch;
        const companyVerified = aliasMatch || orgMatch;
        if (!companyVerified) continue;
        const name = nameMatches[0] ?? '';
        const role = roleMatches[0] ?? '';
        if (!name || !role) continue;
        if (!roleMatchesFocus(role, roleSynonyms)) continue;
        if (/rickard|wigrund/i.test(name)) continue;
        if (isLikelyGenericPersonName(name)) continue;
        if (seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        const verifiedEmails = extractEmailsFromText(text, companyDomain);
        const verifiedPhones = extractPhoneNumbersFromText(text);
        const score = (linkedinVerified ? 2 : 0)
          + (orgMatch ? 2 : 0)
          + (aliasMatch ? 1 : 0)
          + (verifiedEmails.length ? 1 : 0)
          + (verifiedPhones.length ? 1 : 0);
        if (score < 2) continue;
        found.push({
          name,
          title: role,
          email: verifiedEmails[0] || '',
          linkedin: url.includes('linkedin.com') ? url : '',
          directPhone: verifiedPhones[0] || '',
          verificationNote: linkedinVerified
            ? `Verifierad via LinkedIn + bolagsmatch (${normalizeDomain(url)})`
            : `Verifierad via bolagsmatch (${normalizeDomain(url)})`,
          score
        });
      }
    } catch { /* continue to next query */ }
  }
  const ranked = found
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const deduped = dedupeDecisionMakers(
    ranked.map(({ score, ...contact }) => contact),
    4
  );
  return {
    contacts: deduped.map((contact) => ({
      name: contact.name,
      title: contact.title,
      email: contact.email || '',
      linkedin: contact.linkedin || '',
      directPhone: contact.directPhone || '',
      verificationNote: contact.verificationNote || ''
    })),
    confidence: ranked.length > 0 ? (ranked[0].score >= 4 ? 'verified' : 'estimated') : 'missing'
  };
}

// ── Phase 4: Email Pattern Detection ─────────────────────────────────────
async function detectEmailPattern(domain: string, evidenceText: string): Promise<string> {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return '';
  const emailRegex = new RegExp(`\\b[a-z0-9._%+\\-]+@${normalizedDomain.replace('.', '\\.')}\\b`, 'gi');
  const inEvidence = (evidenceText.match(emailRegex) || []).map(e => e.toLowerCase());
  if (inEvidence.length >= 2) return inferEmailPattern(inEvidence.map(e => e.split('@')[0]), normalizedDomain);
  for (const page of ['/kontakt', '/contact', '/om-oss', '/about']) {
    try {
      const resp = await axios.post(
        buildApiUrl('/api/crawl'),
        { url: `https://${normalizedDomain}${page}`, actionType: 'crawl', includeLinks: false, includeImages: false, maxDepth: 1 },
        { timeout: 10000 }
      );
      const content = pickString(resp.data?.content);
      const emails = (content.match(emailRegex) || []).map(e => e.toLowerCase());
      if (emails.length >= 1) return inferEmailPattern(emails.map(e => e.split('@')[0]), normalizedDomain);
    } catch { /* try next page */ }
  }
  return '';
}

function parseRetryAfterSeconds(error: any): number {
  const headerValue = error?.response?.headers?.['retry-after'];
  if (headerValue) {
    const direct = Number(headerValue);
    if (!Number.isNaN(direct) && direct > 0) return direct;
  }

  const msg = String(error?.response?.data?.error || error?.message || '').toLowerCase();
  const secMatch = msg.match(/(\d+)\s*s/);
  if (secMatch) return Math.max(5, Number(secMatch[1]));

  return 20;
}

async function fetchLatestNews(
  companyName: string,
  domains: string[],
  options?: {
    orgNumber?: string;
    contactNames?: string[];
    strictCompanyMatch?: boolean;
    earliestNewsYear?: number;
    analysisPolicy?: AnalysisPolicy;
    sourcePolicies?: SourcePolicyConfig;
  }
): Promise<VerifiedNewsEvidence> {
  if (!companyName) return { summary: '', confidence: 'missing', sources: [], items: [], failureContext: buildFailureContext(null, undefined, 'News search skipped because company name was missing.') };

  const aliases = buildCompanyAliases(companyName);
  const primaryAlias = aliases[0] || companyName;
  const companyClause = aliases.slice(0, 3).map((a) => `"${a}"`).join(' OR ');
  const siteQuery = domains.slice(0, 8).map((d) => `site:${normalizeDomain(d)}`).join(' OR ');
  const orgNumber = pickString(options?.orgNumber);
  const orgClause = orgNumber ? ` OR "${orgNumber}"` : '';
  const strictCompanyMatch = options?.strictCompanyMatch !== false;
  const earliestNewsYear = options?.earliestNewsYear || (new Date().getFullYear() - 1);
  const newsHints = getPolicyHintsForCategory(
    'news',
    options?.analysisPolicy,
    options?.sourcePolicies,
    ['nyheter', 'pressmeddelande', 'expansion', 'rekrytering']
  ).slice(0, 4);
  const contactNames = (options?.contactNames || [])
    .map((n) => String(n || '').trim())
    .filter((n) => n.length > 4)
    .filter((n) => !isLikelyGenericPersonName(n))
    .slice(0, 2);
  const contactClause = contactNames.length
    ? ` OR (${contactNames.map((name) => `"${name}" AND "${primaryAlias}"`).join(' OR ')})`
    : '';
  const query = `(${companyClause}${orgClause}${contactClause}) (${siteQuery}) (${newsHints.map((hint) => `"${hint}"`).join(' OR ')})`;

  try {
    const [response, broadResponse] = await Promise.all([
      axios.post(
      buildApiUrl('/api/tavily'),
      {
        query,
        action: 'search',
        maxResults: 6
      },
      {
        timeout: 15000
      }
    ),
      axios.post(
        buildApiUrl('/api/tavily'),
        {
          query: `${companyName} ${contactNames.join(' ')} ${newsHints.join(' ')}`,
          action: 'search',
          maxResults: 4
        },
        {
          timeout: 15000
        }
      )
    ]);

    const results = [...(response.data?.results || []), ...(broadResponse.data?.results || [])];
    if (!Array.isArray(results) || results.length === 0) return { summary: '', confidence: 'missing', sources: [], items: [], failureContext: buildFailureContext(null, undefined, 'News search returned no results.') };

    const orgNormalized = normalizeOrgNumber(orgNumber);
    const filtered = results.filter((item: any) => {
      const title = pickString(item?.title);
      const content = pickString(item?.content);
      const url = pickString(item?.url);
      const sourceText = `${title} ${content} ${url}`.toLowerCase();
      const publishedDate = parseLikelyPublishedDate(item);

      if (publishedDate && publishedDate.getFullYear() < earliestNewsYear) return false;

      if (strictCompanyMatch && isConflictingCompanyVariant(sourceText, aliases)) return false;

      if (strictCompanyMatch && orgNormalized) {
        const hasOrg = normalizeOrgNumber(sourceText).includes(orgNormalized);
        const hasAlias = aliases.some((alias) => sourceText.includes(alias.toLowerCase()));
        return hasOrg || hasAlias;
      }

      if (strictCompanyMatch) {
        return aliases.some((alias) => sourceText.includes(alias.toLowerCase()));
      }

      return true;
    });

    const safeResults = filtered;
    if (!safeResults.length) return { summary: '', confidence: 'missing', sources: [], items: [], failureContext: buildFailureContext(null, undefined, 'News search found hits but none matched current company policy.') };

    const uniqueResults = Array.from(new Map<string, any>(
      safeResults
        .map((item: any) => [pickString(item?.url, item?.title), item] as [string, any])
        .filter(([key]) => Boolean(key))
    ).values());

    const items: NewsItem[] = uniqueResults.slice(0, 5).map((item: any) => {
      const title = pickString(item?.title, item?.content, 'Nyhet');
      const url = pickString(item?.url);
      const publishedDate = parseLikelyPublishedDate(item);
      return {
        title,
        url,
        date: publishedDate ? publishedDate.toISOString().slice(0, 10) : undefined,
        source: url ? normalizeDomain(url) : undefined
      };
    });

    const topEntries = items.slice(0, 3).map((item) => {
      const prefix = item.date ? `${item.date} · ` : '';
      return item.url ? `${prefix}${item.title} (${item.url})` : `${prefix}${item.title}`;
    });

    return {
      summary: topEntries.join(' | '),
      confidence: 'verified',
      sources: items.map((item) => item.url).filter(Boolean),
      items
    };
  } catch (error) {
    return { summary: '', confidence: 'missing', sources: [], items: [], failureContext: buildFailureContext(error, undefined, 'News search failed.') };
  }
}

/**
 * OPENROUTER API CALL WITH RETRY
 * Calls backend proxy to keep API key secure
 */
async function callOpenRouterWithRetry(
  model: ModelName,
  prompt: string,
  config: any = {},
  onStatus?: (msg: string) => void,
  handleWait?: (s: number, type: 'rate' | 'quota') => void,
  retries = 4
): Promise<string> {
  const configuredBaseUrl = (import.meta.env.VITE_BASE_URL || '').trim();
  const normalizedBaseUrl = configuredBaseUrl.replace(/\/$/, '');
  const apiEndpoint = normalizedBaseUrl ? `${normalizedBaseUrl}/api/openrouter` : '/api/openrouter';
  
  for (let i = 0; i < retries; i++) {
    try {
      await throttle();

      const response = await axios.post(
        apiEndpoint,
        {
          model,
          prompt: prompt,
          systemInstruction: config.systemInstruction || SYSTEM_INSTRUCTION,
          temperature: config.temperature || 0.1,
          maxTokens: Math.min(config.maxTokens || 1400, MODEL_CONFIG[model].maxTokens),
          responseMimeType: config.responseMimeType
        }
      );

      const text = response.data.content || response.data.choices?.[0]?.message?.content || '';
      const inputTokens = response.data.tokensUsed?.prompt || response.data.usage?.prompt_tokens || 0;
      const outputTokens = response.data.tokensUsed?.completion || response.data.usage?.completion_tokens || 0;
      
      // Calculate cost
      const costPer1k = (MODEL_CONFIG[model].costPer1kTokens / 1000);
      const estimatedCost = ((inputTokens + outputTokens) * costPer1k);
      totalCostAccumulated += estimatedCost;

      if (onStatus) {
        onStatus(`✓ ${selectedModel} | Cost: $${estimatedCost.toFixed(5)} | Total: $${totalCostAccumulated.toFixed(2)}`);
      }

      return text;

    } catch (error: any) {
      const status = error.response?.status;
      const isRateLimit = status === 429;
      const isQuotaExceeded = status === 429 || error.message?.includes('quota');

      if ((isRateLimit || isQuotaExceeded) && i < retries - 1) {
        const baseWait = parseRetryAfterSeconds(error);
        const waitTime = Math.min(baseWait + i * 8, 90);
        if (onStatus) onStatus(`⚠️ Rate limited. Waiting ${waitTime}s...`);
        if (handleWait) handleWait(waitTime, 'rate');
        await new Promise(res => setTimeout(res, waitTime * 1000));
        continue;
      }

      const responseData = error?.response?.data;
      const backendError = responseData?.error ?? responseData?.message ?? error?.message ?? 'Unknown OpenRouter error';
      const errorMsg = typeof backendError === 'string'
        ? backendError
        : (backendError?.message || JSON.stringify(backendError));
      console.error('OpenRouter API Error:', errorMsg);
      throw new Error(`OpenRouter API failed: ${errorMsg}`);
    }
  }

  throw new Error("OpenRouter: Max retries exceeded.");
}

/**
 * SURGICAL DEEPSCAN ANALYZER
 */
export async function runSurgicalDeepScan(
  lead: LeadData,
  onStatus: (msg: string) => void,
  model?: ModelName
): Promise<Partial<LeadData>> {
  const activeModel = model || selectedModel;
  onStatus("Initierar Surgical DeepScan: Skuggar kundresa...");
  
  const deepPrompt = `
    PERFORM SURGICAL DEEPSCAN FOR: ${lead.companyName} (${lead.websiteUrl})
    
    1. Analyze Checkout Friction: Estimate clicks to conversion vs industry benchmark (3.8 clicks).
    2. Analyze DMT (Density & Margin Test) Leakage: 
       Compare Current vs Target costs for 'Small (0-3kg)' and 'Heavy (10kg+)'.
    3. Calculate total Recovery Potential based on freight budget ${lead.freightBudget}.
    
    Return JSON only:
    {
      "conversionScore": number,
      "recoveryPotentialSek": string,
      "frictionAnalysis": { "companyClicks": number, "benchmarkClicks": number, "frictionNote": string },
      "dmtMatrix": [
        { "segment": "Small (0-3kg)", "currentCost": number, "targetCost": number, "savingPercentage": number },
        { "segment": "Heavy (10kg+)", "currentCost": number, "targetCost": number, "savingPercentage": number }
      ]
    }`;

  const response = await callOpenRouterWithRetry(
    activeModel,
    deepPrompt,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      temperature: 0.2
    },
    onStatus
  );

  const rawData = JSON.parse(response.trim());
  
  return {
    deepScanPerformed: true,
    conversionScore: rawData.conversionScore,
    recoveryPotentialSek: rawData.recoveryPotentialSek,
    frictionAnalysis: rawData.frictionAnalysis,
    dmtMatrix: rawData.dmtMatrix,
    aiModel: activeModel,
    halluccinationScore: 0, // Will be updated by Tavily
    hallucinationScore: 0
  };
}

/**
 * DEEP DIVE SEQUENTIAL ANALYSIS
 */
export async function generateDeepDiveSequential(
  formData: SearchFormData,
  onUpdate: (partial: Partial<LeadData>, status?: string) => void,
  handleWait: (s: number, type: 'rate' | 'quota') => void,
  newsSourceMappings: NewsSourceMapping[],
  sniPercentages: SNIPercentage[],
  integrations: string[],
  activeCarrier: string,
  threePLProviders: ThreePLProvider[],
  model?: ModelName,
  sourcePolicies?: SourcePolicyConfig,
  activeCountry?: string,
  techSolutionConfig?: TechSolutionConfig,
  analysisPolicy?: AnalysisPolicy,
  marketSettings?: CarrierSettings[]
): Promise<LeadData> {
  const activeModel = model || selectedModel;
  let analysisSteps: AnalysisStep[] = [];
  const analysisTelemetry: string[] = [];
  const analysisWarnings: string[] = [];
  const stepStartedAt = new Map<AnalysisStepName, string>();
  const publishStep = (
    step: AnalysisStepName,
    status: AnalysisStep['status'],
    summary: string,
    extra?: Partial<AnalysisStep>
  ) => {
    const nowIso = new Date().toISOString();
    const existingStep = analysisSteps.find((item) => item.step === step);
    const startedAt = status === 'running'
      ? (existingStep?.startedAt || nowIso)
      : (extra?.startedAt || existingStep?.startedAt || stepStartedAt.get(step) || nowIso);

    if (status === 'running' && !stepStartedAt.has(step)) {
      stepStartedAt.set(step, startedAt);
    }

    analysisSteps = upsertAnalysisStep(analysisSteps, {
      step,
      status,
      summary,
      startedAt,
      completedAt: status === 'running' ? undefined : (extra?.completedAt || nowIso),
      ...extra
    });
    onUpdate({ analysisSteps: [...analysisSteps] }, summary);
  };
  const pushTelemetry = (message: string) => {
    const normalized = String(message || '').trim();
    if (normalized) analysisTelemetry.push(normalized);
  };
  const pushWarning = (message: string) => {
    const normalized = String(message || '').trim();
    if (normalized) analysisWarnings.push(normalized);
  };
  onUpdate({}, `Aktiverar OpenRouter Surgical Engine med ${MODEL_CONFIG[activeModel].displayName}...`);

  const effectivePolicies = mergeSourcePolicies(sourcePolicies, activeCountry);
  const effectiveAnalysisPolicy = analysisPolicy || buildAnalysisPolicyFromSourcePolicyConfig(effectivePolicies, activeCountry);
  const preferredDomains = buildDeepDivePreferredDomains(newsSourceMappings, effectivePolicies, effectiveAnalysisPolicy);
  const identityContext = await resolveAnalysisIdentity(formData.companyNameOrOrg, preferredDomains, effectiveAnalysisPolicy);
  publishStep('identity', identityContext.stepStatus, identityContext.stepSummary, identityContext.stepData);
  const { resolvedIdentity, strictCompanyMatchEnabled, strictCompanyName, strictOrgNumber, identityLabel, searchQuery } = identityContext;
  const prompt = `${MASTER_DEEP_SCAN_PROMPT.replace('{{COMPANY_CONTEXT}}', searchQuery)}

### HARD MATCHING RULES (CRITICAL)
${strictCompanyMatchEnabled
  ? `- Matcha endast exakta företaget: ${identityLabel}.
- Om flera liknande bolag förekommer (ex. "fastighet", "holding", "group"), välj ENDAST bolaget med korrekt namn/org.nr.
- Om org.nr saknas i källa, kräv exakt bolagsnamn (inklusive AB om tillgängligt).
- Vid osäkerhet: lämna fält tomt hellre än att gissa.`
  : '- Strict match är avstängt: använd bästa tillgängliga källkritiska matchning utan hård org.nr-filtrering.'}

### SOURCE PRIORITY
Prioritera dessa källor när tillgängligt: ${preferredDomains.join(', ')}.
${getSourcePriorityBlock(preferredDomains, effectivePolicies, effectiveAnalysisPolicy)}
${getSourcePriorityByPartBlock(effectivePolicies)}

### NEWS RUNTIME RULES
- Tidigaste tillåtna nyhetsår: ${effectivePolicies.earliestNewsYear || (new Date().getFullYear() - 1)}
- Google/Tavily-fallback ska alltid användas om kategori-domänerna inte räcker.

### CATEGORY FIELD MAPPINGS
${getCategoryFieldMappingBlock(effectivePolicies)}

### EXACT PAGE TARGETING
För varje kategori, använd Tavily med site:-filter på kategori-domäner och fokusera på exakta sidor för fält-mappningen.
Vid osäkerhet, använd Crawl4ai på den mest relevanta URL:en för att extrahera verifierad text innan slutsats.

### TECH WATCHLIST (Tavily + Crawl4ai)
${getTechWatchlistText(techSolutionConfig)}

Om relevant nyhetsinformation hittas, inkludera ett fält \"latest_news\" med kort sammanfattning och URL.`;

  try {
    onUpdate({}, "Genomför teknisk & finansiell revision...");
    onUpdate({}, 'Samlar källunderlag via Tavily/Google, Allabolag och Crawl4ai...');
    publishStep('source_grounding', 'running', 'Samlar källunderlag via Tavily/Google och Crawl4ai...');
    publishStep('financials', 'running', 'Hämtar verifierad finansiell registerdata...');
    const [groundingBundle, financialBundle] = await Promise.all([
      fetchSourceGroundingBundle(identityLabel, effectivePolicies, effectiveAnalysisPolicy),
      fetchVerifiedFinancialBundle(strictOrgNumber, strictCompanyName)
    ]);
    const { sourceBundle, sourceGroundingEvidence, stepStatus: sourceGroundingStatus, stepSummary: sourceGroundingSummary, stepData: sourceGroundingStepData } = groundingBundle;
    const { financialEvidence, stepStatus: financialStatus, stepSummary: financialSummary, stepData: financialStepData, telemetryMessage: financialTelemetryMessage } = financialBundle;
    publishStep('source_grounding', sourceGroundingStatus, sourceGroundingSummary, sourceGroundingStepData);
    publishStep('financials', financialStatus, financialSummary, financialStepData);
    pushTelemetry(sourceGroundingEvidence ? 'Source grounding hittades via Tavily/Crawl4ai.' : 'Source grounding gav inga externa träffar.');
    pushTelemetry(financialTelemetryMessage);
    onUpdate({}, financialEvidence.confidence === 'verified'
      ? '✓ Finansiell registerdata hämtad från Allabolag/Ratsit'
      : 'Finansiell registerdata ej tillgänglig — AI nyttjar källbevis');

    const groundedPrompt = `${prompt}

### SOURCE EVIDENCE (TAVILY/GOOGLE + CRAWL4AI)
${sourceGroundingEvidence || 'Ingen extern källa kunde hämtas i detta steg. Använd då source-priority-listan ovan.'}

### FINANSIELL REGISTERDATA (ALLABOLAG.SE / RATSIT.SE — DIREKT CRAWL)
${financialEvidence.evidenceText || 'Ingen direkt registerdata hämtad. Om finansiella fält saknar evidens ska de lämnas tomma eller null enligt schema.'}
KRITISK REGEL: Extrahera siffror verbatim från registerdata ovan. Inga avrundningar. Inga estimeringar. Inga påhittade siffror.

Använd source evidence och registerdata ovan när du fyller fälten. Om ett fält saknar evidens, skriv tom sträng, tom array eller null enligt schema.`;

    const responseText = await callOpenRouterWithRetry(
      activeModel, 
      groundedPrompt, 
      {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.1,
        maxTokens: 2048 
      },
      (msg) => onUpdate({}, msg),
      handleWait
    );

    if (!responseText) throw new Error("Tomt svar från AI.");
    
    const rawData = parseJsonSafely(responseText);
    const { root, companyData, financials, logistics, contactsRaw } = extractModelDraft(rawData);

    // ── Phase 2 + 4: Checkout crawl + email pattern (non-critical, parallel) ─
    const parsedDomain = normalizeDomain(
      pickString(companyData?.domain, companyData?.website, companyData?.url)
    );
    let checkoutCrawlResult: CheckoutEvidence = { positions: [], evidenceSnippet: '', confidence: 'missing' };
    let paymentEvidence: VerifiedPaymentEvidence = { paymentProvider: '', checkoutSolution: '', evidenceSnippet: '', confidence: 'missing' };
    let techProfile: StructuredTechProfile = { platforms: [], taSystems: [], paymentProviders: [], checkoutSolutions: [], evidenceSnippet: '', confidence: 'missing' };
    let retailEvidence: RetailFootprintEvidence = { activeMarkets: [], evidenceSnippet: '', confidence: 'missing' };
    let detectedEmailPattern = '';
    try {
      onUpdate({}, 'Crawlar checkoutpositioner & detekterar e-postmönster...');
      publishStep('logistics', 'running', 'Kartlagger logistik- och butikssignaler...');
      publishStep('checkout', 'running', 'Crawlar checkoutflöden...');
      publishStep('payment', 'running', 'Detekterar verifierad betalsetup...');
      publishStep('tech_stack', 'running', 'Bygger verifierad tech-profil...');
      const commercialBundle = await fetchCommercialSignalsBundle(strictCompanyName, parsedDomain, activeCarrier, techSolutionConfig, effectiveAnalysisPolicy, sourceGroundingEvidence, financialEvidence.evidenceText || '');
      checkoutCrawlResult = commercialBundle.checkoutCrawlResult;
      paymentEvidence = commercialBundle.paymentEvidence;
      techProfile = commercialBundle.techProfile;
      retailEvidence = commercialBundle.retailEvidence;
      detectedEmailPattern = commercialBundle.detectedEmailPattern;
      commercialBundle.telemetryMessages.forEach(pushTelemetry);
      publishStep('logistics', commercialBundle.logisticsStep.status, commercialBundle.logisticsStep.summary, commercialBundle.logisticsStep.data);
      publishStep('checkout', commercialBundle.checkoutStep.status, commercialBundle.checkoutStep.summary, commercialBundle.checkoutStep.data);
      publishStep('payment', commercialBundle.paymentStep.status, commercialBundle.paymentStep.summary, commercialBundle.paymentStep.data);
      publishStep('tech_stack', commercialBundle.techStep.status, commercialBundle.techStep.summary, commercialBundle.techStep.data);
    } catch {
      pushWarning('Checkout crawl, payment-detection eller tech crawl misslyckades. AI-svaret kan därför vara tunnare än normalt.');
      pushTelemetry('Phase 2+4 misslyckades och föll tillbaka till AI-data.');
      onUpdate({}, 'Varning: checkout crawl/tech-detection gav inget verifierat underlag.');
      publishStep('checkout', 'failed', 'Checkout crawl misslyckades och föll tillbaka till AI-data.', { errorCode: 'crawl_blocked' });
      publishStep('payment', 'failed', 'Payment-detection misslyckades och föll tillbaka till AI-data.', { errorCode: 'crawl_blocked', fallbackFromStep: 'checkout' });
      publishStep('tech_stack', 'failed', 'Tech-profil misslyckades och föll tillbaka till AI-data.', { errorCode: 'crawl_blocked', fallbackFromStep: 'checkout' });
    }

    // ── Phase 3: Targeted decision makers (non-critical, only if LLM sparse) ─
    const llmContactCount = Array.isArray(contactsRaw) ? contactsRaw.length : 0;
    let dmSupplement: Array<{ name: string; title: string; email: string; linkedin: string; directPhone: string; verificationNote: string }> = [];
    let dmConfidence: 'verified' | 'estimated' | 'missing' = 'estimated';
    try {
      if (llmContactCount < 2) {
        onUpdate({}, 'Söker beslutsfattare via rollstyrd källsökning...');
        publishStep('contacts', 'running', 'Söker beslutsfattare via rollstyrd källsökning...');
        const contactsBundle = await fetchVerifiedContactsBundle(
          pickString(companyData?.name, companyData?.company_name) || strictCompanyName,
          pickString(companyData?.org_nr, companyData?.organization_number) || strictOrgNumber,
          [formData.focusRole1, formData.focusRole2, formData.focusRole3],
          preferredDomains,
          parsedDomain
        );
        dmSupplement = contactsBundle.contacts;
        dmConfidence = contactsBundle.confidence;
        pushTelemetry(contactsBundle.telemetryMessage);
        publishStep('contacts', contactsBundle.stepStatus, contactsBundle.stepSummary, contactsBundle.stepData);
      }
    } catch {
      pushWarning('Beslutsfattarsökning misslyckades. Kontaktdata kan vara ofullständig.');
      pushTelemetry('Phase 3 misslyckades och föll tillbaka till befintliga kontaktfält.');
      onUpdate({}, 'Varning: beslutsfattarsökning gav inga verifierade kompletteringar.');
      publishStep('contacts', 'failed', 'Beslutsfattarsökning misslyckades och föll tillbaka till befintliga kontaktfält.', { errorCode: 'no_source_hits' });
    }
    const contactNames = (Array.isArray(contactsRaw) ? contactsRaw : [])
      .map((c: any) => pickString(c?.name))
      .filter(Boolean);
    const newsBundle = await fetchVerifiedNewsBundle(
      pickString(companyData?.name, companyData?.companyName, companyData?.company_name) || strictCompanyName,
      Array.from(new Set([...getPreferredDomains(newsSourceMappings, effectivePolicies, effectiveAnalysisPolicy, pickString(companyData?.sni_code, companyData?.sniCode, companyData?.sni)), ...effectivePolicies.news].map(normalizeDomain).filter(Boolean))),
      {
        orgNumber: pickString(companyData?.org_nr, companyData?.orgNumber, companyData?.organization_number, strictOrgNumber),
        contactNames,
        strictCompanyMatch: strictCompanyMatchEnabled,
        earliestNewsYear: effectivePolicies.earliestNewsYear,
        analysisPolicy: effectiveAnalysisPolicy,
        sourcePolicies: effectivePolicies
      }
    );
    const verifiedNews = newsBundle.verifiedNews;
    pushTelemetry(newsBundle.telemetryMessage);
    publishStep('news', newsBundle.stepStatus, newsBundle.stepSummary, newsBundle.stepData);
    const modelTechEvidence = pickString(logistics?.tech_evidence, logistics?.techEvidence);
    const crawlTechEvidence = modelTechEvidence ? '' : await fetchTechEvidenceFromCrawl(
      pickString(companyData?.domain, companyData?.website, companyData?.url),
      techSolutionConfig
    );
    const lead = materializeLeadFromEvidence({
      activeModel,
      strictCompanyName,
      strictOrgNumber,
      strictCompanyMatchEnabled,
      resolvedIdentity,
      root,
      companyData,
      financials,
      logistics,
      contactsRaw,
      sourceBundle,
      sourceGroundingEvidence,
      financialEvidence,
      checkoutCrawlResult,
      paymentEvidence,
      techProfile,
      retailEvidence,
      detectedEmailPattern,
      dmSupplement,
      dmConfidence,
      verifiedNews,
      crawlTechEvidence,
      analysisWarnings,
      analysisTelemetry,
      analysisSteps,
      sniPercentages,
      activeCarrier,
      marketSettings,
      techSolutionConfig
    });

    onUpdate(lead, "Analys slutförd.");
    return lead;

  } catch (error: any) {
    throw error;
  }
}

/**
 * BATCH LEADS GENERATION
 */
interface BatchGenerationRuntimeOptions {
  bypassExclusions?: boolean;
  includeUnknownSegmentWhenFiltering?: boolean;
  onDiagnostics?: (diagnostics: BatchLeadFilterDiagnostics) => void;
}

export async function generateLeads(
  formData: SearchFormData,
  handleWait: (s: number, type: 'rate' | 'quota') => void,
  sniPercentages: SNIPercentage[],
  exclusionList: string[],
  activeCarrier: string,
  threePLProviders: ThreePLProvider[],
  model?: ModelName,
  sourcePolicies?: SourcePolicyConfig,
  activeCountry?: string,
  techSolutionConfig?: TechSolutionConfig,
  analysisPolicy?: AnalysisPolicy,
  marketSettings?: CarrierSettings[],
  runtimeOptions?: BatchGenerationRuntimeOptions
): Promise<LeadData[]> {
  const activeModel = model || selectedModel;
  try {
    const bypassExclusions = Boolean(runtimeOptions?.bypassExclusions);
    const includeUnknownSegmentWhenFiltering = runtimeOptions?.includeUnknownSegmentWhenFiltering !== false;
    const effectiveExclusionList = bypassExclusions ? [] : exclusionList;
    const effectivePolicies = mergeSourcePolicies(sourcePolicies, activeCountry);
    const effectiveAnalysisPolicy = analysisPolicy || buildBatchAnalysisPolicyFromSourcePolicyConfig(effectivePolicies, activeCountry);
    const batchEnrichmentLimit = getBatchEnrichmentLimit(effectivePolicies, effectiveAnalysisPolicy);
    const customDomains = Object.values(effectivePolicies.customCategories || {}).flat();
    const preferredDomains = Array.from(new Set([
      ...effectivePolicies.news,
      ...effectivePolicies.financial,
      ...effectivePolicies.addresses,
      ...effectivePolicies.decisionMakers,
      ...effectivePolicies.payment,
      ...effectivePolicies.webSoftware,
      ...customDomains
    ].map(normalizeDomain).filter(Boolean)));

    const prompt = `Batch Scan: Ort: ${formData.geoArea}, Omsättningssegment: ${formData.financialScope}, Triggers: ${formData.triggers}, Antal: ${formData.leadCount}.
    ${effectiveExclusionList.length
      ? `EXKLUDERA DESSA BOLAG (Returnera dem INTE): ${effectiveExclusionList.slice(0, 50).join(', ')}`
      : 'EXKLUDERINGSLISTA: ingen (engångs-bypass aktiv).'} `;

    const antiHallucinationInstruction = 'VIKTIGT: Gissa aldrig fakta. Om verifierbar data saknas ska fält lämnas tomma i stället för att uppskattas.';

    const responseText = await callOpenRouterWithRetry(
      activeModel, 
      prompt, 
      {
        systemInstruction: `${BATCH_PROSPECTING_INSTRUCTION}\n\n${effectiveExclusionList.length ? 'VIKTIGT: Returnera ALDRIG bolag som finns i exkluderingslistan.\n' : ''}${antiHallucinationInstruction}`,
        responseMimeType: "application/json",
        temperature: 0.1 
      },
      undefined,
      handleWait
    );

    if (!responseText) {
      throw createStructuredProcessingError('parse_failed', 'Batchresultatet var tomt och kunde inte tolkas till leads.');
    }

    let data;
    try {
      data = parseJsonSafely(responseText);
    } catch (e) {
      console.error("JSON Parse failed (Batch):", responseText);
      throw createStructuredProcessingError('parse_failed', 'Batchresultatet kunde inte tolkas eftersom modellen returnerade ogiltig JSON.');
    }

    const leadsArray = Array.isArray(data) ? data : (data.leads || data.results || []);
    const filteredLeads = leadsArray.filter((l: any) => l && typeof l === 'object');
    const exclusionSets = buildBatchExclusionSets(effectiveExclusionList);
    const leadsAfterExclusion = effectiveExclusionList.length
      ? filteredLeads.filter((lead: any) => !isRawBatchLeadExcluded(lead, exclusionSets))
      : filteredLeads;
    const removedByExclusion = filteredLeads.length - leadsAfterExclusion.length;

    if (Array.isArray(leadsArray) && leadsArray.length > 0 && filteredLeads.length === 0) {
      throw createStructuredProcessingError('schema_invalid', 'Batchresultatet innehöll poster men inget lead följde förväntat schema.');
    }

    const enrichedLeads = await Promise.all(leadsAfterExclusion.map(async (l: any, index: number) => {
      try {
      const evidenceBundle = await buildBatchLeadEvidenceBundle({
        rawLead: l,
        index,
        batchEnrichmentLimit,
        activeCarrier,
        techSolutionConfig,
        effectivePolicies,
        preferredDomains,
        focusRoles: [formData.focusRole1, formData.focusRole2, formData.focusRole3],
        sniPercentages,
        marketSettings
      });

      const {
        logisticsMetrics,
        domain,
        websiteUrl,
        sniCode,
        metrics,
        annualPackages,
        pos1Volume,
        pos2Volume,
        strategicPitch,
        shouldEnrich,
        analysisWarnings,
        analysisTelemetry,
        financialEvidence,
        checkoutEvidence,
        paymentEvidence,
        newsEvidence,
        techProfile,
        retailEvidence,
        emailPattern,
        decisionMakers,
        dmConfidence,
        registryFields,
        verifiedFinancialHistory,
        historyProfitTKR,
        effectiveRevenueTkr,
        verifiedSolidity,
        verifiedLiquidityRatio,
        verifiedDebtBalance,
        verifiedDebtEquityRatio,
        verifiedPaymentRemarks,
        verifiedLegalStatus,
        verifiedActiveMarkets,
        verifiedMarketCount,
        verifiedStoreCount,
        derivedTrend,
        derivedRiskProfile,
        verifiedRegistrySnapshot,
        decisionMakerSourceUrl,
        decisionMakerEvidenceText,
        verifiedPrimaryAddress,
        verifiedVisitingAddress,
        verifiedWarehouseAddress,
        verifiedFieldEvidence
      } = evidenceBundle;

      const leadDraft = materializeBatchLeadDraft({
        rawLead: l,
        activeModel,
        activeCarrier,
        shouldEnrich,
        domain,
        websiteUrl,
        metrics,
        annualPackages,
        pos1Volume,
        pos2Volume,
        sniCode,
        effectiveRevenueTkr,
        verifiedPrimaryAddress,
        verifiedVisitingAddress,
        verifiedWarehouseAddress,
        verifiedMarketCount,
        verifiedActiveMarkets,
        verifiedStoreCount,
        verifiedLegalStatus,
        verifiedFinancialHistory,
        verifiedSolidity,
        verifiedLiquidityRatio,
        verifiedDebtBalance,
        verifiedDebtEquityRatio,
        verifiedPaymentRemarks,
        registryFields,
        historyProfitTKR,
        financialEvidence,
        retailEvidence,
        checkoutEvidence,
        paymentEvidence,
        techProfile,
        newsEvidence,
        decisionMakers,
        decisionMakerSourceUrl,
        decisionMakerEvidenceText,
        emailPattern,
        strategicPitch,
        derivedRiskProfile,
        derivedTrend,
        logisticsMetrics,
        analysisWarnings,
        analysisTelemetry,
        dmConfidence,
        verifiedRegistrySnapshot,
        verifiedFieldEvidence
      });

      const pricingProduct = marketSettings?.length
        ? selectPricingProductForLead(leadDraft, marketSettings)
        : undefined;

      return {
        ...leadDraft,
        pricingProductName: pricingProduct?.productName,
        pricingProductSource: pricingProduct?.source,
        pricingBasis: 'volume-only'
      } as LeadData;
      } catch (error) {
        const errorCode = getProcessingErrorCode(error, 'schema_invalid');
        const errorMessage = getErrorMessage(error);
        const failedLead = buildFailedBatchLead(l, activeModel, errorCode, errorMessage);
        return failedLead;
      }
    }));

    const targetSegments = formData.targetSegments || [];
    const persistedLeads = enrichedLeads.filter((lead): lead is LeadData => Boolean(lead));

    const finalLeads = targetSegments.length
      ? persistedLeads.filter((lead) => {
          if (lead.processingStatus === 'failed') return true;
          if (includeUnknownSegmentWhenFiltering && lead.segment === Segment.UNKNOWN) return true;
          return targetSegments.includes(lead.segment);
        })
      : persistedLeads;

    runtimeOptions?.onDiagnostics?.({
      rawCandidateCount: Array.isArray(leadsArray) ? leadsArray.length : 0,
      objectCandidateCount: filteredLeads.length,
      removedByExclusion,
      removedBySegment: targetSegments.length ? (persistedLeads.length - finalLeads.length) : 0,
      finalCount: finalLeads.length,
      exclusionCount: effectiveExclusionList.length,
      bypassedExclusions: bypassExclusions,
      targetSegments,
      includesUnknownSegmentFallback: targetSegments.length ? includeUnknownSegmentWhenFiltering : false
    });

    return finalLeads;
  } catch (error: any) {
    throw error;
  }
}

/**
 * EMAIL SUGGESTION GENERATION
 */
export async function generateEmailSuggestion(
  type: 'template' | 'personalized',
  lead: Partial<LeadData>,
  focusWords: string[],
  customTemplate?: string,
  activeCarrier: string = 'DHL',
  language: 'sv' | 'en' = 'sv',
  contact?: DecisionMaker,
  model?: ModelName
): Promise<string> {
  const activeModel = model || selectedModel;
  const langStr = language === 'sv' ? 'svenska' : 'engelska';
  
  const firstName = contact?.name ? contact.name.split(' ')[0] : '';
  const lastName = contact?.name ? contact.name.split(' ').slice(1).join(' ') : '';
  
  let prompt = "";
  
  if (customTemplate && customTemplate.trim().length > 10) {
    prompt = `UPPGIFT: Skriv ett personligt säljmail på ${langStr} för ${activeCarrier} baserat på denna MALL.
    
    MALL:
    "${customTemplate}"
    
    KONTEXT FÖR FÖRETAGET:
    Företag: ${lead.companyName}
    Bransch: ${lead.industry || ''}
    Plattform: ${lead.ecommercePlatform || ''}
    Problem/Pitch: ${lead.strategicPitch || ''}
    Omsättning: ${lead.revenue || ''}
    Potential: ${lead.freightBudget || ''}
    
    KONTEXT FÖR MOTTAGAREN:
    Namn: ${contact?.name || ''}
    Förnamn: ${firstName}
    Efternamn: ${lastName}
    Titel: ${contact?.title || ''}
    
    INSTRUKTIONER:
    1. Följ mallens struktur och ton men anpassa detaljerna för detta specifika företag och person.
    2. Ersätt placeholders i mallen med korrekt data och använd fokusorden: ${focusWords.join(', ')}.
    3. Målet är att boka ett möte.
    4. Svara ENDAST med HTML-koden för mailets body (inga <html> eller <body> taggar).`;
  } else {
    prompt = `UPPGIFT: Skriv ett personligt säljmail på ${langStr} för ${activeCarrier} med fokus på Revenue Recovery för ${lead.companyName}. 
    Mottagare: ${contact?.name || ''} (${contact?.title || ''}).
    Använd följande fokusord: ${focusWords.join(', ')}. 
    Kontext: ${lead.strategicPitch}
    Målet är att boka ett möte. Inkludera en tydlig Call to Action (CTA).
    Svara ENDAST med HTML-koden för mailets body (inga <html> eller <body> taggar).`;
  }
  
  try {
    const response = await callOpenRouterWithRetry(activeModel, prompt, {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7
    });
    return response || (language === 'sv' ? "Kunde inte generera mailförslag." : "Could not generate email suggestion.");
  } catch (error) {
    return language === 'sv' ? "Ett fel uppstod." : "An error occurred.";
  }
}
