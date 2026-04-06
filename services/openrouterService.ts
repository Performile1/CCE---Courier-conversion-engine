import axios from 'axios';
import { SYSTEM_INSTRUCTION } from "../prompts/systemInstructions";
import { MASTER_DEEP_SCAN_PROMPT } from "../prompts/deepAnalysis";
import { BATCH_PROSPECTING_INSTRUCTION } from "../prompts/batchProspecting";
import { calculateRickardMetrics, determineSegmentByPotential } from "../utils/calculations";
import { SearchFormData, LeadData, SNIPercentage, ThreePLProvider, NewsSourceMapping, DecisionMaker, SourcePolicyConfig, SourceCoverageEntry, SourcePerformanceEntry, DataConfidence, FinancialYear, VerifiedRegistrySnapshot, VerifiedFieldEvidence, VerifiedLeadField, NewsItem, TechDetections, Segment, TechSolutionCategory, TechSolutionConfig, AnalysisPolicy, AnalysisStep, AnalysisStepName, AnalysisErrorCode, AnalysisStepProvider, CarrierSettings } from "../types";
import { buildAnalysisPolicyFromSourcePolicyConfig, buildBatchAnalysisPolicyFromSourcePolicyConfig, DEFAULT_ANALYSIS_CATEGORY_PAGE_HINTS, DEFAULT_ANALYSIS_TRUSTED_DOMAINS, DEFAULT_BATCH_ENRICHMENT_LIMIT } from './analysisPolicy';
import { DEFAULT_TECH_SOLUTION_CONFIG, getTechSolutionsByCategory, normalizeTechSolutionConfig, TECH_SOLUTION_CATEGORY_LABELS } from './techSolutionConfig';
import { selectPricingProductForLead } from './pricingService';

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
const DEFAULT_TRUSTED_DOMAINS = DEFAULT_ANALYSIS_TRUSTED_DOMAINS;
const FINANCIAL_SOURCE_DOMAINS = ['allabolag.se', 'kreditrapporten.se', 'boolag.se', 'ratsit.se', 'bolagsverket.se'];
const ADDRESS_SOURCE_DOMAINS = ['allabolag.se', 'boolag.se', 'ratsit.se', 'bolagsverket.se', 'hitta.se', 'eniro.se'];
const CONTACT_SOURCE_DOMAINS = ['ratsit.se', 'allabolag.se', 'linkedin.com', 'hitta.se'];
const PAYMENT_SOURCE_DOMAINS = ['klarna.com', 'stripe.com', 'adyen.com', 'checkout.com'];
const WEBSOFTWARE_SOURCE_DOMAINS = ['shopify.com', 'woocommerce.com', 'norce.io', 'centra.com', 'magento.com'];
type TechSolutionPattern = { label: string; keywords: string[] };

const STEP_DEFAULT_PROVIDER: Record<AnalysisStepName, AnalysisStepProvider> = {
  identity: 'internal',
  source_grounding: 'tavily',
  financials: 'registry',
  tech_stack: 'crawl4ai',
  checkout: 'crawl4ai',
  payment: 'crawl4ai',
  news: 'tavily',
  contacts: 'tavily'
};

const STEP_AFFECTED_FIELDS: Record<AnalysisStepName, VerifiedLeadField[]> = {
  identity: [],
  source_grounding: [],
  financials: ['revenue', 'profit', 'financialHistory', 'solidity', 'liquidityRatio', 'profitMargin', 'legalStatus', 'paymentRemarks', 'debtBalance', 'debtEquityRatio'],
  tech_stack: ['ecommercePlatform', 'taSystem'],
  checkout: ['checkoutOptions'],
  payment: ['paymentProvider', 'checkoutSolution'],
  news: ['latestNews'],
  contacts: ['decisionMakers', 'emailPattern']
};

function getEffectiveTechSolutionConfig(config?: TechSolutionConfig): TechSolutionConfig {
  return normalizeTechSolutionConfig(config || DEFAULT_TECH_SOLUTION_CONFIG);
}

function getTechPatterns(config: TechSolutionConfig | undefined, category: TechSolutionCategory): TechSolutionPattern[] {
  return getTechSolutionsByCategory(getEffectiveTechSolutionConfig(config), category).map((solution) => ({
    label: solution.label,
    keywords: solution.keywords
  }));
}

function getTechKeywords(config: TechSolutionConfig | undefined, category?: TechSolutionCategory): string[] {
  const effective = getEffectiveTechSolutionConfig(config);
  const categories: TechSolutionCategory[] = category
    ? [category]
    : ['ecommercePlatforms', 'checkoutSolutions', 'paymentProviders', 'taSystems', 'logisticsSignals'];

  return categories.flatMap((item) => getTechSolutionsByCategory(effective, item).flatMap((solution) => solution.keywords));
}

function dedupeMessages(messages: Array<string | undefined | null>): string[] {
  return Array.from(new Set(messages.map((message) => String(message || '').trim()).filter(Boolean)));
}

