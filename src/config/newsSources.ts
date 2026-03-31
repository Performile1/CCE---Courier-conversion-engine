/**
 * News Sources Configuration by Country
 * Maps local and international news sources for each country
 */

export interface NewsSourceConfig {
  id: string;
  country: string;
  name: string;
  url: string;
  domain: string;
  category: 'business' | 'startup' | 'logistics' | 'finance' | 'tech' | 'general' | 'industry';
  feedType: 'rss' | 'api' | 'web' | 'manual';
  feedUrl?: string;
  apiEndpoint?: string;
  apiKeyRequired: boolean;
  language: string;
  updateFrequency: 'daily' | 'hourly' | '15min' | '1hour';
  reliability: number;
  description: string;
  icon?: string;
}

export const NEWS_SOURCES: NewsSourceConfig[] = [
  // ========== SWEDEN ==========
  {
    id: 'se-breakit',
    country: 'SE',
    name: 'Breakit',
    url: 'https://www.breakit.se',
    domain: 'breakit.se',
    category: 'startup',
    feedType: 'rss',
    feedUrl: 'https://www.breakit.se/feed',
    language: 'sv',
    updateFrequency: 'daily',
    reliability: 95,
    description: 'Swedish startup and tech news',
    icon: '🚀'
  },
  {
    id: 'se-dagenslogistik',
    country: 'SE',
    name: 'Dagens Logistik',
    url: 'https://www.dagenslogistik.se',
    domain: 'dagenslogistik.se',
    category: 'logistics',
    feedType: 'rss',
    feedUrl: 'https://www.dagenslogistik.se/feed',
    language: 'sv',
    updateFrequency: 'daily',
    reliability: 92,
    description: 'Swedish logistics and supply chain news',
    icon: '📦'
  },
  {
    id: 'se-mynewsdesk',
    country: 'SE',
    name: 'MyNewsDesk',
    url: 'https://www.mynewsdesk.com',
    domain: 'mynewsdesk.com',
    category: 'general',
    feedType: 'api',
    apiEndpoint: 'https://api.mynewsdesk.com/v2/press_releases',
    apiKeyRequired: true,
    language: 'sv',
    updateFrequency: '15min',
    reliability: 93,
    description: 'Press release distribution and news platform',
    icon: '📰'
  },
  {
    id: 'se-di',
    country: 'SE',
    name: 'DI Digital',
    url: 'https://www.di.se',
    domain: 'di.se',
    category: 'finance',
    feedType: 'rss',
    feedUrl: 'https://www.di.se/feed',
    language: 'sv',
    updateFrequency: 'hourly',
    reliability: 96,
    description: 'Swedish business and finance news',
    icon: '💼'
  },
  {
    id: 'se-sme',
    country: 'SE',
    name: 'SME Sweden',
    url: 'https://www.sme.se',
    domain: 'sme.se',
    category: 'business',
    feedType: 'rss',
    feedUrl: 'https://www.sme.se/feed',
    language: 'sv',
    updateFrequency: 'daily',
    reliability: 91,
    description: 'Swedish small and medium enterprise news',
    icon: '🏢'
  },

  // ========== DENMARK ==========
  {
    id: 'dk-finans',
    country: 'DK',
    name: 'Finans',
    url: 'https://www.finans.dk',
    domain: 'finans.dk',
    category: 'finance',
    feedType: 'rss',
    feedUrl: 'https://www.finans.dk/feed',
    language: 'da',
    updateFrequency: 'hourly',
    reliability: 95,
    description: 'Danish finance and business news',
    icon: '💰'
  },
  {
    id: 'dk-business',
    country: 'DK',
    name: 'Business.dk',
    url: 'https://www.business.dk',
    domain: 'business.dk',
    category: 'business',
    feedType: 'rss',
    feedUrl: 'https://www.business.dk/feed',
    language: 'da',
    updateFrequency: 'daily',
    reliability: 93,
    description: 'Danish business and entrepreneur news',
    icon: '📊'
  },
  {
    id: 'dk-mynewsdesk',
    country: 'DK',
    name: 'MyNewsDesk Denmark',
    url: 'https://www.mynewsdesk.com/dk',
    domain: 'mynewsdesk.com',
    category: 'general',
    feedType: 'api',
    apiEndpoint: 'https://api.mynewsdesk.com/v2/press_releases',
    apiKeyRequired: true,
    language: 'da',
    updateFrequency: '15min',
    reliability: 93,
    description: 'Press releases and company news',
    icon: '📰'
  },
  {
    id: 'dk-tech',
    country: 'DK',
    name: 'IT-Branchens Nyheder',
    url: 'https://www.it-branch.dk',
    domain: 'it-branch.dk',
    category: 'tech',
    feedType: 'rss',
    feedUrl: 'https://www.it-branch.dk/feed',
    language: 'da',
    updateFrequency: 'daily',
    reliability: 90,
    description: 'Danish IT and tech industry news',
    icon: '💻'
  },

  // ========== NORWAY ==========
  {
    id: 'no-e24',
    country: 'NO',
    name: 'E24',
    url: 'https://www.e24.no',
    domain: 'e24.no',
    category: 'finance',
    feedType: 'rss',
    feedUrl: 'https://www.e24.no/feed',
    language: 'no',
    updateFrequency: 'hourly',
    reliability: 96,
    description: 'Norwegian finance and business news',
    icon: '💼'
  },
  {
    id: 'no-startupland',
    country: 'NO',
    name: 'Startupland',
    url: 'https://startupland.no',
    domain: 'startupland.no',
    category: 'startup',
    feedType: 'rss',
    feedUrl: 'https://startupland.no/feed',
    language: 'no',
    updateFrequency: 'daily',
    reliability: 92,
    description: 'Norwegian startup and innovation news',
    icon: '🚀'
  },
  {
    id: 'no-mynewsdesk',
    country: 'NO',
    name: 'MyNewsDesk Norway',
    url: 'https://www.mynewsdesk.com/no',
    domain: 'mynewsdesk.com',
    category: 'general',
    feedType: 'api',
    apiEndpoint: 'https://api.mynewsdesk.com/v2/press_releases',
    apiKeyRequired: true,
    language: 'no',
    updateFrequency: '15min',
    reliability: 93,
    description: 'Press releases and company news',
    icon: '📰'
  },
  {
    id: 'no-logistics',
    country: 'NO',
    name: 'Logistics Norway',
    url: 'https://www.logistikk.no',
    domain: 'logistikk.no',
    category: 'logistics',
    feedType: 'rss',
    feedUrl: 'https://www.logistikk.no/feed',
    language: 'no',
    updateFrequency: 'daily',
    reliability: 88,
    description: 'Norwegian transport and logistics news',
    icon: '🚛'
  },

  // ========== FINLAND ==========
  {
    id: 'fi-kauppalehti',
    country: 'FI',
    name: 'Kauppalehti',
    url: 'https://www.kauppalehti.fi',
    domain: 'kauppalehti.fi',
    category: 'finance',
    feedType: 'rss',
    feedUrl: 'https://www.kauppalehti.fi/feed',
    language: 'fi',
    updateFrequency: 'hourly',
    reliability: 96,
    description: 'Finnish business and finance news',
    icon: '💼'
  },
  {
    id: 'fi-startup',
    country: 'FI',
    name: 'Startup Suomi',
    url: 'https://www.startupsuomi.fi',
    domain: 'startupsuomi.fi',
    category: 'startup',
    feedType: 'rss',
    feedUrl: 'https://www.startupsuomi.fi/feed',
    language: 'fi',
    updateFrequency: 'daily',
    reliability: 91,
    description: 'Finnish startup and tech news',
    icon: '🚀'
  },
  {
    id: 'fi-mynewsdesk',
    country: 'FI',
    name: 'MyNewsDesk Finland',
    url: 'https://www.mynewsdesk.com/fi',
    domain: 'mynewsdesk.com',
    category: 'general',
    feedType: 'api',
    apiEndpoint: 'https://api.mynewsdesk.com/v2/press_releases',
    apiKeyRequired: true,
    language: 'fi',
    updateFrequency: '15min',
    reliability: 93,
    description: 'Press releases and company news',
    icon: '📰'
  },

  // ========== UNITED KINGDOM ==========
  {
    id: 'gb-bloomberg',
    country: 'GB',
    name: 'Bloomberg',
    url: 'https://www.bloomberg.com',
    domain: 'bloomberg.com',
    category: 'finance',
    feedType: 'rss',
    feedUrl: 'https://feeds.bloomberg.com/markets/news.rss',
    language: 'en',
    updateFrequency: '15min',
    reliability: 98,
    description: 'Global finance and business news',
    icon: '💰'
  },
  {
    id: 'gb-bbc-business',
    country: 'GB',
    name: 'BBC Business',
    url: 'https://www.bbc.com/news/business',
    domain: 'bbc.com',
    category: 'business',
    feedType: 'rss',
    feedUrl: 'https://feeds.bbc.co.uk/news/business/rss.xml',
    language: 'en',
    updateFrequency: 'hourly',
    reliability: 97,
    description: 'BBC business and economics news',
    icon: '📺'
  },
  {
    id: 'gb-techcrunch',
    country: 'GB',
    name: 'TechCrunch',
    url: 'https://techcrunch.com',
    domain: 'techcrunch.com',
    category: 'tech',
    feedType: 'rss',
    feedUrl: 'https://feeds.techcrunch.com/techcrunch/',
    language: 'en',
    updateFrequency: 'hourly',
    reliability: 95,
    description: 'Technology and startup news',
    icon: '💻'
  },

  // ========== GERMANY ==========
  {
    id: 'de-handelsblatt',
    country: 'DE',
    name: 'Handelsblatt',
    url: 'https://www.handelsblatt.com',
    domain: 'handelsblatt.com',
    category: 'finance',
    feedType: 'rss',
    feedUrl: 'https://www.handelsblatt.com/feed.rss',
    language: 'de',
    updateFrequency: 'hourly',
    reliability: 97,
    description: 'German business and finance news',
    icon: '💼'
  },
  {
    id: 'de-gruenderszene',
    country: 'DE',
    name: 'Gründerszene',
    url: 'https://www.gruenderszene.de',
    domain: 'gruenderszene.de',
    category: 'startup',
    feedType: 'rss',
    feedUrl: 'https://www.gruenderszene.de/feed',
    language: 'de',
    updateFrequency: 'daily',
    reliability: 94,
    description: 'German startup and entrepreneur news',
    icon: '🚀'
  },
  {
    id: 'de-mynewsdesk',
    country: 'DE',
    name: 'MyNewsDesk Germany',
    url: 'https://www.mynewsdesk.com/de',
    domain: 'mynewsdesk.com',
    category: 'general',
    feedType: 'api',
    apiEndpoint: 'https://api.mynewsdesk.com/v2/press_releases',
    apiKeyRequired: true,
    language: 'de',
    updateFrequency: '15min',
    reliability: 93,
    description: 'Press releases and company news',
    icon: '📰'
  },

  // ========== FRANCE ==========
  {
    id: 'fr-lesechos',
    country: 'FR',
    name: 'Les Échos',
    url: 'https://www.lesechos.fr',
    domain: 'lesechos.fr',
    category: 'finance',
    feedType: 'rss',
    feedUrl: 'https://www.lesechos.fr/rss.xml',
    language: 'fr',
    updateFrequency: 'hourly',
    reliability: 97,
    description: 'French business and finance news',
    icon: '💼'
  },
  {
    id: 'fr-maddyness',
    country: 'FR',
    name: 'Maddyness',
    url: 'https://www.maddyness.com',
    domain: 'maddyness.com',
    category: 'startup',
    feedType: 'rss',
    feedUrl: 'https://www.maddyness.com/feed/',
    language: 'fr',
    updateFrequency: 'daily',
    reliability: 93,
    description: 'French startup and innovation news',
    icon: '🚀'
  },
  {
    id: 'fr-mynewsdesk',
    country: 'FR',
    name: 'MyNewsDesk France',
    url: 'https://www.mynewsdesk.com/fr',
    domain: 'mynewsdesk.com',
    category: 'general',
    feedType: 'api',
    apiEndpoint: 'https://api.mynewsdesk.com/v2/press_releases',
    apiKeyRequired: true,
    language: 'fr',
    updateFrequency: '15min',
    reliability: 93,
    description: 'Press releases and company news',
    icon: '📰'
  },

  // ========== NETHERLANDS ==========
  {
    id: 'nl-volkskrant-economie',
    country: 'NL',
    name: 'Volkskrant Economie',
    url: 'https://www.volkskrant.nl/economie',
    domain: 'volkskrant.nl',
    category: 'finance',
    feedType: 'rss',
    feedUrl: 'https://www.volkskrant.nl/feeds/economie/rss',
    language: 'nl',
    updateFrequency: 'hourly',
    reliability: 96,
    description: 'Dutch business and economy news',
    icon: '💼'
  },
  {
    id: 'nl-startupland',
    country: 'NL',
    name: 'Startup Amsterdam',
    url: 'https://www.startup.amsterdam',
    domain: 'startup.amsterdam',
    category: 'startup',
    feedType: 'rss',
    feedUrl: 'https://www.startup.amsterdam/feed',
    language: 'nl',
    updateFrequency: 'daily',
    reliability: 92,
    description: 'Dutch startup and tech news',
    icon: '🚀'
  },
];

