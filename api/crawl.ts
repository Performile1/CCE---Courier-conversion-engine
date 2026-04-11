/**
 * VERCEL FUNCTION - Crawl4ai Web Scraping Handler
 * Secure backend endpoint for complex site scraping
 * Used as fallback when Tavily can't handle JavaScript-heavy sites or PDFs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { requireApiAuth } from './_scheduledJobs.js';

const DEFAULT_CRAWL4AI_API_URL = 'https://api.crawl4ai.com/v1/crawl';
const CRAWL4AI_AUTH_MODE = String(process.env.CRAWL4AI_AUTH_MODE || 'auto').trim().toLowerCase();
const CRAWL4AI_AUTH_EMAIL = String(process.env.CRAWL4AI_AUTH_EMAIL || '').trim();
const CRAWL4AI_AUTH_TOKEN_URL = String(process.env.CRAWL4AI_AUTH_TOKEN_URL || '').trim();
const CRAWL4AI_AUTH_STRICT = String(process.env.CRAWL4AI_AUTH_STRICT || 'false').trim().toLowerCase() === 'true';

const CRAWL4AI_PROXY_USER_AGENT = 'CCE-Carrier-Conversion-Engine (+https://cce-carrier-conversion.vercel.app)';
const JWT_REFRESH_BUFFER_MS = 60 * 1000;
const FALLBACK_TOKEN_TTL_MS = 55 * 60 * 1000;

type Crawl4aiJwtCacheEntry = {
  accessToken: string;
  expiresAtMs: number;
  email: string;
  tokenUrl: string;
};

let crawl4aiJwtCache: Crawl4aiJwtCacheEntry | null = null;

function resolveCrawl4aiApiUrl(rawUrl: string | undefined): { url: string; warning?: string } {
  const configured = String(rawUrl || '').trim();
  if (!configured) {
    return { url: DEFAULT_CRAWL4AI_API_URL };
  }

  try {
    const parsed = new URL(configured);
    const basePath = parsed.pathname.replace(/\/+$/, '');

    // If only host is provided, default to /crawl for self-host compatibility.
    if (!basePath || basePath === '/') {
      parsed.pathname = '/crawl';
      const corrected = parsed.toString();
      return {
        url: corrected,
        warning: `CRAWL4AI_API_URL had no path and was normalized to ${corrected}`
      };
    }

    return { url: configured };
  } catch {
    return {
      url: DEFAULT_CRAWL4AI_API_URL,
      warning: `CRAWL4AI_API_URL is invalid (${configured}). Falling back to ${DEFAULT_CRAWL4AI_API_URL}`
    };
  }
}

const crawlApiConfig = resolveCrawl4aiApiUrl(process.env.CRAWL4AI_API_URL);
const CRAWL4AI_API_URL = crawlApiConfig.url;
if (crawlApiConfig.warning) {
  console.warn('Crawl4ai API config warning:', crawlApiConfig.warning);
}

function buildCrawlApiCandidates(primaryUrl: string): string[] {
  const candidates = new Set<string>();
  const normalizedPrimary = String(primaryUrl || '').trim();

  const addCandidate = (value: string) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;
    candidates.add(trimmed.replace(/\/+$/, ''));
  };

  if (normalizedPrimary) {
    addCandidate(normalizedPrimary);

    if (/\/v1\/crawl\/?$/i.test(normalizedPrimary)) {
      addCandidate(normalizedPrimary.replace(/\/v1\/crawl\/?$/i, '/crawl'));
    } else if (/\/crawl\/?$/i.test(normalizedPrimary)) {
      addCandidate(normalizedPrimary.replace(/\/crawl\/?$/i, '/v1/crawl'));
    } else {
      addCandidate(`${normalizedPrimary}/crawl`);
      addCandidate(`${normalizedPrimary}/v1/crawl`);
    }
  }

  addCandidate(DEFAULT_CRAWL4AI_API_URL);

  return Array.from(candidates).filter(Boolean);
}

function buildTokenApiCandidates(primaryUrl: string): string[] {
  const candidates = new Set<string>();
  const crawlCandidates = buildCrawlApiCandidates(primaryUrl);

  const addCandidate = (value: string) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;
    candidates.add(trimmed.replace(/\/+$/, ''));
  };

  addCandidate(CRAWL4AI_AUTH_TOKEN_URL);

  for (const crawlCandidate of crawlCandidates) {
    try {
      const parsed = new URL(crawlCandidate);
      parsed.pathname = '/token';
      parsed.search = '';
      parsed.hash = '';
      addCandidate(parsed.toString());
    } catch {
      // Ignore malformed candidate and continue.
    }
  }

  return Array.from(candidates).filter(Boolean);
}

function shouldUseJwtAuth(): boolean {
  if (CRAWL4AI_AUTH_MODE === 'jwt') return true;
  if (CRAWL4AI_AUTH_MODE === 'api-key') return false;
  return Boolean(CRAWL4AI_AUTH_EMAIL);
}

function shouldUseApiKeyAuth(): boolean {
  if (CRAWL4AI_AUTH_MODE === 'jwt') return false;
  return Boolean(process.env.CRAWL4AI_API_KEY);
}

function decodeJwtExpirationMs(token: string): number | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;

    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const payloadJson = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const exp = Number(payload?.exp);

    if (!Number.isFinite(exp) || exp <= 0) return null;
    return exp * 1000;
  } catch {
    return null;
  }
}

async function resolveJwtAuthorizationHeader(): Promise<{ authorizationHeader?: string; warning?: string }> {
  if (!shouldUseJwtAuth()) {
    return {};
  }

  if (!CRAWL4AI_AUTH_EMAIL) {
    const warning = 'Crawl4AI JWT auth is enabled but CRAWL4AI_AUTH_EMAIL is missing.';
    if (CRAWL4AI_AUTH_STRICT) {
      throw new Error(warning);
    }
    return { warning };
  }

  if (
    crawl4aiJwtCache
    && crawl4aiJwtCache.email === CRAWL4AI_AUTH_EMAIL
    && (crawl4aiJwtCache.expiresAtMs - JWT_REFRESH_BUFFER_MS) > Date.now()
  ) {
    return { authorizationHeader: `Bearer ${crawl4aiJwtCache.accessToken}` };
  }

  const tokenApiCandidates = buildTokenApiCandidates(CRAWL4AI_API_URL);
  let lastTokenError: any = null;

  for (const tokenUrl of tokenApiCandidates) {
    try {
      const tokenResponse = await axios.post(
        tokenUrl,
        { email: CRAWL4AI_AUTH_EMAIL },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': CRAWL4AI_PROXY_USER_AGENT
          }
        }
      );

      const accessToken = String(tokenResponse?.data?.access_token || '').trim();
      if (!accessToken) {
        throw new Error('Crawl4AI token endpoint returned no access_token.');
      }

      const expiresAtMs = decodeJwtExpirationMs(accessToken) || (Date.now() + FALLBACK_TOKEN_TTL_MS);
      crawl4aiJwtCache = {
        accessToken,
        expiresAtMs,
        email: CRAWL4AI_AUTH_EMAIL,
        tokenUrl
      };

      return { authorizationHeader: `Bearer ${accessToken}` };
    } catch (tokenError: any) {
      lastTokenError = tokenError;
    }
  }

  const details = lastTokenError?.response?.data
    ? JSON.stringify(lastTokenError.response.data)
    : (lastTokenError?.message || 'Unknown error');
  const warning = `Unable to fetch Crawl4AI JWT token (${details}).`;

  if (CRAWL4AI_AUTH_STRICT) {
    throw new Error(warning);
  }

  return { warning };
}

interface Crawl4aiRequest {
  url: string;
  actionType?: 'crawl' | 'extract' | 'pdf';
  includeLinks?: boolean;
  includeImages?: boolean;
  ignoreCookieConsent?: boolean;
  maxDepth?: number;
}

function normalizeHostFromUrl(value?: string): string {
  if (!value) return '';
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return String(value || '').replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();
  }
}

function isLikelyVercelRuntime(): boolean {
  const vercelFlag = String(process.env.VERCEL || '').trim();
  const vercelEnv = String(process.env.VERCEL_ENV || '').trim();
  const vercelUrl = String(process.env.VERCEL_URL || '').trim();
  return vercelFlag === '1' || Boolean(vercelEnv || vercelUrl);
}

function isLoopbackLikeHost(hostname: string): boolean {
  const normalized = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === '0.0.0.0'
    || normalized.endsWith('.localhost')
  );
}

type Crawl4aiConfigIssue = {
  envKey: 'CRAWL4AI_API_URL' | 'CRAWL4AI_AUTH_TOKEN_URL';
  value: string;
};

function detectUnreachableCrawl4aiConfig(): Crawl4aiConfigIssue | null {
  if (!isLikelyVercelRuntime()) {
    return null;
  }

  const checks: Crawl4aiConfigIssue[] = [
    { envKey: 'CRAWL4AI_API_URL' as const, value: CRAWL4AI_API_URL },
    { envKey: 'CRAWL4AI_AUTH_TOKEN_URL' as const, value: CRAWL4AI_AUTH_TOKEN_URL }
  ].filter((entry) => Boolean(String(entry.value || '').trim()));

  for (const check of checks) {
    try {
      const parsed = new URL(check.value);
      if (isLoopbackLikeHost(parsed.hostname)) {
        return check;
      }
    } catch {
      // Ignore malformed URL here; input validation happens in existing flow.
    }
  }

  return null;
}

function isTrustedFrontendRequest(req: VercelRequest): boolean {
  const origin = String(req.headers.origin || '').trim();
  const referer = String(req.headers.referer || '').trim();
  const host = String(req.headers.host || '').trim().toLowerCase();

  const configuredFrontend = String(process.env.FRONTEND_URL || '').trim();
  const vercelUrl = String(process.env.VERCEL_URL || '').trim();

  const trustedHosts = new Set<string>([
    normalizeHostFromUrl(configuredFrontend),
    normalizeHostFromUrl(vercelUrl ? `https://${vercelUrl}` : ''),
    host
  ].filter(Boolean));

  const originHost = normalizeHostFromUrl(origin);
  const refererHost = normalizeHostFromUrl(referer);

  return Boolean((originHost && trustedHosts.has(originHost)) || (refererHost && trustedHosts.has(refererHost)));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  const crawlConfigIssue = detectUnreachableCrawl4aiConfig();
  if (crawlConfigIssue) {
    return res.status(503).json({
      success: false,
      content: '',
      metadata: {},
      error: 'Crawl4ai runtime configuration unreachable',
      code: 'CRAWL4AI_CONFIG_UNREACHABLE',
      message: `${crawlConfigIssue.envKey} points to ${crawlConfigIssue.value}. In Vercel runtime this resolves inside the serverless container and cannot reach your local Docker host. Use a network-reachable Crawl4AI URL and redeploy.`,
      fallback: true
    });
  }

  try {
    await requireApiAuth(req);
  } catch (authErr: any) {
    if (!isTrustedFrontendRequest(req)) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized' });
    }
    console.warn('Crawl4ai auth fallback activated for trusted frontend request:', {
      message: authErr?.message,
      origin: req.headers.origin,
      referer: req.headers.referer,
      host: req.headers.host
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { 
      url, 
      actionType = 'crawl',
      includeLinks = true,
      includeImages = false,
      ignoreCookieConsent = true,
      maxDepth = 1
    } = body as Crawl4aiRequest;

    // Validate URL
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Only http/https URLs are allowed' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const allowedActionTypes = new Set(['crawl', 'extract', 'pdf']);
    if (!allowedActionTypes.has(actionType)) {
      return res.status(400).json({ error: 'Invalid actionType. Use crawl, extract, or pdf.' });
    }

    const crawlHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': CRAWL4AI_PROXY_USER_AGENT
    };

    if (shouldUseApiKeyAuth() && process.env.CRAWL4AI_API_KEY) {
      crawlHeaders['X-API-Key'] = process.env.CRAWL4AI_API_KEY;
    }

    const jwtAuth = await resolveJwtAuthorizationHeader();
    if (jwtAuth.warning) {
      console.warn('Crawl4AI auth warning:', jwtAuth.warning);
    }
    if (jwtAuth.authorizationHeader) {
      crawlHeaders.Authorization = jwtAuth.authorizationHeader;
    }

    const legacyCrawlPayload = {
      url,
      action_type: actionType,
      include_links: includeLinks,
      include_images: includeImages,
      ignore_cookie_consent: ignoreCookieConsent,
      max_depth: maxDepth,
      word_count_threshold: 10,
      remove_overlay: true,
      cache_strategy: 'write',
    };

    // Self-hosted Docker API expects urls[] on /crawl.
    const selfHostedCrawlPayload = {
      urls: [url]
    };

    // Call Crawl4ai API from backend (secure, no API key exposed to frontend)
    // and auto-retry across endpoint/payload variants for cloud + self-host.
    const crawlApiCandidates = buildCrawlApiCandidates(CRAWL4AI_API_URL);
    let crawlResponse: any;
    let lastCandidateError: any;

    for (const endpoint of crawlApiCandidates) {
      const isLikelySelfHosted = !/api\.crawl4ai\.com/i.test(endpoint);
      const payloadCandidates = isLikelySelfHosted
        ? [selfHostedCrawlPayload, legacyCrawlPayload]
        : [legacyCrawlPayload, selfHostedCrawlPayload];

      for (const payload of payloadCandidates) {
        try {
          crawlResponse = await axios.post(endpoint, payload, {
            timeout: 30000,
            headers: crawlHeaders
          });
          break;
        } catch (candidateError: any) {
          lastCandidateError = candidateError;
          const candidateStatus = candidateError?.response?.status;

          if (candidateStatus === 401 && shouldUseJwtAuth()) {
            try {
              // Refresh token once on unauthorized and retry current endpoint/payload.
              crawl4aiJwtCache = null;
              const refreshedJwtAuth = await resolveJwtAuthorizationHeader();
              if (refreshedJwtAuth.authorizationHeader) {
                crawlHeaders.Authorization = refreshedJwtAuth.authorizationHeader;
                crawlResponse = await axios.post(endpoint, payload, {
                  timeout: 30000,
                  headers: crawlHeaders
                });
                break;
              }
            } catch (refreshError: any) {
              lastCandidateError = refreshError;
            }
          }

          // Path mismatch - try next endpoint candidate.
          if (candidateStatus === 404 || candidateStatus === 405) {
            break;
          }

          // Payload schema mismatch - try next payload shape on same endpoint.
          if (candidateStatus === 422) {
            continue;
          }

          throw candidateError;
        }
      }

      if (crawlResponse) break;
    }

    if (!crawlResponse) {
      throw lastCandidateError || new Error('Crawl4ai request failed for all candidate endpoints');
    }

    // Extract useful content from response
    const responseData = crawlResponse.data || {};
    const firstResult = Array.isArray(responseData.results) ? responseData.results[0] : undefined;

    const normalizedContent = responseData.markdown_content
      || responseData.content
      || firstResult?.markdown?.raw_markdown
      || firstResult?.cleaned_html
      || firstResult?.fit_html
      || firstResult?.html
      || '';

    const content = typeof normalizedContent === 'string'
      ? normalizedContent
      : JSON.stringify(normalizedContent);

    const resultLinks = firstResult?.links
      ? [
          ...(Array.isArray(firstResult.links.internal) ? firstResult.links.internal : []),
          ...(Array.isArray(firstResult.links.external) ? firstResult.links.external : [])
        ]
      : [];

    const links = Array.isArray(responseData.links) ? responseData.links : resultLinks;
    const images = Array.isArray(responseData.images)
      ? responseData.images
      : (Array.isArray(firstResult?.media?.images) ? firstResult.media.images : []);

    const metadata = {
      title: responseData.title || firstResult?.metadata?.title || '',
      description: responseData.description || firstResult?.metadata?.description || '',
      language: responseData.language_code || responseData.language || 'unknown',
      crawlTime: responseData.run_time || 0
    };

    return res.status(200).json({
      success: true,
      content: content.substring(0, 5000), // Cap at 5000 chars to avoid token bloat
      metadata,
      links: links.slice(0, 10), // Return top 10 links
      images: images.slice(0, 5), // Return top 5 images
      url,
      actionType
    });

  } catch (error: any) {
    const upstreamStatus = error?.response?.status;
    const upstreamData = error?.response?.data;
    const upstreamCode = String(error?.code || '').trim();
    const upstreamMessage = typeof upstreamData?.error === 'string'
      ? upstreamData.error
      : (typeof upstreamData?.message === 'string' ? upstreamData.message : error.message);

    console.error('Crawl4ai API Handler Error:', {
      message: error?.message,
      upstreamStatus,
      upstreamData
    });

    if (upstreamStatus) {
      const normalizedStatus = [400, 401, 403, 404, 408, 409, 422, 429, 500, 502, 503, 504].includes(upstreamStatus)
        ? upstreamStatus
        : 502;

      return res.status(normalizedStatus).json({
        success: false,
        content: '',
        metadata: {},
        error: 'Crawl4ai request failed',
        message: upstreamMessage || 'Crawl4ai returned an error',
        upstreamStatus,
        fallback: true
      });
    }

    // Return graceful error response
    return res.status(503).json({
      success: false,
      content: '',
      metadata: {},
      error: 'Web crawling service temporarily unavailable',
      message: upstreamMessage || 'Failed to crawl the requested URL. Please try again or check the URL.',
      upstreamCode: upstreamCode || undefined,
      fallback: true
    });
  }
}
