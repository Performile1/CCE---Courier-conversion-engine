/**
 * LEAD MAPPING SERVICE (v25.1)
 * Truth Persistence Principle: a value with higher verification grade or
 * more specific information must never be overwritten by a weaker value.
 *
 * Contains:
 *  - mergeLeadData()               — field-wise merge with per-category rules
 *  - buildVerifiedFieldEvidenceUpdate() — confidence-locking evidence writer
 */

import type {
  LeadData,
  VerifiedLeadField,
  VerifiedFieldEvidence,
  DecisionMaker,
  FinancialYear,
  CheckoutOption,
  NewsItem,
} from '../../types';

// Legal statuses that require a confirmed registry source to remove.
const PROTECTED_LEGAL_STATUSES = ['Konkurs', 'Likvidation', 'Avregistrerad'];
const PLACEHOLDER_DECISION_MAKER_TITLES = new Set(['title', 'titel', 'role', 'roll', 'kontaktperson', 'person', 'unknown', 'okand', 'n/a', 'na']);
const PLACEHOLDER_DECISION_MAKER_NAME_TOKENS = new Set([
  'john', 'jane', 'doe', 'test', 'demo', 'example', 'user', 'person',
  'unknown', 'okand', 'namn', 'fornamn', 'efternamn', 'kontaktperson',
  'contact', 'admin', 'support', 'info', 'team', 'sales'
]);

// ---------------------------------------------------------------------------
// mergeLeadData
// ---------------------------------------------------------------------------

/**
 * Merges `incoming` (Partial<LeadData> from a new analysis pass) into
 * `existing` (the stored lead) using per-field Truth Persistence rules.
 *
 * Rules by category:
 *  IDENTITY      – companyName/websiteUrl: non-empty overwrite. orgNumber: immutable.
 *  FINANCIAL     – revenue/profit: only if meaningful value (length > 2, not "—").
 *                  financialHistory: keyed union on year.
 *                  solidity/liquidityRatio/profitMargin: non-empty overwrite.
 *  RISK/STATUS   – legalStatus: authority lock for Konkurs/Likvidation statuses.
 *                  paymentRemarks/debtBalance/debtEquityRatio: worst-case persistence.
 *  GEOGRAPHY     – address: immutable in merge (registry-only via orchestrator).
 *                  visitingAddress/warehouseAddress/returnAddress: explicit overwrite.
 *  MARKET        – activeMarkets: unique-set union. storeCount: max value.
 *  LOGISTICS     – ecommercePlatform/taSystem: crawl-first protection (only fill empty).
 *                  paymentProvider/checkoutSolution/carriers: additive unique comma-join.
 *                  checkoutOptions: keyed overwrite on carrier name.
 *  OUTREACH      – decisionMakers: deduplicated union (email primary, name secondary).
 *                  newsItems: union by URL, sorted by date desc.
 *                  emailPattern: verified-lock (@ pattern cannot be overwritten by guess).
 *  EVIDENCE      – verifiedFieldEvidence: confidence-locked field-by-field merge.
 */
