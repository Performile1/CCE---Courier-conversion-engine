/**
 * International System Prompts for OpenRouter AI
 * Dynamically generates prompts based on country-specific requirements
 */

import { getCountryConfig } from './countries';
import { getRegistryDomains } from './sources';
import { getNewsDomains } from './newsSources';

export interface InternationalPromptConfig {
  country: string;
  company: string;
  language?: 'sv' | 'da' | 'no' | 'fi' | 'de' | 'fr' | 'nl' | 'en';
  includeNews?: boolean;
  includeFinancial?: boolean;
  halluccinationCheck?: boolean;
}

/**
 * Generate international system prompt based on country
 */
export function generateInternationalSystemPrompt(config: InternationalPromptConfig): string {
  const countryConfig = getCountryConfig(config.country);
  if (!countryConfig) {
    throw new Error(`Unknown country: ${config.country}`);
  }

  const registryDomains = getRegistryDomains(config.country);
  const newsDomains = getNewsDomains(config.country);
  const isBRIS = config.country === 'SE' || config.country === 'DK' || config.country === 'NO';

  const basePrompt = `You are an expert business research assistant specializing in ${countryConfig.name}.

=== SEARCH STRATEGY FOR ${countryConfig.name} ===

PRIORITY 1: OFFICIAL REGISTRY (${countryConfig.registryType})
- Primary source: ${countryConfig.registryDomain}
- When searching, prioritize official registry data from this domain
- Extract: Company name, registration number, legal structure, address, CEO/Directors
- Verify all data against official records

${
  isBRIS
    ? `
PRIORITY 2: EU-BRIS (Business Register Interconnection System)
- Domain: e-justice.europa.eu
- Use for cross-border verification within EU
- Useful for parent company information and international operations
`
    : ''
}

PRIORITY 3: TRUSTED BUSINESS & NEWS SOURCES
- Domains: ${newsDomains.slice(0, 5).join(', ')}
- Extract: Recent news, financial performance, leadership changes, company growth
- Verify facts across multiple sources

PRIORITY 4: GENERAL WEB SEARCH
- Only if specific data not found in priorities 1-3
- Filter results by country domain (.${config.country.toLowerCase()})
- Cross-verify with official sources

=== INFORMATION TO EXTRACT ===

Required Data:
1. Official Registration Information
   - Legal company name
   - Registration/Organization number
   - Legal form (AB, AS, Ltd, GmbH, etc.)
   - Registration date

2. Key Personnel
   - CEO/Founder names
   - Board members
   - Key executives

3. Financial Information
   - Annual revenue (último)
   - Number of employees
   - Company status (active/dormant/dissolved)
   - Industry/Sector

4. Contact Information
   - Registered address
   - Business address (if different)
   - Phone number
   - Email

${
  config.includeNews
    ? `
5. Recent News & Activity
   - Latest company announcements
   - Recent funding rounds
   - Partnerships or acquisitions
   - Industry recognition
`
    : ''
}

=== LANGUAGE & TRANSLATION ===

${
  countryConfig.language !== 'en'
    ? `- Source documents may be in ${countryConfig.language.toUpperCase()}
- Translate extracted data to English
- Preserve technical terms and legal definitions `
    : `- All sources are in English`
}

=== DATA VERIFICATION ===

For each data point:
1. Verify source reliability (official > news > web)
2. Check for conflicting information
3. Use most recent verified data
4. Report confidence level (High/Medium/Low)

If data conflicts between sources:
- Prioritize official registry data
- Note discrepancies found
- Recommend which source is most reliable

${
  config.halluccinationCheck
    ? `
=== HALLUCINATION DETECTION ===

CRITICAL: Avoid speculation and unverified claims

VERIFY BEFORE CLAIMING:
❌ DO NOT claim information without confirming the source
❌ DO NOT fabricate data points
❌ DO NOT make assumptions
✅ ONLY report data found in verified sources
✅ MARK any speculation with "Possible but unverified"
✅ Include source links for all major claims

Confidence Scoring:
- Official source (100%): Direct from registry
- News source (80-90%): From reputable business news
- Multiple sources agree (90-95%): Cross-verified
- Single non-official source (60-70%): Less reliable
- Speculation (0%): Not mentioned in any source
`
    : ''
}

=== OUTPUT FORMAT ===

Structure your response as:
{
  "company": "${config.company}",
  "country": "${config.country}",
  "registryVerified": true/false,
  "verificationDate": "YYYY-MM-DD",
  "data": {
    "official": { ... },
    "financial": { ... },
    "personnel": { ... },
    "news": { ... }
  },
  "confidence": "High/Medium/Low",
  "sources": ["source1", "source2", ...],
  "notes": "Any important findings or concerns"
}

=== SEARCH INSTRUCTIONS ===

For Tavily Search:
1. Filter domains: Include ${registryDomains.join(', ')}
2. Search language: ${countryConfig.language.toUpperCase()}
3. Include news domains: ${newsDomains.slice(0, 3).join(', ')}

For Manual Research:
1. Start at: ${countryConfig.registryUrl}
2. Search term: "${config.company}" + company type keywords
3. Cross-reference with: News sources listed above

=== FOLLOW-UP ACTIONS ===

After finding base information:
1. Search for additional executive information on LinkedIn
2. Check for recent press releases on ${newsDomains[0] || 'news sources'}
3. Verify financial data from latest annual reports
4. Look for industry certifications or recognition

=== IMPORTANT NOTES ===

- Always cite your sources
- Include URLs to verify information
- Report confidence levels for each data point
- Flag any incomplete or unavailable information
- Note if company appears to be defunct or inactive
- Report if company not found after thorough search
`;

  return basePrompt;
}

