# International Expansion Integration Guide

## Overview

This guide explains how to integrate the complete international expansion framework into your existing CCE application. All changes are **non-breaking** and can be implemented incrementally.

## 📋 Table of Contents

1. [Setup & Configuration](#setup--configuration)
2. [Database Integration](#database-integration)
3. [Component Integration](#component-integration)
4. [Service Integration](#service-integration)
5. [UI Integration Examples](#ui-integration-examples)
6. [Testing & Verification](#testing--verification)
7. [Deployment Checklist](#deployment-checklist)

---

## Setup & Configuration

### Step 1: Environment Variables

Add these to your `.env.local` and configure in Vercel:

```env
# Countries & Languages
REACT_APP_DEFAULT_COUNTRY=SE
REACT_APP_DEFAULT_LANGUAGE=sv
REACT_APP_ENABLE_INTERNATIONAL=true
REACT_APP_ENABLE_NEWS_INTEGRATION=true

# External APIs
REACT_APP_TAVILY_API_KEY=your_key_here
REACT_APP_OPENROUTER_API_KEY=your_key_here
REACT_APP_MYNEWSDESK_API_KEY=your_key_here

# Supabase (existing, needed for new tables)
REACT_APP_SUPABASE_URL=your_url_here
REACT_APP_SUPABASE_ANON_KEY=your_key_here

# Feature Flags
REACT_APP_HALLUCINATION_CHECK_ENABLED=true
```

### Step 2: Supabase Database Setup

1. Open Supabase SQL Editor
2. Copy the entire contents of `db/international_expansion_migrations.sql`
3. Run the SQL
4. Verify tables exist:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- countries
- official_sources
- news_sources
- news_articles
- search_history
- api_quota
- search_cache
- company_profiles
- news_mentions

---

## Database Integration

### Supabase Client Setup (Already Configured)

The `services/supabaseClient.ts` already has your connection. The new tables are automatically accessible:

```typescript
import { supabaseClient } from '@/services/supabaseClient';

// Query new tables
const { data: countries } = await supabaseClient
  .from('countries')
  .select('*');
```

### Initialization Script (Optional - Run Once)

```typescript
// Initialize international data (run once after migrations)
import { COUNTRIES } from '@/config/countries';
import { OFFICIAL_SOURCES } from '@/config/sources';
import { NEWS_SOURCES } from '@/config/newsSources';
import { supabaseClient } from '@/services/supabaseClient';

async function initializeInternationalData() {
  // Countries are already seeded in migrations
  console.log('✅ Countries already initialized');

  // Optionally seed official sources
  const { error: sourcesError } = await supabaseClient
    .from('official_sources')
    .insert(OFFICIAL_SOURCES.map(s => ({
      source_id: s.id,
      country_code: s.country,
      name: s.name,
      domain: s.domain,
      type: s.type,
      reliability_score: s.reliability,
      description: s.description,
      url: s.url,
      tags: s.tags
    })), { ignoreDuplicates: true });

  if (!sourcesError) console.log('✅ Official sources seeded');

  // Optionally seed news sources
  const { error: newsError } = await supabaseClient
    .from('news_sources')
    .insert(NEWS_SOURCES.map(s => ({
      news_source_id: s.id,
      country_code: s.country,
      name: s.name,
      domain: s.domain,
      category: s.category,
      feed_type: s.feedType,
      feed_url: s.feedUrl,
      api_endpoint: s.apiEndpoint,
      api_key_required: s.apiKeyRequired,
      language: s.language,
      update_frequency: s.updateFrequency,
      reliability_score: s.reliability,
      description: s.description,
      url: s.url
    })), { ignoreDuplicates: true });

  if (!newsError) console.log('✅ News sources seeded');
}

// Call once during app initialization
initializeInternationalData().catch(console.error);
```

---

## Component Integration

### 1. Add Country Selector to Header/Nav

```typescript
// components/Header.tsx or similar
import { CountrySelector } from '@/components/CountrySelector';
import { useState } from 'react';

export function Header() {
  const [selectedCountry, setSelectedCountry] = useState('SE');

  return (
    <header className="flex items-center justify-between">
      {/* Existing header content */}
      
      {/* Add country selector */}
      <CountrySelector
        selectedCountry={selectedCountry}
        onCountryChange={setSelectedCountry}
        showFlags={true}
      />
    </header>
  );
}
```

### 2. Add News Panel to Dashboard

```typescript
// pages/Dashboard.tsx or components/Dashboard.tsx
import { NewsPanel } from '@/components/NewsPanel';

export function Dashboard() {
  const [selectedCountry, setSelectedCountry] = useState('SE');

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Existing dashboard content */}
      
      {/* Add news panel as new section */}
      <div className="col-span-2">
        <NewsPanel
          countryCode={selectedCountry}
          onSourceSelect={(source) => {
            console.log('Selected source:', source);
          }}
        />
      </div>

      {/* Sidebar for other content */}
    </div>
  );
}
```

### 3. Add Sources List to Tools Section

```typescript
// pages/Tools.tsx or Tools/Sources.tsx
import { SourcesList } from '@/components/SourcesList';

export function ToolsPage() {
  const [selectedCountry, setSelectedCountry] = useState('SE');

  return (
    <div className="space-y-6">
      <h1>Tools & Resources</h1>

      {/* Add sources list section */}
      <section className="bg-white rounded-lg p-6">
        <SourcesList
          countryCode={selectedCountry}
          showReliabilityScore={true}
        />
      </section>
    </div>
  );
}
```

---

## Service Integration

### 1. Integrate with Existing Search Service

```typescript
// services/searchService.ts (EXISTING FILE - ADD THIS)
import { enhancedTavilyService } from './tavilyInternationalService';
import { enhancedOpenRouterService } from './openRouterInternationalService';
import { newsAggregationService } from './newsAggregationService';

// Enhance existing search with international support
export async function searchCompanyInternational(
  country: string,
  companyName: string,
  searchType: 'registry' | 'news' | 'financial' = 'registry'
) {
  // Use Tavily for structured search
  const searchResult = await enhancedTavilyService.searchInternational({
    country,
    companyName,
    searchType,
    focusOnRegistries: searchType === 'registry'
  });

  // Use OpenRouter for synthesis
  const synthesis = await enhancedOpenRouterService.queryInternational({
    country,
    company: companyName,
    query: `Summarize findings about ${companyName}`,
    searchResults: searchResult.results,
    includeHallucinationCheck: true
  });

  return {
    results: searchResult.results,
    synthesis: synthesis.response,
    confidence: synthesis.confidence,
    sources: searchResult.sources,
    executionTime: searchResult.executionTimeMs
  };
}
```

### 2. Add News Monitoring

```typescript
// services/searchService.ts (CONTINUED)
// Periodically fetch and save news
export async function aggregateCountryNews(country: string) {
  const newsResult = await newsAggregationService.getArticlesByCountry(
    country,
    true, // includeRSS
    true, // includeAPI
    50    // limit
  );

  if (newsResult.status === 'success' || newsResult.status === 'partial') {
    // Save to database
    await newsAggregationService.saveArticlesToDatabase(
      newsResult.articles,
      country
    );

    return newsResult;
  }

  return null;
}
```

### 3. Registry Verification

```typescript
// services/searchService.ts (CONTINUED)
export async function verifyCompanyRegistry(
  country: string,
  companyName: string,
  registrationNumber?: string
) {
  // Direct registry search
  const registryResults = await enhancedTavilyService.searchRegistry(
    country,
    companyName,
    registrationNumber
  );

  // Verify with LLM
  const verification = await enhancedOpenRouterService.registryLookup(
    country,
    companyName,
    registrationNumber
  );

  return {
    registryResults: registryResults.results,
    verification: verification.response,
    confidence: verification.confidence,
    verifiedSources: registryResults.verifiedSources
  };
}
```

---

## UI Integration Examples

### Example 1: International Company Search

```typescript
// components/InternationalCompanySearch.tsx
import React, { useState } from 'react';
import { CountrySelector } from './CountrySelector';
import { SourcesList } from './SourcesList';
import { NewsPanel } from './NewsPanel';
import { searchCompanyInternational } from '@/services/searchService';

export function InternationalCompanySearch() {
  const [country, setCountry] = useState('SE');
  const [company, setCompany] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const result = await searchCompanyInternational(country, company, 'registry');
      setResults(result);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="flex gap-4">
        <CountrySelector
          selectedCountry={country}
          onCountryChange={setCountry}
          showFlags={true}
        />
        <input
          type="text"
          placeholder="Company name..."
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="grid grid-cols-3 gap-6">
          {/* Search Results */}
          <div className="col-span-2 space-y-4">
            <h3 className="text-lg font-bold">Results</h3>
            {results.results.map((result, i) => (
              <div key={i} className="border rounded p-4">
                <h4 className="font-bold">{result.title}</h4>
                <p className="text-sm text-gray-600">{result.url}</p>
                <p className="text-sm mt-2">{result.content}</p>
                <div className="text-xs text-gray-500 mt-2">
                  Confidence: {results.confidence}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <SourcesList countryCode={country} />
            <NewsPanel countryCode={country} />
          </div>
        </div>
      )}
    </div>
  );
}
```

### Example 2: Dashboard with News Feed

```typescript
// components/DashboardWithNews.tsx
import React, { useState, useEffect } from 'react';
import { NewsPanel } from './NewsPanel';
import { CountrySelector } from './CountrySelector';
import { newsAggregationService } from '@/services/newsAggregationService';

export function DashboardWithNews() {
  const [country, setCountry] = useState('SE');
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        // Try database first (cached news)
        const dbNews = await newsAggregationService.getRecentArticlesFromDatabase(
          country,
          24,
          10
        );

        if (dbNews.length > 0) {
          setNews(dbNews);
        } else {
          // Fallback to aggregation
          const result = await newsAggregationService.getArticlesByCountry(country);
          if (result.status !== 'error') {
            setNews(result.articles.slice(0, 10));
            // Save to database
            await newsAggregationService.saveArticlesToDatabase(
              result.articles,
              country
            );
          }
        }
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [country]);

  return (
    <div className="space-y-6">
      <CountrySelector
        selectedCountry={country}
        onCountryChange={setCountry}
        showFlags={true}
      />

      <div className="grid grid-cols-3 gap-6">
        {/* News Feed */}
        <div className="col-span-2">
          <h2 className="text-2xl font-bold mb-4">News & Updates</h2>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : news.length > 0 ? (
            <div className="space-y-4">
              {news.map((article) => (
                <article key={article.id} className="border rounded-lg p-4 hover:shadow-lg">
                  <h3 className="font-bold text-lg mb-2">{article.title}</h3>
                  <p className="text-gray-600 mb-3">{article.description}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">{article.source}</span>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Read More →
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No news found</div>
          )}
        </div>

        {/* Sidebar */}
        <NewsPanel countryCode={country} />
      </div>
    </div>
  );
}
```

---

## Testing & Verification

### Manual Testing

```typescript
// pages/IntegrationTest.tsx - Create temporary test page
import React from 'react';
import { enhancedTavilyService } from '@/services/tavilyInternationalService';
import { enhancedOpenRouterService } from '@/services/openRouterInternationalService';
import { newsAggregationService } from '@/services/newsAggregationService';

export function IntegrationTest() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    const testResults = [];

    try {
      // Test 1: Tavily
      console.log('🧪 Testing Tavily...');
      const tavilyResult = await enhancedTavilyService.searchRegistry(
        'SE',
        'Apple'
      );
      testResults.push({
        test: 'Tavily Registry Search',
        success: (tavilyResult.results?.length || 0) > 0,
        details: `Found ${tavilyResult.results?.length || 0} results`
      });

      // Test 2: OpenRouter
      console.log('🧪 Testing OpenRouter...');
      const llmResult = await enhancedOpenRouterService.queryInternational({
        country: 'SE',
        company: 'Spotify',
        query: 'Is Spotify a Swedish company?'
      });
      testResults.push({
        test: 'OpenRouter Query',
        success: !!llmResult.response,
        details: `Response length: ${llmResult.response?.length || 0}`
      });

      // Test 3: News Aggregation
      console.log('🧪 Testing News Aggregation...');
      const newsResult = await newsAggregationService.getArticlesByCountry('SE');
      testResults.push({
        test: 'News Aggregation',
        success: (newsResult.articles?.length || 0) > 0,
        details: `Found ${newsResult.articles?.length || 0} articles`
      });

      setResults(testResults);
    } catch (error) {
      testResults.push({
        test: 'Error',
        success: false,
        details: String(error)
      });
      setResults(testResults);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <button
        onClick={runTests}
        disabled={loading}
        className="px-6 py-2 bg-green-600 text-white rounded"
      >
        {loading ? 'Testing...' : 'Run Tests'}
      </button>

      {results.map((r, i) => (
        <div
          key={i}
          className={`p-4 border rounded ${
            r.success ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
          }`}
        >
          <div className="font-bold">{r.test}</div>
          <div className="text-sm">{r.details}</div>
          <div className={r.success ? 'text-green-600' : 'text-red-600'}>
            {r.success ? '✅ PASS' : '❌ FAIL'}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set in Vercel
- [ ] Supabase migrations executed
- [ ] API keys verified and working
- [ ] Test page runs successfully
- [ ] No console errors in browser
- [ ] Type checking passes: `npm run type-check`
- [ ] Build succeeds: `npm run build`

### Deployment

1. **Push to develop branch**
   ```bash
   git add .
   git commit -m "feat: international expansion integration"
   git push origin develop
   ```

2. **GitHub Actions runs:**
   - Lint & Type Check
   - Build
   - Deploy to Vercel Dev
   - Run API verification tests

3. **Test in dev environment:**
   - Test country selection
   - Test news panel
   - Test sources list
   - Verify API calls

4. **Merge to main for production**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

5. **GitHub Actions runs:**
   - All checks
   - Deploy to Vercel Production
   - Create release tag

### Post-Deployment

- [ ] Monitor error logs
- [ ] Check API usage/quotas
- [ ] Verify search results accuracy
- [ ] Monitor database performance
- [ ] Track user interactions

---

## Troubleshooting

### Issue: "Unsupported country"

**Solution:** Ensure the country code matches the COUNTRIES config (SE, DK, NO, FI, GB, DE, FR, NL, BE, AT, CH, US)

### Issue: No search results

**Solution:** 
1. Verify Tavily API key is set
2. Check network tab for API calls
3. Ensure `include_domains` is correct

### Issue: News Panel empty

**Solution:**
1. Verify news sources are seeded in database
2. Check feed URLs are accessible
3. Look for CORS errors in console
4. Check MyNewsDesk API key if using

### Issue: Slow performance

**Solution:**
1. Enable search caching in localStorage
2. Implement pagination for large result sets
3. Consider debouncing search input
4. Monitor API rate limits

---

## Next Steps

1. ✅ Deploy to dev environment
2. ✅ Gather user feedback
3. ✅ Add country-specific UI customizations
4. ✅ Implement analytics tracking
5. ✅ Optimize for mobile
6. ✅ Scale to more countries as needed

---

## Support

For issues or questions:
- Check the INTERNATIONAL_EXPANSION_PLAN.md for comprehensive overview
- Review ENV_INTERNATIONAL_SETUP.md for environment setup
- Check component TypeScript interfaces for API details
- See individual service files for function documentation