export function mergeLeadData(
  existing: LeadData,
  incoming: Partial<LeadData>
): LeadData {
  const merged: LeadData = { ...existing };
  const sanitizedExistingDecisionMakers = sanitizeDecisionMakers(existing.decisionMakers || []);
  if (sanitizedExistingDecisionMakers.length !== (existing.decisionMakers || []).length) {
    merged.decisionMakers = sanitizedExistingDecisionMakers;
  }

  // ── IDENTITY ───────────────────────────────────────────────────────────────
  if (incoming.companyName?.trim()) merged.companyName = incoming.companyName;
  if (incoming.websiteUrl?.trim()) merged.websiteUrl = incoming.websiteUrl;
  if (incoming.domain?.trim()) merged.domain = incoming.domain;
  if (incoming.phoneNumber?.trim()) merged.phoneNumber = incoming.phoneNumber;
  // orgNumber: never changed in merge (authority: registry only via orchestrator)

  // ── FINANCIALS ─────────────────────────────────────────────────────────────
  if (isMeaningfulValue(incoming.revenue)) merged.revenue = incoming.revenue!;
  if (isMeaningfulValue(incoming.profit)) merged.profit = incoming.profit;
  if (isMeaningfulValue(incoming.solidity)) merged.solidity = incoming.solidity;
  if (isMeaningfulValue(incoming.liquidityRatio)) merged.liquidityRatio = incoming.liquidityRatio;
  if (isMeaningfulValue(incoming.profitMargin)) merged.profitMargin = incoming.profitMargin;
  if (incoming.revenueYear?.trim()) merged.revenueYear = incoming.revenueYear;
  if (incoming.employeesCount !== undefined && incoming.employeesCount > 0) {
    merged.employeesCount = incoming.employeesCount;
  }
  if (incoming.financialSource?.trim()) merged.financialSource = incoming.financialSource;

  // financialHistory: keyed union on year.
  // Existing entries are preserved; incoming can add missing years or fill in
  // missing sub-fields (profit, ebitda, revenueChange) on existing years.
  if (incoming.financialHistory && incoming.financialHistory.length > 0) {
    const yearMap = new Map<string, FinancialYear>(
      (existing.financialHistory || []).map(fy => [fy.year, { ...fy }])
    );
    for (const fy of incoming.financialHistory) {
      const existing = yearMap.get(fy.year);
      if (!existing) {
        yearMap.set(fy.year, fy);
      } else {
        // Fill in sub-fields that are missing in the existing entry only
        if (!existing.profit && fy.profit) existing.profit = fy.profit;
        if (!existing.ebitda && fy.ebitda) existing.ebitda = fy.ebitda;
        if (!existing.revenueChange && fy.revenueChange) existing.revenueChange = fy.revenueChange;
        // Revenue: keep existing unless it is clearly a placeholder ("—", "0")
        if (!isMeaningfulValue(existing.revenue) && isMeaningfulValue(fy.revenue)) {
          existing.revenue = fy.revenue;
        }
      }
    }
    merged.financialHistory = Array.from(yearMap.values())
      .sort((a, b) => b.year.localeCompare(a.year))
      .slice(0, 3);
  }

  // ── RISK & STATUS ──────────────────────────────────────────────────────────
  // legalStatus: authority lock — Konkurs/Likvidation/Avregistrerad status
  // can only be cleared through a dedicated registry-step, never via this merge.
  if (incoming.legalStatus?.trim()) {
    const existingIsLocked = PROTECTED_LEGAL_STATUSES.some(s =>
      existing.legalStatus?.toLowerCase().includes(s.toLowerCase())
    );
    if (!existingIsLocked) merged.legalStatus = incoming.legalStatus;
  }

  if (incoming.creditRatingLabel?.trim()) merged.creditRatingLabel = incoming.creditRatingLabel;
  if (incoming.creditRatingMotivation?.trim()) merged.creditRatingMotivation = incoming.creditRatingMotivation;
  if (incoming.riskProfile?.trim()) merged.riskProfile = incoming.riskProfile;
  if (incoming.financialTrend?.trim()) merged.financialTrend = incoming.financialTrend;

  // paymentRemarks, debtBalance, debtEquityRatio: worst-case persistence.
  // Only update when incoming has a real value; never overwrite a real value with empty/dash.
  if (isMeaningfulValue(incoming.paymentRemarks)) merged.paymentRemarks = incoming.paymentRemarks;
  if (isMeaningfulValue(incoming.debtBalance)) merged.debtBalance = incoming.debtBalance;
  if (isMeaningfulValue(incoming.debtEquityRatio)) merged.debtEquityRatio = incoming.debtEquityRatio;

  // isBankruptOrLiquidated / hasRemarks: sticky-true
  if (incoming.isBankruptOrLiquidated === true) merged.isBankruptOrLiquidated = true;
  if (incoming.hasRemarks === true) merged.hasRemarks = true;
  if (incoming.vatRegistered !== undefined) merged.vatRegistered = incoming.vatRegistered;

  // ── GEOGRAPHY ──────────────────────────────────────────────────────────────
  // address: NOT updated in merge. Registry-only; use orchestrator to update.
  // visitingAddress, warehouseAddress, returnAddress: explicit overwrite only.
  if (incoming.visitingAddress?.trim()) merged.visitingAddress = incoming.visitingAddress;
  if (incoming.warehouseAddress?.trim()) merged.warehouseAddress = incoming.warehouseAddress;
  if (incoming.returnAddress?.trim()) merged.returnAddress = incoming.returnAddress;

  // ── CLASSIFICATION ─────────────────────────────────────────────────────────
  if (incoming.industry?.trim()) merged.industry = incoming.industry;
  if (incoming.industryDescription?.trim()) merged.industryDescription = incoming.industryDescription;
  if (incoming.sniCode?.trim()) merged.sniCode = incoming.sniCode;
  if (incoming.businessModel?.trim()) merged.businessModel = incoming.businessModel;
  // segment: NOT set here — orchestrator responsibility (requires calculateRickardMetrics)

  // ── MARKET ─────────────────────────────────────────────────────────────────
  // activeMarkets: unique-set union
  if (incoming.activeMarkets && incoming.activeMarkets.length > 0) {
    merged.activeMarkets = Array.from(
      new Set([...(existing.activeMarkets || []), ...incoming.activeMarkets])
    );
    merged.marketCount = merged.activeMarkets.length;
  }

  // storeCount: max value
  if (incoming.storeCount !== undefined && incoming.storeCount > (existing.storeCount ?? 0)) {
    merged.storeCount = incoming.storeCount;
  }

  if (incoming.b2bPercentage !== undefined && incoming.b2bPercentage > 0) {
    merged.b2bPercentage = incoming.b2bPercentage;
  }
  if (incoming.b2cPercentage !== undefined && incoming.b2cPercentage > 0) {
    merged.b2cPercentage = incoming.b2cPercentage;
  }

  // ── LOGISTICS / TECH STACK ─────────────────────────────────────────────────
  // ecommercePlatform, taSystem: crawl-first protection.
  // We never overwrite an existing (crawled) value with an LLM inference.
  // The orchestrator must bypass this if a new crawl produces a conflicting value.
  if (!existing.ecommercePlatform && incoming.ecommercePlatform?.trim()) {
    merged.ecommercePlatform = incoming.ecommercePlatform;
  }
  if (!existing.taSystem && incoming.taSystem?.trim()) {
    merged.taSystem = incoming.taSystem;
  }

  // paymentProvider, checkoutSolution, carriers: additive unique comma-join.
  // Example: "Klarna" + "Adyen" → "Klarna, Adyen"
  if (incoming.paymentProvider?.trim()) {
    merged.paymentProvider = mergeUniqueCommaValues(existing.paymentProvider, incoming.paymentProvider);
  }
  if (incoming.checkoutSolution?.trim()) {
    merged.checkoutSolution = mergeUniqueCommaValues(existing.checkoutSolution, incoming.checkoutSolution);
  }
  if (incoming.carriers?.trim()) {
    merged.carriers = mergeUniqueCommaValues(existing.carriers, incoming.carriers);
  }

  if (incoming.techEvidence?.trim()) merged.techEvidence = incoming.techEvidence;
  if (incoming.techDetections) merged.techDetections = incoming.techDetections;

  // checkoutOptions: keyed overwrite on carrier name.
  // If incoming marks a carrier as pos:0 / inCheckout:false, that reflects
  // the current state and overwrites any earlier "present" entry for that carrier.
  if (incoming.checkoutOptions && incoming.checkoutOptions.length > 0) {
    const optionMap = new Map<string, CheckoutOption>(
      (existing.checkoutOptions || []).map(opt => [opt.carrier.toLowerCase(), opt])
    );
    for (const opt of incoming.checkoutOptions) {
      optionMap.set(opt.carrier.toLowerCase(), opt);
    }
    merged.checkoutOptions = Array.from(optionMap.values())
      .sort((a, b) => a.position - b.position);
  }

  // Logistics metrics: overwrite if incoming has a real value
  if (isMeaningfulValue(incoming.freightBudget)) merged.freightBudget = incoming.freightBudget!;
  if (incoming.potentialSek && incoming.potentialSek > 0) merged.potentialSek = incoming.potentialSek;
  if (incoming.annualPackages && incoming.annualPackages > 0) merged.annualPackages = incoming.annualPackages;
  if (incoming.annualPackageEstimateSource) merged.annualPackageEstimateSource = incoming.annualPackageEstimateSource;
  if (incoming.estimatedAOV && incoming.estimatedAOV > 0) merged.estimatedAOV = incoming.estimatedAOV;
  if (incoming.pos1Volume !== undefined) merged.pos1Volume = incoming.pos1Volume;
  if (incoming.pos2Volume !== undefined) merged.pos2Volume = incoming.pos2Volume;
  if (incoming.pricingProductName?.trim()) merged.pricingProductName = incoming.pricingProductName;
  if (incoming.pricingProductSource) merged.pricingProductSource = incoming.pricingProductSource;
  if (incoming.marketShareOfTotal?.trim()) merged.marketShareOfTotal = incoming.marketShareOfTotal;
  if (incoming.conversionFactor !== undefined) merged.conversionFactor = incoming.conversionFactor;
  if (incoming.is3pl !== undefined) merged.is3pl = incoming.is3pl;
  if (incoming.detected3plProvider?.trim()) merged.detected3plProvider = incoming.detected3plProvider;

  // ── OUTREACH ───────────────────────────────────────────────────────────────
  // decisionMakers: deduplicated union.
  //  - Keys: email (primary), name (secondary, lowercased).
  //  - Existing contacts NOT present in incoming are preserved (historical truth).
  //  - For the same key, incoming wins (more recent fetch = more current info).
  const sanitizedIncomingDecisionMakers = sanitizeDecisionMakers(incoming.decisionMakers || []);
  if (sanitizedIncomingDecisionMakers.length > 0) {
    const dmMap = new Map<string, DecisionMaker>(
      sanitizedExistingDecisionMakers.map(dm => [
        normalizeDecisionMakerMergeKey(dm),
        dm,
      ])
    );
    for (const dm of sanitizedIncomingDecisionMakers) {
      dmMap.set(normalizeDecisionMakerMergeKey(dm), dm);
    }
    merged.decisionMakers = Array.from(dmMap.values());
  }

  // latestNews: non-empty overwrite (free text summary from latest scan)
  if (incoming.latestNews?.trim()) merged.latestNews = incoming.latestNews;

  // newsItems: union by URL, sorted newest-first by date string
  if (incoming.newsItems && incoming.newsItems.length > 0) {
    const newsMap = new Map<string, NewsItem>(
      (existing.newsItems || []).map(n => [n.url, n])
    );
    for (const n of incoming.newsItems) {
      // Incoming wins on same URL (could have updated title/source)
      newsMap.set(n.url, n);
    }
    merged.newsItems = Array.from(newsMap.values())
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }

  // emailPattern: verified-lock.
  // A pattern containing "@" (inferred format like "f.e@domain.se") is verified.
  // A verified existing pattern cannot be overwritten by a non-verified guess.
  if (incoming.emailPattern?.trim()) {
    const existingIsVerified = existing.emailPattern?.includes('@');
    const incomingIsVerified = incoming.emailPattern.includes('@');
    if (!existingIsVerified || incomingIsVerified) {
      merged.emailPattern = incoming.emailPattern;
    }
  }

  if (incoming.strategicPitch?.trim()) merged.strategicPitch = incoming.strategicPitch;

  // ── CONFIDENCE & DIAGNOSTICS ───────────────────────────────────────────────
  if (incoming.dataConfidence) merged.dataConfidence = incoming.dataConfidence;
  if (incoming.sourceCoverage && incoming.sourceCoverage.length > 0) {
    merged.sourceCoverage = incoming.sourceCoverage;
  }
  if (incoming.verifiedRegistrySnapshot) merged.verifiedRegistrySnapshot = incoming.verifiedRegistrySnapshot;

  // verifiedFieldEvidence: confidence-locked field-by-field merge.
  // An 'estimated' finding from a new pass cannot overwrite a 'verified' finding.
  if (incoming.verifiedFieldEvidence) {
    const base = { ...(existing.verifiedFieldEvidence ?? {}) };
    for (const [field, newEv] of Object.entries(incoming.verifiedFieldEvidence) as [VerifiedLeadField, VerifiedFieldEvidence | undefined][]) {
      if (!newEv) continue;
      const existEv = base[field];
      const canOverwrite = !existEv || existEv.confidence !== 'verified' || newEv.confidence === 'verified';
      if (canOverwrite) base[field] = newEv;
    }
    merged.verifiedFieldEvidence = base;
  }

  // ── DEEPSCAN ───────────────────────────────────────────────────────────────
  if (incoming.deepScanPerformed) merged.deepScanPerformed = true;
  if (incoming.conversionScore !== undefined) merged.conversionScore = incoming.conversionScore;
  if (incoming.recoveryPotentialSek?.trim()) merged.recoveryPotentialSek = incoming.recoveryPotentialSek;
  if (incoming.frictionAnalysis) merged.frictionAnalysis = incoming.frictionAnalysis;
  if (incoming.dmtMatrix && incoming.dmtMatrix.length > 0) merged.dmtMatrix = incoming.dmtMatrix;

  // ── AI METADATA ────────────────────────────────────────────────────────────
  if (incoming.aiModel) merged.aiModel = incoming.aiModel;
  const incomingHallucinationScore = incoming.hallucinationScore ?? incoming.halluccinationScore;
  if (incomingHallucinationScore !== undefined) {
    merged.halluccinationScore = incomingHallucinationScore;
    merged.hallucinationScore = incomingHallucinationScore;
  }
  const incomingHallucinationAnalysis = incoming.hallucinationAnalysis ?? incoming.halluccinationAnalysis;
  if (incomingHallucinationAnalysis) {
    merged.halluccinationAnalysis = incomingHallucinationAnalysis;
    merged.hallucinationAnalysis = incomingHallucinationAnalysis;
  }
  if (incoming.processingStatus) merged.processingStatus = incoming.processingStatus;
  if (incoming.processingErrorCode) merged.processingErrorCode = incoming.processingErrorCode;
  if (incoming.processingErrorMessage?.trim()) merged.processingErrorMessage = incoming.processingErrorMessage;
  if (incoming.analysisCompleteness) merged.analysisCompleteness = incoming.analysisCompleteness;
  if (incoming.analysisWarnings && incoming.analysisWarnings.length > 0) {
    merged.analysisWarnings = incoming.analysisWarnings;
  }
  if (incoming.analysisTelemetry && incoming.analysisTelemetry.length > 0) {
    merged.analysisTelemetry = incoming.analysisTelemetry;
  }
  if (incoming.analysisSteps && incoming.analysisSteps.length > 0) {
    merged.analysisSteps = incoming.analysisSteps;
  }
  if (incoming.analysisDate) merged.analysisDate = incoming.analysisDate;

  return merged;
}

