/**
 * VERCEL FUNCTION - Crawl4ai Web Scraping Handler
 * Secure backend endpoint for complex site scraping
 * Used as fallback when Tavily can't handle JavaScript-heavy sites or PDFs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const CRAWL4AI_API_URL = process.env.CRAWL4AI_API_URL || 'https://api.crawl4ai.com/crawl';

interface Crawl4aiRequest {
  url: string;
  actionType?: 'crawl' | 'extract' | 'pdf';
  includeLinks?: boolean;
  includeImages?: boolean;
  ignoreCookieConsent?: boolean;
  maxDepth?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
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
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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
      'User-Agent': 'CCE-Carrier-Conversion-Engine (+https://cce-carrier-conversion.vercel.app)'
    };

    if (process.env.CRAWL4AI_API_KEY) {
      crawlHeaders.Authorization = `Bearer ${process.env.CRAWL4AI_API_KEY}`;
    }

    // Call Crawl4ai API from backend (secure, no API key exposed to frontend)
    const crawlResponse = await axios.post(
      CRAWL4AI_API_URL,
      {
        url,
        action_type: actionType,
        include_links: includeLinks,
        include_images: includeImages,
        ignore_cookie_consent: ignoreCookieConsent,
        max_depth: maxDepth,
        word_count_threshold: 10,
        remove_overlay: true,
        cache_strategy: 'write',
      },
      {
        timeout: 30000,
        headers: crawlHeaders
      }
    );

    // Extract useful content from response
    const content = crawlResponse.data.markdown_content || crawlResponse.data.content || '';
    const links = crawlResponse.data.links || [];
    const images = crawlResponse.data.images || [];
    const metadata = {
      title: crawlResponse.data.title || '',
      description: crawlResponse.data.description || '',
      language: crawlResponse.data.language_code || 'unknown',
      crawlTime: crawlResponse.data.run_time || 0
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
    return res.status(500).json({
      success: false,
      content: '',
      metadata: {},
      error: 'Web crawling service temporarily unavailable',
      message: 'Failed to crawl the requested URL. Please try again or check the URL.',
      fallback: true
    });
  }
}
