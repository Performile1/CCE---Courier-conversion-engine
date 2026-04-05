import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../prompts/systemInstructions";
import { MASTER_DEEP_SCAN_PROMPT } from "../prompts/deepAnalysis";
import { BATCH_PROSPECTING_INSTRUCTION } from "../prompts/batchProspecting";
import { calculateRickardMetrics, determineSegmentByPotential } from "../utils/calculations";
import { SearchFormData, LeadData, SNIPercentage, ThreePLProvider, NewsSourceMapping, DecisionMaker, Segment, SourcePolicyConfig, VerifiedFieldEvidence, VerifiedLeadField, VerifiedRegistrySnapshot, CarrierSettings } from "../types";
import { selectPricingProductForLead } from './pricingService';

/**
 * PERFORMILE - TURBO ENGINE (v25.1)
 * Optimerad för hastighet och PSP/Tech-detektion.
 */
const MIN_INTERVAL = 1500; 
let lastCallTime = 0;

const GEMINI_DEFAULT_SOURCE_POLICIES: SourcePolicyConfig = {
  financial: ['allabolag.se', 'ratsit.se', 'kreditrapporten.se', 'boolag.se', 'bolagsverket.se'],
  addresses: ['hitta.se', 'eniro.se', 'allabolag.se', 'bolagsverket.se'],
  decisionMakers: ['linkedin.com', 'allabolag.se', 'ratsit.se'],
  payment: ['klarna.com', 'stripe.com', 'adyen.com'],
  webSoftware: ['shopify.com', 'woocommerce.com', 'norce.io', 'centra.com'],
  news: ['ehandel.se', 'market.se', 'breakit.se', 'bolagsverket.se'],
  strictCompanyMatch: true,
  earliestNewsYear: new Date().getFullYear() - 1,
  customCategories: {},
  categoryFieldMappings: {},
  countrySourcePolicies: {}
};

type GeminiGroundingSource = {
  url: string;
  domain: string;
  title?: string;
};

async function throttle() {
  const now = Date.now();
  const diff = now - lastCallTime;
  if (diff < MIN_INTERVAL) {
    await new Promise(res => setTimeout(res, MIN_INTERVAL - diff));
  }
  lastCallTime = Date.now();
}

