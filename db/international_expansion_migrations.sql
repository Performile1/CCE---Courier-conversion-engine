-- International Expansion Database Schema
-- Supabase PostgreSQL Migration for Multi-Country Support
-- Run these migrations in Supabase SQL Editor

-- ============================================================================
-- TABLE 1: Countries Configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  code VARCHAR(2) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  language VARCHAR(10) NOT NULL,
  timezone VARCHAR(50),
  currency_code VARCHAR(3),
  registry_name VARCHAR(100),
  registry_domain VARCHAR(100),
  registry_url TEXT,
  eu_member BOOLEAN DEFAULT FALSE,
  bris_compatible BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for countries table
CREATE INDEX idx_countries_code ON countries(code);
CREATE INDEX idx_countries_eu_member ON countries(eu_member);
CREATE INDEX idx_countries_bris ON countries(bris_compatible);

-- Sample data for countries
INSERT INTO countries (code, name, language, timezone, currency_code, registry_name, registry_domain, registry_url, eu_member, bris_compatible)
VALUES
  ('SE', 'Sweden', 'sv', 'Europe/Stockholm', 'SEK', 'Bolagsverket', 'bolagsverket.se', 'https://bolagsverket.se', true, true),
  ('DK', 'Denmark', 'da', 'Europe/Copenhagen', 'DKK', 'CVR/Virk', 'datacvr.virk.dk', 'https://datacvr.virk.dk', true, true),
  ('NO', 'Norway', 'nb', 'Europe/Oslo', 'NOK', 'Brønnøysundregistrene', 'brreg.no', 'https://brreg.no', false, true),
  ('FI', 'Finland', 'fi', 'Europe/Helsinki', 'EUR', 'YTJ', 'ytj.fi', 'https://ytj.fi', true, true),
  ('GB', 'United Kingdom', 'en', 'Europe/London', 'GBP', 'Companies House', 'gov.uk', 'https://find-and-update.company-information.service.gov.uk', false, false),
  ('DE', 'Germany', 'de', 'Europe/Berlin', 'EUR', 'Handelsregister', 'handelsregister.de', 'https://www.handelsregistereintrag.de', true, true),
  ('FR', 'France', 'fr', 'Europe/Paris', 'EUR', 'INFOGREFFE', 'infogreffe.fr', 'https://www.infogreffe.fr', true, true),
  ('NL', 'Netherlands', 'nl', 'Europe/Amsterdam', 'EUR', 'KVK', 'kvk.nl', 'https://www.kvk.nl', true, true),
  ('BE', 'Belgium', 'nl', 'Europe/Brussels', 'EUR', 'Crossroads Bank/NBB', 'nbb.be', 'https://www.nbb.be', true, true),
  ('AT', 'Austria', 'de', 'Europe/Vienna', 'EUR', 'Firmenbuch', 'firmenbuch.at', 'https://www.firmenbuch.at', true, true),
  ('CH', 'Switzerland', 'de', 'Europe/Zurich', 'CHF', 'SHAB', 'shab.ch', 'https://www.shab.ch', false, false),
  ('US', 'United States', 'en', 'America/New_York', 'USD', 'SEC', 'sec.gov', 'https://www.sec.gov', false, false)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- TABLE 2: Official Sources (Registries, Financial, News, Directories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS official_sources (
  id SERIAL PRIMARY KEY,
  source_id VARCHAR(100) UNIQUE NOT NULL,
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  name VARCHAR(200) NOT NULL,
  domain VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL, -- registry, financial, news, directory
  reliability_score INT DEFAULT 90, -- 0-100
  description TEXT,
  url TEXT NOT NULL,
  tags TEXT[], -- e.g., ["company", "financial", "official"]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal searching
CREATE INDEX idx_sources_country ON official_sources(country_code);
CREATE INDEX idx_sources_type ON official_sources(type);
CREATE INDEX idx_sources_domain ON official_sources(domain);
CREATE INDEX idx_sources_reliability ON official_sources(reliability_score DESC);
CREATE INDEX idx_sources_fts ON official_sources USING GIN (tags);

-- ============================================================================
-- TABLE 3: News Sources Configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS news_sources (
  id SERIAL PRIMARY KEY,
  news_source_id VARCHAR(100) UNIQUE NOT NULL,
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  name VARCHAR(200) NOT NULL,
  domain VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL, -- business, startup, logistics, finance, tech, general, industry
  feed_type VARCHAR(20) NOT NULL, -- rss, api, web, manual
  feed_url TEXT,
  api_endpoint TEXT,
  api_key_required BOOLEAN DEFAULT FALSE,
  language VARCHAR(10),
  update_frequency VARCHAR(20), -- 15min, 1hour, daily, etc.
  reliability_score INT DEFAULT 90,
  description TEXT,
  url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for news sources
CREATE INDEX idx_news_country ON news_sources(country_code);
CREATE INDEX idx_news_category ON news_sources(category);
CREATE INDEX idx_news_feed_type ON news_sources(feed_type);
CREATE INDEX idx_news_reliability ON news_sources(reliability_score DESC);

-- ============================================================================
-- TABLE 4: News Articles (Cache from aggregation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS news_articles (
  id VARCHAR(200) PRIMARY KEY,
  source VARCHAR(200) NOT NULL,
  country VARCHAR(2) NOT NULL REFERENCES countries(code),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMP NOT NULL,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  category VARCHAR(50),
  reliability INT DEFAULT 90,
  language VARCHAR(10),
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for articles
CREATE INDEX idx_articles_country ON news_articles(country);
CREATE INDEX idx_articles_published ON news_articles(published_at DESC);
CREATE INDEX idx_articles_source ON news_articles(source);
CREATE INDEX idx_articles_created ON news_articles(created_at DESC);

-- Full-text search index for articles
CREATE INDEX idx_articles_fts ON news_articles 
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ============================================================================
-- TABLE 5: Search History & Performance Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_history (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  company_name VARCHAR(255) NOT NULL,
  search_type VARCHAR(50), -- registry, news, financial, general
  query TEXT NOT NULL,
  results_count INT DEFAULT 0,
  execution_time_ms INT,
  confidence_level VARCHAR(20), -- High, Medium, Low
  verified_sources INT DEFAULT 0,
  used_registries BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for search history
CREATE INDEX idx_search_country ON search_history(country_code);
CREATE INDEX idx_search_created ON search_history(created_at DESC);
CREATE INDEX idx_search_company ON search_history(company_name);
CREATE INDEX idx_search_confidence ON search_history(confidence_level);

-- ============================================================================
-- TABLE 6: API Usage & Rate Limiting
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_quota (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(100) NOT NULL, -- tavily, mynewsdesk, openrouter, etc.
  country_code VARCHAR(2),
  api_calls INT DEFAULT 0,
  quota_limit INT NOT NULL,
  reset_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(service_name, country_code, reset_at)
);

-- Indexes for quota tracking
CREATE INDEX idx_quota_service ON api_quota(service_name);
CREATE INDEX idx_quota_reset ON api_quota(reset_at);

-- ============================================================================
-- TABLE 7: Cached Search Results
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(500) NOT NULL UNIQUE,
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  company_name VARCHAR(255) NOT NULL,
  results JSONB NOT NULL,
  confidence_level VARCHAR(20),
  ttl_seconds INT DEFAULT 3600,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Indexes for cache lookups
CREATE INDEX idx_cache_key ON search_cache(cache_key);
CREATE INDEX idx_cache_expires ON search_cache(expires_at);
CREATE INDEX idx_cache_country ON search_cache(country_code);

-- Automatic cleanup of expired cache (would need a CRON job or trigger)
-- Example CRON: DELETE FROM search_cache WHERE expires_at < NOW() (run every hour)

-- ============================================================================
-- TABLE 8: Company Profiles (Extended for International)
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  primary_country VARCHAR(2) NOT NULL REFERENCES countries(code),
  secondary_countries VARCHAR(2)[],
  registry_ids JSONB, -- Store registry IDs per country, e.g., {"SE": "556000-0001", "DK": "12345678"}
  registry_urls JSONB,
  website VARCHAR(500),
  founded_year INT,
  industry VARCHAR(100),
  size VARCHAR(50), -- startup, small, medium, large, enterprise
  status VARCHAR(50), -- active, inactive, dissolved, etc.
  last_verified_at TIMESTAMP,
  verification_confidence VARCHAR(20), -- High, Medium, Low
  data_sources TEXT[], -- which sources this profile comes from
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for company profiles
CREATE INDEX idx_company_primary_country ON company_profiles(primary_country);
CREATE INDEX idx_company_name ON company_profiles(name);
CREATE UNIQUE INDEX idx_company_name_country ON company_profiles(LOWER(name), primary_country);

-- ============================================================================
-- TABLE 9: News Mentions (Linking companies to articles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS news_mentions (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  article_id VARCHAR(200) REFERENCES news_articles(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  mention_type VARCHAR(50), -- founded, acquired, news, partnership, fundraising, etc.
  context TEXT, -- excerpt from article mentioning the company
  confidence INT, -- 0-100 confidence this is relevant
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, article_id)
);

-- Indexes for mentions
CREATE INDEX idx_mentions_company ON news_mentions(company_id);
CREATE INDEX idx_mentions_article ON news_mentions(article_id);
CREATE INDEX idx_mentions_country ON news_mentions(country_code);

-- ============================================================================
-- RLS (Row Level Security) Policies
-- ============================================================================

-- For public data (countries, sources, news)
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Public read access to countries
CREATE POLICY "Countries are readable by everyone" ON countries
  FOR SELECT USING (TRUE);

-- Public read access to sources
CREATE POLICY "Sources are readable by everyone" ON official_sources
  FOR SELECT USING (TRUE);

-- Public read access to news sources
CREATE POLICY "News sources are readable by everyone" ON news_sources
  FOR SELECT USING (TRUE);

-- Public read access to articles (recent only - last 30 days)
CREATE POLICY "News articles are readable if recent" ON news_articles
  FOR SELECT USING (
    published_at >= NOW() - INTERVAL '30 days'
    OR created_at >= NOW() - INTERVAL '7 days'
  );

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- View: EU Countries with BRIS Support
CREATE OR REPLACE VIEW eu_countries_with_bris AS
SELECT code, name, language, registry_name, registry_domain, registry_url
FROM countries
WHERE eu_member = TRUE AND bris_compatible = TRUE
ORDER BY name;

-- View: Registry Sources by Country (Official only)
CREATE OR REPLACE VIEW registry_sources_by_country AS
SELECT 
  country_code,
  c.name as country_name,
  s.name as source_name,
  s.domain,
  s.reliability_score,
  s.url
FROM official_sources s
JOIN countries c ON s.country_code = c.code
WHERE s.type = 'registry'
ORDER BY c.code, s.reliability_score DESC;

-- View: Recent News by Country (Last 24 hours)
CREATE OR REPLACE VIEW recent_news_by_country AS
SELECT 
  country,
  source,
  title,
  published_at,
  url,
  reliability,
  category,
  COUNT(*) OVER (PARTITION BY country) as daily_articles
FROM news_articles
WHERE published_at >= NOW() - INTERVAL '24 hours'
ORDER BY country, published_at DESC;

-- ============================================================================
-- Functions for Common Operations
-- ============================================================================

-- Function: Get total news articles by country
CREATE OR REPLACE FUNCTION get_article_count_by_country()
RETURNS TABLE(country_code VARCHAR, article_count BIGINT) AS $$
  SELECT country, COUNT(*) as article_count
  FROM news_articles
  WHERE published_at >= NOW() - INTERVAL '30 days'
  GROUP BY country
  ORDER BY article_count DESC;
$$ LANGUAGE SQL;

-- Function: Search companies by registry ID across countries
CREATE OR REPLACE FUNCTION search_company_by_registry_id(
  p_registry_id VARCHAR,
  p_country_code VARCHAR
)
RETURNS TABLE(
  id UUID,
  name VARCHAR,
  primary_country VARCHAR,
  registry_ids JSONB,
  status VARCHAR
) AS $$
  SELECT id, name, primary_country, registry_ids, status
  FROM company_profiles
  WHERE primary_country = p_country_code
    AND (registry_ids->p_country_code = to_jsonb(p_registry_id)
         OR registry_ids ->> p_country_code = p_registry_id)
  LIMIT 10;
$$ LANGUAGE SQL;

-- Function: Get search performance metrics
CREATE OR REPLACE FUNCTION get_search_performance_metrics(
  p_hours INT DEFAULT 24
)
RETURNS TABLE(
  country_code VARCHAR,
  total_searches BIGINT,
  avg_execution_time NUMERIC,
  high_confidence_count BIGINT,
  avg_results NUMERIC
) AS $$
  SELECT 
    country_code,
    COUNT(*) as total_searches,
    ROUND(AVG(execution_time_ms)::NUMERIC, 2) as avg_execution_time,
    COUNT(CASE WHEN confidence_level = 'High' THEN 1 END) as high_confidence_count,
    ROUND(AVG(results_count)::NUMERIC, 2) as avg_results
  FROM search_history
  WHERE created_at >= NOW() - INTERVAL '1 hour' * p_hours
  GROUP BY country_code
  ORDER BY total_searches DESC;
$$ LANGUAGE SQL;

-- ============================================================================
-- Triggers for Automatic Updates
-- ============================================================================

-- Trigger: Update updated_at timestamp for countries
CREATE OR REPLACE FUNCTION update_timestamp_countries()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER countries_update_timestamp
BEFORE UPDATE ON countries
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_countries();

-- Trigger: Update updated_at timestamp for sources
CREATE OR REPLACE FUNCTION update_timestamp_sources()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sources_update_timestamp
BEFORE UPDATE ON official_sources
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_sources();

-- ============================================================================
-- Performance Optimization: Partitioning (Optional, for very large tables)
-- ============================================================================
-- If you have millions of articles, consider partitioning by month:
-- ALTER TABLE news_articles PARTITION BY RANGE (DATE_TRUNC('month', published_at));

-- ============================================================================
-- Backup Recommendation
-- ============================================================================
-- Set up automatic backups in Supabase settings
-- - Retention: 7-30 days
-- - Frequency: Daily
-- - Test restore procedures regularly

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Run verification queries to confirm:
-- SELECT COUNT(*) FROM countries; -- Should be 12
-- SELECT COUNT(*) FROM official_sources; -- Should be 50+
-- SELECT COUNT(*) FROM news_sources; -- Should be 60+
