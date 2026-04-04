import { LeadData, Segment } from '../types';
import { supabase } from './supabaseClient';

export type LeadBucket = 'active' | 'reservoir';
export type SharedExclusionType = 'customer' | 'history';

type PersistedLeadRow = {
  id: string;
  company_name: string;
  org_number: string | null;
  domain: string | null;
  website_url: string | null;
  sni_code: string | null;
  industry: string | null;
  revenue: string | null;
  revenue_year: string | null;
  profit: string | null;
  segment: string | null;
  ecommerce_platform: string | null;
  payment_provider: string | null;
  carriers: string | null;
  potential_sek: number | null;
  freight_budget: string | null;
  annual_packages: number | null;
  analysis_model: string | null;
  hallucination_score: number | null;
  hallucination_details: unknown;
  source: string | null;
  analysis_date: string | null;
  lead_bucket?: LeadBucket | null;
  lead_payload?: Partial<LeadData> | null;
};

type SharedExclusionRow = {
  exclusion_type: SharedExclusionType;
  value: string;
  normalized_value: string;
};

function normalizeExclusionValue(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sortLeadsByAnalysisDate(leads: LeadData[]): LeadData[] {
  return [...leads].sort((a, b) => (b.analysisDate || '').localeCompare(a.analysisDate || ''));
}

function normalizePersistedLead(row: PersistedLeadRow): LeadData {
  const payload = row.lead_payload && typeof row.lead_payload === 'object' && !Array.isArray(row.lead_payload)
    ? row.lead_payload
    : {};

  return {
    id: String(payload.id || row.id),
    companyName: payload.companyName || row.company_name || '',
    orgNumber: payload.orgNumber || row.org_number || '',
    domain: payload.domain || row.domain || undefined,
    websiteUrl: payload.websiteUrl || row.website_url || '',
    phoneNumber: payload.phoneNumber,
    address: payload.address || '',
    visitingAddress: payload.visitingAddress,
    warehouseAddress: payload.warehouseAddress,
    returnAddress: payload.returnAddress,
    segment: (payload.segment || row.segment || Segment.UNKNOWN) as LeadData['segment'],
    industry: payload.industry || row.industry || undefined,
    industryDescription: payload.industryDescription,
    sniCode: payload.sniCode || row.sni_code || undefined,
    businessModel: payload.businessModel,
    revenue: payload.revenue || row.revenue || '',
    revenueYear: payload.revenueYear || row.revenue_year || undefined,
    profit: payload.profit || row.profit || undefined,
    financialHistory: payload.financialHistory,
    solidity: payload.solidity,
    liquidityRatio: payload.liquidityRatio,
    profitMargin: payload.profitMargin,
    employeesCount: payload.employeesCount,
    debtBalance: payload.debtBalance,
    debtEquityRatio: payload.debtEquityRatio,
    paymentRemarks: payload.paymentRemarks,
    isBankruptOrLiquidated: payload.isBankruptOrLiquidated,
    financialSource: payload.financialSource,
    legalStatus: payload.legalStatus || '',
    creditRatingLabel: payload.creditRatingLabel || '',
    creditRatingMotivation: payload.creditRatingMotivation,
    riskProfile: payload.riskProfile,
    financialTrend: payload.financialTrend,
    hasRemarks: payload.hasRemarks,
    vatRegistered: payload.vatRegistered,
    potentialSek: payload.potentialSek ?? row.potential_sek ?? undefined,
    freightBudget: payload.freightBudget || row.freight_budget || '',
    annualPackages: payload.annualPackages ?? row.annual_packages ?? undefined,
    pos1Volume: payload.pos1Volume,
    pos2Volume: payload.pos2Volume,
    estimatedAOV: payload.estimatedAOV,
    marketShareOfTotal: payload.marketShareOfTotal,
    conversionFactor: payload.conversionFactor,
    activeMarkets: payload.activeMarkets,
    marketCount: payload.marketCount,
    b2bPercentage: payload.b2bPercentage,
    b2cPercentage: payload.b2cPercentage,
    storeCount: payload.storeCount,
    ecommercePlatform: payload.ecommercePlatform || row.ecommerce_platform || undefined,
    paymentProvider: payload.paymentProvider || row.payment_provider || undefined,
    checkoutSolution: payload.checkoutSolution,
    taSystem: payload.taSystem,
    techEvidence: payload.techEvidence,
    techDetections: payload.techDetections,
    carriers: payload.carriers || row.carriers || '',
    checkoutOptions: payload.checkoutOptions,
    is3pl: payload.is3pl,
    detected3plProvider: payload.detected3plProvider,
    latestNews: payload.latestNews,
    newsItems: payload.newsItems,
    strategicPitch: payload.strategicPitch,
    analysisDate: payload.analysisDate || row.analysis_date || undefined,
    source: payload.source || (row.source as LeadData['source']) || 'manual',
    decisionMakers: Array.isArray(payload.decisionMakers) ? payload.decisionMakers : [],
    feedback: payload.feedback,
    deepScanPerformed: payload.deepScanPerformed,
    conversionScore: payload.conversionScore,
    recoveryPotentialSek: payload.recoveryPotentialSek,
    frictionAnalysis: payload.frictionAnalysis,
    dmtMatrix: payload.dmtMatrix,
    aiModel: payload.aiModel || (row.analysis_model as LeadData['aiModel']) || undefined,
    halluccinationScore: payload.halluccinationScore ?? row.hallucination_score ?? undefined,
    halluccinationAnalysis: payload.halluccinationAnalysis || (row.hallucination_details as LeadData['halluccinationAnalysis']) || undefined,
    sourceCoverage: payload.sourceCoverage,
    emailPattern: payload.emailPattern,
    dataConfidence: payload.dataConfidence,
    verifiedRegistrySnapshot: payload.verifiedRegistrySnapshot,
    verifiedFieldEvidence: payload.verifiedFieldEvidence,
    changeHighlights: payload.changeHighlights,
    hasMonitoredChanges: payload.hasMonitoredChanges,
    lastMonitoredCheckAt: payload.lastMonitoredCheckAt
  };
}

async function persistDecisionMakers(leadId: string, lead: LeadData) {
  const { error: deleteError } = await supabase.from('decision_makers').delete().eq('lead_id', leadId);
  if (deleteError) throw deleteError;

  const contacts = (lead.decisionMakers || []).filter((contact) => contact?.name);
  if (!contacts.length) return;

  const { error: insertError } = await supabase.from('decision_makers').insert(
    contacts.map((contact) => ({
      lead_id: leadId,
      name: contact.name,
      title: contact.title || null,
      email: contact.email || null,
      linkedin: contact.linkedin || null,
      direct_phone: contact.directPhone || null,
      verification_note: contact.verificationNote || null
    }))
  );

  if (insertError) throw insertError;
}

async function findExistingLeadId(userId: string, lead: LeadData, preferredId?: string) {
  if (preferredId && !preferredId.startsWith('temp_')) {
    return preferredId;
  }

  let query = supabase.from('leads').select('id').eq('user_id', userId).limit(1);
  if (lead.orgNumber) {
    query = query.eq('org_number', lead.orgNumber);
  } else {
    query = query.eq('company_name', lead.companyName);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.id || undefined;
}

export async function loadPersistedLeads(userId: string, bucket: LeadBucket = 'active'): Promise<LeadData[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, company_name, org_number, domain, website_url, sni_code, industry, revenue, revenue_year, profit, segment, ecommerce_platform, payment_provider, carriers, potential_sek, freight_budget, annual_packages, analysis_model, hallucination_score, hallucination_details, source, analysis_date, lead_bucket, lead_payload')
    .eq('user_id', userId)
    .eq('lead_bucket', bucket)
    .order('analysis_date', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return sortLeadsByAnalysisDate((data || []).map((row: PersistedLeadRow) => normalizePersistedLead(row)));
}

export async function upsertPersistedLead(userId: string, lead: LeadData, existingLeadId?: string, bucket: LeadBucket = 'active'): Promise<LeadData> {
  const resolvedId = await findExistingLeadId(userId, lead, existingLeadId || lead.id);
  const leadId = resolvedId || (!lead.id || lead.id.startsWith('temp_') ? crypto.randomUUID() : lead.id);
  const analysisDate = lead.analysisDate || new Date().toISOString();
  const normalizedLead: LeadData = {
    ...lead,
    id: leadId,
    analysisDate
  };

  const row = {
    id: leadId,
    user_id: userId,
    company_name: normalizedLead.companyName,
    org_number: normalizedLead.orgNumber || null,
    domain: normalizedLead.domain || null,
    website_url: normalizedLead.websiteUrl || null,
    sni_code: normalizedLead.sniCode || null,
    industry: normalizedLead.industry || null,
    revenue: normalizedLead.revenue || null,
    revenue_year: normalizedLead.revenueYear || null,
    profit: normalizedLead.profit || null,
    segment: normalizedLead.segment || null,
    ecommerce_platform: normalizedLead.ecommercePlatform || null,
    payment_provider: normalizedLead.paymentProvider || null,
    carriers: normalizedLead.carriers || null,
    potential_sek: normalizedLead.potentialSek || null,
    freight_budget: normalizedLead.freightBudget || null,
    annual_packages: normalizedLead.annualPackages || null,
    analysis_model: normalizedLead.aiModel || null,
    hallucination_score: normalizedLead.halluccinationScore || 0,
    hallucination_details: normalizedLead.halluccinationAnalysis || null,
    lead_bucket: bucket,
    lead_payload: normalizedLead,
    status: 'pending',
    source: normalizedLead.source || 'manual',
    analysis_date: analysisDate,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('leads').upsert(row, { onConflict: 'id' }).select('id').single();
  if (error) throw error;

  await persistDecisionMakers(data.id, normalizedLead);
  return {
    ...normalizedLead,
    id: data.id
  };
}

export async function deletePersistedLead(userId: string, leadId: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('user_id', userId).eq('id', leadId);
  if (error) throw error;
}

export async function replacePersistedLeads(userId: string, leads: LeadData[], bucket: LeadBucket = 'active'): Promise<LeadData[]> {
  const { error: deleteError } = await supabase.from('leads').delete().eq('user_id', userId).eq('lead_bucket', bucket);
  if (deleteError) throw deleteError;

  const persisted: LeadData[] = [];
  for (const lead of leads) {
    persisted.push(await upsertPersistedLead(userId, lead, undefined, bucket));
  }

  return sortLeadsByAnalysisDate(persisted);
}

export async function loadSharedExclusions(): Promise<Record<SharedExclusionType, string[]>> {
  const { data, error } = await supabase
    .from('shared_exclusions')
    .select('exclusion_type, value, normalized_value')
    .order('value', { ascending: true });

  if (error) throw error;

  const result: Record<SharedExclusionType, string[]> = {
    customer: [],
    history: []
  };

  for (const row of (data || []) as SharedExclusionRow[]) {
    if (row.exclusion_type === 'customer' || row.exclusion_type === 'history') {
      result[row.exclusion_type].push(row.value);
    }
  }

  return result;
}

export async function replaceSharedExclusions(type: SharedExclusionType, values: string[], userId?: string): Promise<string[]> {
  const uniqueValues = Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

  const { error: deleteError } = await supabase.from('shared_exclusions').delete().eq('exclusion_type', type);
  if (deleteError) throw deleteError;

  if (uniqueValues.length === 0) {
    return [];
  }

  const rows = uniqueValues.map((value) => ({
    exclusion_type: type,
    value,
    normalized_value: normalizeExclusionValue(value),
    created_by: userId || null,
    updated_at: new Date().toISOString()
  }));

  const { error: insertError } = await supabase.from('shared_exclusions').insert(rows);
  if (insertError) throw insertError;

  return uniqueValues;
}