/**
 * JSON REPAIR ENGINE
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
 * FINANCIAL FIREWALL PARSER
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
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function normalizeDomain(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

function mergeSourcePolicies(sourcePolicies?: SourcePolicyConfig, activeCountry?: string): SourcePolicyConfig {
  const countryOverride = activeCountry && activeCountry !== 'global'
    ? (sourcePolicies?.countrySourcePolicies?.[activeCountry] || {})
    : {};
  const pickList = (...lists: Array<string[] | undefined>) => {
    for (const list of lists) {
      if (Array.isArray(list) && list.length > 0) return list;
    }
    return [];
  };

  return {
    financial: pickList(countryOverride.financial, sourcePolicies?.financial, GEMINI_DEFAULT_SOURCE_POLICIES.financial),
    addresses: pickList(countryOverride.addresses, sourcePolicies?.addresses, GEMINI_DEFAULT_SOURCE_POLICIES.addresses),
    decisionMakers: pickList(countryOverride.decisionMakers, sourcePolicies?.decisionMakers, GEMINI_DEFAULT_SOURCE_POLICIES.decisionMakers),
    payment: pickList(countryOverride.payment, sourcePolicies?.payment, GEMINI_DEFAULT_SOURCE_POLICIES.payment),
    webSoftware: pickList(countryOverride.webSoftware, sourcePolicies?.webSoftware, GEMINI_DEFAULT_SOURCE_POLICIES.webSoftware),
    news: pickList(countryOverride.news, sourcePolicies?.news, GEMINI_DEFAULT_SOURCE_POLICIES.news),
    strictCompanyMatch: countryOverride.strictCompanyMatch ?? sourcePolicies?.strictCompanyMatch ?? GEMINI_DEFAULT_SOURCE_POLICIES.strictCompanyMatch,
    earliestNewsYear: countryOverride.earliestNewsYear ?? sourcePolicies?.earliestNewsYear ?? GEMINI_DEFAULT_SOURCE_POLICIES.earliestNewsYear,
    customCategories: {
      ...(sourcePolicies?.customCategories || {}),
      ...(countryOverride.customCategories || {})
    },
    categoryFieldMappings: {
      ...(sourcePolicies?.categoryFieldMappings || {}),
      ...(countryOverride.categoryFieldMappings || {})
    },
    countrySourcePolicies: sourcePolicies?.countrySourcePolicies || {}
  };
}

function buildSourceManagerPrompt(sourcePolicies?: SourcePolicyConfig, activeCountry?: string): { effectivePolicies: SourcePolicyConfig; promptSuffix: string } {
  const effectivePolicies = mergeSourcePolicies(sourcePolicies, activeCountry);
  const promptSuffix = `

SOURCE MANAGER PRIORITY:
- Financial: ${effectivePolicies.financial.join(', ')}
- Addresses: ${effectivePolicies.addresses.join(', ')}
- Decision makers: ${effectivePolicies.decisionMakers.join(', ')}
- Payment: ${effectivePolicies.payment.join(', ')}
- Web software: ${effectivePolicies.webSoftware.join(', ')}
- News: ${effectivePolicies.news.join(', ')}
- Strict company match: ${effectivePolicies.strictCompanyMatch !== false ? 'required' : 'recommended'}
- If evidence is missing, return empty strings, empty arrays or null. Never invent defaults.`;
  return { effectivePolicies, promptSuffix };
}

function extractGroundingSources(response: GenerateContentResponse): GeminiGroundingSource[] {
  const chunks = ((response as any)?.candidates || [])
    .flatMap((candidate: any) => candidate?.groundingMetadata?.groundingChunks || []);

  return chunks
    .map((chunk: any) => ({
      url: pickString(chunk?.web?.uri, chunk?.retrievedContext?.uri),
      title: pickString(chunk?.web?.title, chunk?.retrievedContext?.title)
    }))
    .filter((chunk: GeminiGroundingSource) => Boolean(chunk.url))
    .map((chunk: GeminiGroundingSource) => ({
      ...chunk,
      domain: normalizeDomain(chunk.url)
    }));
}

function pickSourceUrl(sources: GeminiGroundingSource[], preferredDomains: string[], fallback?: string): string | undefined {
  const normalizedDomains = preferredDomains.map(normalizeDomain).filter(Boolean);
  const match = sources.find((source) => normalizedDomains.some((domain) => source.domain.includes(domain)));
  return match?.url || fallback;
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

async function callGeminiWithRetry(
  model: string, 
  prompt: string, 
  config: any, 
  onStatus?: (msg: string) => void,
  handleWait?: (s: number, type: 'rate' | 'quota') => void,
  retries = 2 
) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  for (let i = 0; i < retries; i++) {
    try {
      await throttle();
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          ...config,
          topP: 0.8,
          topK: 40
        }
      });
      return response;

    } catch (error: any) {
      const isRateLimit = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
      if (isRateLimit && i < retries - 1) {
        const waitTime = model.includes('pro') ? 65 : 10;
        if (onStatus) onStatus(`⚠️ Rate limit. Pausar ${waitTime}s...`);
        if (handleWait) handleWait(waitTime, 'rate');
        await new Promise(res => setTimeout(res, waitTime * 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Performile Engine: Timeout eller Rate Limit.");
}

/**
 * NEW: SURGICAL DEEPSCAN ANALYZER (v25.1)
 * Körs när användaren begär fördjupad analys i Audit-tabben.
 */