// ---------------------------------------------------------------------------
// buildVerifiedFieldEvidenceUpdate
// ---------------------------------------------------------------------------

export interface FieldFinding {
  field: VerifiedLeadField;
  url: string;
  label: string;
  snippet?: string;
  confidence: 'verified' | 'estimated';
}

/**
 * Applies a list of new source findings to the existing evidence map.
 *
 * Confidence-lock rule:
 *  - An existing 'verified' entry is only replaced when the new finding is
 *    also 'verified' (e.g. a fresh registry hit).
 *  - An existing 'estimated' or missing entry is always replaced.
 *
 * Returns a new evidence map; does not mutate the input.
 */
export function buildVerifiedFieldEvidenceUpdate(
  currentEvidence: Partial<Record<VerifiedLeadField, VerifiedFieldEvidence>>,
  newFindings: FieldFinding[]
): Partial<Record<VerifiedLeadField, VerifiedFieldEvidence>> {
  const updated: Partial<Record<VerifiedLeadField, VerifiedFieldEvidence>> = { ...currentEvidence };

  for (const finding of newFindings) {
    const existing = updated[finding.field];
    const canOverwrite =
      !existing ||
      existing.confidence !== 'verified' ||
      finding.confidence === 'verified';

    if (canOverwrite) {
      updated[finding.field] = {
        sourceUrl: finding.url,
        sourceLabel: finding.label,
        snippet: finding.snippet,
        confidence: finding.confidence,
        capturedAt: new Date().toISOString(),
      };
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the value is a non-empty string that is not a placeholder
 * such as "—", "0", or whitespace-only.
 */
function isMeaningfulValue(v: string | null | undefined): boolean {
  if (v == null) return false;
  const trimmed = v.trim();
  if (!trimmed) return false;

  const lowered = trimmed.toLowerCase();
  const placeholders = new Set([
    '—', '-', 'n/a', 'na', 'okänd', 'okand', 'unknown',
    'ej tillgänglig', 'ej tillganglig', 'saknas', 'null', 'undefined'
  ]);
  if (placeholders.has(lowered)) return false;

  // Guard against synthetic zero placeholders like "0", "0%", "0 tkr".
  if (/^0+(?:[.,]0+)?$/.test(trimmed)) return false;
  if (/^0+(?:[.,]0+)?\s*(tkr|kr|sek|mkr|msek|%)$/i.test(trimmed)) return false;

  return true;
}

/**
 * Merges two comma-separated value strings into a single unique-valued string.
 * Deduplication is case-insensitive; original casing of the first occurrence is kept.
 *
 * Example: mergeUniqueCommaValues("Klarna", "Adyen, Klarna") → "Klarna, Adyen"
 */
function mergeUniqueCommaValues(
  existing: string | undefined,
  incoming: string
): string {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of [...(existing ?? '').split(','), ...incoming.split(',')]) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }

  return result.join(', ');
}

function normalizeDecisionMakerMergeKey(contact: DecisionMaker): string {
  const email = (contact.email || '').trim().toLowerCase();
  if (email) return email;
  return normalizeDecisionMakerNameForFiltering(contact.name);
}

function normalizeDecisionMakerNameForFiltering(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9åäö\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyPlaceholderDecisionMakerName(name: string): boolean {
  const normalized = normalizeDecisionMakerNameForFiltering(name);
  if (!normalized) return true;

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length < 2) return true;

  if ((parts[0] === 'john' || parts[0] === 'jane') && parts[1] === 'doe') {
    return true;
  }

  if (parts.every((part) => PLACEHOLDER_DECISION_MAKER_NAME_TOKENS.has(part))) {
    return true;
  }

  return /^(test|demo|example)\b/i.test(normalized);
}

function isLikelyPlaceholderDecisionMakerTitle(title: string): boolean {
  const normalized = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9åäö/\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return !normalized || PLACEHOLDER_DECISION_MAKER_TITLES.has(normalized);
}

function sanitizeDecisionMakers(contacts: DecisionMaker[]): DecisionMaker[] {
  if (!Array.isArray(contacts)) return [];

  const deduped = new Map<string, DecisionMaker>();
  for (const contact of contacts) {
    const name = String(contact?.name || '').trim();
    const title = String(contact?.title || '').trim();
    if (!name || !title) continue;
    if (isLikelyPlaceholderDecisionMakerName(name)) continue;
    if (isLikelyPlaceholderDecisionMakerTitle(title)) continue;

    const sanitized: DecisionMaker = {
      ...contact,
      name,
      title,
      email: String(contact?.email || '').trim(),
      linkedin: String(contact?.linkedin || '').trim(),
      directPhone: String(contact?.directPhone || '').trim(),
      verificationNote: String(contact?.verificationNote || '').trim()
    };

    deduped.set(normalizeDecisionMakerMergeKey(sanitized), sanitized);
  }

  return Array.from(deduped.values());
}
