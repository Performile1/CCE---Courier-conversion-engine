import axiosBase from 'axios';
import { supabase } from './supabaseClient.js';
import { CarrierSettings } from '../types';

export interface CarrierNetworkSnapshot {
  carrierName: string;
  agentLocationCount?: number;
  lockerLocationCount?: number;
  homeDeliveryReachPeople?: number;
  homeReachPercent?: number;
  sourceUrl?: string;
  sourceLabel?: string;
  capturedAt: string;
  confidence: 'verified' | 'estimated' | 'missing';
  snippet?: string;
}

type TavilySearchResult = {
  url?: string;
};

type CarrierSourceConfig = {
  aliases: string[];
  officialDomains: string[];
  queries: string[];
};

const CARRIER_SOURCE_CONFIG: Record<string, CarrierSourceConfig> = {
  postnord: {
    aliases: ['postnord'],
    officialDomains: ['postnord.se'],
    queries: [
      'PostNord Sverige ombud servicestallen paketskap hemleverans site:postnord.se',
      'PostNord Sverige paketombud paketskap befolkning site:postnord.se'
    ]
  },
  instabee: {
    aliases: ['instabee', 'instabox', 'budbee'],
    officialDomains: ['instabee.com', 'instabox.io', 'instabox.se', 'budbee.com'],
    queries: [
      'Instabee Sverige paketskap ombud hemleverans site:instabee.com OR site:instabox.io OR site:budbee.com',
      'Instabox Sverige lockers home delivery coverage official site:instabee.com OR site:instabox.io'
    ]
  },
  dhl: {
    aliases: ['dhl freight', 'dhl ecommerce', 'dhl'],
    officialDomains: ['dhl.com'],
    queries: [
      'DHL Sverige service points ombud hemleverans parcel lockers site:dhl.com',
      'DHL Freight Sverige utlämningsstallen hemleverans coverage site:dhl.com'
    ]
  },
  bring: {
    aliases: ['bring'],
    officialDomains: ['bring.se', 'bring.com'],
    queries: [
      'Bring Sverige ombud paketskap hemleverans site:bring.se OR site:bring.com',
      'Bring Sweden parcel lockers home delivery coverage official site:bring.se OR site:bring.com'
    ]
  }
};

async function getAuthToken(): Promise<string> {
  if (typeof window === 'undefined') {
    return process.env.CRON_SECRET || '';
  }

  try {
    const { data } = await (supabase as any).auth.getSession();
    return (data as any).session?.access_token || '';
  } catch {
    return '';
  }
}

