import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../prompts/systemInstructions";
import { MASTER_DEEP_SCAN_PROMPT } from "../prompts/deepAnalysis";
import { BATCH_PROSPECTING_INSTRUCTION } from "../prompts/batchProspecting";
import { calculateRickardMetrics, determineSegmentByPotential } from "../utils/calculations";
import { SearchFormData, LeadData, SNIPercentage, ThreePLProvider, NewsSourceMapping, DecisionMaker } from "../types";

/**
 * PERFORMILE - TURBO ENGINE (v25.1)
 * Optimerad för hastighet och PSP/Tech-detektion.
 */
const MIN_INTERVAL = 1500; 
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
  threePLProviders: ThreePLProvider[]
): Promise<LeadData> {
  onUpdate({}, "Aktiverar Performile Surgical Engine v25.1...");

  const searchQuery = `${formData.companyNameOrOrg} (Allabolag, Ratsit, Kreditkollen, LinkedIn)`;
  const prompt = MASTER_DEEP_SCAN_PROMPT.replace('{{COMPANY_CONTEXT}}', searchQuery);

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

      // Mappa även in initial QuickScan data om AI skickar det direkt
      conversionScore: rawData.logistics?.conversion_score || 0,
      deepScanPerformed: false 
    };

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
  threePLProviders: ThreePLProvider[]
): Promise<LeadData[]> {
  try {
    const prompt = `Batch Scan: Ort: ${formData.geoArea}, Omsättningssegment: ${formData.financialScope}, Triggers: ${formData.triggers}, Antal: ${formData.leadCount}. 
    EXKLUDERA DESSA BOLAG (Returnera dem INTE): ${exclusionList.slice(0, 50).join(', ')}`;

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

    const leadsArray = Array.isArray(data) ? data : (data.leads || []);
    return leadsArray.filter((l: any) => l && typeof l === 'object').map((l: any) => {
      const rev = parseRevenueToTKR(l.revenue);
      const marketCount = l.marketCount || 1;
      const metrics = calculateRickardMetrics(rev, l.sniCode || '', sniPercentages, marketCount);
      
      // Map nested logisticsMetrics to top-level LeadData fields if they exist
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
        analysisDate: '' 
      } as LeadData;
    });
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