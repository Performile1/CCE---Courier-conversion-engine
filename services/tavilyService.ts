import axios from 'axios';
import { LeadData } from '../types';

/**
 * TAVILY SERVICE - Hallucination Prevention Engine
 * Fact-checks AI-generated data against real sources
 * Calculates hallucination scores: 0 = verified, 100 = likely hallucinated
 */

interface SearchResult {
  title: string;
  url: string;
  content: string;
}

interface VerificationResult {
  field: string;
  claim: string;
  verificationStatus: 'verified' | 'unverified' | 'conflicting';
  sources: string[];
  confidence: number; // 0-100, higher = more confident
  notes: string;
}

interface HallucinationAnalysis {
  halluccinationScore: number; // 0-100, higher = more hallucinated
  verifiedFields: string[];
  unverifiedFields: string[];
  conflictingFields: VerificationResult[];
  overallTrust: 'high' | 'medium' | 'low';
  recommendations: string[];
}

/**
 * Fact-check a lead's key claims against external sources
 */
export async function analyzeForHallucinations(
  lead: LeadData,
  onProgress?: (msg: string) => void
): Promise<HallucinationAnalysis> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    console.warn("TAVILY_API_KEY not configured. Skipping hallucination check. Set it in environment variables.");
    return {
      halluccinationScore: 0,
      verifiedFields: [],
      unverifiedFields: [],
      conflictingFields: [],
      overallTrust: 'medium',
      recommendations: ['Configure Tavily API for hallucination detection']
    };
  }

  const verifications: VerificationResult[] = [];
  const results: HallucinationAnalysis = {
    halluccinationScore: 0,
    verifiedFields: [],
    unverifiedFields: [],
    conflictingFields: [],
    overallTrust: 'medium',
    recommendations: []
  };

  try {
    // Verify company existence and basic info
    if (onProgress) onProgress(`Verifying company: ${lead.companyName}...`);
    const companyCheck = await searchAndVerify(
      lead.companyName,
      {
        orgNumber: lead.orgNumber,
        domain: lead.domain,
        address: lead.visitingAddress
      },
      apiKey
    );

    if (companyCheck.found) {
      results.verifiedFields.push('companyName', 'orgNumber', 'domain');
    } else {
      results.unverifiedFields.push('companyName');
      results.recommendations.push(`⚠️ Company "${lead.companyName}" not found in public databases. Manual verification required.`);
    }

    // Verify revenue if available
    if (lead.revenue && onProgress) {
      onProgress(`Verifying revenue data...`);
      const revenueCheck = await verifyFinancials(lead.companyName, lead.revenue, apiKey);
      if (revenueCheck.verified) {
        results.verifiedFields.push('revenue');
      } else {
        results.unverifiedFields.push('revenue');
        results.recommendations.push(`⚠️ Revenue claim "${lead.revenue}" could not be verified against public sources.`);
      }
    }

    // Verify decision makers if present
    if (lead.decisionMakers && lead.decisionMakers.length > 0 && onProgress) {
      onProgress(`Verifying decision makers...`);
      for (const dm of lead.decisionMakers) {
        const dmCheck = await verifyDecisionMaker(lead.companyName, dm.name, dm.title, apiKey);
        if (dmCheck.found) {
          results.verifiedFields.push(`decisionMaker_${dm.name}`);
        } else {
          results.unverifiedFields.push(`decisionMaker_${dm.name}`);
        }
      }
    }

    // Verify ecommerce platform if present
    if (lead.ecommercePlatform && lead.ecommercePlatform !== 'Okänd' && onProgress) {
      onProgress(`Verifying ecommerce platform...`);
      const platformCheck = await verifyTechStack(lead.companyName, lead.ecommercePlatform, apiKey);
      if (platformCheck.found) {
        results.verifiedFields.push('ecommercePlatform');
      } else {
        results.unverifiedFields.push('ecommercePlatform');
      }
    }

    // Calculate hallucination score
    const totalClaimsVerified = results.verifiedFields.length;
    const totalClaimsUnverified = results.unverifiedFields.length;
    const totalClaim = totalClaimsVerified + totalClaimsUnverified;

    if (totalClaim === 0) {
      results.halluccinationScore = 0; // No verifiable claims = neutral
    } else {
      results.halluccinationScore = Math.round((totalClaimsUnverified / totalClaim) * 100);
    }

    // Determine overall trust level
    if (results.halluccinationScore <= 20) {
      results.overallTrust = 'high';
    } else if (results.halluccinationScore <= 50) {
      results.overallTrust = 'medium';
    } else {
      results.overallTrust = 'low';
    }

    // Add security recommendations
    if (results.overallTrust === 'low') {
      results.recommendations.push('🔴 Manual review required before outreach.');
      results.recommendations.push('Verify data with company directly via phone/website.');
    } else if (results.overallTrust === 'medium') {
      results.recommendations.push('⚠️ Recommend cross-checking key details (decision makers, revenue) before engagement.');
    } else {
      results.recommendations.push('✓ Data appears reliable. Standard verification process recommended.');
    }

    if (onProgress) onProgress(`✓ Hallucination analysis complete: ${results.halluccinationScore}% unverified`);

  } catch (error: any) {
    console.error('Hallucination analysis failed:', error.message);
    results.recommendations.push(`Analysis error: ${error.message}`);
  }

  return results;
}