export async function runSurgicalDeepScan(
  lead: LeadData,
  onStatus: (msg: string) => void
): Promise<Partial<LeadData>> {
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
    }
  `;

  const response = await callGeminiWithRetry(
    'gemini-3-flash-preview',
    deepPrompt,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      temperature: 0.2
    }
  );

  const rawData = JSON.parse(response.text.trim());
  
  return {
    deepScanPerformed: true,
    conversionScore: rawData.conversionScore,
    recoveryPotentialSek: rawData.recoveryPotentialSek,
    frictionAnalysis: rawData.frictionAnalysis,
    dmtMatrix: rawData.dmtMatrix
  };
}

export async function generateDeepDiveSequential(
  formData: SearchFormData,
  onUpdate: (partial: Partial<LeadData>, status?: string) => void,
  handleWait: (s: number, type: 'rate' | 'quota') => void,
  newsSourceMappings: NewsSourceMapping[],
  sniPercentages: SNIPercentage[],
  integrations: string[],
  activeCarrier: string,
  threePLProviders: ThreePLProvider[],
  sourcePolicies?: SourcePolicyConfig,
  activeCountry?: string,
  marketSettings?: CarrierSettings[]
): Promise<LeadData> {
  onUpdate({}, "Aktiverar Performile Surgical Engine v25.1...");

  const searchQuery = `${formData.companyNameOrOrg} (Allabolag, Ratsit, Kreditkollen, LinkedIn)`;
  const { effectivePolicies, promptSuffix } = buildSourceManagerPrompt(sourcePolicies, activeCountry);
  const prompt = `${MASTER_DEEP_SCAN_PROMPT.replace('{{COMPANY_CONTEXT}}', searchQuery)}${promptSuffix}`;

  try {
    onUpdate({}, "Genomför teknisk & finansiell revision...");
    const response = await callGeminiWithRetry(
      'gemini-3-flash-preview', 
      prompt, 
      {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, 
        temperature: 0.1,
        maxOutputTokens: 2048 
      },
      (msg) => onUpdate({}, msg),
      handleWait
    );

    const text = response.text.trim();
    if (!text) throw new Error("Tomt svar från AI.");
    
    let rawData;
    try { rawData = JSON.parse(text); } catch (e) { rawData = JSON.parse(repairJson(text)); }
        const groundingSources = extractGroundingSources(response);
        const capturedAt = new Date().toISOString();

    const revenueTKR = parseRevenueToTKROptional(rawData.company_data?.revenue_tkr);
    const marketCount = rawData.company_data?.market_count;
    const metrics = revenueTKR !== undefined
      ? calculateRickardMetrics(revenueTKR, rawData.company_data?.sni_code || '', sniPercentages, marketCount || 1, {
          marketSettings,
          activeCarrier
        })
      : undefined;
        const companyWebsiteUrl = rawData.company_data?.domain ? `https://${rawData.company_data.domain}` : '';
        const financialSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.financial);
        const addressSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.addresses, companyWebsiteUrl || undefined);
        const decisionSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.decisionMakers, rawData.contacts?.[0]?.linkedin);
        const paymentSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.payment, companyWebsiteUrl || undefined);
        const webSoftwareSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.webSoftware, companyWebsiteUrl || undefined);
        const newsSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.news);
        const financialHistory = (rawData.financials?.history || []).map((h: any) => ({
          year: h.year,
          revenue: `${parseRevenueToTKR(h.revenue).toLocaleString('sv-SE')} tkr`,
          profit: `${parseRevenueToTKR(h.profit).toLocaleString('sv-SE')} tkr`
        }));
        const verifiedRegistrySnapshot: VerifiedRegistrySnapshot | undefined = financialSourceUrl
          ? {
              sourceUrl: financialSourceUrl,
              sourceLabel: normalizeDomain(financialSourceUrl),
              orgNumber: pickString(rawData.company_data?.org_nr),
              registeredAddress: pickString(rawData.company_data?.visiting_address),
              revenue: revenueTKR !== undefined ? `${revenueTKR.toLocaleString('sv-SE')} tkr` : '',
              profit: parseRevenueToTKROptional(rawData.financials?.history?.[0]?.profit) !== undefined
                ? `${parseRevenueToTKROptional(rawData.financials?.history?.[0]?.profit)!.toLocaleString('sv-SE')} tkr`
                : '',
              capturedAt
            }
          : undefined;
        const verifiedFieldEvidence: Partial<Record<VerifiedLeadField, VerifiedFieldEvidence>> = {
          revenue: buildFieldEvidence(revenueTKR !== undefined ? `${revenueTKR.toLocaleString('sv-SE')} tkr` : '', financialSourceUrl, rawData.financials?.financial_source, capturedAt),
          profit: buildFieldEvidence(rawData.financials?.history?.[0]?.profit, financialSourceUrl, rawData.financials?.financial_source, capturedAt),
          financialHistory: buildFieldEvidence(financialHistory, financialSourceUrl, rawData.financials?.financial_source, capturedAt),
          solidity: buildFieldEvidence(rawData.financials?.solidity, financialSourceUrl, rawData.financials?.financial_source, capturedAt),
          liquidityRatio: buildFieldEvidence(rawData.financials?.liquidity_ratio, financialSourceUrl, rawData.financials?.financial_source, capturedAt),
          profitMargin: buildFieldEvidence(rawData.financials?.profit_margin, financialSourceUrl, rawData.financials?.financial_source, capturedAt),
          legalStatus: buildFieldEvidence(rawData.company_data?.legal_status, financialSourceUrl, rawData.financials?.financial_source, capturedAt),
          paymentRemarks: buildFieldEvidence(rawData.financials?.payment_remarks, financialSourceUrl, rawData.financials?.financial_source, capturedAt),
          debtBalance: buildFieldEvidence(rawData.financials?.debt_balance_tkr, financialSourceUrl, rawData.financials?.financial_source, capturedAt),
          debtEquityRatio: buildFieldEvidence(rawData.financials?.debt_equity_ratio, financialSourceUrl, rawData.financials?.financial_source, capturedAt),
          address: buildFieldEvidence(rawData.company_data?.visiting_address, addressSourceUrl, rawData.company_data?.industry_description, capturedAt),
          visitingAddress: buildFieldEvidence(rawData.company_data?.visiting_address, addressSourceUrl, rawData.company_data?.industry_description, capturedAt),
          warehouseAddress: buildFieldEvidence(rawData.company_data?.warehouse_address, addressSourceUrl, rawData.company_data?.industry_description, capturedAt),
          checkoutOptions: buildFieldEvidence(rawData.logistics?.checkout_positions, companyWebsiteUrl || paymentSourceUrl, rawData.logistics?.tech_evidence, capturedAt),
          ecommercePlatform: buildFieldEvidence(rawData.logistics?.ecommerce_platform, webSoftwareSourceUrl, rawData.logistics?.tech_evidence, capturedAt),
          taSystem: buildFieldEvidence(rawData.logistics?.ta_system, webSoftwareSourceUrl, rawData.logistics?.tech_evidence, capturedAt),
          paymentProvider: buildFieldEvidence(rawData.logistics?.payment_provider, paymentSourceUrl, rawData.logistics?.tech_evidence, capturedAt),
          checkoutSolution: buildFieldEvidence(rawData.logistics?.checkout_solution, paymentSourceUrl, rawData.logistics?.tech_evidence, capturedAt),
          activeMarkets: buildFieldEvidence(rawData.company_data?.active_markets || [], addressSourceUrl, rawData.company_data?.industry_description, capturedAt),
          storeCount: buildFieldEvidence(rawData.logistics?.store_count, addressSourceUrl, rawData.company_data?.industry_description, capturedAt),
          decisionMakers: buildFieldEvidence(rawData.contacts, decisionSourceUrl, rawData.contacts?.map((contact: any) => `${contact.name || ''} ${contact.title || ''}`).join(' | '), capturedAt),
          latestNews: buildFieldEvidence(rawData.latest_news || '', newsSourceUrl, rawData.latest_news, capturedAt),
          emailPattern: buildFieldEvidence(rawData.email_pattern || '', companyWebsiteUrl || decisionSourceUrl, rawData.email_pattern, capturedAt)
        };

    const lead: LeadData = {
      id: crypto.randomUUID(),
      companyName: rawData.company_data?.name || formData.companyNameOrOrg,
      orgNumber: rawData.company_data?.org_nr || '',
      domain: rawData.company_data?.domain || '',
      sniCode: rawData.company_data?.sni_code || '',
      address: rawData.company_data?.visiting_address || '',
      visitingAddress: rawData.company_data?.visiting_address || '',
      warehouseAddress: rawData.company_data?.warehouse_address || '',
      revenue: revenueTKR !== undefined ? `${revenueTKR.toLocaleString('sv-SE')} tkr` : '',
      revenueYear: rawData.company_data?.revenue_year || '',
      profit: parseRevenueToTKROptional(rawData.financials?.history?.[0]?.profit) !== undefined
        ? `${parseRevenueToTKROptional(rawData.financials?.history?.[0]?.profit)!.toLocaleString('sv-SE')} tkr`
        : '',
      activeMarkets: [],
      marketCount: marketCount,
      estimatedAOV: metrics?.estimatedAOV,
      b2bPercentage: undefined,
      b2cPercentage: undefined,
      
      financialHistory,
      solidity: rawData.financials?.solidity || '',
      liquidityRatio: rawData.financials?.liquidity_ratio || '',
      profitMargin: rawData.financials?.profit_margin || '',
      debtEquityRatio: rawData.financials?.debt_equity_ratio || '',
      debtBalance: rawData.financials?.debt_balance_tkr || '',
      paymentRemarks: rawData.financials?.payment_remarks || '',
      isBankruptOrLiquidated: rawData.financials?.is_bankrupt_or_liquidated || false,
      financialSource: rawData.financials?.financial_source || '',
      
      ecommercePlatform: rawData.logistics?.ecommerce_platform || '',
      paymentProvider: rawData.logistics?.payment_provider || '', 
      checkoutSolution: rawData.logistics?.checkout_solution || '',
      taSystem: rawData.logistics?.ta_system || '',
      techEvidence: rawData.logistics?.tech_evidence || '',
      carriers: (rawData.logistics?.carriers || []).join(', '),
      strategicPitch: rawData.logistics?.strategic_pitch || '',
      latestNews: rawData.latest_news || '', 
      
      decisionMakers: (rawData.contacts || []).map((c: any) => ({
        name: c.name || '', title: c.title || '', email: c.email || '', linkedin: c.linkedin || ''
      })),
      
      potentialSek: metrics?.shippingBudgetSEK,
      freightBudget: metrics ? `${metrics.potentialTKR.toLocaleString('sv-SE')} tkr` : '',
      annualPackages: metrics?.annualPackages,
      annualPackageEstimateSource: metrics?.annualPackageEstimateSource,
      pos1Volume: metrics?.pos1Volume,
      pos2Volume: metrics?.pos2Volume,
      segment: metrics ? determineSegmentByPotential(metrics.shippingBudgetSEK) : Segment.UNKNOWN,
      analysisDate: new Date().toISOString(),
      source: 'ai',
      legalStatus: rawData.company_data?.legal_status || '',
      vatRegistered: rawData.company_data?.vat_registered || false,
      creditRatingLabel: rawData.company_data?.credit_rating || '',
      creditRatingMotivation: rawData.company_data?.credit_rating_motivation || '',
      riskProfile: rawData.company_data?.risk_profile || '',
      financialTrend: rawData.company_data?.financial_trend || '',
      industry: rawData.company_data?.industry || '',
      industryDescription: rawData.company_data?.industry_description || '',
      websiteUrl: companyWebsiteUrl,
      
      businessModel: rawData.company_data?.business_model || '',
      storeCount: rawData.logistics?.store_count,
      checkoutOptions: (rawData.logistics?.checkout_positions || []).map((cp: any, index: number) => ({
        position: cp.pos ?? index + 1,
        carrier: cp.carrier || '',
        service: cp.service || '',
        price: cp.price || ''
      })),

      // Mappa även in initial QuickScan data om AI skickar det direkt
      conversionScore: rawData.logistics?.conversion_score,
      deepScanPerformed: false,
      verifiedRegistrySnapshot,
      verifiedFieldEvidence: Object.values(verifiedFieldEvidence).some(Boolean) ? verifiedFieldEvidence : undefined,
      dataConfidence: {
        financial: financialSourceUrl ? 'verified' : 'estimated',
        checkout: rawData.logistics?.checkout_positions?.length ? 'crawled' : 'missing',
        contacts: rawData.contacts?.length ? (decisionSourceUrl ? 'verified' : 'estimated') : 'missing',
        addresses: rawData.company_data?.visiting_address ? (addressSourceUrl ? 'verified' : 'estimated') : 'missing',
        payment: rawData.logistics?.payment_provider || rawData.logistics?.checkout_solution ? (paymentSourceUrl ? 'verified' : 'estimated') : 'missing',
        news: rawData.latest_news ? (newsSourceUrl ? 'verified' : 'estimated') : 'missing',
        emailPattern: rawData.email_pattern ? 'found' : 'missing'
      }
    };

    const pricingProduct = marketSettings?.length
      ? selectPricingProductForLead(lead, marketSettings)
      : undefined;

    lead.pricingProductName = pricingProduct?.productName;
    lead.pricingProductSource = pricingProduct?.source;
    lead.pricingBasis = 'volume-only';

    onUpdate(lead, "Analys slutförd.");
    return lead;

  } catch (error: any) {
    throw error;
  }
}

