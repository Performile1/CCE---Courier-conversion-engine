import axios from 'axios';
import { SYSTEM_INSTRUCTION } from "../prompts/systemInstructions";
import { MASTER_DEEP_SCAN_PROMPT } from "../prompts/deepAnalysis";
import { BATCH_PROSPECTING_INSTRUCTION } from "../prompts/batchProspecting";
import { calculateRickardMetrics, determineSegmentByPotential } from "../utils/calculations";
import { SearchFormData, LeadData, SNIPercentage, ThreePLProvider, NewsSourceMapping, DecisionMaker, SourcePolicyConfig, SourceCoverageEntry, SourcePerformanceEntry, DataConfidence, FinancialYear, VerifiedRegistrySnapshot } from "../types";

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
const DEFAULT_TRUSTED_DOMAINS = [
  'allabolag.se',
  'kreditrapporten.se',
  'boolag.se',
  'ratsit.se',
  'ehandel.se',
  'market.se',
  'breakit.se'
];
const FINANCIAL_SOURCE_DOMAINS = ['allabolag.se', 'kreditrapporten.se', 'boolag.se', 'ratsit.se'];
const ADDRESS_SOURCE_DOMAINS = ['allabolag.se', 'boolag.se', 'ratsit.se', 'bolagsverket.se', 'hitta.se', 'eniro.se'];
const CONTACT_SOURCE_DOMAINS = ['ratsit.se', 'allabolag.se', 'linkedin.com', 'hitta.se'];
const PAYMENT_SOURCE_DOMAINS = ['klarna.com', 'stripe.com', 'adyen.com', 'checkout.com'];
const WEBSOFTWARE_SOURCE_DOMAINS = ['shopify.com', 'woocommerce.com', 'norce.io', 'centra.com', 'magento.com'];
const TECH_SOLUTION_KEYWORDS = {
  ecommercePlatforms: ['shopify', 'woocommerce', 'magento', 'adobe commerce', 'centra', 'norce', 'prestashop'],
  checkoutSolutions: ['klarna checkout', 'kco', 'qliro checkout', 'stripe checkout', 'adyen checkout', 'nets easy'],
  paymentProviders: ['klarna', 'adyen', 'stripe', 'checkout.com', 'nets', 'svea', 'qliro', 'walley', 'payex'],
  taSystems: ['nshift', 'unifaun', 'centiro', 'ingrid', 'logtrade', 'shipmondo', 'consignor'],
  logisticsSignals: ['instabox', 'budbee', 'bring', 'postnord', 'dhl', 'db schenker', 'airmee']
};
const CATEGORY_PAGE_HINTS: Record<string, string[]> = {
  financial: ['bokslut', 'omsättning', 'resultat', 'soliditet', 'likviditet', 'annual report'],
  addresses: ['adress', 'besöksadress', 'postadress', 'kontakt', 'karta'],
  decisionMakers: ['ledning', 'styrelse', 'ceo', 'vd', 'kontaktperson', 'linkedin'],
  payment: ['checkout', 'betalning', 'klarna', 'stripe', 'adyen', 'payment methods'],
  webSoftware: ['platform', 'tech stack', 'shopify', 'woocommerce', 'norce', 'scripts'],
  news: ['nyheter', 'pressmeddelande', 'expansion', 'förvärv']
};

