# CCE International Expansion Plan

**Date:** March 31, 2026
**Objective:** Scale CCE to multiple countries with localized data sources and news integration

---

## Phase Overview

### Phase A: Infrastructure & Deployment Setup (Week 1)
- [ ] GitHub project creation
- [ ] Vercel deployment configuration
- [ ] Supabase database setup
- [ ] Environment variables documentation

### Phase B: Internationalization Framework (Week 1-2)
- [ ] Country-to-source mapping system
- [ ] Multi-language support
- [ ] Official registry integration
- [ ] Domain-focused search strategy

### Phase C: News Integration (Week 2-3)
- [ ] Local news source mapping
- [ ] News aggregation service
- [ ] Source-specific parsing
- [ ] Real-time updates

### Phase D: Testing & Optimization (Week 3-4)
- [ ] Multi-country testing
- [ ] Hallucination detection
- [ ] Performance optimization
- [ ] Launch readiness

---

## 1. Infrastructure Setup Plan

### 1.1 GitHub Project Structure

```
cce-international/
├── .github/
│   ├── workflows/
│   │   ├── deploy-prod.yml
│   │   ├── deploy-staging.yml
│   │   └── tests.yml
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── src/
│   ├── config/
│   │   ├── countries.ts
│   │   ├── sources.ts
│   │   ├── registries.ts
│   │   └── newsSources.ts
│   ├── services/
│   │   ├── registryService.ts
│   │   ├── newsService.ts
│   │   ├── tavilyService.ts (enhanced)
│   │   └── openrouterService.ts (enhanced)
│   ├── components/
│   │   ├── CountrySelector.tsx
│   │   ├── SourcesList.tsx
│   │   ├── NewsPanel.tsx
│   │   └── InternationalSearch.tsx
│   ├── types/
│   │   ├── country.ts
│   │   ├── registry.ts
│   │   ├── newsSource.ts
│   │   └── source.ts
│   └── prompts/
│       └── internationalSystemPrompt.ts
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_countries_table.sql
│   │   ├── 002_create_news_sources_table.sql
│   │   ├── 003_create_sources_table.sql
│   │   └── 004_create_search_history_table.sql
│   └── seed.sql
├── docs/
│   ├── INTERNATIONAL_SETUP.md
│   ├── ENV_VARIABLES.md
│   ├── COUNTRIES.md
│   └── NEWS_SOURCES.md
└── .env.example
```

### 1.2 GitHub Project Board

**Columns:**
- Backlog
- In Progress
- Code Review
- Testing
- Blocked
- Done

**Issues by Priority:**
1. Infrastructure setup (P0)
2. Country mapping (P0)
3. News integration (P1)
4. Testing framework (P1)

---

## 2. Vercel Deployment Plan

### 2.1 Environment Variables

```bash
# Core
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_KEY=your-service-key

# AI Services
VITE_OPENROUTER_API_KEY=your-openrouter-key
VITE_TAVILY_API_KEY=your-tavily-key
VITE_GEMINI_API_KEY=your-gemini-key

# Default Language & Country
VITE_DEFAULT_LANGUAGE=sv
VITE_DEFAULT_COUNTRY=SE

# News Sources API Keys (if needed)
VITE_MYNEWSDESK_API_KEY=optional
VITE_BREAKIT_API_KEY=optional
VITE_NEWSAPI_KEY=optional

# Feature Flags
VITE_ENABLE_INTERNATIONAL=true
VITE_ENABLE_NEWS_INTEGRATION=true
VITE_HALLUCINATION_CHECK_ENABLED=true

# Performance
VITE_CACHE_TTL=3600
VITE_MAX_SEARCH_RESULTS=50
```

### 2.2 Deployment Checklist

- [ ] Connect GitHub repository to Vercel
- [ ] Set up preview deployments
- [ ] Configure production domain
- [ ] Enable automatic deployments on main branch
- [ ] Set environment variables per environment (staging, prod)
- [ ] Configure build settings:
  - Build command: `npm run build`
  - Output directory: `dist`
  - Install command: `npm install`
- [ ] Enable Edge Functions (for server-side search optimization)
- [ ] Set up monitoring and error tracking

---

## 3. Supabase Database Setup Plan

### 3.1 Tables to Create

#### Countries Table
```sql
CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  language VARCHAR(5) DEFAULT 'en',
  region VARCHAR(50),
  registry_type VARCHAR(50),
  registry_url TEXT,
  registry_api_endpoint TEXT,
  timezone VARCHAR(50),
  currency VARCHAR(3),
  bris_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### News Sources Table
```sql
CREATE TABLE news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) REFERENCES countries(code),
  name VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  category VARCHAR(50),
  feed_type VARCHAR(20),
  feed_url TEXT,
  api_endpoint TEXT,
  api_key_required BOOLEAN DEFAULT false,
  language VARCHAR(5),
  reliability_score INT DEFAULT 100,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Sources Table
```sql
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) REFERENCES countries(code),
  name VARCHAR(100) NOT NULL,
  domain TEXT NOT NULL,
  source_type VARCHAR(50),
  reliability_score INT DEFAULT 100,
  description TEXT,
  tags TEXT[],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Search History Table
```sql
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  country_code VARCHAR(2),
  search_query TEXT NOT NULL,
  sources_used TEXT[],
  results_count INT,
  hallucination_detected BOOLEAN DEFAULT false,
  hallucination_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Indexes