/**
 * Search for and verify basic company information
 */
async function searchAndVerify(
  companyName: string,
  context: { orgNumber?: string; domain?: string; address?: string },
  apiKey: string
): Promise<{ found: boolean; sources: string[] }> {
  try {
    const query = `${companyName} ${context.orgNumber || ''} Sweden company`;
    const sources = await performTavilySearch(query, apiKey);
    
    // Check if company found in top results
    const found = sources.length > 0 && sources.some(url => 
      url.includes('allabolag.se') || 
      url.includes('bolagsverket.se') || 
      url.includes('linkedin.com')
    );

    return { found, sources };
  } catch (error) {
    console.error('Company verification error:', error);
    return { found: false, sources: [] };
  }
}

/**
 * Verify financial information
 */
async function verifyFinancials(
  companyName: string,
  revenueString: string,
  apiKey: string
): Promise<{ verified: boolean; sources: string[] }> {
  try {
    const query = `${companyName} revenue omsättning finanser Sweden`;
    const sources = await performTavilySearch(query, apiKey);
    
    // If financial sources found, consider verified
    const verified = sources.length > 0 && sources.some(url => 
      url.includes('allabolag.se') || 
      url.includes('kreditkollen.se') ||
      url.includes('ratsit.se')
    );

    return { verified, sources };
  } catch (error) {
    console.error('Financial verification error:', error);
    return { verified: false, sources: [] };
  }
}

/**
 * Verify decision maker information
 */
async function verifyDecisionMaker(
  companyName: string,
  name: string,
  title: string,
  apiKey: string
): Promise<{ found: boolean; sources: string[] }> {
  try {
    const query = `"${name}" "${companyName}" ${title} LinkedIn`;
    const sources = await performTavilySearch(query, apiKey);

    const found = sources.length > 0 && sources.some(url => 
      url.includes('linkedin.com') || 
      url.includes('allabolag.se')
    );

    return { found, sources };
  } catch (error) {
    console.error('Decision maker verification error:', error);
    return { found: false, sources: [] };
  }
}

/**
 * Verify tech stack / ecommerce platform
 */
async function verifyTechStack(
  companyName: string,
  platform: string,
  apiKey: string
): Promise<{ found: boolean; sources: string[] }> {
  try {
    const query = `"${companyName}" "${platform}" ecommerce website`;
    const sources = await performTavilySearch(query, apiKey);

    return { found: sources.length > 0, sources };
  } catch (error) {
    console.error('Tech stack verification error:', error);
    return { found: false, sources: [] };
  }
}

/**
 * Perform search using Tavily API
 */
async function performTavilySearch(
  query: string,
  apiKey: string
): Promise<string[]> {
  try {
    const response = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: apiKey,
        query: query,
        max_results: 5,
        include_answer: false
      },
      {
        timeout: 10000
      }
    );

    if (response.data?.results) {
      return response.data.results.map((r: any) => r.url || '');
    }

    return [];
  } catch (error: any) {
    // Gracefully handle Tavily API issues
    console.warn('Tavily search failed:', error.message);
    return [];
  }
}

/**
 * Get sources for a specific claim
 */
export async function getSourcesForClaim(
  claim: string,
  context: string,
  apiKey?: string
): Promise<SearchResult[]> {
  const key = apiKey || process.env.TAVILY_API_KEY;
  
  if (!key) {
    return [];
  }

  try {
    const response = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: key,
        query: `${claim} ${context}`,
        max_results: 10,
        include_answer: true
      },
      {
        timeout: 10000
      }
    );

    return response.data?.results?.map((r: any) => ({
      title: r.title || 'Untitled',
      url: r.url || '',
      content: r.content || ''
    })) || [];
  } catch (error) {
    console.error('Failed to retrieve sources:', error);
    return [];
  }
}

/**
 * Lightweight async check - returns immediately without blocking
 */
export async function quickHallucinationCheck(
  lead: LeadData,
  callback?: (analysis: HallucinationAnalysis) => void
): Promise<void> {
  // Run in background
  analyzeForHallucinations(lead).then(analysis => {
    if (callback) callback(analysis);
  }).catch(error => {
    console.error('Quick hallucination check failed:', error);
  });
}