function determineAnalysisCompleteness(input: {
  revenue?: string;
  websiteUrl?: string;
  decisionMakers?: DecisionMaker[];
  latestNews?: string;
  checkoutCount?: number;
  techDetections?: string[];
  warnings?: string[];
}): 'full' | 'partial' | 'thin' {
  const signals = [
    Boolean(input.revenue),
    Boolean(input.websiteUrl),
    Boolean(input.decisionMakers?.length),
    Boolean(input.latestNews),
    Boolean((input.checkoutCount || 0) > 0),
    Boolean(input.techDetections?.length)
  ].filter(Boolean).length;

  if (signals >= 5 && !(input.warnings || []).length) return 'full';
  if (signals >= 3) return 'partial';
  return 'thin';
}
const DEFAULT_CATEGORY_PAGE_HINTS: Record<string, string[]> = DEFAULT_ANALYSIS_CATEGORY_PAGE_HINTS;

function upsertAnalysisStep(
  steps: AnalysisStep[],
  patch: Partial<AnalysisStep> & Pick<AnalysisStep, 'step' | 'status' | 'summary'>
): AnalysisStep[] {
  const nextStep: AnalysisStep = {
    provider: STEP_DEFAULT_PROVIDER[patch.step],
    durationMs: 0,
    evidenceCount: 0,
    confidence: 0,
    sourceDomains: [],
    sourceUrls: [],
    affectedFields: STEP_AFFECTED_FIELDS[patch.step],
    ...patch
  };
  const existingIndex = steps.findIndex((step) => step.step === patch.step);
  if (existingIndex >= 0) {
    const next = [...steps];
    next[existingIndex] = { ...next[existingIndex], ...nextStep };
    return next;
  }
  return [...steps, nextStep];
}

function countEvidence(...values: Array<unknown>): number {
  let total = 0;
  for (const value of values) {
    if (Array.isArray(value)) {
      total += value.filter(Boolean).length;
      continue;
    }
    if (value && typeof value === 'object') {
      total += Object.keys(value as Record<string, unknown>).length;
      continue;
    }
    if (value) {
      total += 1;
    }
  }
  return total;
}

function createStructuredProcessingError(code: AnalysisErrorCode, message: string): Error & { code: AnalysisErrorCode } {
  return Object.assign(new Error(message), { code });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Okänt fel');
}

