import axios from 'axios';
import { SYSTEM_INSTRUCTION } from "../prompts/systemInstructions";
import { MASTER_DEEP_SCAN_PROMPT } from "../prompts/deepAnalysis";
import { BATCH_PROSPECTING_INSTRUCTION } from "../prompts/batchProspecting";
import { calculateRickardMetrics, determineSegmentByPotential } from "../utils/calculations";
import { SearchFormData, LeadData, SNIPercentage, ThreePLProvider, NewsSourceMapping, DecisionMaker, SourcePolicyConfig } from "../types";

/**
 * OPENROUTER SERVICE - Cost-Aware Model Selection Engine
 * Replaces Google Gemini with OpenRouter for better hallucination control
 */

export type ModelName = 'llama-3.1-70b' | 'gpt-4-turbo' | 'google-gemini-free' | 'gpt-3.5-turbo' | 'mistral-7b';

const MODEL_CONFIG: Record<ModelName, { displayName: string; costPer1kTokens: number; maxTokens: number }> = {
  'llama-3.1-70b': { displayName: 'Llama 3.1 70B (Fast)', costPer1kTokens: 0.0007, maxTokens: 8000 },
  'gpt-4-turbo': { displayName: 'GPT-4 Turbo (Most Reliable)', costPer1kTokens: 0.01, maxTokens: 4096 },
  'google-gemini-free': { displayName: 'Gemini Free (Budget)', costPer1kTokens: 0.0001, maxTokens: 2000 },
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
    costPerModel: {} // Track by model if needed
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

function mergeSourcePolicies(sourcePolicies?: SourcePolicyConfig): SourcePolicyConfig {
  return {
    financial: sourcePolicies?.financial?.length ? sourcePolicies.financial : FINANCIAL_SOURCE_DOMAINS,
    addresses: sourcePolicies?.addresses?.length ? sourcePolicies.addresses : ADDRESS_SOURCE_DOMAINS,
    decisionMakers: sourcePolicies?.decisionMakers?.length ? sourcePolicies.decisionMakers : CONTACT_SOURCE_DOMAINS,
    payment: sourcePolicies?.payment?.length ? sourcePolicies.payment : PAYMENT_SOURCE_DOMAINS,
    webSoftware: sourcePolicies?.webSoftware?.length ? sourcePolicies.webSoftware : WEBSOFTWARE_SOURCE_DOMAINS,
    news: sourcePolicies?.news?.length ? sourcePolicies.news : ['ehandel.se', 'market.se', 'breakit.se']
  };
}

function getSourcePriorityByPartBlock(sourcePolicies?: SourcePolicyConfig): string {
  const effective = mergeSourcePolicies(sourcePolicies);
  return [
    `Finansiell data (omsättning/resultat): ${effective.financial.join(', ')}`,
    `Adresser: ${effective.addresses.join(', ')}`,
    `Beslutsfattare: ${effective.decisionMakers.join(', ')}`,
    `Payment/checkout: ${effective.payment.join(', ')}`,
    `Websoftware/plattform: ${effective.webSoftware.join(', ')}`,
    `Nyheter: ${effective.news.join(', ')}`
  ].join('\n');
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

async function fetchLatestNews(companyName: string, domains: string[]): Promise<string> {
  if (!companyName) return '';

  const siteQuery = domains.slice(0, 8).map((d) => `site:${d}`).join(' OR ');
  const query = `${companyName} (${siteQuery}) nyheter OR pressmeddelande OR expansion`;

  try {
    const response = await axios.post(
      buildApiUrl('/api/tavily'),
      {
        query,
        action: 'search',
        maxResults: 6
      },
      {
        timeout: 15000
      }
    );

    const results = response.data?.results || [];
    if (!Array.isArray(results) || results.length === 0) return '';

    const topEntries = results.slice(0, 3).map((item: any) => {
      const title = pickString(item?.title, item?.content, 'Nyhet');
      const url = pickString(item?.url);
      return url ? `${title} (${url})` : title;
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
          model: model === 'google-gemini-free' ? 'google/gemini-flash-1.5' : model,
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
  sourcePolicies?: SourcePolicyConfig
): Promise<LeadData> {
  const activeModel = model || selectedModel;
  onUpdate({}, `Aktiverar OpenRouter Surgical Engine med ${MODEL_CONFIG[activeModel].displayName}...`);

  const effectivePolicies = mergeSourcePolicies(sourcePolicies);
  const preferredDomains = Array.from(new Set([
    ...getPreferredDomains(newsSourceMappings),
    ...effectivePolicies.news,
    ...effectivePolicies.financial,
    ...effectivePolicies.addresses,
    ...effectivePolicies.decisionMakers,
    ...effectivePolicies.payment,
    ...effectivePolicies.webSoftware
  ].map(normalizeDomain).filter(Boolean)));
  const searchQuery = `${formData.companyNameOrOrg} (${preferredDomains.join(', ')}, LinkedIn)`;
  const prompt = `${MASTER_DEEP_SCAN_PROMPT.replace('{{COMPANY_CONTEXT}}', searchQuery)}

### SOURCE PRIORITY
Prioritera dessa källor när tillgängligt: ${preferredDomains.join(', ')}.
${getSourcePriorityBlock(preferredDomains)}
${getSourcePriorityByPartBlock(effectivePolicies)}

### TECH WATCHLIST (Tavily + Crawl4ai)
${getTechWatchlistText()}

Om relevant nyhetsinformation hittas, inkludera ett fält \"latest_news\" med kort sammanfattning och URL.`;

  try {
    onUpdate({}, "Genomför teknisk & finansiell revision...");
    const responseText = await callOpenRouterWithRetry(
      activeModel, 
      prompt, 
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
    
    let rawData;
    try { rawData = JSON.parse(responseText); } catch (e) { rawData = JSON.parse(repairJson(responseText)); }

    const root = (rawData?.lead && typeof rawData.lead === 'object') ? rawData.lead : rawData;
    const companyData = root?.company_data || root?.companyData || root?.company || {};
    const financials = root?.financials || root?.financialData || root?.financial_data || {};
    const logistics = root?.logistics || root?.logisticsData || root?.logistics_data || {};
    const contactsRaw = root?.contacts || root?.decisionMakers || root?.decision_makers || [];

    const revenueTKR = parseRevenueToTKR(
      pickNumber(companyData?.revenue_tkr, companyData?.revenueTKR, companyData?.revenue) || 0
    );
    const marketCount = pickNumber(companyData?.market_count, companyData?.marketCount) || 1;
    const sniCode = pickString(companyData?.sni_code, companyData?.sniCode, companyData?.sni);
    const metrics = calculateRickardMetrics(revenueTKR, sniCode, sniPercentages, marketCount);

    const latestNewsFromModel = pickString(
      root?.latest_news,
      root?.latestNews,
      companyData?.latest_news,
      companyData?.latestNews,
      root?.news_summary,
      root?.newsSummary
    );
    const latestNewsFallback = latestNewsFromModel ? '' : await fetchLatestNews(
      pickString(companyData?.name, companyData?.companyName, companyData?.company_name) || formData.companyNameOrOrg,
      Array.from(new Set([...getPreferredDomains(newsSourceMappings, sniCode), ...effectivePolicies.news].map(normalizeDomain).filter(Boolean)))
    );
    const modelTechEvidence = pickString(logistics?.tech_evidence, logistics?.techEvidence);
    const crawlTechEvidence = modelTechEvidence ? '' : await fetchTechEvidenceFromCrawl(
      pickString(companyData?.domain, companyData?.website, companyData?.url)
    );

    const lead: LeadData = {
      id: crypto.randomUUID(),
      companyName: pickString(companyData?.name, companyData?.companyName, companyData?.company_name) || formData.companyNameOrOrg,
      orgNumber: pickString(companyData?.org_nr, companyData?.orgNumber, companyData?.organization_number),
      domain: pickString(companyData?.domain, companyData?.website, companyData?.url),
      sniCode,
      address: pickString(companyData?.visiting_address, companyData?.address, companyData?.street_address),
      visitingAddress: pickString(companyData?.visiting_address, companyData?.address, companyData?.street_address),
      warehouseAddress: pickString(companyData?.warehouse_address, companyData?.warehouseAddress),
      revenue: `${revenueTKR.toLocaleString('sv-SE')} tkr`,
      revenueYear: pickString(companyData?.revenue_year, companyData?.revenueYear),
      profit: `${parseRevenueToTKR(financials?.history?.[0]?.profit || 0).toLocaleString('sv-SE')} tkr`,
      activeMarkets: companyData?.active_markets || companyData?.activeMarkets || [],
      marketCount: marketCount,
      estimatedAOV: metrics.estimatedAOV,
      b2bPercentage: pickNumber(companyData?.b2b_percentage, companyData?.b2bPercentage) || 0,
      b2cPercentage: pickNumber(companyData?.b2c_percentage, companyData?.b2cPercentage) || 0,
      
      financialHistory: (financials?.history || []).map((h: any) => ({
        year: h.year,
        revenue: `${parseRevenueToTKR(h.revenue).toLocaleString('sv-SE')} tkr`,
        profit: `${parseRevenueToTKR(h.profit).toLocaleString('sv-SE')} tkr`
      })),
      solidity: pickString(financials?.solidity, financials?.equity_ratio) || '0%',
      liquidityRatio: pickString(financials?.liquidity_ratio, financials?.liquidityRatio) || '0%',
      profitMargin: pickString(financials?.profit_margin, financials?.profitMargin) || '0%',
      debtEquityRatio: pickString(financials?.debt_equity_ratio, financials?.debtEquityRatio),
      debtBalance: pickString(financials?.debt_balance_tkr, financials?.debtBalance, '0'),
      paymentRemarks: pickString(financials?.payment_remarks, financials?.paymentRemarks),
      isBankruptOrLiquidated: Boolean(financials?.is_bankrupt_or_liquidated || financials?.isBankruptOrLiquidated),
      financialSource: pickString(financials?.financial_source, financials?.source) || 'Officiella källor',
      
      ecommercePlatform: pickString(logistics?.ecommerce_platform, logistics?.ecommercePlatform) || 'Okänd',
      paymentProvider: pickString(logistics?.payment_provider, logistics?.paymentProvider) || 'Okänd', 
      checkoutSolution: pickString(logistics?.checkout_solution, logistics?.checkoutSolution),
      taSystem: pickString(logistics?.ta_system, logistics?.taSystem),
      techEvidence: modelTechEvidence || crawlTechEvidence,
      carriers: Array.isArray(logistics?.carriers) ? logistics.carriers.join(', ') : pickString(logistics?.carriers),
      strategicPitch: pickString(logistics?.strategic_pitch, logistics?.strategicPitch),
      latestNews: latestNewsFromModel || latestNewsFallback, 
      
      decisionMakers: (Array.isArray(contactsRaw) ? contactsRaw : []).map((c: any) => ({
        name: c.name || '', title: c.title || '', email: c.email || '', linkedin: c.linkedin || ''
      })),
      
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
      checkoutOptions: (logistics?.checkout_positions || logistics?.checkoutPositions || []).map((cp: any) => ({
        position: cp.pos || 0,
        carrier: cp.carrier || '',
        service: cp.service || '',
        price: cp.price || 'N/A'
      })),

      conversionScore: pickNumber(logistics?.conversion_score, logistics?.conversionScore) || 0,
      deepScanPerformed: false,
      aiModel: activeModel,
      halluccinationScore: 0 // Will be updated by Tavily
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
  model?: ModelName
): Promise<LeadData[]> {
  const activeModel = model || selectedModel;
  try {
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
      data = JSON.parse(responseText);
    } catch (e) {
      console.warn("JSON Parse Error (Batch), attempting repair...", e);
      try {
        const repaired = repairJson(responseText);
        data = JSON.parse(repaired);
      } catch (repairError) {
        console.error("JSON Repair failed (Batch):", responseText);
        return [];
      }
    }

    const leadsArray = Array.isArray(data) ? data : (data.leads || data.results || []);
    return leadsArray.filter((l: any) => l && typeof l === 'object').map((l: any) => {
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
      const decisionMakers = (l.decisionMakers || l.decision_makers || l.contacts || []).map((c: any) => ({
        name: pickString(c?.name),
        title: pickString(c?.title),
        email: pickString(c?.email),
        linkedin: pickString(c?.linkedin)
      }));

      return {
        ...l,
        id: crypto.randomUUID(),
        companyName: pickString(l.companyName, l.company_name, l.name),
        orgNumber: pickString(l.orgNumber, l.org_number, l.organizationNumber),
        phoneNumber: pickString(l.phoneNumber, l.phone_number),
        sniCode,
        revenue: `${rev.toLocaleString('sv-SE')} tkr`,
        address: pickString(l.address, l.visitingAddress, l.visiting_address),
        visitingAddress: pickString(l.visitingAddress, l.visiting_address, l.address),
        warehouseAddress: pickString(l.warehouseAddress, l.warehouse_address),
        domain,
        websiteUrl,
        decisionMakers,
        carriers: Array.isArray(l.carriers) ? l.carriers.join(', ') : pickString(l.carriers),
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
        halluccinationScore: 0
      } as LeadData;
    });
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