```sql
CREATE INDEX idx_countries_code ON countries(code);
CREATE INDEX idx_news_sources_country ON news_sources(country_code);
CREATE INDEX idx_sources_country ON sources(country_code);
CREATE INDEX idx_search_history_user ON search_history(user_id);
CREATE INDEX idx_search_history_created ON search_history(created_at DESC);
```

### 3.3 Seed Data

Initial countries and news sources will be populated via `supabase/seed.sql`.

---

## 4. Internationalization Strategy

### 4.1 Country-Source Mapping

Each country has:
- Official company registry (mandatory)
- Trusted secondary sources (news, business)
- Language settings
- Regional configurations

### 4.2 Registry Prioritization

```
Priority 1: Official Government Registry
  └─ Include_domains: [official_registry_domain]
  
Priority 2: EU-BRIS (if EU country)
  └─ Include_domains: [e-justice.europa.eu]
  
Priority 3: Trusted Business Sources
  └─ Include_domains: [trusted_news_domains]
  
Priority 4: General Web Search
  └─ Filter by country domain (.se, .dk, .no, etc.)
```

### 4.3 AI Prompt Strategy

The system prompt will be dynamic based on country:

```
"You are searching for information about [COMPANY] in [COUNTRY].

Primary sources to consult (in order of preference):
1. Official registry: [REGISTRY_NAME] at [REGISTRY_DOMAIN]
2. Secondary sources: [TRUSTED_DOMAINS]
3. News sources: [NEWS_DOMAINS]

When searching:
- Prioritize official sources
- Verify data across multiple sources
- Translate local language content to [TARGET_LANGUAGE]
- Flag any contradictions between sources
- Report confidence level for each data point"
```

---

## 5. News Integration Strategy

### 5.1 Multi-Country News Sources

**Tier 1: Official & Verified**
- Government business updates
- Stock exchange announcements
- Official press releases

**Tier 2: Premium Business News**
- Industry-specific outlets (MyNewsDesk, Breakit, Dagens Logistik)
- Financial news (Yahoo Finance, Bloomberg)
- Business directories

**Tier 3: General News**
- Wikipedia business pages
- LinkedIn company pages
- Google News results

### 5.2 News Source Examples by Country

```typescript
// Sweden
SWEDEN: {
  news: [
    { name: 'Breakit', url: 'breakit.se', feed: 'rss', category: 'startup' },
    { name: 'Dagens Logistik', url: 'dagenslogistik.se', category: 'logistics' },
    { name: 'MyNewsDesk', url: 'mynewsdesk.com', api: true },
    { name: 'DI Digital', url: 'di.se', category: 'business' }
  ]
}

// Denmark
DENMARK: {
  news: [
    { name: 'Finans', url: 'finans.dk', category: 'finance' },
    { name: 'Business.dk', url: 'business.dk', category: 'business' }
  ]
}

// Norway
NORWAY: {
  news: [
    { name: 'E24', url: 'e24.no', category: 'business' },
    { name: 'Startupland', url: 'startupland.no', category: 'startup' }
  ]
}
```

### 5.3 News Parser Logic

```typescript
// Each news source type needs a parser
interface NewsParser {
  parseRSS(feed: string): NewsItem[];
  parseHTML(html: string): NewsItem[];
  parseAPI(response: any): NewsItem[];
}
```

---

## 6. Implementation Roadmap

### Week 1: Infrastructure
- [ ] Create GitHub repository
- [ ] Set up Vercel project
- [ ] Create Supabase database
- [ ] Configure environment variables
- [ ] Deploy to staging
- **Deliverable:** Basic infrastructure running

### Week 2: Internationalization
- [ ] Create country-source mapping system
- [ ] Implement multi-country search logic
- [ ] Update AI system prompts
- [ ] Build country selector UI
- [ ] Connect to official registries
- **Deliverable:** 5+ countries working

### Week 3: News Integration
- [ ] Build news source mapping
- [ ] Create news aggregation service
- [ ] Implement news parsers
- [ ] Build news panel UI
- [ ] Integrate into search results
- **Deliverable:** Real-time news for multiple countries

### Week 4: Testing & Launch
- [ ] Multi-country testing
- [ ] Hallucination detection
- [ ] Performance testing
- [ ] Security audit
- [ ] Launch to production
- **Deliverable:** Production-ready multi-country platform

---

## 7. Success Metrics

- [ ] Search accuracy > 95% (hallucination detection)
- [ ] Response time < 2 seconds
- [ ] News freshness < 1 hour
- [ ] Source reliability > 98%
- [ ] User adoption in 5+ countries
- [ ] 99.9% uptime

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Registry rate limiting | Implement caching layer |
| Language barriers | AI translation in system prompt |
| News source failures | Fallback to alternative sources |
| Hallucination | Confidence scoring + cross-validation |
| Performance | CDN caching + Edge Functions |

---

## 9. Next Steps

1. **Immediate:** Create this GitHub project structure
2. **Day 1:** Set up Vercel deployment
3. **Day 2:** Configure Supabase database
4. **Day 3-4:** Implement country mapping
5. **Day 5-7:** Add news integration

---

## Files to Create (Next)

1. `countries.ts` - Country configuration
2. `sources.ts` - Source/registry mapping
3. `newsSources.ts` - News source configuration
4. `internationalSystemPrompt.ts` - Dynamic AI prompt
5. `NewsPanel.tsx` - UI component
6. `SourcesList.tsx` - UI component
7. `supabase/seed.sql` - Database seed data
8. `.env.example` - Environment template

