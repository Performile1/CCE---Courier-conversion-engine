/**
 * parseUtils.ts — Pure text / number / domain parsing utilities
 * Extracted from openrouterService.ts. No async, no axios, no LeadData construction.
 */
import { FinancialYear, DecisionMaker } from '../../types';

// ── String / RegExp primitives ─────────────────────────────────────────────

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pickString(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  }
  return '';
}

export function pickNumber(...values: any[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value.replace(',', '.'));
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return undefined;
}

export function dedupeMessages(messages: Array<string | undefined | null>): string[] {
  return Array.from(new Set(messages.map((message) => String(message || '').trim()).filter(Boolean)));
}

// ── JSON repair & parse ────────────────────────────────────────────────────

export function repairJson(json: string): string {
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

export function parseJsonSafely(rawText: string): any {
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

// ── Domain / URL normalisation ──────────────────────────────────────────────

export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*/, '')
    .trim();
}

// ── Company name handling ──────────────────────────────────────────────────

export function normalizeCompanyForComparison(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(aktiebolag|ab|publ|holding|group|gruppen|sweden|sverige)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCompanyAliases(companyName: string): string[] {
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

export function normalizeOrgNumber(value: string): string {
  return String(value || '').replace(/[^0-9]/g, '');
}

export function extractOrgNumberFromText(text: string): string {
  const cleaned = String(text || '');
  const match = cleaned.match(/\b\d{6}[-\s]?\d{4}\b|\b\d{10}\b|\b\d{12}\b/);
  return match ? match[0] : '';
}

// ── Person name / contact guards ───────────────────────────────────────────

export function isLikelyGenericPersonName(name: string): boolean {
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

export function isConflictingCompanyVariant(sourceText: string, aliases: string[]): boolean {
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

export function looksLikeCompanyNewsText(newsText: string, companyAliases: string[], orgNumber?: string): boolean {
  const text = String(newsText || '').toLowerCase();
  if (!text) return false;

  const hasAlias = companyAliases.some((alias) => text.includes(alias.toLowerCase()));
  const orgNormalized = normalizeOrgNumber(orgNumber || '');
  const hasOrg = orgNormalized ? normalizeOrgNumber(text).includes(orgNormalized) : false;

  if (isConflictingCompanyVariant(text, companyAliases)) return false;
  return hasAlias || hasOrg;
}

// ── Date helpers ───────────────────────────────────────────────────────────

export function parseResultDate(value: any): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseLikelyPublishedDate(item: any): Date | null {
  return parseResultDate(item?.published_date)
    || parseResultDate(item?.publishedDate)
    || parseResultDate(item?.date)
    || parseResultDate(item?.metadata?.published_date)
    || null;
}

// ── Revenue / numeric parsers ──────────────────────────────────────────────

export function parseRevenueToTKR(val: any): number {
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

export function parseRevenueToTKROptional(val: any): number | undefined {
  if (val === null || val === undefined || val === '' || val === 'Ej tillgänglig') return undefined;
  return parseRevenueToTKR(val);
}

export function formatTkr(value?: number): string {
  if (value === undefined || Number.isNaN(value)) return '';
  return `${Math.round(value).toLocaleString('sv-SE')} tkr`;
}

export function parseLooseNumber(value: string): number | undefined {
  const cleaned = String(value || '').replace(/[<>]/g, '').replace(/[−–]/g, '-').replace(/\s+/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function parseAmountToTkr(value: string, unit?: string): number | undefined {
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

// ── Labeled text extractors ────────────────────────────────────────────────

export function parseLabeledMetricText(text: string, labels: string[]): string {
  const source = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}[\\s\\S]{0,120}?([<>−-]?\\s*[\\d\\s.,]+(?:\\s*(?:%|kr|tkr|mkr|msek))?)`, 'i');
    const match = source.match(pattern);
    const candidate = pickString(match?.[1]).replace(/[−–]/g, '-').replace(/\s{2,}/g, ' ').trim();
    if (candidate) return candidate;
  }
  return '';
}

export function parseLabeledFreeText(text: string, labels: string[]): string {
  const source = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}[^\\n]{0,15}[:\\-]?\\s*([^\\n|]{2,80})`, 'i');
    const match = source.match(pattern);
    const candidate = pickString(match?.[1]).replace(/\s{2,}/g, ' ').replace(/[.;,\s]+$/, '').trim();
    if (candidate) return candidate;
  }
  return '';
}

export function parseLabeledTkrValue(text: string, labels: string[]): number | undefined {
  const source = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}[^\\d\\n]{0,120}([\\d\\s.,]+)(?:\\s*(tkr|mkr|msek|sek))?`, 'i');
    const match = source.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseAmountToTkr(match[1], match[2]);
    if (parsed === undefined) continue;
    if (parsed > 0 || String(match[1]).includes('0')) return parsed;
  }
  return undefined;
}

export function parseLabeledAddress(text: string, labels: string[]): string {
  const source = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*:?\\s*([^\\n|]{8,140})`, 'i');
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

export function normalizeAddressCandidate(candidate: string): string {
  return String(candidate || '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[|;]/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ', ')
    .trim();
}

// ── Financial history helpers ──────────────────────────────────────────────

export function parseFinancialHistoryFromEvidence(text: string): FinancialYear[] {
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

export function deriveProfitMargin(history: FinancialYear[], fallback?: string): string {
  if (fallback && fallback !== '0%' && fallback !== '0') return fallback;
  const latest = history[0];
  if (!latest) return fallback || '';
  const revenue = parseLooseNumber(latest.revenue);
  const profit = parseLooseNumber(latest.profit || '');
  if (!revenue || profit === undefined) return fallback || '';
  return `${((profit / revenue) * 100).toFixed(1)}%`;
}

export function deriveFinancialTrend(history: FinancialYear[], fallback?: string): string {
  if (history.length < 2) return fallback || '';
  const latestRevenue = parseLooseNumber(history[0].revenue);
  const oldestRevenue = parseLooseNumber(history[history.length - 1].revenue);
  if (!latestRevenue || !oldestRevenue) return fallback || '';
  const growth = ((latestRevenue - oldestRevenue) / Math.max(oldestRevenue, 1)) * 100;
  if (growth >= 8) return 'Växande';
  if (growth <= -5) return 'Minskande';
  return 'Stabil';
}

export function deriveRiskProfileFromMetrics(input: {
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

export function normalizeFinancialHistoryEntries(history: any[], evidenceText?: string): FinancialYear[] {
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

// ── Structured label detection ─────────────────────────────────────────────

export function detectStructuredLabels(text: string, patterns: Array<{ label: string; keywords: string[] }>): string[] {
  const haystack = String(text || '').toLowerCase();
  if (!haystack) return [];
  return Array.from(new Set(
    patterns
      .filter((pattern) => pattern.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())))
      .map((pattern) => pattern.label)
  ));
}

// ── Decision maker helpers ─────────────────────────────────────────────────

export function normalizeDecisionMakerName(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9åäö\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeDecisionMakerTitle(title: string): string {
  return String(title || '').toLowerCase().replace(/[^a-z0-9åäö\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function scoreDecisionMaker(contact: DecisionMaker): number {
  return (contact.linkedin ? 3 : 0)
    + (contact.email ? 2 : 0)
    + (contact.directPhone ? 2 : 0)
    + (contact.verificationNote ? 2 : 0)
    + (contact.name.trim().split(/\s+/).length >= 2 ? 1 : 0);
}

export function dedupeDecisionMakers(contacts: DecisionMaker[], maxResults = 6): DecisionMaker[] {
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

// ── Market / store footprint ───────────────────────────────────────────────

export const MARKET_LABELS: Array<{ label: string; keywords: string[] }> = [
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

export function parseStoreCount(text: string): number | undefined {
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

export function extractMarketLabels(text: string): string[] {
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

// ── Evidence pattern matching ──────────────────────────────────────────────

export function findPatternMatch(
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

export function extractEvidenceSnippet(text: string, keywords: string[]): string {
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

export function containsAnyKeyword(text: string, keywords: string[]): boolean {
  const haystack = String(text || '').toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

// ── Email / phone helpers ──────────────────────────────────────────────────

export function extractEmailsFromText(text: string, companyDomain?: string): string[] {
  const matches: string[] = String(text || '').match(/\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b/gi) || [];
  const normalizedDomain = normalizeDomain(companyDomain || '');
  const filtered = normalizedDomain
    ? matches.filter((email) => normalizeDomain(email.split('@')[1] || '') === normalizedDomain)
    : matches;
  return Array.from(new Set(filtered.map((email) => email.toLowerCase())));
}

export function extractPhoneNumbersFromText(text: string): string[] {
  const matches = String(text || '').match(/(?:\+46|0)\s?(?:\d[\s-]?){6,11}\d/g) || [];
  return Array.from(new Set(matches.map((phone) => phone.replace(/\s+/g, ' ').trim())));
}

export function inferEmailPattern(localParts: string[], domain: string): string {
  const dotParts = localParts.filter(p => p.includes('.'));
  if (dotParts.length > 0 && dotParts.length / localParts.length >= 0.5) return `förnamn.efternamn@${domain}`;
  const initDotParts = localParts.filter(p => /^[a-z]\.[a-z]{2,}$/.test(p));
  if (initDotParts.length > 0) return `f.efternamn@${domain}`;
  return `[namn]@${domain}`;
}

// ── Role matching ──────────────────────────────────────────────────────────

export function normalizeRoleToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9åäö]/g, '');
}

export function roleMatchesFocus(role: string, focusRoles: string[]): boolean {
  const normalizedRole = normalizeRoleToken(role);
  const normalizedFocus = focusRoles
    .filter(Boolean)
    .map(normalizeRoleToken)
    .filter(Boolean);
  if (!normalizedFocus.length) return Boolean(normalizedRole);
  return normalizedFocus.some((focus) => normalizedRole.includes(focus) || focus.includes(normalizedRole));
}
