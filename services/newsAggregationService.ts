import { getNewsSourcesByCountry, getAPINewsSources, getRSSNewsSources } from '../config/newsSources';
import { supabaseClient } from './supabaseClient';

export interface NewsArticle {
  id: string;
  source: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  country: string;
  category: string;
  reliability: number;
  language: string;
  content?: string;
}

export interface NewsAggregationResult {
  articles: NewsArticle[];
  source: string;
  fetchedAt: Date;
  status: 'success' | 'error' | 'partial';
  error?: string;
}

export interface RSSFeedItem {
  title: string;
  description?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  guid?: string;
  enclosure?: {
    url?: string;
  };
}

interface ParsedRSSFeed {
  items: RSSFeedItem[];
  title?: string;
}

class NewsAggregationService {
  /**
   * Parse RSS feed from URL
   * For production, use a library like xml2js or rss-parser
   */
  async parseRSSFeed(
    feedUrl: string,
    limit: number = 10
  ): Promise<ParsedRSSFeed> {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'CCE/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
      }

      const xml = await response.text();

      // Parse XML - for production, use xml2js or rss-parser library
      // This is a simple regex-based parser for demo purposes
      const items: RSSFeedItem[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;

      let match;
      let count = 0;

      while ((match = itemRegex.exec(xml)) !== null && count < limit) {
        const itemXml = match[1];

        const titleMatch = itemXml.match(/<title[^>]*>([^<]*)<\/title>/);
        const descMatch = itemXml.match(/<description[^>]*>([^<]*)<\/description>/);
        const linkMatch = itemXml.match(/<link[^>]*>([^<]*)<\/link>/);
        const pubDateMatch = itemXml.match(/<pubDate[^>]*>([^<]*)<\/pubDate>/);
        const guidMatch = itemXml.match(/<guid[^>]*>([^<]*)<\/guid>/);

        items.push({
          title: titleMatch?.[1]?.trim() || 'Untitled',
          description: descMatch?.[1]?.trim(),
          link: linkMatch?.[1]?.trim(),
          pubDate: pubDateMatch?.[1]?.trim(),
          guid: guidMatch?.[1]?.trim()
        });

        count++;
      }

      return { items };
    } catch (error) {
      console.error('Error parsing RSS feed:', error);
      return { items: [] };
    }
  }

  /**
   * Fetch articles from a single RSS source
   */
  async fetchFromRSSSource(
    sourceId: string,
    url: string,
    domain: string,
    country: string,
    category: string,
    reliability: number,
    language: string,
    limit: number = 10
  ): Promise<NewsArticle[]> {
    try {
      const feed = await this.parseRSSFeed(url, limit);

      return feed.items
        .filter(item => item.title && item.link)
        .map((item, index) => ({
          id: `${sourceId}-${Date.now()}-${index}`,
          source: domain,
          title: item.title,
          description: item.description || '',
          url: item.link || '',
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          country,
          category,
          reliability,
          language,
          content: item.description
        }));
    } catch (error) {
      console.error(`Error fetching from RSS source ${domain}:`, error);
      return [];
    }
  }

  /**
   * Fetch articles from MyNewsDesk API (Swedish press release service)
   */
  async fetchFromMyNewsDeskAPI(
    apiKey: string | undefined,
    country: string,
    limit: number = 20
  ): Promise<NewsArticle[]> {
    if (!apiKey) {
      console.warn('MyNewsDesk API key not provided');
      return [];
    }

    try {
      const response = await fetch(
        `https://api.mynewsdesk.com/v2/press_releases?` +
        `feed_id=${apiKey}&` +
        `lang=${this.getMyNewsDeskLanguageCode(country)}&` +
        `limit=${limit}`,
        {
          headers: {
            'User-Agent': 'CCE/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`MyNewsDesk API error: ${response.statusText}`);
      }

      const data = await response.json();

      return (data.press_releases || []).map((pr: any) => ({
        id: `mynewsdesk-${pr.id}`,
        source: 'MyNewsDesk',
        title: pr.headline || pr.title || 'Untitled',
        description: pr.summary || pr.excerpt || '',
        url: pr.url || `https://mynewsdesk.com/press_release/${pr.id}`,
        publishedAt: pr.published_at ? new Date(pr.published_at).toISOString() : new Date().toISOString(),
        country,
        category: 'business',
        reliability: 92,
        language: this.getISOLanguageCode(country),
        content: pr.body || pr.summary || ''
      }));
    } catch (error) {
      console.error('Error fetching from MyNewsDesk API:', error);
      return [];
    }
  }

  /**
   * Get articles for a specific country by aggregating all sources
   */
  async getArticlesByCountry(
    countryCode: string,
    includeRSS: boolean = true,
    includeAPI: boolean = true,
    limit: number = 30
  ): Promise<NewsAggregationResult> {
    const newsSources = getNewsSourcesByCountry(countryCode);
    const articles: NewsArticle[] = [];
    const errors: string[] = [];

    // Fetch from RSS sources
    if (includeRSS && newsSources.length > 0) {
      const rssSources = newsSources.filter(s => s.feedType === 'rss' && s.feedUrl);

      const rssPromises = rssSources.map(source =>
        this.fetchFromRSSSource(
          source.id,
          source.feedUrl!,
          source.domain,
          countryCode,
          source.category,
          source.reliability,
          source.language,
          Math.ceil(limit / rssSources.length)
        )
      );

      const rssResults = await Promise.allSettled(rssPromises);
      rssResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          articles.push(...result.value);
        } else {
          errors.push(`RSS source ${index}: ${result.reason}`);
        }
      });
    }

    // Fetch from API sources
    if (includeAPI) {
      try {
        const apiSources = newsSources.filter(s => s.feedType === 'api');

        // MyNewsDesk is a common regional API
        const myNewsDeskAPI = process.env.REACT_APP_MYNEWSDESK_API_KEY;
        if (myNewsDeskAPI && apiSources.some(s => s.name.includes('MyNewsDesk'))) {
          const apiArticles = await this.fetchFromMyNewsDeskAPI(
            myNewsDeskAPI,
            countryCode,
            Math.ceil(limit / 2)
          );
          articles.push(...apiArticles);
        }
      } catch (error) {
        errors.push(`API fetch error: ${error}`);
      }
    }

    // Sort by publish date (newest first) and limit
    const sortedArticles = articles
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, limit);

    // Deduplicate by title similarity
    const uniqueArticles = this.deduplicateArticles(sortedArticles);

    return {
      articles: uniqueArticles,
      source: `News sources for ${countryCode}`,
      fetchedAt: new Date(),
      status: errors.length === 0 ? 'success' : errors.length < newsSources.length ? 'partial' : 'error',
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  }

  /**
   * Deduplicate articles by title similarity
   */
  private deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>();
    const result: NewsArticle[] = [];

    for (const article of articles) {
      // Normalize title for comparison
      const normalized = article.title.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Only keep if we haven't seen this title before
      let isDuplicate = false;
      for (const seenTitle of seen) {
        // Simple similarity check - if 80% of characters match, consider duplicate
        if (this.calculateSimilarity(normalized, seenTitle) > 0.8) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seen.add(normalized);
        result.push(article);
      }
    }

    return result;
  }

  /**
   * Calculate similarity between two strings (simple implementation)
   */
  private calculateSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    if (longer.length === 0) return 1.0;

    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Get edit distance between two strings
   */
  private getEditDistance(a: string, b: string): number {
    const costs: number[] = [];

    for (let j = 0; j <= b.length; j++) {
      let lastValue = j;
      for (let i = 1; i <= a.length; i++) {
        let newValue = costs[j] ?? (lastValue + (a.charCodeAt(i - 1) !== b.charCodeAt(j - 1) ? 1 : 0));
        costs[j] = Math.min(lastValue + 1, newValue + 1, (costs[j - 1] ?? lastValue) + 1);
        lastValue = newValue;
      }
    }

    return costs[b.length] ?? 0;
  }

  /**
   * Save articles to Supabase for persistence and searching
   */
  async saveArticlesToDatabase(articles: NewsArticle[], countryCode: string) {
    try {
      const { error } = await supabaseClient
        .from('news_articles')
        .insert(
          articles.map(article => ({
            id: article.id,
            source: article.source,
            country: countryCode,
            title: article.title,
            description: article.description,
            url: article.url,
            publishedAt: article.publishedAt,
            category: article.category,
            reliability: article.reliability,
            language: article.language,
            createdAt: new Date().toISOString()
          }))
        )
        .on('conflict', 'id', { ignoreDuplicates: true });

      if (error) {
        console.error('Error saving articles to database:', error);
      }
    } catch (error) {
      console.error('Error saving articles:', error);
    }
  }

  /**
   * Get recent articles from database for display
   */
  async getRecentArticlesFromDatabase(
    countryCode: string,
    hoursBack: number = 24,
    limit: number = 20
  ): Promise<NewsArticle[]> {
    try {
      const sinceDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabaseClient
        .from('news_articles')
        .select('*')
        .eq('country', countryCode)
        .gte('publishedAt', sinceDate)
        .order('publishedAt', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching articles from database:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching articles:', error);
      return [];
    }
  }

  /**
   * Search articles by keyword
   */
  async searchArticles(
    countryCode: string,
    keyword: string,
    limit: number = 20
  ): Promise<NewsArticle[]> {
    try {
      const { data, error } = await supabaseClient
        .from('news_articles')
        .select('*')
        .eq('country', countryCode)
        .or(
          `title.ilike.%${keyword}%,` +
          `description.ilike.%${keyword}%`
        )
        .order('publishedAt', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error searching articles:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error searching articles:', error);
      return [];
    }
  }

  /**
   * Convert country code to MyNewsDesk language code
   */
  private getMyNewsDeskLanguageCode(countryCode: string): string {
    const mapping: Record<string, string> = {
      SE: 'sv',
      DK: 'da',
      NO: 'no',
      FI: 'fi',
      DE: 'de',
      FR: 'fr',
      NL: 'nl',
      GB: 'en',
      BE: 'nl',
      AT: 'de',
      CH: 'de',
      US: 'en'
    };
    return mapping[countryCode] || 'en';
  }

  /**
   * Convert country code to ISO language code
   */
  private getISOLanguageCode(countryCode: string): string {
    const mapping: Record<string, string> = {
      SE: 'sv',
      DK: 'da',
      NO: 'nb',
      FI: 'fi',
      DE: 'de',
      FR: 'fr',
      NL: 'nl',
      GB: 'en',
      BE: 'nl',
      AT: 'de',
      CH: 'de',
      US: 'en'
    };
    return mapping[countryCode] || 'en';
  }
}

export const newsAggregationService = new NewsAggregationService();
export default newsAggregationService;