export async function generateLeads(
  formData: SearchFormData,
  handleWait: (s: number, type: 'rate' | 'quota') => void,
  sniPercentages: SNIPercentage[],
  exclusionList: string[],
  activeCarrier: string,
  threePLProviders: ThreePLProvider[],
  sourcePolicies?: SourcePolicyConfig,
  activeCountry?: string,
  marketSettings?: CarrierSettings[]
): Promise<LeadData[]> {
  try {
    const { effectivePolicies, promptSuffix } = buildSourceManagerPrompt(sourcePolicies, activeCountry);
    const prompt = `Batch Scan: Ort: ${formData.geoArea}, Omsättningssegment: ${formData.financialScope}, Triggers: ${formData.triggers}, Antal: ${formData.leadCount}. 
    EXKLUDERA DESSA BOLAG (Returnera dem INTE): ${exclusionList.slice(0, 50).join(', ')}${promptSuffix}`;

    const response = await callGeminiWithRetry(
      'gemini-3-flash-preview', 
      prompt, 
      {
        systemInstruction: BATCH_PROSPECTING_INSTRUCTION + "\n\nVIKTIGT: Returnera ALDRIG bolag som finns i exkluderingslistan.",
        responseMimeType: "application/json",
        temperature: 0.1 
      },
      undefined,
      handleWait
    );

    const text = response.text.trim();
    if (!text) return [];

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn("JSON Parse Error (Batch), attempting repair...", e);
      try {
        const repaired = repairJson(text);
        data = JSON.parse(repaired);
      } catch (repairError) {
        console.error("JSON Repair failed (Batch):", text);
        return [];
      }
    }

    const groundingSources = extractGroundingSources(response);
    const capturedAt = new Date().toISOString();
    const financialSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.financial);
    const addressSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.addresses);
    const decisionSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.decisionMakers);
    const paymentSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.payment);
    const webSoftwareSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.webSoftware);
    const newsSourceUrl = pickSourceUrl(groundingSources, effectivePolicies.news);
    const leadsArray = Array.isArray(data) ? data : (data.leads || []);
    const leads = leadsArray.filter((l: any) => l && typeof l === 'object').map((l: any) => {
      const rev = parseRevenueToTKROptional(l.revenue);
      const marketCount = l.marketCount;
      const metrics = rev !== undefined
        ? calculateRickardMetrics(rev, l.sniCode || '', sniPercentages, marketCount || 1, {
            marketSettings,
            activeCarrier
          })
        : undefined;
      
      // Map nested logisticsMetrics to top-level LeadData fields if they exist
      const annualPackages = metrics?.annualPackages || l.logisticsMetrics?.estimatedAnnualPackages;
      const pos1Volume = metrics?.pos1Volume || l.logisticsMetrics?.pos1_volume;
      const pos2Volume = metrics?.pos2Volume || l.logisticsMetrics?.pos2_volume;
      const strategicPitch = l.logisticsMetrics?.strategic_pitch || '';
      const companyWebsiteUrl = l.domain ? `https://${String(l.domain).replace(/^https?:\/\//, '')}` : pickString(l.websiteUrl, l.website);
      const verifiedFieldEvidence: Partial<Record<VerifiedLeadField, VerifiedFieldEvidence>> = {
        revenue: buildFieldEvidence(rev !== undefined ? `${rev.toLocaleString('sv-SE')} tkr` : '', financialSourceUrl, l.financialSource, capturedAt),
        profit: buildFieldEvidence(l.profit, financialSourceUrl, l.financialSource, capturedAt),
        address: buildFieldEvidence(l.address, addressSourceUrl || companyWebsiteUrl || undefined, l.address, capturedAt),
        visitingAddress: buildFieldEvidence(l.visitingAddress || l.address, addressSourceUrl || companyWebsiteUrl || undefined, l.visitingAddress || l.address, capturedAt),
        warehouseAddress: buildFieldEvidence(l.warehouseAddress, addressSourceUrl || companyWebsiteUrl || undefined, l.warehouseAddress, capturedAt),
        ecommercePlatform: buildFieldEvidence(l.ecommercePlatform, webSoftwareSourceUrl || companyWebsiteUrl || undefined, l.techEvidence, capturedAt),
        taSystem: buildFieldEvidence(l.taSystem, webSoftwareSourceUrl || companyWebsiteUrl || undefined, l.techEvidence, capturedAt),
        paymentProvider: buildFieldEvidence(l.paymentProvider, paymentSourceUrl || companyWebsiteUrl || undefined, l.techEvidence, capturedAt),
        checkoutSolution: buildFieldEvidence(l.checkoutSolution, paymentSourceUrl || companyWebsiteUrl || undefined, l.techEvidence, capturedAt),
        decisionMakers: buildFieldEvidence(l.decisionMakers, decisionSourceUrl, l.decisionMakers?.map((contact: any) => contact?.name).join(' | '), capturedAt),
        latestNews: buildFieldEvidence(l.latestNews, newsSourceUrl, l.latestNews, capturedAt)
      };

      const leadDraft: LeadData = {
        ...l,
        id: crypto.randomUUID(),
        revenue: rev !== undefined ? `${rev.toLocaleString('sv-SE')} tkr` : '',
        visitingAddress: l.visitingAddress || l.address || '',
        warehouseAddress: l.warehouseAddress || '',
        marketCount,
        annualPackages,
        annualPackageEstimateSource: l.logisticsMetrics?.estimatedAnnualPackages ? 'llm-logistics' : metrics?.annualPackageEstimateSource,
        pos1Volume,
        pos2Volume,
        strategicPitch,
        segment: metrics ? determineSegmentByPotential(metrics.shippingBudgetSEK) : (l.segment || Segment.UNKNOWN),
        source: 'ai',
        analysisDate: '',
        verifiedRegistrySnapshot: financialSourceUrl ? {
          sourceUrl: financialSourceUrl,
          sourceLabel: normalizeDomain(financialSourceUrl),
          orgNumber: pickString(l.orgNumber),
          registeredAddress: pickString(l.address, l.visitingAddress),
          revenue: rev !== undefined ? `${rev.toLocaleString('sv-SE')} tkr` : '',
          profit: pickString(l.profit),
          capturedAt
        } : undefined,
        verifiedFieldEvidence: Object.values(verifiedFieldEvidence).some(Boolean) ? verifiedFieldEvidence : undefined
      } as LeadData;

      const pricingProduct = marketSettings?.length
        ? selectPricingProductForLead(leadDraft, marketSettings)
        : undefined;

      return {
        ...leadDraft,
        pricingProductName: pricingProduct?.productName,
        pricingProductSource: pricingProduct?.source,
        pricingBasis: 'volume-only'
      } as LeadData;
    });

    const targetSegments = formData.targetSegments || [];
    return targetSegments.length ? leads.filter((lead) => targetSegments.includes(lead.segment)) : leads;
  } catch (error: any) {
    throw error;
  }
}

