/**
 * stepUtils.ts — AnalysisStep constants, builder functions, source coverage helpers,
 * and tech-solution config utilities.
 * Extracted from openrouterService.ts.
 */
import {
  AnalysisStep, AnalysisStepName, AnalysisStepProvider, AnalysisDiagnosticEngine,
  AnalysisDiagnosticSourceType, VerifiedLeadField, AnalysisErrorCode,
  SourceCoverageEntry, SourceCoverageExtractionMethod, AnalysisPolicy,
  TechSolutionCategory, TechSolutionConfig, DecisionMaker
} from '../../types.js';
import { normalizeDomain } from './parseUtils.js';
import {
  DEFAULT_ANALYSIS_TRUSTED_DOMAINS,
  DEFAULT_ANALYSIS_CATEGORY_PAGE_HINTS
} from '../analysisPolicy.js';
import {
  getTechSolutionsByCategory,
  normalizeTechSolutionConfig,
  DEFAULT_TECH_SOLUTION_CONFIG
} from '../techSolutionConfig.js';

// ── Tech solution pattern type ─────────────────────────────────────────────
export type TechSolutionPattern = { label: string; keywords: string[] };

// ── Source domain defaults ─────────────────────────────────────────────────
export const FINANCIAL_SOURCE_DOMAINS = ['allabolag.se', 'kreditrapporten.se', 'boolag.se', 'ratsit.se', 'bolagsverket.se'];
export const ADDRESS_SOURCE_DOMAINS = ['allabolag.se', 'boolag.se', 'ratsit.se', 'bolagsverket.se', 'hitta.se', 'eniro.se'];
export const CONTACT_SOURCE_DOMAINS = ['ratsit.se', 'allabolag.se', 'linkedin.com', 'hitta.se'];
export const PAYMENT_SOURCE_DOMAINS = ['klarna.com', 'stripe.com', 'adyen.com', 'checkout.com'];
export const WEBSOFTWARE_SOURCE_DOMAINS = ['shopify.com', 'woocommerce.com', 'norce.io', 'centra.com', 'magento.com'];
export const DEFAULT_TRUSTED_DOMAINS = DEFAULT_ANALYSIS_TRUSTED_DOMAINS;
export const DEFAULT_CATEGORY_PAGE_HINTS: Record<string, string[]> = DEFAULT_ANALYSIS_CATEGORY_PAGE_HINTS;

// ── AnalysisStep configuration maps ───────────────────────────────────────
export const STEP_DEFAULT_PROVIDER: Record<AnalysisStepName, AnalysisStepProvider> = {
  identity: 'internal',
  source_grounding: 'tavily',
  financials: 'registry',
  logistics: 'crawl4ai',
  tech_stack: 'crawl4ai',
  checkout: 'crawl4ai',
  payment: 'crawl4ai',
  news: 'tavily',
  contacts: 'tavily'
};

export const STEP_AFFECTED_FIELDS: Record<AnalysisStepName, VerifiedLeadField[]> = {
  identity: [],
  source_grounding: [],
  financials: ['revenue', 'profit', 'financialHistory', 'solidity', 'liquidityRatio', 'profitMargin', 'legalStatus', 'paymentRemarks', 'debtBalance', 'debtEquityRatio'],
  logistics: ['address', 'visitingAddress', 'warehouseAddress', 'activeMarkets', 'storeCount'],
  tech_stack: ['ecommercePlatform', 'taSystem'],
  checkout: ['checkoutOptions'],
  payment: ['paymentProvider', 'checkoutSolution'],
  news: ['latestNews'],
  contacts: ['decisionMakers', 'emailPattern']
};

export const STEP_LABELS: Record<AnalysisStepName, string> = {
  identity: 'Identity',
  source_grounding: 'Source Grounding',
  financials: 'Financials',
  logistics: 'Logistics',
  tech_stack: 'Tech Stack',
  checkout: 'Checkout',
  payment: 'Payment',
  news: 'News',
  contacts: 'Contacts'
};

// ── AnalysisStep diagnostic mapping ───────────────────────────────────────
export function mapProviderToDiagnosticEngine(provider?: AnalysisStepProvider): AnalysisDiagnosticEngine {
  if (provider === 'registry') return 'registry';
  if (provider === 'crawl4ai') return 'crawl';
  return 'llm_inference';
}

export function classifyDiagnosticSourceType(url: string, provider?: AnalysisStepProvider): AnalysisDiagnosticSourceType {
  const domain = normalizeDomain(url);
  if (domain.includes('linkedin.com')) return 'social';
  if (provider === 'registry' || provider === 'crawl4ai') return 'primary';
  return 'secondary';
}

// ── AnalysisStep builders ──────────────────────────────────────────────────
export function buildAnalysisStepDiagnostics(step: AnalysisStep): AnalysisStep['diagnostics'] {
  const sources = (step.sourceUrls || []).filter(Boolean).map((url) => ({
    url,
    weight: roundCoverageScore(step.confidence || 0),
    type: classifyDiagnosticSourceType(url, step.provider)
  }));

  return {
    engine: mapProviderToDiagnosticEngine(step.provider),
    durationMs: step.durationMs || 0,
    sources,
    errorContext: step.errorCode
      ? {
          code: String(step.errorCode).toUpperCase(),
          message: step.summary
        }
      : undefined
  };
}

