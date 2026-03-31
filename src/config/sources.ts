/**
 * Official Sources and Registries Configuration
 * Maps each country to its official business registers and trusted data sources
 */

export interface SourceConfig {
  id: string;
  country: string;
  name: string;
  domain: string;
  type: 'registry' | 'news' | 'financial' | 'directory';
  reliability: number;
  description: string;
  tags: string[];
  icon?: string;
}

export const OFFICIAL_SOURCES: SourceConfig[] = [
  // ========== SWEDEN ==========
  {
    id: 'se-bolagsverket',
    country: 'SE',
    name: 'Bolagsverket',
    domain: 'bolagsverket.se',
    type: 'registry',
    reliability: 100,
    description: 'Swedish Company Registry - Official government register of all Swedish companies',
    tags: ['official', 'government', 'primary', 'companies', 'legal'],
    icon: '🏛️'
  },
  {
    id: 'se-scb',
    country: 'SE',
    name: 'SCB (Statistics Sweden)',
    domain: 'scb.se',
    type: 'financial',
    reliability: 98,
    description: 'Official statistics and business data for Sweden',
    tags: ['official', 'statistics', 'financial', 'economy'],
    icon: '📊'
  },
  {
    id: 'se-allabolag',
    country: 'SE',
    name: 'Allabolag',
    domain: 'allabolag.se',
    type: 'directory',
    reliability: 95,
    description: 'Swedish company directory and business information database',
    tags: ['directory', 'business', 'search'],
    icon: '📑'
  },
  {
    id: 'se-twitter-fisc',
    country: 'SE',
    name: 'Skatteverket',
    domain: 'skatteverket.se',
    type: 'registry',
    reliability: 99,
    description: 'Swedish Tax Agency - Tax and financial information',
    tags: ['official', 'tax', 'financial'],
    icon: '💰'
  },

  // ========== DENMARK ==========
  {
    id: 'dk-virk',
    country: 'DK',
    name: 'CVR (Virk)',
    domain: 'datacvr.virk.dk',
    type: 'registry',
    reliability: 100,
    description: 'Danish Central Business Register - Official state registry',
    tags: ['official', 'government', 'primary', 'companies'],
    icon: '🏛️'
  },
  {
    id: 'dk-erhvervsstyrelsen',
    country: 'DK',
    name: 'Danish Business Authority',
    domain: 'erhvervsstyrelsen.dk',
    type: 'registry',
    reliability: 99,
    description: 'Official Danish business and regulatory authority',
    tags: ['official', 'government', 'licenses'],
    icon: '📋'
  },
  {
    id: 'dk-statens-erhvervs',
    country: 'DK',
    name: 'Statens Erhvervsadministration',
    domain: 'se.dk',
    type: 'directory',
    reliability: 95,
    description: 'Danish business information portal',
    tags: ['official', 'directory', 'business'],
    icon: '📑'
  },

  // ========== NORWAY ==========
  {
    id: 'no-brreg',
    country: 'NO',
    name: 'Brønnøysundregistrene',
    domain: 'brreg.no',
    type: 'registry',
    reliability: 100,
    description: 'Norwegian Business Registry - Official register of all Norwegian enterprises',
    tags: ['official', 'government', 'primary', 'companies'],
    icon: '🏛️'
  },
  {
    id: 'no-altinn',
    country: 'NO',
    name: 'Altinn',
    domain: 'altinn.no',
    type: 'registry',
    reliability: 98,
    description: 'Norwegian government portal for business information',
    tags: ['official', 'government', 'licenses'],
    icon: '🏛️'
  },
  {
    id: 'no-ssbno',
    country: 'NO',
    name: 'Statistics Norway',
    domain: 'ssb.no',
    type: 'financial',
    reliability: 97,
    description: 'Official statistics and business data',
    tags: ['official', 'statistics', 'financial'],
    icon: '📊'
  },

  // ========== FINLAND ==========
  {
    id: 'fi-ytj',
    country: 'FI',
    name: 'YTJ (Finnish Patent and Board of Patents)',
    domain: 'ytj.fi',
    type: 'registry',
    reliability: 100,
    description: 'Finnish Trade Register - Official register of Finnish companies',
    tags: ['official', 'government', 'primary', 'companies'],
    icon: '🏛️'
  },
  {
    id: 'fi-prh',
    country: 'FI',
    name: 'PRH Register',
    domain: 'prh.fi',
    type: 'registry',
    reliability: 99,
    description: 'Finnish Registry - Corporate registration authority',
    tags: ['official', 'government', 'registration'],
    icon: '📋'
  },
  {
    id: 'fi-stat',
    country: 'FI',
    name: 'Statistics Finland',
    domain: 'stat.fi',
    type: 'financial',
    reliability: 97,
    description: 'Official Finnish statistics and economic data',
    tags: ['official', 'statistics', 'financial'],
    icon: '📊'
  },

  // ========== UNITED KINGDOM ==========
  {
    id: 'gb-companies-house',
    country: 'GB',
    name: 'Companies House',
    domain: 'gov.uk',
    type: 'registry',
    reliability: 100,
    description: 'UK Companies House - Official UK company registry',
    tags: ['official', 'government', 'primary', 'companies'],
    icon: '🏛️'
  },
  {
    id: 'gb-fca',
    country: 'GB',
    name: 'FCA Register',
    domain: 'fca.org.uk',
    type: 'registry',
    reliability: 98,
    description: 'Financial Conduct Authority register',
    tags: ['official', 'financial', 'regulation'],
    icon: '💰'
  },
  {
    id: 'gb-ons',
    country: 'GB',
    name: 'Office for National Statistics',
    domain: 'ons.gov.uk',
    type: 'financial',
    reliability: 97,
    description: 'UK official statistics and economic data',
    tags: ['official', 'statistics', 'financial'],
    icon: '📊'
  },

  // ========== GERMANY ==========
  {
    id: 'de-handelsregister',
    country: 'DE',
    name: 'Handelsregister',
    domain: 'handelsregister.de',
    type: 'registry',
    reliability: 100,
    description: 'German Commercial Registry - Official German business register',
    tags: ['official', 'government', 'primary', 'companies'],
    icon: '🏛️'
  },
  {
    id: 'de-bundesanz',
    country: 'DE',
    name: 'Bundesanzeiger',
    domain: 'bundesanzeiger.de',
    type: 'registry',
    reliability: 99,
    description: 'Federal Official Gazette - German legal notices',
    tags: ['official', 'government', 'legal'],
    icon: '📋'
  },
  {
    id: 'de-destatis',
    country: 'DE',
    name: 'DESTATIS',
    domain: 'destatis.de',
    type: 'financial',
    reliability: 97,
    description: 'German Federal Statistical Office',
    tags: ['official', 'statistics', 'financial'],
    icon: '📊'
  },

  // ========== FRANCE ==========
  {
    id: 'fr-infogreffe',
    country: 'FR',
    name: 'Infogreffe',
    domain: 'infogreffe.fr',
    type: 'registry',
    reliability: 100,
    description: 'French Commercial Court Registry - Official French company register',
    tags: ['official', 'government', 'primary', 'companies'],
    icon: '🏛️'
  },
  {
    id: 'fr-insee',
    country: 'FR',
    name: 'INSEE',
    domain: 'insee.fr',
    type: 'financial',
    reliability: 98,
    description: 'French National Institute of Statistics - Official economic data',
    tags: ['official', 'statistics', 'financial'],
    icon: '📊'
  },
  {
    id: 'fr-bodacc',
    country: 'FR',
    name: 'BODACC',
    domain: 'bodacc.fr',
    type: 'registry',
    reliability: 97,
    description: 'French Official Gazette of Legal Notices',
    tags: ['official', 'government', 'legal'],
    icon: '📋'
  },

  // ========== NETHERLANDS ==========
  {
    id: 'nl-kvk',
    country: 'NL',
    name: 'KVK Register',
    domain: 'kvk.nl',
    type: 'registry',
    reliability: 100,
    description: 'Dutch Chamber of Commerce Registry',
    tags: ['official', 'government', 'primary', 'companies'],
    icon: '🏛️'
  },
  {
    id: 'nl-cbs',
    country: 'NL',
    name: 'Statistics Netherlands',
    domain: 'cbs.nl',
    type: 'financial',
    reliability: 97,
    description: 'Dutch official statistics bureau',
    tags: ['official', 'statistics', 'financial'],
    icon: '📊'
  },

  // ========== BELGIUM ==========
  {
    id: 'be-nbb',
    country: 'BE',
    name: 'Crossroads Bank (NBB/BNB)',
    domain: 'nbb.be',
    type: 'registry',
    reliability: 100,
    description: 'Belgian National Bank - Crossroads Bank registry',
    tags: ['official', 'government', 'primary', 'companies'],
    icon: '🏛️'
  },
  {
    id: 'be-statbel',
    country: 'BE',
    name: 'STATBEL',
    domain: 'statbel.fgov.be',
    type: 'financial',
    reliability: 97,
    description: 'Belgian Statistical Office',
    tags: ['official', 'statistics', 'financial'],
    icon: '📊'
  },

  // ========== AUSTRIA ==========
  {
    id: 'at-firmenbuch',
    country: 'AT',
    name: 'Firmenbuch',
    domain: 'firmenbuch.at',
    type: 'registry',
    reliability: 100,
    description: 'Austrian Commercial Registry',
    tags: ['official', 'government', 'primary', 'companies'],
    icon: '🏛️'
  },
  {
    id: 'at-statistik',
    country: 'AT',
    name: 'Statistics Austria',
    domain: 'statistik.at',
    type: 'financial',
    reliability: 97,
    description: 'Austrian Statistical Office',
    tags: ['official', 'statistics', 'financial'],
    icon: '📊'
  },

  // ========== SWITZERLAND ==========
  {
    id: 'ch-shab',
    country: 'CH',
    name: 'SHAB',
    domain: 'shab.ch',
    type: 'registry',
    reliability: 100,
    description: 'Swiss Trade Register',
    tags: ['official', 'government', 'primary', 'companies'],
    icon: '🏛️'
  },
  {
    id: 'ch-ostat',
    country: 'CH',
    name: 'Swiss Statistics',
    domain: 'stat.admin.ch',
    type: 'financial',
    reliability: 97,
    description: 'Swiss Federal Statistical Office',
    tags: ['official', 'statistics', 'financial'],
    icon: '📊'
  },
];