function resolveApiBaseUrl(): string {
  const configuredBaseUrl = (import.meta.env.VITE_BASE_URL || '').trim();
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

function getPreferredDomains(newsSourceMappings: NewsSourceMapping[], sniCode?: string): string[] {
  const normalizedSni = (sniCode || '').trim();
  const fromMappings = newsSourceMappings
    .filter((m) => {
      const prefix = (m.sniPrefix || '').trim();
      if (!prefix || prefix === '*') return true;
      return normalizedSni.startsWith(prefix);
    })
    .flatMap((m) => m.sources || []);

  const merged = [...DEFAULT_TRUSTED_DOMAINS, ...fromMappings]
    .map((d) => normalizeDomain(d))
    .filter(Boolean);

  return Array.from(new Set(merged));
}

function getSourcePriorityBlock(preferredDomains: string[]): string {
  const merged = Array.from(new Set([...preferredDomains, ...DEFAULT_TRUSTED_DOMAINS]));
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
    profit: ['profit', 'profitMargin'],
    solidity: ['solidity'],
    liquidityRatio: ['liquidityRatio'],
    addresses: ['address', 'visitingAddress', 'warehouseAddress', 'segment'],
    decisionMakers: ['decisionMakers', 'emailPattern', 'strategicPitch'],
    payment: ['paymentProvider', 'checkoutSolution', 'checkoutOptions', 'carriers', 'conversionScore', 'frictionAnalysis', 'dmtMatrix', 'recoveryPotentialSek'],
    webSoftware: ['ecommercePlatform', 'taSystem', 'techEvidence', 'storeCount', 'activeMarkets', 'marketCount', 'b2bPercentage', 'b2cPercentage'],
    news: ['latestNews', 'sourceCoverage', 'analysisDate']
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
  sourcePolicies: SourcePolicyConfig
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
  for (const category of categories) {
    const domains = (categoryDomains[category] || []).map(normalizeDomain).filter(Boolean).slice(0, 4);
    if (!domains.length) continue;

    const pageHints = CATEGORY_PAGE_HINTS[category] || ['about', 'kontakt', 'nyheter'];
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

        externalUrls = (broadResponse.data?.results || [])
          .map((r: any) => pickString(r?.url))
          .filter(Boolean)
          .map(u => ({ raw: u, domain: normalizeDomain(u) }))
          .filter(item => item.domain && !preferredSet.has(item.domain))
          .slice(0, 2)
          .map(item => item.raw);
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

function getTechWatchlistText(): string {
  return [
    `E-handelsplattformar: ${TECH_SOLUTION_KEYWORDS.ecommercePlatforms.join(', ')}`,
    `Checkout-lösningar: ${TECH_SOLUTION_KEYWORDS.checkoutSolutions.join(', ')}`,
    `Betalproviders: ${TECH_SOLUTION_KEYWORDS.paymentProviders.join(', ')}`,
    `TA-system: ${TECH_SOLUTION_KEYWORDS.taSystems.join(', ')}`,
    `Logistiksignaler: ${TECH_SOLUTION_KEYWORDS.logisticsSignals.join(', ')}`
  ].join('\n');
}

function detectTechSignals(content: string): string[] {
  const haystack = (content || '').toLowerCase();
  if (!haystack) return [];

  const keywords = Object.values(TECH_SOLUTION_KEYWORDS).flat();
  return keywords.filter((k) => haystack.includes(k.toLowerCase()));
}

async function fetchTechEvidenceFromCrawl(domain: string): Promise<string> {
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
    const hits = detectTechSignals(content);
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
};

type VerifiedFinancialEvidence = {
  evidenceText: string;
  confidence: 'verified' | 'estimated' | 'missing';
  sourceUrl?: string;
  parsed: VerifiedRegistryFields;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseLabeledTkrValue(text: string, labels: string[]): number | undefined {
  const source = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}[^\d\n]{0,40}([\d\s.]+)\s*tkr`, 'i');
    const match = source.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseRevenueToTKR(`${match[1]} tkr`);
    if (parsed > 0 || String(match[1]).includes('0')) return parsed;
  }
  return undefined;
}

function parseLabeledAddress(text: string, labels: string[]): string {
  const source = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\s*:?\s*([^\n|]{8,140})`, 'i');
    const match = source.match(pattern);
    const candidate = pickString(match?.[1])
      .replace(/\s{2,}/g, ' ')
      .replace(/[.;,\s]+$/, '')
      .trim();
    if (candidate && /\d/.test(candidate) && /,/.test(candidate)) return candidate;
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
    registeredAddress: parseLabeledAddress(source, ['registrerad adress', 'adress', 'besöksadress']),
    revenueTkr: parseLabeledTkrValue(source, ['omsättning', 'nettoomsättning']),
    profitTkr: parseLabeledTkrValue(source, ['resultat efter finansnetto', 'efter finansnetto', 'årets resultat', 'resultat'])
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
  focusCarrier: string
): Promise<{
  positions: Array<{ carrier: string; pos: number; service: string; price: string; inCheckout: boolean }>;
  evidenceSnippet: string;
  confidence: 'crawled' | 'estimated' | 'missing';
}> {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return { positions: [], evidenceSnippet: '', confidence: 'missing' };
  const pathsToTry = ['/checkout', '/kassan', '/varukorg', '/cart', '/leverans', '/frakt'];
  let checkoutContent = '';
  for (const path of pathsToTry) {
    try {
      const resp = await axios.post(
        buildApiUrl('/api/crawl'),
        { url: `https://${normalizedDomain}${path}`, actionType: 'crawl', includeLinks: false, includeImages: false, maxDepth: 1 },
        { timeout: 15000 }
      );
      const content = pickString(resp.data?.content);
      if (content && content.length > 200) { checkoutContent = content.slice(0, 2500); break; }
    } catch { /* try next path */ }
  }
  if (!checkoutContent) return { positions: [], evidenceSnippet: '', confidence: 'missing' };
  const haystack = checkoutContent.toLowerCase();
  const allCarriers = TECH_SOLUTION_KEYWORDS.logisticsSignals;
  const foundCarriers = allCarriers.filter(c => haystack.includes(c.toLowerCase()));
  const positions: Array<{ carrier: string; pos: number; service: string; price: string; inCheckout: boolean }> = foundCarriers.map((carrier, i) => ({
    carrier, pos: i + 1, service: '', price: 'N/A', inCheckout: true
  }));
  // Explicit "not in checkout" flag for the focus carrier
  const focusNorm = focusCarrier.toLowerCase();
  const focusFound = foundCarriers.some(c => c.toLowerCase().includes(focusNorm) || focusNorm.includes(c.toLowerCase()));
  if (!focusFound && focusCarrier) {
    positions.push({ carrier: focusCarrier, pos: 0, service: 'EJ I CHECKOUT', price: '—', inCheckout: false });
  }
  return { positions, evidenceSnippet: checkoutContent.slice(0, 500), confidence: 'crawled' };
}

// ── Phase 3: Role-Targeted Decision Maker Search ──────────────────────────
async function fetchDecisionMakersTargeted(
  companyName: string,
  orgNumber: string,
  focusRoles: string[],
  preferredDomains: string[]
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

  const found: Array<{ name: string; title: string; email: string; linkedin: string; directPhone: string; verificationNote: string }> = [];
  const seenNames = new Set<string>();
  for (const query of queries) {
    try {
      const resp = await axios.post(buildApiUrl('/api/tavily'), { query, action: 'search', maxResults: 5 }, { timeout: 12000 });
      const results: any[] = resp.data?.results || [];
      for (const r of results) {
        const text = `${pickString(r?.title)} ${pickString(r?.content)}`;
        const url = pickString(r?.url);
        const lowered = `${text} ${url}`.toLowerCase();
        const nameMatches = text.match(/\b([A-ZÅÄÖ][a-zåäö-]+\s+[A-ZÅÄÖ][a-zåäö-]+)\b/g) || [];
        const roleMatches = text.match(/(VD|CEO|logistikchef|inköpschef|e-handelschef|CMO|CFO|COO|styrelseordförande|styrelseledamot|Supply Chain|Head of Logistics)/gi) || [];
        if (!nameMatches.length || !roleMatches.length) continue;
        const aliasMatch = aliases.some(alias => lowered.includes(alias.toLowerCase()));
        const orgMatch = orgNormalized ? normalizeOrgNumber(lowered).includes(orgNormalized) : false;
        const linkedinVerified = url.includes('linkedin.com') && aliasMatch;
        const companyVerified = aliasMatch || orgMatch;
        if (!companyVerified) continue;
        const name = nameMatches[0];
        const role = roleMatches[0];
        if (/rickard|wigrund/i.test(name)) continue;
        if (isLikelyGenericPersonName(name)) continue;
        if (seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        found.push({
          name,
          title: role,
          email: '',
          linkedin: url.includes('linkedin.com') ? url : '',
          directPhone: '',
          verificationNote: linkedinVerified
            ? `Verifierad via LinkedIn + bolagsmatch (${normalizeDomain(url)})`
            : `Verifierad via bolagsmatch (${normalizeDomain(url)})`
        });
      }
    } catch { /* continue to next query */ }
  }
  return { contacts: found.slice(0, 4), confidence: found.length > 0 ? 'verified' : 'missing' };
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
): Promise<string> {
  if (!companyName) return '';

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
    if (!Array.isArray(results) || results.length === 0) return '';

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

    const safeResults = filtered.length ? filtered : results.slice(0, 2);

    const topEntries = safeResults.slice(0, 3).map((item: any) => {
      const title = pickString(item?.title, item?.content, 'Nyhet');
      const url = pickString(item?.url);
      const publishedDate = parseLikelyPublishedDate(item);
      const prefix = publishedDate ? `${publishedDate.toISOString().slice(0, 10)} · ` : '';
      return url ? `${prefix}${title} (${url})` : `${prefix}${title}`;
    });

    return topEntries.join(' | ');
  } catch (error) {
    return '';
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
  activeCountry?: string
): Promise<LeadData> {
  const activeModel = model || selectedModel;
  onUpdate({}, `Aktiverar OpenRouter Surgical Engine med ${MODEL_CONFIG[activeModel].displayName}...`);

  const effectivePolicies = mergeSourcePolicies(sourcePolicies, activeCountry);
  const customDomains = Object.values(effectivePolicies.customCategories || {}).flat();
  const preferredDomains = Array.from(new Set([
    ...getPreferredDomains(newsSourceMappings),
    ...effectivePolicies.news,
    ...effectivePolicies.financial,
    ...effectivePolicies.addresses,
    ...effectivePolicies.decisionMakers,
    ...effectivePolicies.payment,
    ...effectivePolicies.webSoftware,
    ...customDomains
  ].map(normalizeDomain).filter(Boolean)));
  const strictCompanyMatchEnabled = effectivePolicies.strictCompanyMatch !== false;
  const resolvedIdentity = strictCompanyMatchEnabled
    ? await resolveCompanyIdentity(formData.companyNameOrOrg, preferredDomains)
    : {
        canonicalName: formData.companyNameOrOrg,
        orgNumber: extractOrgNumberFromText(formData.companyNameOrOrg),
        aliases: buildCompanyAliases(formData.companyNameOrOrg)
      };
  const strictCompanyName = resolvedIdentity.canonicalName || formData.companyNameOrOrg;
  const strictOrgNumber = resolvedIdentity.orgNumber || extractOrgNumberFromText(formData.companyNameOrOrg);
  const identityLabel = strictOrgNumber ? `${strictCompanyName} (${strictOrgNumber})` : strictCompanyName;
  const searchQuery = `${identityLabel} (${preferredDomains.join(', ')}, LinkedIn)`;
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
${getSourcePriorityBlock(preferredDomains)}
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
${getTechWatchlistText()}

Om relevant nyhetsinformation hittas, inkludera ett fält \"latest_news\" med kort sammanfattning och URL.`;

  try {
    onUpdate({}, "Genomför teknisk & finansiell revision...");
    onUpdate({}, 'Samlar källunderlag via Tavily/Google, Allabolag och Crawl4ai...');
    const [sourceBundle, financialEvidence] = await Promise.all([
      fetchCategoryExactPageEvidenceBundle(identityLabel, effectivePolicies),
      fetchVerifiedFinancials(strictOrgNumber, strictCompanyName)
    ]);
    const sourceGroundingEvidence = sourceBundle.promptEvidence;
    onUpdate({}, financialEvidence.confidence === 'verified'
      ? '✓ Finansiell registerdata hämtad från Allabolag/Ratsit'
      : 'Finansiell registerdata ej tillgänglig — AI nyttjar källbevis');

    const groundedPrompt = `${prompt}

### SOURCE EVIDENCE (TAVILY/GOOGLE + CRAWL4AI)
${sourceGroundingEvidence || 'Ingen extern källa kunde hämtas i detta steg. Använd då source-priority-listan ovan.'}

### FINANSIELL REGISTERDATA (ALLABOLAG.SE / RATSIT.SE — DIREKT CRAWL)
${financialEvidence.evidenceText || 'Ingen direkt registerdata hämtad. Ange 0 för alla finansiella fält som saknas i SOURCE EVIDENCE.'}
KRITISK REGEL: Extrahera siffror verbatim från registerdata ovan. Inga avrundningar. Inga estimeringar. Inga påhittade siffror.

Använd source evidence och registerdata ovan när du fyller fälten. Om ett fält saknar evidens, skriv tom sträng eller 0 enligt schema.`;

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

    const root = (rawData?.lead && typeof rawData.lead === 'object') ? rawData.lead : rawData;
    const companyData = root?.company_data || root?.companyData || root?.company || {};
    const financials = root?.financials || root?.financialData || root?.financial_data || {};
    const logistics = root?.logistics || root?.logisticsData || root?.logistics_data || {};
    const contactsRaw = root?.contacts || root?.decisionMakers || root?.decision_makers || [];

    // ── Phase 2 + 4: Checkout crawl + email pattern (non-critical, parallel) ─
    const parsedDomain = normalizeDomain(
      pickString(companyData?.domain, companyData?.website, companyData?.url)
    );
    let checkoutCrawlResult: {
      positions: Array<{ carrier: string; pos: number; service: string; price: string; inCheckout: boolean }>;
      evidenceSnippet: string;
      confidence: 'crawled' | 'estimated' | 'missing';
    } = { positions: [], evidenceSnippet: '', confidence: 'missing' };
    let detectedEmailPattern = '';
    try {
      onUpdate({}, 'Crawlar checkoutpositioner & detekterar e-postmönster...');
      const phase24 = await Promise.all([
        fetchCheckoutPositions(parsedDomain, activeCarrier),
        detectEmailPattern(parsedDomain, sourceGroundingEvidence + ' ' + (financialEvidence.evidenceText || ''))
      ]);
      checkoutCrawlResult = phase24[0];
      detectedEmailPattern = phase24[1];
    } catch { /* Phase 2+4 non-critical — proceed with LLM data */ }

    // ── Phase 3: Targeted decision makers (non-critical, only if LLM sparse) ─
    const llmContactCount = Array.isArray(contactsRaw) ? contactsRaw.length : 0;
    let dmSupplement: Array<{ name: string; title: string; email: string; linkedin: string; directPhone: string; verificationNote: string }> = [];
    let dmConfidence: 'verified' | 'estimated' | 'missing' = 'estimated';
    try {
      if (llmContactCount < 2) {
        onUpdate({}, 'Söker beslutsfattare via rollstyrd källsökning...');
        const dmResult = await fetchDecisionMakersTargeted(
          pickString(companyData?.name, companyData?.company_name) || strictCompanyName,
          pickString(companyData?.org_nr, companyData?.organization_number) || strictOrgNumber,
          [formData.focusRole1, formData.focusRole2, formData.focusRole3],
          preferredDomains
        );
        dmSupplement = dmResult.contacts;
        dmConfidence = dmResult.confidence;
      }
    } catch { /* Phase 3 non-critical — proceed with LLM contacts */ }

    const registryFields = financialEvidence.parsed || {};
    const revenueTKR = registryFields.revenueTkr ?? parseRevenueToTKR(
      pickNumber(companyData?.revenue_tkr, companyData?.revenueTKR, companyData?.revenue) || 0
    );
    const profitTKR = registryFields.profitTkr ?? parseRevenueToTKR(financials?.history?.[0]?.profit || 0);
    const marketCount = pickNumber(companyData?.market_count, companyData?.marketCount) || 1;
    const sniCode = pickString(companyData?.sni_code, companyData?.sniCode, companyData?.sni);
    const metrics = calculateRickardMetrics(revenueTKR, sniCode, sniPercentages, marketCount);

    const latestNewsFromModelRaw = pickString(
      root?.latest_news,
      root?.latestNews,
      companyData?.latest_news,
      companyData?.latestNews,
      root?.news_summary,
      root?.newsSummary
    );
    const strictAliases = resolvedIdentity.aliases.length
      ? resolvedIdentity.aliases
      : buildCompanyAliases(strictCompanyName);
    const latestNewsFromModel = strictCompanyMatchEnabled
      ? (looksLikeCompanyNewsText(
        latestNewsFromModelRaw,
        strictAliases,
        pickString(companyData?.org_nr, companyData?.orgNumber, companyData?.organization_number, strictOrgNumber)
      )
        ? latestNewsFromModelRaw
        : '')
      : latestNewsFromModelRaw;
    const contactNames = (Array.isArray(contactsRaw) ? contactsRaw : [])
      .map((c: any) => pickString(c?.name))
      .filter(Boolean);
    const latestNewsFallback = latestNewsFromModel ? '' : await fetchLatestNews(
      pickString(companyData?.name, companyData?.companyName, companyData?.company_name) || strictCompanyName,
      Array.from(new Set([...getPreferredDomains(newsSourceMappings, sniCode), ...effectivePolicies.news].map(normalizeDomain).filter(Boolean))),
      {
        orgNumber: pickString(companyData?.org_nr, companyData?.orgNumber, companyData?.organization_number, strictOrgNumber),
        contactNames,
        strictCompanyMatch: strictCompanyMatchEnabled,
        earliestNewsYear: effectivePolicies.earliestNewsYear
      }
    );
    const modelTechEvidence = pickString(logistics?.tech_evidence, logistics?.techEvidence);
    const crawlTechEvidence = modelTechEvidence ? '' : await fetchTechEvidenceFromCrawl(
      pickString(companyData?.domain, companyData?.website, companyData?.url)
    );

    const verifiedRegistrySnapshot: VerifiedRegistrySnapshot | undefined = financialEvidence.confidence === 'verified'
      ? {
          sourceUrl: financialEvidence.sourceUrl,
          sourceLabel: financialEvidence.sourceUrl ? normalizeDomain(financialEvidence.sourceUrl) : 'allabolag.se',
          orgNumber: pickString(registryFields.orgNumber, strictOrgNumber),
          registeredAddress: pickString(registryFields.registeredAddress),
          revenue: revenueTKR ? `${revenueTKR.toLocaleString('sv-SE')} tkr` : '',
          profit: profitTKR || profitTKR === 0 ? `${profitTKR.toLocaleString('sv-SE')} tkr` : '',
          capturedAt: new Date().toISOString()
        }
      : undefined;

    const lead: LeadData = {
      id: crypto.randomUUID(),
      companyName: pickString(companyData?.name, companyData?.companyName, companyData?.company_name) || strictCompanyName,
      orgNumber: pickString(registryFields.orgNumber, companyData?.org_nr, companyData?.orgNumber, companyData?.organization_number, strictOrgNumber),
      domain: pickString(companyData?.domain, companyData?.website, companyData?.url),
      sniCode,
      address: pickString(registryFields.registeredAddress, companyData?.visiting_address, companyData?.address, companyData?.street_address),
      visitingAddress: pickString(companyData?.visiting_address, registryFields.registeredAddress, companyData?.address, companyData?.street_address),
      warehouseAddress: pickString(companyData?.warehouse_address, companyData?.warehouseAddress),
      revenue: `${revenueTKR.toLocaleString('sv-SE')} tkr`,
      revenueYear: pickString(companyData?.revenue_year, companyData?.revenueYear),
      profit: `${profitTKR.toLocaleString('sv-SE')} tkr`,
      activeMarkets: companyData?.active_markets || companyData?.activeMarkets || [],
      marketCount: marketCount,
      estimatedAOV: metrics.estimatedAOV,
      b2bPercentage: pickNumber(companyData?.b2b_percentage, companyData?.b2bPercentage) || 0,
      b2cPercentage: pickNumber(companyData?.b2c_percentage, companyData?.b2cPercentage) || 0,
      
      financialHistory: normalizeFinancialHistoryEntries(financials?.history || [], financialEvidence.evidenceText),
      solidity: pickString(financials?.solidity, financials?.equity_ratio) || '0%',
      liquidityRatio: pickString(financials?.liquidity_ratio, financials?.liquidityRatio) || '0%',
      profitMargin: pickString(financials?.profit_margin, financials?.profitMargin) || '0%',
      debtEquityRatio: pickString(financials?.debt_equity_ratio, financials?.debtEquityRatio),
      debtBalance: pickString(financials?.debt_balance_tkr, financials?.debtBalance, '0'),
      paymentRemarks: pickString(financials?.payment_remarks, financials?.paymentRemarks),
      isBankruptOrLiquidated: Boolean(financials?.is_bankrupt_or_liquidated || financials?.isBankruptOrLiquidated),
      financialSource: pickString(financials?.financial_source, financials?.source)
        || (financialEvidence.sourceUrl ? `Verifierad registerkälla: ${normalizeDomain(financialEvidence.sourceUrl)}` : '')
        || (sourceGroundingEvidence ? 'Kategori-styrd Tavily+Crawl4ai' : 'Officiella källor'),
      
      ecommercePlatform: pickString(logistics?.ecommerce_platform, logistics?.ecommercePlatform) || 'Okänd',
      paymentProvider: pickString(logistics?.payment_provider, logistics?.paymentProvider) || 'Okänd', 
      checkoutSolution: pickString(logistics?.checkout_solution, logistics?.checkoutSolution),
      taSystem: pickString(logistics?.ta_system, logistics?.taSystem),
      techEvidence: [modelTechEvidence, crawlTechEvidence, sourceGroundingEvidence].filter(Boolean).join(' | ').slice(0, 2000),
      carriers: Array.isArray(logistics?.carriers) ? logistics.carriers.join(', ') : pickString(logistics?.carriers),
      strategicPitch: pickString(logistics?.strategic_pitch, logistics?.strategicPitch),
      latestNews: latestNewsFromModel || latestNewsFallback, 
      
      decisionMakers: (() => {
        const llmContacts: DecisionMaker[] = (Array.isArray(contactsRaw) ? contactsRaw : []).map((c: any) => ({
          name: c.name || '', title: c.title || '', email: c.email || '', linkedin: c.linkedin || '',
          directPhone: c.direct_phone || c.directPhone || '', verificationNote: ''
        }));
        const supplement: DecisionMaker[] = dmSupplement
          .filter(dc => !llmContacts.some(lc => lc.name.toLowerCase().startsWith(dc.name.split(' ')[0].toLowerCase())))
          .map(dc => ({ name: dc.name, title: dc.title, email: dc.email, linkedin: dc.linkedin, directPhone: dc.directPhone, verificationNote: dc.verificationNote }));
        return [...llmContacts, ...supplement].slice(0, 6);
      })(),
      
      potentialSek: metrics.shippingBudgetSEK,
      freightBudget: `${metrics.potentialTKR.toLocaleString('sv-SE')} tkr`,
      annualPackages: metrics.annualPackages,
      pos1Volume: metrics.pos1Volume,
      pos2Volume: metrics.pos2Volume,
      segment: determineSegmentByPotential(metrics.shippingBudgetSEK),
      analysisDate: new Date().toISOString(),
      source: 'ai',
      legalStatus: pickString(companyData?.legal_status, companyData?.legalStatus) || 'Aktiv',
      vatRegistered: Boolean(companyData?.vat_registered || companyData?.vatRegistered),
      creditRatingLabel: pickString(companyData?.credit_rating, companyData?.creditRating) || 'N/A',
      creditRatingMotivation: pickString(companyData?.credit_rating_motivation, companyData?.creditRatingMotivation),
      riskProfile: pickString(companyData?.risk_profile, companyData?.riskProfile),
      financialTrend: pickString(companyData?.financial_trend, companyData?.financialTrend),
      industry: pickString(companyData?.industry, companyData?.industry_name),
      industryDescription: pickString(companyData?.industry_description, companyData?.industryDescription),
      websiteUrl: pickString(companyData?.domain, companyData?.website, companyData?.url)
        ? `https://${pickString(companyData?.domain, companyData?.website, companyData?.url).replace(/^https?:\/\//, '')}`
        : '',
      
      businessModel: pickString(companyData?.business_model, companyData?.businessModel),
      storeCount: pickNumber(logistics?.store_count, logistics?.storeCount) || 0,
      checkoutOptions: checkoutCrawlResult.confidence === 'crawled' && checkoutCrawlResult.positions.length > 0
        ? checkoutCrawlResult.positions.map(cp => ({
            position: cp.pos, carrier: cp.carrier, service: cp.service, price: cp.price, inCheckout: cp.inCheckout
          }))
        : (logistics?.checkout_positions || logistics?.checkoutPositions || []).map((cp: any) => ({
            position: cp.pos || 0, carrier: cp.carrier || '', service: cp.service || '', price: cp.price || 'N/A', inCheckout: true
          })),

      conversionScore: pickNumber(logistics?.conversion_score, logistics?.conversionScore) || 0,
      deepScanPerformed: false,
      aiModel: activeModel,
      halluccinationScore: 0, // Will be updated by Tavily
      sourceCoverage: sourceBundle.coverage,
      emailPattern: detectedEmailPattern,
      verifiedRegistrySnapshot,
      dataConfidence: {
        financial: financialEvidence.confidence,
        checkout: checkoutCrawlResult.confidence,
        contacts: llmContactCount >= 2 ? 'estimated' as const : dmConfidence,
        addresses: financialEvidence.confidence === 'verified' ? 'verified' as const : 'estimated' as const,
        emailPattern: detectedEmailPattern ? 'found' as const : 'missing' as const
      } as DataConfidence
    };

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
  activeCountry?: string
): Promise<LeadData[]> {
  const activeModel = model || selectedModel;
  try {
    const effectivePolicies = mergeSourcePolicies(sourcePolicies, activeCountry);
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

    if (!responseText) return [];

    let data;
    try {
      data = parseJsonSafely(responseText);
    } catch (e) {
      console.error("JSON Parse failed (Batch):", responseText);
      return [];
    }

    const leadsArray = Array.isArray(data) ? data : (data.leads || data.results || []);
    const filteredLeads = leadsArray.filter((l: any) => l && typeof l === 'object');

    const enrichedLeads = await Promise.all(filteredLeads.map(async (l: any, index: number) => {
      const logisticsMetrics = l.logisticsMetrics || l.logistics_metrics || {};
      const revenueRaw = pickString(l.revenue, l.revenue_tkr, l.revenueTKR);
      const rev = parseRevenueToTKR(revenueRaw);
      const marketCount = pickNumber(l.marketCount, l.market_count) || 1;
      const sniCode = pickString(l.sniCode, l.sni_code, l.sni);
      const metrics = calculateRickardMetrics(rev, sniCode, sniPercentages, marketCount);
      
      const annualPackages = pickNumber(logisticsMetrics?.estimatedAnnualPackages, logisticsMetrics?.estimated_annual_packages) || metrics.annualPackages;
      const pos1Volume = pickNumber(logisticsMetrics?.pos1_volume, logisticsMetrics?.pos1Volume) || metrics.pos1Volume;
      const pos2Volume = pickNumber(logisticsMetrics?.pos2_volume, logisticsMetrics?.pos2Volume) || metrics.pos2Volume;
      const strategicPitch = pickString(logisticsMetrics?.strategic_pitch, logisticsMetrics?.strategicPitch);

      const domainRaw = pickString(l.domain, l.website, l.websiteUrl, l.url);
      const domain = domainRaw.replace(/^https?:\/\//, '');
      const websiteUrl = domain ? `https://${domain}` : '';
      const baseDecisionMakers = (l.decisionMakers || l.decision_makers || l.contacts || []).map((c: any) => ({
        name: pickString(c?.name),
        title: pickString(c?.title),
        email: pickString(c?.email),
        linkedin: pickString(c?.linkedin),
        directPhone: pickString(c?.direct_phone, c?.directPhone),
        verificationNote: ''
      }));

      // Apply heavier evidence checks on the first leads to avoid quota spikes in large batches.
      const shouldEnrich = index < 6;
      let financialEvidence: VerifiedFinancialEvidence = { evidenceText: '', confidence: 'missing', parsed: {} };
      let checkoutEvidence: {
        positions: Array<{ carrier: string; pos: number; service: string; price: string; inCheckout: boolean }>;
        evidenceSnippet: string;
        confidence: 'crawled' | 'estimated' | 'missing';
      } = { positions: [], evidenceSnippet: '', confidence: 'missing' };
      let emailPattern = '';
      let dmSupplement: Array<{ name: string; title: string; email: string; linkedin: string; directPhone: string; verificationNote: string }> = [];
      let dmConfidence: 'verified' | 'estimated' | 'missing' = baseDecisionMakers.length ? 'estimated' : 'missing';

      if (shouldEnrich) {
        try {
          const [fin, checkout, email] = await Promise.all([
            fetchVerifiedFinancials(pickString(l.orgNumber, l.org_number, l.organizationNumber), pickString(l.companyName, l.company_name, l.name)),
            fetchCheckoutPositions(domain, activeCarrier),
            detectEmailPattern(domain, `${pickString(l.companyName, l.company_name, l.name)} ${pickString(l.orgNumber, l.org_number, l.organizationNumber)}`)
          ]);
          financialEvidence = fin;
          checkoutEvidence = checkout;
          emailPattern = email;
        } catch {
          // Non-critical in batch mode
        }

        if (!baseDecisionMakers.length) {
          try {
            const dmResult = await fetchDecisionMakersTargeted(
              pickString(l.companyName, l.company_name, l.name),
              pickString(l.orgNumber, l.org_number, l.organizationNumber),
              [formData.focusRole1, formData.focusRole2, formData.focusRole3],
              preferredDomains
            );
            dmSupplement = dmResult.contacts;
            dmConfidence = dmResult.confidence;
          } catch {
            dmSupplement = [];
          }
        }
      }

      const registryFields = financialEvidence.parsed || {};
      const decisionMakers: DecisionMaker[] = [
        ...baseDecisionMakers,
        ...dmSupplement.filter(dc => !baseDecisionMakers.some(b => b.name.toLowerCase() === dc.name.toLowerCase()))
      ].slice(0, 6);

      const verifiedRegistrySnapshot: VerifiedRegistrySnapshot | undefined = financialEvidence.confidence === 'verified'
        ? {
            sourceUrl: financialEvidence.sourceUrl,
            sourceLabel: financialEvidence.sourceUrl ? normalizeDomain(financialEvidence.sourceUrl) : 'allabolag.se',
            orgNumber: pickString(registryFields.orgNumber, l.orgNumber, l.org_number, l.organizationNumber),
            registeredAddress: pickString(registryFields.registeredAddress),
            revenue: registryFields.revenueTkr !== undefined ? `${registryFields.revenueTkr.toLocaleString('sv-SE')} tkr` : '',
            profit: registryFields.profitTkr !== undefined ? `${registryFields.profitTkr.toLocaleString('sv-SE')} tkr` : '',
            capturedAt: new Date().toISOString()
          }
        : undefined;

      return {
        ...l,
        id: crypto.randomUUID(),
        companyName: pickString(l.companyName, l.company_name, l.name),
        orgNumber: pickString(registryFields.orgNumber, l.orgNumber, l.org_number, l.organizationNumber),
        phoneNumber: pickString(l.phoneNumber, l.phone_number),
        sniCode,
        revenue: `${(registryFields.revenueTkr ?? rev).toLocaleString('sv-SE')} tkr`,
        address: pickString(registryFields.registeredAddress, l.address, l.visitingAddress, l.visiting_address),
        visitingAddress: pickString(l.visitingAddress, l.visiting_address, registryFields.registeredAddress, l.address),
        warehouseAddress: pickString(l.warehouseAddress, l.warehouse_address),
        domain,
        websiteUrl,
        decisionMakers,
        carriers: Array.isArray(l.carriers) ? l.carriers.join(', ') : pickString(l.carriers),
        checkoutOptions: checkoutEvidence.confidence === 'crawled' && checkoutEvidence.positions.length > 0
          ? checkoutEvidence.positions.map(cp => ({
              position: cp.pos,
              carrier: cp.carrier,
              service: cp.service,
              price: cp.price,
              inCheckout: cp.inCheckout
            }))
          : (l.checkoutOptions || []),
        marketCount,
        annualPackages,
        pos1Volume,
        pos2Volume,
        strategicPitch,
        freightBudget: `${metrics.potentialTKR.toLocaleString('sv-SE')} tkr`,
        potentialSek: metrics.shippingBudgetSEK,
        legalStatus: pickString(l.legalStatus, l.legal_status) || 'Aktiv',
        creditRatingLabel: pickString(l.creditRatingLabel, l.credit_rating) || 'N/A',
        segment: determineSegmentByPotential(metrics.shippingBudgetSEK),
        source: 'ai',
        analysisDate: '',
        aiModel: activeModel,
        halluccinationScore: 0,
        profit: registryFields.profitTkr !== undefined
          ? `${registryFields.profitTkr.toLocaleString('sv-SE')} tkr`
          : pickString(l.profit),
        financialSource: financialEvidence.confidence === 'verified'
          ? `Verifierad registerkälla: ${normalizeDomain(financialEvidence.sourceUrl || 'allabolag.se')}`
          : pickString(l.financialSource),
        verifiedRegistrySnapshot,
        emailPattern,
        dataConfidence: {
          financial: financialEvidence.confidence,
          checkout: checkoutEvidence.confidence,
          contacts: dmConfidence,
          addresses: financialEvidence.confidence === 'verified' ? 'verified' : 'estimated',
          emailPattern: emailPattern ? 'found' : 'missing'
        }
      } as LeadData;
    }));

    return enrichedLeads;
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
    Bransch: ${lead.industry || 'E-handel'}
    Plattform: ${lead.ecommercePlatform || 'Okänd'}
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