export function buildAnalysisStepFieldCoverage(step: AnalysisStep): AnalysisStep['fieldCoverage'] {
  const total = Math.max(1, step.affectedFields?.length || 0);
  const filled = Math.min(total, Math.max(0, step.evidenceCount || 0));
  const verified = step.confidence >= 0.75
    ? filled
    : Math.min(filled, Math.round(filled * Math.max(0, step.confidence || 0)));

  return { total, filled, verified };
}

export function hydrateAnalysisStep(step: AnalysisStep): AnalysisStep {
  return {
    ...step,
    stepId: step.step,
    label: step.label || STEP_LABELS[step.step],
    confidenceScore: step.confidenceScore ?? step.confidence,
    fieldCoverage: step.fieldCoverage || buildAnalysisStepFieldCoverage(step),
    diagnostics: step.diagnostics || buildAnalysisStepDiagnostics(step)
  };
}

export function upsertAnalysisStep(
  steps: AnalysisStep[],
  patch: Partial<AnalysisStep> & Pick<AnalysisStep, 'step' | 'status' | 'summary'>
): AnalysisStep[] {
  const nextStep = hydrateAnalysisStep({
    provider: STEP_DEFAULT_PROVIDER[patch.step],
    durationMs: 0,
    evidenceCount: 0,
    confidence: 0,
    sourceDomains: [],
    sourceUrls: [],
    affectedFields: STEP_AFFECTED_FIELDS[patch.step],
    label: STEP_LABELS[patch.step],
    ...patch
  });
  const existingIndex = steps.findIndex((step) => step.step === patch.step);
  if (existingIndex >= 0) {
    const next = [...steps];
    next[existingIndex] = hydrateAnalysisStep({ ...next[existingIndex], ...nextStep });
    return next;
  }
  return [...steps, nextStep];
}

// ── Evidence counting & error utils ───────────────────────────────────────
export function countEvidence(...values: Array<unknown>): number {
  let total = 0;
  for (const value of values) {
    if (Array.isArray(value)) { total += value.filter(Boolean).length; continue; }
    if (value && typeof value === 'object') { total += Object.keys(value as Record<string, unknown>).length; continue; }
    if (value) { total += 1; }
  }
  return total;
}

export function createStructuredProcessingError(code: AnalysisErrorCode, message: string): Error & { code: AnalysisErrorCode } {
  return Object.assign(new Error(message), { code });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Okänt fel');
}

export function getProcessingErrorCode(error: unknown, fallback: AnalysisErrorCode = 'schema_invalid'): AnalysisErrorCode {
  const code = (error as { code?: AnalysisErrorCode } | undefined)?.code;
  return code || fallback;
}

// ── Analysis completeness assessment ──────────────────────────────────────
export function determineAnalysisCompleteness(input: {
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

// ── Source coverage scoring ────────────────────────────────────────────────
export function roundCoverageScore(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export function classifyCoverageWeight(
  category: string,
  domain: string,
  isPreferred: boolean,
  analysisPolicy?: AnalysisPolicy
): number {
  const weighting = analysisPolicy?.sources?.weighting || {
    registry: 1,
    officialSite: 0.8,
    industryMedia: 0.5,
    generalWeb: 0.2
  };
  const normalizedDomain = normalizeDomain(domain);
  const registryDomains = new Set(['allabolag.se', 'ratsit.se', 'kreditrapporten.se', 'boolag.se', 'bolagsverket.se']);
  const industryMediaDomains = new Set(['breakit.se', 'market.se', 'ehandel.se']);

  if (registryDomains.has(normalizedDomain)) return weighting.registry;
  if (industryMediaDomains.has(normalizedDomain) || category === 'news') return weighting.industryMedia;
  if (isPreferred) return weighting.officialSite;
  return weighting.generalWeb;
}

export function getSourceCoverageExtractionMethod(isPreferred: boolean): SourceCoverageExtractionMethod {
  return isPreferred ? 'site_search' : 'broad_search';
}

export function buildSourceCoverageEntry(input: {
  category: string;
  field: string;
  domain: string;
  url: string;
  isPreferred: boolean;
  analysisPolicy?: AnalysisPolicy;
}): SourceCoverageEntry {
  const extractionMethod = getSourceCoverageExtractionMethod(input.isPreferred);
  const weight = classifyCoverageWeight(input.category, input.domain, input.isPreferred, input.analysisPolicy);
  const confidenceScore = roundCoverageScore(weight + (input.isPreferred ? 0.1 : -0.05));

  return {
    category: input.category,
    field: input.field,
    source: input.domain,
    url: input.url,
    isPreferred: input.isPreferred,
    confidenceScore,
    extractionMethod
  };
}

// ── Tech solution config helpers ───────────────────────────────────────────
export function getEffectiveTechSolutionConfig(config?: TechSolutionConfig): TechSolutionConfig {
  return normalizeTechSolutionConfig(config || DEFAULT_TECH_SOLUTION_CONFIG);
}

export function getTechPatterns(config: TechSolutionConfig | undefined, category: TechSolutionCategory): TechSolutionPattern[] {
  return getTechSolutionsByCategory(getEffectiveTechSolutionConfig(config), category).map((solution) => ({
    label: solution.label,
    keywords: solution.keywords
  }));
}

export function getTechKeywords(config: TechSolutionConfig | undefined, category?: TechSolutionCategory): string[] {
  const effective = getEffectiveTechSolutionConfig(config);
  const categories: TechSolutionCategory[] = category
    ? [category]
    : ['ecommercePlatforms', 'checkoutSolutions', 'paymentProviders', 'taSystems', 'logisticsSignals'];

  return categories.flatMap((item) => getTechSolutionsByCategory(effective, item).flatMap((solution) => solution.keywords));
}