/**
 * Generate registry-focused search prompt
 */
export function generateRegistrySearchPrompt(
  company: string,
  country: string,
  language: string = 'en'
): string {
  const countryConfig = getCountryConfig(country);
  if (!countryConfig) throw new Error(`Unknown country: ${country}`);

  return `Search for "${company}" in ${countryConfig.name}'s official registry (${countryConfig.registryType}).

Primary search domain: ${countryConfig.registryDomain}
Official URL: ${countryConfig.registryUrl}

Find and extract:
1. Exact company name (as registered)
2. Registration number/ID
3. Legal form
4. Registered address
5. CEO/Founder
6. Registration status
7. Annual revenue (if public)
8. Employee count

If results are in ${countryConfig.language}, translate field names and key data to English.

Return data in structured JSON format with source verification.`;
}

/**
 * Generate news search prompt
 */
export function generateNewsSearchPrompt(
  company: string,
  country: string
): string {
  return `Find recent news and announcements about "${company}" in ${country}.

Search domains:
- Official company website
- Industry news sites
- Business publications
- LinkedIn company page
- Press release platforms

Extract:
1. Recent news items (last 12 months)
2. Acquisition or investment news
3. Leadership changes
4. Industry awards or recognition
5. Product/service launches
6. Partnership announcements

Include:
- Publication name
- Publication date
- Brief summary
- URL to full article

Format as JSON with news items array.`;
}

/**
 * Generate financial data search prompt
 */
export function generateFinancialSearchPrompt(
  company: string,
  country: string
): string {
  return `Find financial information about "${company}" in ${country}.

Search for:
1. Annual revenue (last 3 years if available)
2. Profit/loss information
3. Number of employees
4. Growth rate
5. Market position
6. Major customers or partners

Prioritize:
- Official financial reports
- Stock exchange announcements (if public)
- Industry databases
- Business registries

Format all financial data as JSON with:
- Year/period
- Amount
- Currency
- Data source
- Verification status`;
}

/**
 * Generate confidence score based on data points found
 */
export function calculateConfidenceScore(
  verifyPoints: {
    official: boolean;
    news: number; // 0-3 sources
    multiple: boolean;
    recent: boolean;
  }
): 'High' | 'Medium' | 'Low' {
  let score = 0;

  if (verifyPoints.official) score += 40;
  score += Math.min(verifyPoints.news * 10, 30);
  if (verifyPoints.multiple) score += 20;
  if (verifyPoints.recent) score += 10;

  if (score >= 80) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

/**
 * Generate combined search prompt for full company research
 */
export function generateFullCompanyResearchPrompt(
  company: string,
  country: string,
  includeNews: boolean = true,
  includeFinancial: boolean = true
): string {
  const basePrompt = generateInternationalSystemPrompt({
    country,
    company,
    includeNews,
    includeFinancial,
    halluccinationCheck: true
  });

  return basePrompt;
}

/**
 * Generate system message for API call
 */
export function generateSystemMessage(
  config: InternationalPromptConfig
): { role: 'system'; content: string } {
  return {
    role: 'system',
    content: generateInternationalSystemPrompt(config)
  };
}

/**
 * Generate user message for company research
 */
export function generateUserMessage(
  company: string,
  country: string,
  additionalContext?: string
): { role: 'user'; content: string } {
  const countryConfig = getCountryConfig(country);
  const registryDomains = getRegistryDomains(country);

  let message = `Research the company "${company}" in ${countryConfig?.name || country}.

Priority search domains:
${registryDomains.map((d, i) => `${i + 1}. ${d}`).join('\n')}

${additionalContext || ''}

Please provide:
1. Official registration details
2. Key personnel information
3. Financial overview
4. Recent news/announcements
5. Confidence assessment
6. Data sources used
7. Any concerns or missing data`;

  return {
    role: 'user',
    content: message
  };
}

/**
 * Validation: Check if country supports international search
 */
export function isCountrySupportedForSearch(countryCode: string): boolean {
  return !!getCountryConfig(countryCode);
}

/**
 * Get all supported countries for display
 */
export function getSupportedCountriesList(): Array<{ code: string; name: string }> {
  const countries = [
    'SE', 'DK', 'NO', 'FI', 'GB', 'DE', 'FR', 'NL', 'BE', 'AT', 'CH', 'US'
  ];

  return countries
    .map(code => {
      const config = getCountryConfig(code);
      return config ? { code, name: config.name } : null;
    })
    .filter((item): item is { code: string; name: string } => item !== null);
}
