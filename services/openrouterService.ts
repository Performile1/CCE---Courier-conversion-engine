import axios, { AxiosError } from 'axios';
import { SYSTEM_INSTRUCTION } from "../prompts/systemInstructions";
import { MASTER_DEEP_SCAN_PROMPT } from "../prompts/deepAnalysis";
import { BATCH_PROSPECTING_INSTRUCTION } from "../prompts/batchProspecting";
import { calculateRickardMetrics, determineSegmentByPotential } from "../utils/calculations";
import { SearchFormData, LeadData, SNIPercentage, ThreePLProvider, NewsSourceMapping, DecisionMaker } from "../types";

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

const MIN_INTERVAL = 1000; // More generous rate limit for OpenRouter
let lastCallTime = 0;

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

/**
 * OPENROUTER API CALL WITH RETRY
 */
async function callOpenRouterWithRetry(
  model: ModelName,
  prompt: string,
  config: any = {},
  onStatus?: (msg: string) => void,
  handleWait?: (s: number, type: 'rate' | 'quota') => void,
  retries = 2
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured. Set it in environment variables.");
  }

  const modelId = model === 'google-gemini-free' ? 'google/gemini-flash-1.5' : model;
  
  for (let i = 0; i < retries; i++) {
    try {
      await throttle();

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: modelId,
          messages: [
            {
              role: 'system',
              content: config.systemInstruction || SYSTEM_INSTRUCTION
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: config.temperature || 0.1,
          max_tokens: MODEL_CONFIG[model].maxTokens,
          response_format: config.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window?.location?.origin || 'http://localhost',
            'X-Title': 'PerformileLeads'
          }
        }
      );

      const text = response.data.choices[0]?.message?.content || '';
      const inputTokens = response.data.usage?.prompt_tokens || 0;
      const outputTokens = response.data.usage?.completion_tokens || 0;
      
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
        const waitTime = 15;
        if (onStatus) onStatus(`⚠️ Rate limited. Waiting ${waitTime}s...`);
        if (handleWait) handleWait(waitTime, 'rate');
        await new Promise(res => setTimeout(res, waitTime * 1000));
        continue;
      }

      console.error('OpenRouter API Error:', error.message, error.response?.data);
      throw new Error(`OpenRouter API failed: ${error.message}`);
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
  model?: ModelName
): Promise<LeadData> {
  const activeModel = model || selectedModel;
  onUpdate({}, `Aktiverar OpenRouter Surgical Engine med ${MODEL_CONFIG[activeModel].displayName}...`);

  const searchQuery = `${formData.companyNameOrOrg} (Allabolag, Ratsit, Kreditkollen, LinkedIn)`;
  const prompt = MASTER_DEEP_SCAN_PROMPT.replace('{{COMPANY_CONTEXT}}', searchQuery);

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

    const revenueTKR = parseRevenueToTKR(rawData.company_data?.revenue_tkr || 0);
    const marketCount = rawData.company_data?.market_count || 1;
    const metrics = calculateRickardMetrics(revenueTKR, rawData.company_data?.sni_code || '', sniPercentages, marketCount);

    const lead: LeadData = {
      id: crypto.randomUUID(),
      companyName: rawData.company_data?.name || formData.companyNameOrOrg,
      orgNumber: rawData.company_data?.org_nr || '',
      domain: rawData.company_data?.domain || '',
      sniCode: rawData.company_data?.sni_code || '',
      address: rawData.company_data?.visiting_address || '',
      visitingAddress: rawData.company_data?.visiting_address || '',
      warehouseAddress: rawData.company_data?.warehouse_address || '',
      revenue: `${revenueTKR.toLocaleString('sv-SE')} tkr`,
      revenueYear: rawData.company_data?.revenue_year || '',
      profit: `${parseRevenueToTKR(rawData.financials?.history?.[0]?.profit || 0).toLocaleString('sv-SE')} tkr`,
      activeMarkets: rawData.company_data?.active_markets || [],
      marketCount: marketCount,
      estimatedAOV: metrics.estimatedAOV,
      b2bPercentage: rawData.company_data?.b2b_percentage || 0,
      b2cPercentage: rawData.company_data?.b2c_percentage || 0,
      
      financialHistory: (rawData.financials?.history || []).map((h: any) => ({
        year: h.year,
        revenue: `${parseRevenueToTKR(h.revenue).toLocaleString('sv-SE')} tkr`,
        profit: `${parseRevenueToTKR(h.profit).toLocaleString('sv-SE')} tkr`
      })),
      solidity: rawData.financials?.solidity || '0%',
      liquidityRatio: rawData.financials?.liquidity_ratio || '0%',
      profitMargin: rawData.financials?.profit_margin || '0%',
      debtEquityRatio: rawData.financials?.debt_equity_ratio || '',
      debtBalance: rawData.financials?.debt_balance_tkr || '0',
      paymentRemarks: rawData.financials?.payment_remarks || '',
      isBankruptOrLiquidated: rawData.financials?.is_bankrupt_or_liquidated || false,
      financialSource: rawData.financials?.financial_source || 'Officiella källor',
      
      ecommercePlatform: rawData.logistics?.ecommerce_platform || 'Okänd',
      paymentProvider: rawData.logistics?.payment_provider || 'Okänd', 
      checkoutSolution: rawData.logistics?.checkout_solution || '',
      taSystem: rawData.logistics?.ta_system || '',
      techEvidence: rawData.logistics?.tech_evidence || '',
      carriers: (rawData.logistics?.carriers || []).join(', '),
      strategicPitch: rawData.logistics?.strategic_pitch || '',
      latestNews: '', 
      
      decisionMakers: (rawData.contacts || []).map((c: any) => ({
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
      legalStatus: rawData.company_data?.legal_status || 'Aktiv',
      vatRegistered: rawData.company_data?.vat_registered || false,
      creditRatingLabel: rawData.company_data?.credit_rating || 'N/A',
      creditRatingMotivation: rawData.company_data?.credit_rating_motivation || '',
      riskProfile: rawData.company_data?.risk_profile || '',
      financialTrend: rawData.company_data?.financial_trend || '',
      industry: rawData.company_data?.industry || '',
      industryDescription: rawData.company_data?.industry_description || '',
      websiteUrl: rawData.company_data?.domain ? `https://${rawData.company_data.domain}` : '',
      
      businessModel: rawData.company_data?.business_model || '',
      storeCount: rawData.logistics?.store_count || 0,
      checkoutOptions: (rawData.logistics?.checkout_positions || []).map((cp: any) => ({
        position: cp.pos || 0,
        carrier: cp.carrier || '',
        service: cp.service || '',
        price: cp.price || 'N/A'
      })),

      conversionScore: rawData.logistics?.conversion_score || 0,
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

    const leadsArray = Array.isArray(data) ? data : (data.leads || []);
    return leadsArray.filter((l: any) => l && typeof l === 'object').map((l: any) => {
      const rev = parseRevenueToTKR(l.revenue);
      const marketCount = l.marketCount || 1;
      const metrics = calculateRickardMetrics(rev, l.sniCode || '', sniPercentages, marketCount);
      
      const annualPackages = l.logisticsMetrics?.estimatedAnnualPackages || metrics.annualPackages;
      const pos1Volume = l.logisticsMetrics?.pos1_volume || metrics.pos1Volume;
      const pos2Volume = l.logisticsMetrics?.pos2_volume || metrics.pos2Volume;
      const strategicPitch = l.logisticsMetrics?.strategic_pitch || '';

      return {
        ...l,
        id: crypto.randomUUID(),
        revenue: `${rev.toLocaleString('sv-SE')} tkr`,
        visitingAddress: l.visitingAddress || l.address || '',
        warehouseAddress: l.warehouseAddress || '',
        marketCount,
        annualPackages,
        pos1Volume,
        pos2Volume,
        strategicPitch,
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