/**
 * Get news sources for a specific country
 */
export function getNewsSourcesByCountry(countryCode: string): NewsSourceConfig[] {
  return NEWS_SOURCES.filter(s => s.country === countryCode);
}

/**
 * Get news sources by category
 */
export function getNewsSourcesByCategory(category: NewsSourceConfig['category']): NewsSourceConfig[] {
  return NEWS_SOURCES.filter(s => s.category === category);
}

/**
 * Get high-reliability news sources
 */
export function getReliableNewsSources(minReliability: number = 90): NewsSourceConfig[] {
  return NEWS_SOURCES.filter(s => s.reliability >= minReliability);
}

/**
 * Get RSS-only news sources (for easy parsing)
 */
export function getRSSNewsSources(countryCode?: string): NewsSourceConfig[] {
  return NEWS_SOURCES.filter(s => 
    s.feedType === 'rss' && (!countryCode || s.country === countryCode)
  );
}

/**
 * Get API-based news sources (for real-time updates)
 */
export function getAPINewsSources(countryCode?: string): NewsSourceConfig[] {
  return NEWS_SOURCES.filter(s => 
    s.feedType === 'api' && (!countryCode || s.country === countryCode)
  );
}

/**
 * Extract all unique domains for search filtering
 */
export function getNewsDomains(countryCode?: string): string[] {
  const sources = countryCode 
    ? getNewsSourcesByCountry(countryCode)
    : NEWS_SOURCES;
  return [...new Set(sources.map(s => s.domain))];
}

/**
 * Get sources that require API key
 */
export function getAPIKeyRequiredSources(): NewsSourceConfig[] {
  return NEWS_SOURCES.filter(s => s.apiKeyRequired);
}