/**
 * Get sources for a specific country
 */
export function getSourcesByCountry(countryCode: string): SourceConfig[] {
  return OFFICIAL_SOURCES.filter(s => s.country === countryCode);
}

/**
 * Get sources by type
 */
export function getSourcesByType(type: SourceConfig['type']): SourceConfig[] {
  return OFFICIAL_SOURCES.filter(s => s.type === type);
}

/**
 * Get registry sources (primary official)
 */
export function getRegistrySources(countryCode: string): SourceConfig[] {
  return OFFICIAL_SOURCES.filter(s => s.country === countryCode && s.type === 'registry');
}

/**
 * Get all registry domains for search inclusion
 */
export function getRegistryDomains(countryCode: string): string[] {
  return getRegistrySources(countryCode).map(s => s.domain);
}

/**
 * Get high-reliability sources for a country
 */
export function getTrustedSources(countryCode: string, minReliability: number = 95): SourceConfig[] {
  return OFFICIAL_SOURCES.filter(
    s => s.country === countryCode && s.reliability >= minReliability
  );
}

/**
 * Get all domains for a country (for search filtering)
 */
export function getAllDomainsForCountry(countryCode: string): string[] {
  return getSourcesByCountry(countryCode).map(s => s.domain);
}

/**
 * Export for Tavily include_domains parameter
 */
export function getTavilyIncludeDomains(countryCode: string): string[] {
  return getRegistryDomains(countryCode);
}