const axios = axiosBase.create();
axios.interceptors.request.use(async (config) => {
  if (config.url && /\/api\/(openrouter|tavily|crawl)/.test(config.url)) {
    const token = await getAuthToken();
    if (token) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

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

function normalizeDomain(urlOrDomain: string): string {
  try {
    const url = urlOrDomain.includes('://') ? new URL(urlOrDomain) : new URL(`https://${urlOrDomain}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return String(urlOrDomain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

function normalizeCarrierKey(name: string): string {
  const normalized = String(name || '').toLowerCase();
  const match = Object.entries(CARRIER_SOURCE_CONFIG).find(([, config]) => config.aliases.some((alias) => normalized.includes(alias)));
  return match?.[0] || normalized;
}

function parseIntLike(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^\d.,\s]/g, '').trim();
  if (!cleaned) return undefined;

  if (/miljon/i.test(value)) {
    const millions = Number(cleaned.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(millions) ? Math.round(millions * 1_000_000) : undefined;
  }

  const normalized = cleaned.includes(',') && cleaned.includes('.')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function extractSnippet(text: string, index: number): string {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + 150);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function extractMetric(text: string, patterns: RegExp[]): { value?: number; snippet?: string } {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const rawValue = match[1] || match[2];
    const value = parseIntLike(rawValue);
    if (!value || value <= 0) continue;
    return { value, snippet: extractSnippet(text, match.index) };
  }

  return {};
}

function extractHomeReach(text: string, populationBase: number): { people?: number; snippet?: string } {
  const directPatterns = [
    /(?:hemleverans|home delivery|hem till d[oö]rren|door-?to-?door)[^\d%]{0,80}(\d{1,3}(?:[\s.,]\d{3})+|\d{1,2}(?:[.,]\d+)?\s*miljoner?)\s+(?:personer|inv[aå]nare|konsumenter|hush[aå]ll)/i,
    /(\d{1,3}(?:[\s.,]\d{3})+|\d{1,2}(?:[.,]\d+)?\s*miljoner?)\s+(?:personer|inv[aå]nare|konsumenter|hush[aå]ll)[^\n.]{0,100}(?:hemleverans|home delivery)/i
  ];
  const direct = extractMetric(text, directPatterns);
  if (direct.value) {
    return { people: direct.value, snippet: direct.snippet };
  }

  const percentPatterns = [
    /(?:hemleverans|home delivery|n[aå]r|reaches|coverage)[^\d%]{0,60}(\d{1,3}(?:[.,]\d+)?)\s*%[^\n.]{0,80}(?:befolkning|population)/i,
    /(\d{1,3}(?:[.,]\d+)?)\s*%[^\n.]{0,80}(?:av\s+)?(?:Sveriges\s+)?(?:befolkning|population)[^\n.]{0,80}(?:hemleverans|home delivery|n[aå]r|coverage)/i
  ];

  for (const pattern of percentPatterns) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const percent = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(percent) || percent <= 0) continue;
    return {
      people: Math.round((percent / 100) * populationBase),
      snippet: extractSnippet(text, match.index)
    };
  }

  return {};
}

function getSourceConfig(carrierName: string): CarrierSourceConfig {
  return CARRIER_SOURCE_CONFIG[normalizeCarrierKey(carrierName)] || {
    aliases: [carrierName.toLowerCase()],
    officialDomains: [],
    queries: [`${carrierName} Sverige ombud paketskap hemleverans officiell`]
  };
}

async function searchOfficialUrls(config: CarrierSourceConfig): Promise<string[]> {
  const urlSet = new Set<string>();

  for (const query of config.queries) {
    try {
      const response = await axios.post(buildApiUrl('/api/tavily'), {
        query,
        action: 'search'
      }, { timeout: 15000 });

      const results = Array.isArray(response.data?.results) ? response.data.results as TavilySearchResult[] : [];
      for (const result of results) {
        const url = String(result?.url || '').trim();
        if (!url) continue;
        const domain = normalizeDomain(url);
        if (!config.officialDomains.length || config.officialDomains.some((official) => domain.endsWith(normalizeDomain(official)))) {
          urlSet.add(url);
        }
      }
    } catch {
      continue;
    }
  }

  return Array.from(urlSet).slice(0, 6);
}

async function crawlUrl(url: string): Promise<string> {
  try {
    const response = await axios.post(buildApiUrl('/api/crawl'), {
      url,
      actionType: 'crawl',
      includeLinks: false,
      includeImages: false,
      ignoreCookieConsent: true,
      maxDepth: 1
    }, { timeout: 20000 });

    return String(response.data?.content || '');
  } catch {
    return '';
  }
}

export async function fetchCarrierNetworkCoverage(settings: CarrierSettings[], populationBase: number): Promise<CarrierNetworkSnapshot[]> {
  const snapshots: CarrierNetworkSnapshot[] = [];

  for (const carrier of settings) {
    const config = getSourceConfig(carrier.name);
    const urls = await searchOfficialUrls(config);
    const capturedAt = new Date().toISOString();

    let bestSnapshot: CarrierNetworkSnapshot = {
      carrierName: carrier.name,
      capturedAt,
      confidence: 'missing'
    };

    for (const url of urls) {
      const content = await crawlUrl(url);
      if (!content) continue;

      const agentMetric = extractMetric(content, [
        /(\d{1,3}(?:[\s.,]\d{3})+|\d{2,5})\s+(?:ombud|paketombud|service points|servicest[aä]llen|utl[aä]mningsst[aä]llen|pickup points)/i,
        /(?:ombud|paketombud|service points|servicest[aä]llen|utl[aä]mningsst[aä]llen|pickup points)[^\d]{0,24}(\d{1,3}(?:[\s.,]\d{3})+|\d{2,5})/i
      ]);
      const lockerMetric = extractMetric(content, [
        /(\d{1,3}(?:[\s.,]\d{3})+|\d{2,5})\s+(?:paketsk[aå]p|paketboxar|parcel lockers?|lockers?)/i,
        /(?:paketsk[aå]p|paketboxar|parcel lockers?|lockers?)[^\d]{0,24}(\d{1,3}(?:[\s.,]\d{3})+|\d{2,5})/i
      ]);
      const homeReachMetric = extractHomeReach(content, populationBase);

      const foundMetrics = [agentMetric.value, lockerMetric.value, homeReachMetric.people].filter((value) => value !== undefined).length;
      const bestMetrics = [bestSnapshot.agentLocationCount, bestSnapshot.lockerLocationCount, bestSnapshot.homeDeliveryReachPeople].filter((value) => value !== undefined).length;
      if (!foundMetrics || foundMetrics < bestMetrics) continue;

      bestSnapshot = {
        carrierName: carrier.name,
        agentLocationCount: agentMetric.value,
        lockerLocationCount: lockerMetric.value,
        homeDeliveryReachPeople: homeReachMetric.people,
        homeReachPercent: homeReachMetric.people && populationBase > 0 ? (homeReachMetric.people / populationBase) * 100 : undefined,
        sourceUrl: url,
        sourceLabel: normalizeDomain(url),
        capturedAt,
        confidence: foundMetrics > 0 ? 'verified' : 'missing',
        snippet: agentMetric.snippet || lockerMetric.snippet || homeReachMetric.snippet
      };
    }

    snapshots.push(bestSnapshot);
  }

  return snapshots;
}