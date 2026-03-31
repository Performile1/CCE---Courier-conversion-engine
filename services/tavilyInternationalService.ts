import { getTavilyIncludeDomains, getSourcesByCountry } from '../config/sources';
import { getCountryConfig } from '../config/countries';
import { generateInternationalSystemPrompt, calculateConfidenceScore } from '../prompts/internationalSystemPrompt';

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
  source?: string;
}

export interface TavilyResponse {
  results: TavilySearchResult[];
  response_time: number;
  query: string;
}

export interface InternationalSearchOptions {
  country: string;
  companyName: string;
  searchType: 'registry' | 'news' | 'financial' | 'general';
  includeNews?: boolean;
  includeFinancial?: boolean;
  halluccinationCheck?: boolean;
  maxResults?: number;
  focusOnRegistries?: boolean;
}

export interface InternationalSearchResult {
  country: string;
  companyName: string;
  results: TavilySearchResult[];
  sources: string[];
  systemPrompt: string;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  verifiedSources: number;
  executionTimeMs: number;
  error?: string;
}

class EnhancedTavilyService {
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com';

  constructor(apiKey: string = process.env.REACT_APP_TAVILY_API_KEY || '') {
    this.apiKey = apiKey;
  }

  /**
   * Perform international search with country-specific registry prioritization
   */
  async searchInternational(
    options: InternationalSearchOptions
  ): Promise<InternationalSearchResult> {
    const startTime = Date.now();
    const defaults = {
      includeNews: true,
      includeFinancial: true,
      halluccinationCheck: true,
      maxResults: 20,
      focusOnRegistries: true,
      ...options
    };

    try {
      // Get country configuration
      const countryConfig = getCountryConfig(options.country);
      if (!countryConfig) {
        throw new Error(`Unsupported country: ${options.country}`);
      }

      // Generate country-specific system prompt
      const systemPrompt = generateInternationalSystemPrompt({
        country: options.country,
        company: options.companyName,
        language: countryConfig.language,
        includeNews: defaults.includeNews,
        includeFinancial: defaults.includeFinancial,
        halluccinationCheck: defaults.halluccinationCheck
      });

      // Get registry domains for this country
      const registryDomains = getTavilyIncludeDomains(options.country);
      const sources = getSourcesByCountry(options.country);

      // Build Tavily search query with registry focus
      const searchQuery = this.buildSearchQuery(
        options.companyName,
        options.country,
        defaults.focusOnRegistries
      );

      // Execute Tavily search with domain filtering
      const tavilyResults = await this.tavilySearch({
        query: searchQuery,
        include_domains: defaults.focusOnRegistries ? registryDomains : undefined,
        max_results: defaults.maxResults,
        search_depth: 'advanced',
        topic: 'business' // Focus on business results
      });

      // Verify results against known sources
      const verifiedSources = this.verifyResults(tavilyResults.results, sources);

      // Calculate confidence score
      const confidenceLevel = calculateConfidenceScore(verifiedSources);

      const executionTime = Date.now() - startTime;

      return {
        country: options.country,
        companyName: options.companyName,
        results: tavilyResults.results,
        sources: registryDomains,
        systemPrompt,
        confidenceLevel,
        verifiedSources: verifiedSources.length,
        executionTimeMs: executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        country: options.country,
        companyName: options.companyName,
        results: [],
        sources: [],
        systemPrompt: '',
        confidenceLevel: 'Low',
        verifiedSources: 0,
        executionTimeMs: executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Registry-specific search (official government data)
   */
  async searchRegistry(
    country: string,
    companyName: string,
    registrySpecificQuery?: string
  ): Promise<InternationalSearchResult> {
    const countryConfig = getCountryConfig(country);
    if (!countryConfig) {
      throw new Error(`Unsupported country: ${country}`);
    }

    const query = registrySpecificQuery ||
      `${companyName} site:${countryConfig.registryDomain}`;

    return this.searchInternational({
      country,
      companyName,
      searchType: 'registry',
      maxResults: 10,
      focusOnRegistries: true
    });
  }

  /**
   * News search for company mentions
   */
  async searchNews(
    country: string,
    companyName: string,
    keywords?: string[]
  ): Promise<InternationalSearchResult> {
    const query = keywords
      ? `${companyName} ${keywords.join(' OR ')}`
      : companyName;

    return this.searchInternational({
      country,
      companyName: query,
      searchType: 'news',
      maxResults: 20,
      focusOnRegistries: false,
      includeNews: true
    });
  }

  /**
   * Financial search for company financials
   */
  async searchFinancial(
    country: string,
    companyName: string
  ): Promise<InternationalSearchResult> {
    const query = `${companyName} financial OR revenue OR earnings OR annual report`;

    return this.searchInternational({
      country,
      companyName,
      searchType: 'financial',
      maxResults: 15,
      focusOnRegistries: false,
      includeFinancial: true
    });
  }

  /**
   * Direct Tavily API call
   */
  private async tavilySearch(params: any): Promise<TavilyResponse> {
    if (!this.apiKey) {
      throw new Error('Tavily API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          ...params
        })
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Tavily API call failed:', error);
      return {
        results: [],
        response_time: 0,
        query: params.query
      };
    }
  }

  /**
   * Build optimized search query for country and company
   */
  private buildSearchQuery(
    companyName: string,
    country: string,
    includeRegistry: boolean = true
  ): string {
    const countryConfig = getCountryConfig(country);
    if (!countryConfig) {
      return companyName;
    }

    const parts = [companyName];

    if (includeRegistry) {
      // Add registry-specific search terms
      switch (country) {
        case 'SE':
          parts.push('Bolagsverket OR Swedish Companies');
          break;
        case 'DK':
          parts.push('CVR OR Virk');
          break;
        case 'NO':
          parts.push('Brønnøysundregistrene OR BRR');
          break;
        case 'FI':
          parts.push('YTJ OR Patentti- ja rekisterihallinto');
          break;
        case 'DE':
          parts.push('Handelsregister OR HRB');
          break;
        case 'FR':
          parts.push('INFOGREFFE OR Registre du Commerce');
          break;
        case 'NL':
          parts.push('KVK OR Bedrijfsregister');
          break;
        // Add more country patterns as needed
      }
    }

    return `"${parts[0]}" ${parts.slice(1).join(' OR ')}`;
  }

  /**
   * Verify Tavily results against known sources
   */
  private verifyResults(
    results: TavilySearchResult[],
    sources: any[]
  ): TavilySearchResult[] {
    const sourceUrls = sources.map(s => s.domain.replace('www.', ''));

    return results.filter(result => {
      const resultDomain = new URL(result.url).hostname.replace('www.', '');
      return sourceUrls.some(source => resultDomain.includes(source) || source.includes(resultDomain));
    });
  }

  /**
   * Get registry-focused results sorted by source reliability
   */
  async getVerifiedRegistryResults(
    country: string,
    companyName: string
  ): Promise<TavilySearchResult[]> {
    const result = await this.searchRegistry(country, companyName);

    if (result.error) {
      console.error('Registry search error:', result.error);
      return [];
    }

    // Sort by verified sources first
    return result.results
      .sort((a, b) => {
        const aVerified = result.sources.some(s => a.url.includes(s)) ? 0 : 1;
        const bVerified = result.sources.some(s => b.url.includes(s)) ? 0 : 1;
        return aVerified - bVerified;
      });
  }

  /**
   * Get multi-country results for comparison
   */
  async searchMultipleCountries(
    companyName: string,
    countries: string[]
  ): Promise<Record<string, InternationalSearchResult>> {
    const results: Record<string, InternationalSearchResult> = {};

    const promises = countries.map(country =>
      this.searchInternational({
        country,
        companyName,
        searchType: 'registry',
        focusOnRegistries: true
      })
        .then(result => {
          results[country] = result;
        })
        .catch(error => {
          console.error(`Error searching ${country}:`, error);
          results[country] = {
            country,
            companyName,
            results: [],
            sources: [],
            systemPrompt: '',
            confidenceLevel: 'Low',
            verifiedSources: 0,
            executionTimeMs: 0,
            error: error.message
          };
        })
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Cache search results in local storage for UI use
   */
  async cacheSearchResults(
    key: string,
    results: InternationalSearchResult,
    ttlSeconds: number = 3600
  ): Promise<void> {
    try {
      const cacheEntry = {
        data: results,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000
      };

      localStorage.setItem(`tavily_search_${key}`, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn('Failed to cache search results:', error);
    }
  }

  /**
   * Get cached search results if available and not expired
   */
  async getCachedSearchResults(
    key: string
  ): Promise<InternationalSearchResult | null> {
    try {
      const cached = localStorage.getItem(`tavily_search_${key}`);
      if (!cached) return null;

      const cacheEntry = JSON.parse(cached);
      const now = Date.now();

      if (now - cacheEntry.timestamp > cacheEntry.ttl) {
        localStorage.removeItem(`tavily_search_${key}`);
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      console.warn('Failed to retrieve cached search results:', error);
      return null;
    }
  }
}

export const enhancedTavilyService = new EnhancedTavilyService();
export default enhancedTavilyService;