function getProcessingErrorCode(error: unknown, fallback: AnalysisErrorCode = 'schema_invalid'): AnalysisErrorCode {
  const code = (error as { code?: AnalysisErrorCode } | undefined)?.code;
  return code || fallback;
}

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
    processingStatus: 'failed',
    processingErrorCode: errorCode,
    processingErrorMessage: errorMessage,
    analysisWarnings: [errorMessage],
    analysisTelemetry: ['Leadet markerades som failed i batchmaterialisering i stället för att tyst filtreras bort.'],
    analysisCompleteness: 'thin',
    analysisSteps: [{
      step: 'identity',
      status: 'failed',
      provider: STEP_DEFAULT_PROVIDER.identity,
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
    }]
  } as LeadData;
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
  domain: string,
  activeCarrier: string,
  techSolutionConfig: TechSolutionConfig | undefined,
  sourceGroundingEvidence: string,
  financialEvidenceText: string
): Promise<{
  checkoutCrawlResult: CheckoutEvidence;
  paymentEvidence: VerifiedPaymentEvidence;
  techProfile: StructuredTechProfile;
  retailEvidence: RetailFootprintEvidence;
  detectedEmailPattern: string;
  telemetryMessages: string[];
  checkoutStep: { status: AnalysisStep['status']; summary: string; data: Partial<AnalysisStep> };
  paymentStep: { status: AnalysisStep['status']; summary: string; data: Partial<AnalysisStep> };
  techStep: { status: AnalysisStep['status']; summary: string; data: Partial<AnalysisStep> };
}> {
  const commercialSignalsStartedAt = Date.now();
  const [checkoutCrawlResult, paymentEvidence, techProfile, retailEvidence, detectedEmailPattern] = await Promise.all([
    fetchCheckoutPositions(domain, activeCarrier, techSolutionConfig),
    fetchVerifiedPaymentSetup(domain, techSolutionConfig),
    fetchStructuredTechProfile(domain, techSolutionConfig),
    fetchRetailFootprint(domain),
    detectEmailPattern(domain, `${sourceGroundingEvidence || ''} ${financialEvidenceText || ''}`.trim())
  ]);

  return {
    checkoutCrawlResult,
    paymentEvidence,
    techProfile,
    retailEvidence,
    detectedEmailPattern,
    telemetryMessages: [
      checkoutCrawlResult.positions.length
        ? `Checkout crawl verifierade ${checkoutCrawlResult.positions.length} checkout-positioner.`
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
    checkoutStep: {
      status: checkoutCrawlResult.positions.length ? 'success' : 'partial',
      summary: checkoutCrawlResult.positions.length ? 'Checkout crawl verifierade checkout-positioner.' : 'Checkout crawl gav inga verifierade checkout-positioner.',
      data: {
        durationMs: Date.now() - commercialSignalsStartedAt,
        evidenceCount: checkoutCrawlResult.positions.length,
        confidence: checkoutCrawlResult.positions.length ? 0.9 : 0.25,
        sourceDomains: checkoutCrawlResult.sourceUrl ? [normalizeDomain(checkoutCrawlResult.sourceUrl)] : [],
        sourceUrls: checkoutCrawlResult.sourceUrl ? [checkoutCrawlResult.sourceUrl] : []
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
        sourceUrls: paymentEvidence.sourceUrl ? [paymentEvidence.sourceUrl] : []
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
        sourceUrls: techProfile.sourceUrl ? [techProfile.sourceUrl] : []
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
  const verifiedFinancialHistory = registryFields.financialHistory?.length
    ? registryFields.financialHistory
    : normalizeFinancialHistoryEntries(financials?.history || [], financialEvidence.evidenceText);
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
        step: 'checkout',
        provider: STEP_DEFAULT_PROVIDER.checkout,
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
    ],
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
        fetchCommercialSignalsBundle(domain, activeCarrier, techSolutionConfig, pickString(rawLead.companyName, rawLead.company_name, rawLead.name), pickString(rawLead.orgNumber, rawLead.org_number, rawLead.organizationNumber)),
        fetchVerifiedNewsBundle(
          pickString(rawLead.companyName, rawLead.company_name, rawLead.name),
          effectivePolicies.news,
          {
            orgNumber: pickString(rawLead.orgNumber, rawLead.org_number, rawLead.organizationNumber),
            strictCompanyMatch: effectivePolicies.strictCompanyMatch !== false,
            earliestNewsYear: effectivePolicies.earliestNewsYear
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
  const verifiedFinancialHistory = registryFields.financialHistory?.length
    ? registryFields.financialHistory
    : normalizeFinancialHistoryEntries(rawLead.financialHistory || [], financialEvidence.evidenceText);
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
function repairJson(json: string): string {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
  }

  let repaired = json;
  if (inString) repaired += '"';
  let trimmed = repaired.trim();
  
  if (openBraces > 0 && trimmed.endsWith('"')) {
    const lastColon = trimmed.lastIndexOf(':');
    const lastSeparator = Math.max(trimmed.lastIndexOf(','), trimmed.lastIndexOf('{'), trimmed.lastIndexOf('['));
    if (lastColon < lastSeparator) repaired += ': null';
  }

  trimmed = repaired.trim();
  if (trimmed.endsWith(':')) repaired += ' null';
  if (trimmed.endsWith(',')) repaired = repaired.slice(0, -1);

  while (openBrackets > 0) { repaired += ']'; openBrackets--; }
  while (openBraces > 0) { repaired += '}'; openBraces--; }

  return repaired;
}

function parseJsonSafely(rawText: string): any {
  const text = String(rawText || '').trim();
  if (!text) throw new Error('Empty JSON response');

  const withoutFences = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    const repaired = repairJson(withoutFences);
    return JSON.parse(repaired);
  }
}

/**
 * FINANCIAL FIREWALL PARSER (Same as Gemini)
 */
function parseRevenueToTKR(val: any): number {
  if (val === null || val === undefined || val === "Ej tillgänglig" || val === 0) return 0;
  if (typeof val === 'number') return Math.round(val);

  let str = String(val).toUpperCase().replace(/\s/g, '').replace(',', '.');
  const isNegative = str.includes('-') || str.includes('−') || (str.startsWith('(') && str.endsWith(')'));
  const numericPart = str.replace(/[^0-9.]/g, '');
  let num = parseFloat(numericPart) || 0;

  if (str.includes('MDSEK') || str.includes('MD')) num *= 1000000;
  else if (str.includes('MSEK') || str.includes('M')) num *= 1000;
  
  return Math.round(isNegative ? -num : num);
}

function parseRevenueToTKROptional(val: any): number | undefined {
  if (val === null || val === undefined || val === '' || val === 'Ej tillgänglig') return undefined;
  return parseRevenueToTKR(val);
}

function pickString(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  }
  return '';
}

function pickNumber(...values: any[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value.replace(',', '.'));
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*/, '')
    .trim();
}

function normalizeCompanyForComparison(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(aktiebolag|ab|publ|holding|group|gruppen|sweden|sverige)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCompanyAliases(companyName: string): string[] {
  const raw = String(companyName || '').trim();
  if (!raw) return [];

  const aliases = new Set<string>();
  aliases.add(raw);

  const hasAB = /\bab\b/i.test(raw) || /aktiebolag/i.test(raw);
  if (!hasAB) aliases.add(`${raw} AB`);

  const stripped = raw.replace(/\baktiebolag\b/ig, '').replace(/\bab\b/ig, '').replace(/\s+/g, ' ').trim();
  if (stripped) aliases.add(stripped);
  if (stripped && !/\bab\b/i.test(stripped)) aliases.add(`${stripped} AB`);

  return Array.from(aliases).filter(Boolean);
}

function normalizeOrgNumber(value: string): string {
  return String(value || '').replace(/[^0-9]/g, '');
}

function extractOrgNumberFromText(text: string): string {
  const cleaned = String(text || '');
  const match = cleaned.match(/\b\d{6}[-\s]?\d{4}\b|\b\d{10}\b|\b\d{12}\b/);
  return match ? match[0] : '';
}

function isLikelyGenericPersonName(name: string): boolean {
  const cleaned = String(name || '').trim();
  if (!cleaned) return true;

  const compact = cleaned.replace(/\s+/g, ' ');
  const parts = compact.split(' ').filter(Boolean);
  if (parts.length < 2) return true;

  const blacklist = new Set([
    'anna', 'anders', 'johan', 'maria', 'erik', 'john', 'jane', 'peter', 'michael',
    'sales', 'support', 'kundservice', 'team', 'info', 'admin', 'kontakt'
  ]);

  const first = parts[0].toLowerCase();
  return blacklist.has(first) && parts.length === 2;
}

function isConflictingCompanyVariant(sourceText: string, aliases: string[]): boolean {
  const lowered = sourceText.toLowerCase();
  const baseAlias = aliases
    .map(normalizeCompanyForComparison)
    .find(Boolean) || '';

  if (!baseAlias) return false;

  if ((lowered.includes(`${baseAlias} fastighet`) || lowered.includes(`${baseAlias} fastigheter`)) && !lowered.includes(`${baseAlias} ab`)) {
    return true;
  }

  return false;
}

function looksLikeCompanyNewsText(newsText: string, companyAliases: string[], orgNumber?: string): boolean {
  const text = String(newsText || '').toLowerCase();
  if (!text) return false;

  const hasAlias = companyAliases.some((alias) => text.includes(alias.toLowerCase()));
  const orgNormalized = normalizeOrgNumber(orgNumber || '');
  const hasOrg = orgNormalized ? normalizeOrgNumber(text).includes(orgNormalized) : false;

  if (isConflictingCompanyVariant(text, companyAliases)) return false;
  return hasAlias || hasOrg;
}

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

function parseResultDate(value: any): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseLikelyPublishedDate(item: any): Date | null {
  return parseResultDate(item?.published_date)
    || parseResultDate(item?.publishedDate)
    || parseResultDate(item?.date)
    || parseResultDate(item?.metadata?.published_date)
    || null;
}

function formatTkr(value?: number): string {
  if (value === undefined || Number.isNaN(value)) return '';
  return `${Math.round(value).toLocaleString('sv-SE')} tkr`;
}

function parseLooseNumber(value: string): number | undefined {
  const cleaned = String(value || '').replace(/[<>]/g, '').replace(/[−–]/g, '-').replace(/\s+/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseAmountToTkr(value: string, unit?: string): number | undefined {
  const numeric = parseLooseNumber(value);
  if (numeric === undefined) return undefined;

  const normalizedUnit = String(unit || '').toLowerCase();
  if (normalizedUnit === 'sek' && Math.abs(numeric) >= 1000) {
    return Math.round(numeric / 1000);
  }

  if (!normalizedUnit && Math.abs(numeric) >= 10000000) {
    return Math.round(numeric / 1000);
  }

  return parseRevenueToTKR(`${value}${normalizedUnit ? ` ${normalizedUnit}` : ''}`.trim());
}

function parseLabeledMetricText(text: string, labels: string[]): string {
  const source = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}[\s\S]{0,120}?([<>−-]?\s*[\d\s.,]+(?:\s*(?:%|kr|tkr|mkr|msek))?)`, 'i');
    const match = source.match(pattern);
    const candidate = pickString(match?.[1]).replace(/[−–]/g, '-').replace(/\s{2,}/g, ' ').trim();
    if (candidate) return candidate;
  }
  return '';
}

function parseLabeledFreeText(text: string, labels: string[]): string {
  const source = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}[^\n]{0,15}[:\-]?\s*([^\n|]{2,80})`, 'i');
    const match = source.match(pattern);
    const candidate = pickString(match?.[1]).replace(/\s{2,}/g, ' ').replace(/[.;,\s]+$/, '').trim();
    if (candidate) return candidate;
  }
  return '';
}

function normalizeAddressCandidate(candidate: string): string {
  return String(candidate || '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[|;]/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ', ')
    .trim();
}

function parseFinancialHistoryFromEvidence(text: string): FinancialYear[] {
  const source = String(text || '');
  if (!source) return [];

  const rows = Array.from(source.matchAll(/(?:^|\n|\|)\s*(20\d{2})[^\n|]{0,24}?(-?[\d\s.,]+)(?:\s*(tkr|mkr|msek|sek))?[^\n|]{0,24}?(-?[\d\s.,]+)(?:\s*(tkr|mkr|msek|sek))?/gi))
    .map((match) => {
      const revenueTkr = parseAmountToTkr(match[2], match[3]);
      const profitTkr = parseAmountToTkr(match[4], match[5]);
      if (revenueTkr === undefined && profitTkr === undefined) return null;
      return {
        year: match[1],
        revenue: formatTkr(revenueTkr || 0),
        profit: formatTkr(profitTkr || 0)
      } as FinancialYear;
    })
    .filter(Boolean) as FinancialYear[];

  return Array.from(new Map(rows.map((row) => [row.year, row])).values())
    .sort((a, b) => Number(b.year) - Number(a.year))
    .slice(0, 3);
}

function deriveProfitMargin(history: FinancialYear[], fallback?: string): string {
  if (fallback && fallback !== '0%' && fallback !== '0') return fallback;
  const latest = history[0];
  if (!latest) return fallback || '';
  const revenue = parseLooseNumber(latest.revenue);
  const profit = parseLooseNumber(latest.profit || '');
  if (!revenue || profit === undefined) return fallback || '';
  return `${((profit / revenue) * 100).toFixed(1)}%`;
}

function deriveFinancialTrend(history: FinancialYear[], fallback?: string): string {
  if (history.length < 2) return fallback || '';
  const latestRevenue = parseLooseNumber(history[0].revenue);
  const oldestRevenue = parseLooseNumber(history[history.length - 1].revenue);
  if (!latestRevenue || !oldestRevenue) return fallback || '';
  const growth = ((latestRevenue - oldestRevenue) / Math.max(oldestRevenue, 1)) * 100;
  if (growth >= 8) return 'Växande';
  if (growth <= -5) return 'Minskande';
  return 'Stabil';
}

function deriveRiskProfileFromMetrics(input: {
  legalStatus?: string;
  paymentRemarks?: string;
  debtBalance?: string;
  debtEquityRatio?: string;
  solidity?: string;
  liquidityRatio?: string;
  vatRegistered?: boolean;
}, fallback?: string): string {
  const status = String(input.legalStatus || '').toLowerCase();
  if (status.includes('konkurs') || status.includes('likvidation') || status.includes('rekonstruktion')) return 'Hög';
  if (input.vatRegistered === false) return 'Hög';

  const paymentRemarks = String(input.paymentRemarks || '').toLowerCase();
  const debtBalance = parseLooseNumber(String(input.debtBalance || '')) || 0;
  const debtEquityRatio = parseLooseNumber(String(input.debtEquityRatio || ''));
  const solidity = parseLooseNumber(String(input.solidity || '').replace('%', ''));
  const liquidity = parseLooseNumber(String(input.liquidityRatio || '').replace('%', ''));

  if ((paymentRemarks && !paymentRemarks.includes('inga') && !paymentRemarks.includes('saknas')) || debtBalance > 0 || (debtEquityRatio !== undefined && debtEquityRatio >= 2)) {
    return 'Hög';
  }
  if ((solidity !== undefined && solidity < 15) || (liquidity !== undefined && liquidity < 100) || (debtEquityRatio !== undefined && debtEquityRatio >= 1)) {
    return 'Medel';
  }
  if ((solidity !== undefined && solidity >= 20) && (liquidity === undefined || liquidity >= 100)) {
    return 'Låg';
  }
  return fallback || 'Medel';
}

function detectStructuredLabels(text: string, patterns: Array<{ label: string; keywords: string[] }>): string[] {
  const haystack = String(text || '').toLowerCase();
  if (!haystack) return [];
  return Array.from(new Set(
    patterns
      .filter((pattern) => pattern.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())))
      .map((pattern) => pattern.label)
  ));
}

function normalizeDecisionMakerName(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9åäö\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDecisionMakerTitle(title: string): string {
  return String(title || '').toLowerCase().replace(/[^a-z0-9åäö\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreDecisionMaker(contact: DecisionMaker): number {
  return (contact.linkedin ? 3 : 0)
    + (contact.email ? 2 : 0)
    + (contact.directPhone ? 2 : 0)
    + (contact.verificationNote ? 2 : 0)
    + (contact.name.trim().split(/\s+/).length >= 2 ? 1 : 0);
}

function dedupeDecisionMakers(contacts: DecisionMaker[], maxResults = 6): DecisionMaker[] {
  const ranked = [...contacts]
    .filter((contact) => contact.name && contact.title)
    .sort((a, b) => scoreDecisionMaker(b) - scoreDecisionMaker(a));

  const seenNames = new Set<string>();
  const seenTitles = new Set<string>();
  const unique: DecisionMaker[] = [];

  for (const contact of ranked) {
    const normalizedName = normalizeDecisionMakerName(contact.name);
    const normalizedTitle = normalizeDecisionMakerTitle(contact.title);
    if (!normalizedName || seenNames.has(normalizedName)) continue;
    if (normalizedTitle && seenTitles.has(normalizedTitle)) continue;
    seenNames.add(normalizedName);
    if (normalizedTitle) seenTitles.add(normalizedTitle);
    unique.push(contact);
    if (unique.length >= maxResults) break;
  }

  return unique;
}

const MARKET_LABELS: Array<{ label: string; keywords: string[] }> = [
  { label: 'Sverige', keywords: ['sverige', 'sweden'] },
  { label: 'Norge', keywords: ['norge', 'norway'] },
  { label: 'Finland', keywords: ['finland'] },
  { label: 'Danmark', keywords: ['danmark', 'denmark'] },
  { label: 'Tyskland', keywords: ['tyskland', 'germany'] },
  { label: 'Nederländerna', keywords: ['nederländerna', 'netherlands'] },
  { label: 'Belgien', keywords: ['belgien', 'belgium'] },
  { label: 'Österrike', keywords: ['österrike', 'austria'] },
  { label: 'Frankrike', keywords: ['frankrike', 'france'] }
];

function parseStoreCount(text: string): number | undefined {
  const source = String(text || '');
  const patterns = [
    /(\d{1,4})\s+(?:butiker|stores|store locations|butikslokaler)/i,
    /(?:har|driver|med)\s+(\d{1,4})\s+(?:butiker|stores)/i
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    const parsed = match?.[1] ? Number(match[1]) : undefined;
    if (parsed && parsed > 0) return parsed;
  }
  return undefined;
}

function extractMarketLabels(text: string): string[] {
  const haystack = String(text || '').toLowerCase();
  const marketContextPatterns = [
    /levererar\s+till[^\n:.]{0,160}/i,
    /ship(?:s|ping)?\s+to[^\n:.]{0,160}/i,
    /available in[^\n:.]{0,160}/i,
    /finns i[^\n:.]{0,160}/i,
    /butiker i[^\n:.]{0,160}/i,
    /stores? in[^\n:.]{0,160}/i,
    /marknader[^\n:.]{0,160}/i,
    /countries[^\n:.]{0,160}/i,
    /välj land[^\n:.]{0,160}/i,
    /select country[^\n:.]{0,160}/i,
    /shipping destinations[^\n:.]{0,200}/i,
    /leverans[^\n:.]{0,160}/i,
    /frakt[^\n:.]{0,160}/i,
    /internationell[^\n:.]{0,160}/i,
    /international[^\n:.]{0,160}/i
  ];
  const contextualWindows = marketContextPatterns
    .flatMap((pattern) => Array.from(haystack.matchAll(new RegExp(pattern.source, 'gi'))).map((match) => match[0] || ''))
    .join('\n');
  const source = contextualWindows || haystack;
  if (!source.trim()) return [];
  return Array.from(new Set(
    MARKET_LABELS
      .filter((item) => item.keywords.some((keyword) => source.includes(keyword.toLowerCase())))
      .map((item) => item.label)
  ));
}

function normalizeFinancialHistoryEntries(history: any[], evidenceText?: string): FinancialYear[] {
  const normalized = (Array.isArray(history) ? history : [])
    .map((entry: any) => {
      const year = pickString(entry?.year);
      if (!/^20\d{2}$/.test(year)) return null;
      return {
        year,
        revenue: `${parseRevenueToTKR(entry?.revenue || 0).toLocaleString('sv-SE')} tkr`,
        profit: `${parseRevenueToTKR(entry?.profit || 0).toLocaleString('sv-SE')} tkr`
      } as FinancialYear;
    })
    .filter(Boolean) as FinancialYear[];

  const deduped = Array.from(new Map(normalized.map(entry => [entry.year, entry])).values())
    .sort((a, b) => Number(b.year) - Number(a.year))
    .slice(0, 3);

  if (deduped.length >= 3) return deduped;

  const verifiedRows = parseFinancialHistoryFromEvidence(String(evidenceText || ''));
  if (verifiedRows.length >= 3) return verifiedRows;

  const fallbackMatches = Array.from(String(evidenceText || '').matchAll(/\b(20\d{2})\b[^\n]{0,80}?([\d\s.]+)\s*tkr[^\n]{0,80}?([\d\s.\-]+)\s*tkr/gi));
  const fallback = fallbackMatches
    .map(match => ({
      year: match[1],
      revenue: `${parseRevenueToTKR(`${match[2]} tkr`).toLocaleString('sv-SE')} tkr`,
      profit: `${parseRevenueToTKR(`${match[3]} tkr`).toLocaleString('sv-SE')} tkr`
    }))
    .filter(entry => /^20\d{2}$/.test(entry.year))
    .sort((a, b) => Number(b.year) - Number(a.year));

  return Array.from(new Map([...deduped, ...fallback].map(entry => [entry.year, entry])).values())
    .sort((a, b) => Number(b.year) - Number(a.year))
    .slice(0, 3);
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
        mappedFields.forEach((field) => {
          coverage.push({
            category,
            field,
            source: domain,
            url,
            isPreferred: preferredSet.has(domain)
          });
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
};

type VerifiedPaymentEvidence = {
  paymentProvider?: string;
  checkoutSolution?: string;
  evidenceSnippet: string;
  confidence: 'verified' | 'estimated' | 'missing';
  sourceUrl?: string;
};

type CheckoutEvidence = {
  positions: Array<{ carrier: string; pos: number; service: string; price: string; inCheckout: boolean }>;
  evidenceSnippet: string;
  confidence: 'crawled' | 'estimated' | 'missing';
  sourceUrl?: string;
};

type VerifiedNewsEvidence = {
  summary: string;
  confidence: 'verified' | 'estimated' | 'missing';
  sources: string[];
  items: NewsItem[];
};

type RetailFootprintEvidence = {
  storeCount?: number;
  activeMarkets: string[];
  visitingAddress?: string;
  warehouseAddress?: string;
  evidenceSnippet: string;
  confidence: 'verified' | 'estimated' | 'missing';
  sourceUrl?: string;
};

type StructuredTechProfile = TechDetections & {
  evidenceSnippet: string;
  confidence: 'verified' | 'estimated' | 'missing';
  sourceUrl?: string;
};

const RISK_FIELD_KEYWORDS: Record<'legalStatus' | 'paymentRemarks' | 'debtBalance' | 'debtEquityRatio', string[]> = {
  legalStatus: ['status', 'likvidation', 'konkurs', 'rekonstruktion'],
  paymentRemarks: ['betalningsanmärkning', 'betalningsanmarkning', 'anmärkning', 'anmarkning'],
  debtBalance: ['skuldsaldo', 'kfm', 'kronofogden'],
  debtEquityRatio: ['skuldsättningsgrad', 'skuldsattningsgrad', 'skuld', 'eget kapital']
};

function findPatternMatch(
  haystack: string,
  patterns: Array<{ label: string; keywords: string[] }>
): { label?: string; keyword?: string } {
  for (const pattern of patterns) {
    for (const keyword of pattern.keywords) {
      if (haystack.includes(keyword.toLowerCase())) {
        return { label: pattern.label, keyword };
      }
    }
  }
  return {};
}

function extractEvidenceSnippet(text: string, keywords: string[]): string {
  const source = String(text || '');
  const lowered = source.toLowerCase();
  for (const keyword of keywords) {
    const index = lowered.indexOf(keyword.toLowerCase());
    if (index >= 0) {
      const start = Math.max(0, index - 120);
      const end = Math.min(source.length, index + 220);
      return source.slice(start, end).replace(/\s+/g, ' ').trim();
    }
  }
  return source.slice(0, 280).replace(/\s+/g, ' ').trim();
}

function containsAnyKeyword(text: string, keywords: string[]): boolean {
  const haystack = String(text || '').toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

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
    .sort((a, b) => Number(b.isPreferred) - Number(a.isPreferred))[0];

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

function extractEmailsFromText(text: string, companyDomain?: string): string[] {
  const matches: string[] = String(text || '').match(/\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b/gi) || [];
  const normalizedDomain = normalizeDomain(companyDomain || '');
  const filtered = normalizedDomain
    ? matches.filter((email) => normalizeDomain(email.split('@')[1] || '') === normalizedDomain)
    : matches;
  return Array.from(new Set(filtered.map((email) => email.toLowerCase())));
}

function extractPhoneNumbersFromText(text: string): string[] {
  const matches = String(text || '').match(/(?:\+46|0)\s?(?:\d[\s-]?){6,11}\d/g) || [];
  return Array.from(new Set(matches.map((phone) => phone.replace(/\s+/g, ' ').trim())));
}

function normalizeRoleToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9åäö]/g, '');
}

function roleMatchesFocus(role: string, focusRoles: string[]): boolean {
  const normalizedRole = normalizeRoleToken(role);
  const normalizedFocus = focusRoles
    .filter(Boolean)
    .map(normalizeRoleToken)
    .filter(Boolean);
  if (!normalizedFocus.length) return Boolean(normalizedRole);
  return normalizedFocus.some((focus) => normalizedRole.includes(focus) || focus.includes(normalizedRole));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseLabeledTkrValue(text: string, labels: string[]): number | undefined {
  const source = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}[^\d\n]{0,120}([\d\s.,]+)(?:\s*(tkr|mkr|msek|sek))?`, 'i');
    const match = source.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseAmountToTkr(match[1], match[2]);
    if (parsed === undefined) continue;
    if (parsed > 0 || String(match[1]).includes('0')) return parsed;
  }
  return undefined;
}

function parseLabeledAddress(text: string, labels: string[]): string {
  const source = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\s*:?\s*([^\n|]{8,140})`, 'i');
    const match = source.match(pattern);
    const candidate = normalizeAddressCandidate(
      pickString(match?.[1])
        .replace(/[.;,\s]+$/, '')
        .trim()
    );
    if (candidate && /\d/.test(candidate) && (/\b\d{3}\s?\d{2}\b/.test(candidate) || /gatan|vägen|vagen|road|street|väg/i.test(candidate))) {
      return candidate;
    }
  }
  return '';
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
  for (const path of pathsToTry) {
    try {
      const url = `https://${normalizedDomain}${path}`;
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
    } catch { /* try next path */ }
  }
  if (!checkoutContent) return { positions: [], evidenceSnippet: '', confidence: 'missing' };
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
  return { positions, evidenceSnippet: checkoutContent.slice(0, 500), confidence: 'crawled', sourceUrl: sourceUrl || undefined };
}

async function fetchVerifiedPaymentSetup(domain: string, techSolutionConfig?: TechSolutionConfig): Promise<VerifiedPaymentEvidence> {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return { paymentProvider: '', checkoutSolution: '', evidenceSnippet: '', confidence: 'missing' };
  }

  const pathsToTry = ['/', '/checkout', '/kassan', '/cart', '/varukorg', '/betalning', '/payment'];
  let bestUrl = '';
  let combinedContent = '';

  for (const path of pathsToTry) {
    try {
      const url = `https://${normalizedDomain}${path}`;
      const resp = await axios.post(
        buildApiUrl('/api/crawl'),
        { url, actionType: 'crawl', includeLinks: false, includeImages: false, maxDepth: 1 },
        { timeout: 15000 }
      );
      const content = pickString(resp.data?.content);
      if (!content) continue;
      if (!bestUrl) bestUrl = url;
      combinedContent += `\n${content.slice(0, 2500)}`;
    } catch {
      continue;
    }
  }

  const haystack = combinedContent.toLowerCase();
  if (!haystack.trim()) {
    return { paymentProvider: '', checkoutSolution: '', evidenceSnippet: '', confidence: 'missing' };
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
      sourceUrl: bestUrl || undefined
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
  for (const path of pathsToTry) {
    try {
      const url = `https://${normalizedDomain}${path}`;
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
    } catch {
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
    sourceUrl: sourceUrl || undefined
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
  for (const path of pathsToTry) {
    try {
      const url = `https://${normalizedDomain}${path}`;
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
    } catch {
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
    sourceUrl: sourceUrl || undefined
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
function inferEmailPattern(localParts: string[], domain: string): string {
  const dotParts = localParts.filter(p => p.includes('.'));
  if (dotParts.length > 0 && dotParts.length / localParts.length >= 0.5) return `förnamn.efternamn@${domain}`;
  const initDotParts = localParts.filter(p => /^[a-z]\.[a-z]{2,}$/.test(p));
  if (initDotParts.length > 0) return `f.efternamn@${domain}`;
  return `[namn]@${domain}`;
}

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
  options?: { orgNumber?: string; contactNames?: string[]; strictCompanyMatch?: boolean; earliestNewsYear?: number }
): Promise<VerifiedNewsEvidence> {
  if (!companyName) return { summary: '', confidence: 'missing', sources: [], items: [] };

  const aliases = buildCompanyAliases(companyName);
  const primaryAlias = aliases[0] || companyName;
  const companyClause = aliases.slice(0, 3).map((a) => `"${a}"`).join(' OR ');
  const siteQuery = domains.slice(0, 8).map((d) => `site:${normalizeDomain(d)}`).join(' OR ');
  const orgNumber = pickString(options?.orgNumber);
  const orgClause = orgNumber ? ` OR "${orgNumber}"` : '';
  const strictCompanyMatch = options?.strictCompanyMatch !== false;
  const earliestNewsYear = options?.earliestNewsYear || (new Date().getFullYear() - 1);
  const contactNames = (options?.contactNames || [])
    .map((n) => String(n || '').trim())
    .filter((n) => n.length > 4)
    .filter((n) => !isLikelyGenericPersonName(n))
    .slice(0, 2);
  const contactClause = contactNames.length
    ? ` OR (${contactNames.map((name) => `"${name}" AND "${primaryAlias}"`).join(' OR ')})`
    : '';
  const query = `(${companyClause}${orgClause}${contactClause}) (${siteQuery}) (nyheter OR pressmeddelande OR expansion OR rekrytering)`;

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
          query: `${companyName} ${contactNames.join(' ')} nyheter pressmeddelande expansion`,
          action: 'search',
          maxResults: 4
        },
        {
          timeout: 15000
        }
      )
    ]);

    const results = [...(response.data?.results || []), ...(broadResponse.data?.results || [])];
    if (!Array.isArray(results) || results.length === 0) return { summary: '', confidence: 'missing', sources: [], items: [] };

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
    if (!safeResults.length) return { summary: '', confidence: 'missing', sources: [], items: [] };

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
    return { summary: '', confidence: 'missing', sources: [], items: [] };
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

      const backendError = error.response?.data?.error || error.message || 'Unknown OpenRouter error';
      const errorMsg = typeof backendError === 'string' ? backendError : String(backendError);
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
    halluccinationScore: 0 // Will be updated by Tavily
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
      publishStep('checkout', 'running', 'Crawlar checkoutflöden...');
      publishStep('payment', 'running', 'Detekterar verifierad betalsetup...');
      publishStep('tech_stack', 'running', 'Bygger verifierad tech-profil...');
      const commercialBundle = await fetchCommercialSignalsBundle(parsedDomain, activeCarrier, techSolutionConfig, sourceGroundingEvidence, financialEvidence.evidenceText || '');
      checkoutCrawlResult = commercialBundle.checkoutCrawlResult;
      paymentEvidence = commercialBundle.paymentEvidence;
      techProfile = commercialBundle.techProfile;
      retailEvidence = commercialBundle.retailEvidence;
      detectedEmailPattern = commercialBundle.detectedEmailPattern;
      commercialBundle.telemetryMessages.forEach(pushTelemetry);
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
        earliestNewsYear: effectivePolicies.earliestNewsYear
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
  marketSettings?: CarrierSettings[]
): Promise<LeadData[]> {
  const activeModel = model || selectedModel;
  try {
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
    EXKLUDERA DESSA BOLAG (Returnera dem INTE): ${exclusionList.slice(0, 50).join(', ')}`;

    const responseText = await callOpenRouterWithRetry(
      activeModel, 
      prompt, 
      {
        systemInstruction: BATCH_PROSPECTING_INSTRUCTION + "\n\nVIKTIGT: Returnera ALDRIG bolag som finns i exkluderingslistan.",
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

    if (Array.isArray(leadsArray) && leadsArray.length > 0 && filteredLeads.length === 0) {
      throw createStructuredProcessingError('schema_invalid', 'Batchresultatet innehöll poster men inget lead följde förväntat schema.');
    }

    const enrichedLeads = await Promise.all(filteredLeads.map(async (l: any, index: number) => {
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
    return targetSegments.length
      ? persistedLeads.filter((lead) => lead.processingStatus === 'failed' || targetSegments.includes(lead.segment))
      : persistedLeads;
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