export async function generateEmailSuggestion(
  type: 'template' | 'personalized',
  lead: Partial<LeadData>,
  focusWords: string[],
  customTemplate?: string,
  activeCarrier: string = 'DHL',
  language: 'sv' | 'en' = 'sv',
  contact?: DecisionMaker
): Promise<string> {
  const langStr = language === 'sv' ? 'svenska' : 'engelska';
  
  // Extract first name for {förnamn} placeholder
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
    2. Ersätt placeholders i mallen med korrekt data:
       - {förnamn} -> ${firstName}
       - {efternamn} -> ${lastName}
       - {namn} -> ${contact?.name || ''}
       - {beslutsfattare} -> ${contact?.name || ''}
       - {titel} -> ${contact?.title || ''}
       - {företag} -> ${lead.companyName}
       - {plattform} -> ${lead.ecommercePlatform || 'er plattform'}
       - {potential} -> ${lead.freightBudget || ''}
       - {omsättning} -> ${lead.revenue || ''}
       - {bransch} -> ${lead.industry || 'er bransch'}
    3. Om en placeholder saknar data, försök formulera om meningen naturligt eller lämna den tom om det inte går.
    4. Använd följande fokusord om de passar in: ${focusWords.join(', ')}.
    5. Målet är att boka ett möte.
    6. Svara ENDAST med HTML-koden för mailets body (inga <html> eller <body> taggar).`;
  } else {
    prompt = `UPPGIFT: Skriv ett personligt säljmail på ${langStr} för ${activeCarrier} med fokus på Revenue Recovery för ${lead.companyName}. 
    Mottagare: ${contact?.name || ''} (${contact?.title || ''}).
    Använd följande fokusord: ${focusWords.join(', ')}. 
    Kontext: ${lead.strategicPitch}
    Målet är att boka ett möte. Inkludera en tydlig Call to Action (CTA).
    Svara ENDAST med HTML-koden för mailets body (inga <html> eller <body> taggar).`;
  }
  
  try {
    const response = await callGeminiWithRetry('gemini-3-flash-preview', prompt, {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7
    });
    return response.text || (language === 'sv' ? "Kunde inte generera mailförslag." : "Could not generate email suggestion.");
  } catch (error) {
    return language === 'sv' ? "Ett fel uppstod." : "An error occurred.";
  }
}