/**
 * VERCEL FUNCTION - Tavily API Handler
 * Secure backend endpoint for fact-checking
 * API keys hidden from frontend
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireApiAuth } from './_scheduledJobs';

// Support both VITE_ and non-VITE_ naming conventions
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;

interface TavilyRequest {
  query?: string;
  url?: string;
  action: 'search' | 'fetch' | 'verify-company' | 'verify-financials' | 'verify-decision-maker' | 'verify-tech-stack';
  context?: Record<string, any>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireApiAuth(req);
  } catch (authErr: any) {
    return res.status(401).json({ error: authErr.message || 'Unauthorized' });
  }

  try {
    if (!TAVILY_API_KEY) {
      return res.status(500).json({
        error: 'TAVILY_API_KEY not configured in Vercel environment variables'
      });
    }

    const { query, url, action, context } = req.body as TavilyRequest;
    const effectiveQuery = query || url;

    if (!effectiveQuery || !action) {
      return res.status(400).json({ error: 'Missing required fields: query, action' });
    }

    // Route to appropriate verification function
    switch (action) {
      case 'verify-company':
        return res.status(200).json(await verifyCompany(effectiveQuery, context));
      case 'verify-financials':
        return res.status(200).json(await verifyFinancials(effectiveQuery, context));
      case 'verify-decision-maker':
        return res.status(200).json(await verifyDecisionMaker(effectiveQuery, context));
      case 'verify-tech-stack':
        return res.status(200).json(await verifyTechStack(effectiveQuery, context));
      case 'fetch':
      case 'search':
      default:
        return await performSearch(effectiveQuery, res);
    }

  } catch (error: any) {
    console.error('Tavily API Handler Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function performSearch(query: string, res: VercelResponse) {
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: 10,
        include_answer: false
      })
    });

    if (!response.ok) {
      const upstream = await response.json().catch(() => ({}));
      const message = upstream?.error || upstream?.message || response.statusText;
      throw new Error(`Tavily API error: ${message}`);
    }

    const data = await response.json();
    return res.status(200).json({ results: data.results || [] });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

async function verifyCompany(companyName: string, context: any) {
  // Search for company across Swedish registries
  const searchResults = await performTavilySearch(
    `${companyName} allabolag.se OR bolagsverket.se OR linkedin.com`,
    5
  );

  const found = searchResults.some((url: string) =>
    url.includes('allabolag.se') ||
    url.includes('bolagsverket.se') ||
    url.includes('linkedin.com')
  );

  return { verified: found, sources: searchResults };
}

async function verifyFinancials(companyName: string, context: any) {
  const revenue = context?.revenue || '';
  const searchResults = await performTavilySearch(
    `${companyName} revenue omsättning finanser allabolag ratsit`,
    5
  );

  const verified = searchResults.some((url: string) =>
    url.includes('allabolag.se') ||
    url.includes('kreditkollen.se') ||
    url.includes('ratsit.se')
  );

  return { verified, sources: searchResults };
}

async function verifyDecisionMaker(name: string, context: any) {
  const companyName = context?.companyName || '';
  const searchResults = await performTavilySearch(
    `"${name}" "${companyName}" linkedin.com`,
    3
  );

  const found = searchResults.length > 0;
  return { found, sources: searchResults };
}

async function verifyTechStack(platform: string, context: any) {
  const companyName = context?.companyName || '';
  const searchResults = await performTavilySearch(
    `"${companyName}" "${platform}" ecommerce shopify`,
    3
  );

  return { found: searchResults.length > 0, sources: searchResults };
}

async function performTavilySearch(query: string, maxResults: number): Promise<string[]> {
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: maxResults,
        include_answer: false
      })
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results?.map((r: any) => r.url) || [];

  } catch (error) {
    console.error('Tavily search error:', error);
    return [];
  }
}
