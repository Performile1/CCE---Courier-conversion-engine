/**
 * International Country Configuration
 * Maps countries to their official registries, news sources, and language settings
 */

export interface CountryConfig {
  code: string;
  name: string;
  language: string;
  region: string;
  currency: string;
  timezone: string;
  registryType: string;
  registryUrl: string;
  registryDomain: string;
  registrySystemPrompt?: string;
  euMember: boolean;
  bridgeCompatible: boolean;
}

export const COUNTRIES: Record<string, CountryConfig> = {
  SE: {
    code: 'SE',
    name: 'Sweden',
    language: 'sv',
    region: 'EU',
    currency: 'SEK',
    timezone: 'Europe/Stockholm',
    registryType: 'Bolagsverket',
    registryUrl: 'https://www.bolagsverket.se',
    registryDomain: 'bolagsverket.se',
    euMember: true,
    bridgeCompatible: true,
    registrySystemPrompt: `You are searching for company information registered in Sweden (Bolagsverket).
Primary source: bolagsverket.se - Swedish company registry.
Extract: Registro number (org number), company name, address, directors, revenue, employees.
If information is in Swedish, translate to English.`
  },

  DK: {
    code: 'DK',
    name: 'Denmark',
    language: 'da',
    region: 'EU',
    currency: 'DKK',
    timezone: 'Europe/Copenhagen',
    registryType: 'CVR (Virk)',
    registryUrl: 'https://datacvr.virk.dk',
    registryDomain: 'datacvr.virk.dk',
    euMember: true,
    bridgeCompatible: true,
    registrySystemPrompt: `You are searching for company information in Denmark (CVR/Virk).
Primary source: datacvr.virk.dk - Danish company registry.
Extract: CVR number, company name, address, phone, email, revenue, employees.
If information is in Danish, translate to English.`
  },

  NO: {
    code: 'NO',
    name: 'Norway',
    language: 'no',
    region: 'EEA',
    currency: 'NOK',
    timezone: 'Europe/Oslo',
    registryType: 'Brønnøysundregistrene',
    registryUrl: 'https://www.brreg.no',
    registryDomain: 'brreg.no',
    euMember: false,
    bridgeCompatible: true,
    registrySystemPrompt: `You are searching for company information in Norway (Brønnøysundregistrene).
Primary source: brreg.no - Norwegian company registry.
Extract: Organization number, company name, address, CEO, revenue, employees.
If information is in Norwegian, translate to English.`
  },

  FI: {
    code: 'FI',
    name: 'Finland',
    language: 'fi',
    region: 'EU',
    currency: 'EUR',
    timezone: 'Europe/Helsinki',
    registryType: 'PRH (YTJ)',
    registryUrl: 'https://www.ytj.fi',
    registryDomain: 'ytj.fi',
    euMember: true,
    bridgeCompatible: true,
    registrySystemPrompt: `You are searching for company information in Finland (YTJ).
Primary source: ytj.fi - Finnish company registry.
Extract: Business ID, company name, address, CEO, industry, employees.
If information is in Finnish, translate to English.`
  },

  GB: {
    code: 'GB',
    name: 'United Kingdom',
    language: 'en',
    region: 'Europe',
    currency: 'GBP',
    timezone: 'Europe/London',
    registryType: 'Companies House',
    registryUrl: 'https://www.gov.uk/government/organisations/companies-house',
    registryDomain: 'gov.uk',
    euMember: false,
    bridgeCompatible: false,
    registrySystemPrompt: `You are searching for company information in the United Kingdom (Companies House).
Primary source: gov.uk (Companies House) - UK company registry.
Extract: Company registration number, company name, address, directors, annual revenue, employees.`
  },

  DE: {
    code: 'DE',
    name: 'Germany',
    language: 'de',
    region: 'EU',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
    registryType: 'Handelsregister',
    registryUrl: 'https://www.handelsregister.de',
    registryDomain: 'handelsregister.de',
    euMember: true,
    bridgeCompatible: true,
    registrySystemPrompt: `You are searching for company information in Germany (Handelsregister).
Primary source: handelsregister.de - German commercial registry.
Extract: HR (Handelsregisternummer), company name, address, Geschäftsführer, annual revenue, employees.
If information is in German, translate to English.`
  },

  FR: {
    code: 'FR',
    name: 'France',
    language: 'fr',
    region: 'EU',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    registryType: 'INFOGREFFE',
    registryUrl: 'https://www.infogreffe.fr',
    registryDomain: 'infogreffe.fr',
    euMember: true,
    bridgeCompatible: true,
    registrySystemPrompt: `You are searching for company information in France (INFOGREFFE).
Primary source: infogreffe.fr - French company registry.
Extract: SIREN number, SIRET number, company name, address, Chiffre d'affaires (revenue), employees.
If information is in French, translate to English.`
  },

  NL: {
    code: 'NL',
    name: 'Netherlands',
    language: 'nl',
    region: 'EU',
    currency: 'EUR',
    timezone: 'Europe/Amsterdam',
    registryType: 'KVK (Kamer van Koophandel)',
    registryUrl: 'https://www.kvk.nl',
    registryDomain: 'kvk.nl',
    euMember: true,
    bridgeCompatible: true,
    registrySystemPrompt: `You are searching for company information in the Netherlands (KVK).
Primary source: kvk.nl - Dutch chamber of commerce registry.
Extract: KVK number, company name, address, directors, annual revenue, employees.
If information is in Dutch, translate to English.`
  },

  BE: {
    code: 'BE',
    name: 'Belgium',
    language: 'nl',
    region: 'EU',
    currency: 'EUR',
    timezone: 'Europe/Brussels',
    registryType: 'Crossroads Bank (BCE)',
    registryUrl: 'https://www.nbb.be',
    registryDomain: 'nbb.be',
    euMember: true,
    bridgeCompatible: true,
    registrySystemPrompt: `You are searching for company information in Belgium (Crossroads Bank).
Primary source: nbb.be (National Bank of Belgium) - Belgian company registry.
Extract: Enterprise number, company name, address, directors, annual revenue, employees.`
  },

  AT: {
    code: 'AT',
    name: 'Austria',
    language: 'de',
    region: 'EU',
    currency: 'EUR',
    timezone: 'Europe/Vienna',
    registryType: 'Firmenbuch',
    registryUrl: 'https://www.firmenbuch.at',
    registryDomain: 'firmenbuch.at',
    euMember: true,
    bridgeCompatible: true,
    registrySystemPrompt: `You are searching for company information in Austria (Firmenbuch).
Primary source: firmenbuch.at - Austrian commercial registry.
Extract: FN (Firmennummer), company name, address, Geschäftsführer, annual revenue, employees.
If information is in German, translate to English.`
  },

  CH: {
    code: 'CH',
    name: 'Switzerland',
    language: 'de',
    region: 'Europe',
    currency: 'CHF',
    timezone: 'Europe/Zurich',
    registryType: 'Handelsregister',
    registryUrl: 'https://www.shab.ch',
    registryDomain: 'shab.ch',
    euMember: false,
    bridgeCompatible: false,
    registrySystemPrompt: `You are searching for company information in Switzerland (Handelsregister).
Primary source: shab.ch - Swiss trade register.
Extract: UID (Unternehmens-Identifikationsnummer), company name, address, CEO, annual revenue, employees.
If information is in German/French/Italian, translate to English.`
  },

  US: {
    code: 'US',
    name: 'United States',
    language: 'en',
    region: 'North America',
    currency: 'USD',
    timezone: 'America/New_York',
    registryType: 'SEC / State Corporate Filings',
    registryUrl: 'https://www.sec.gov',
    registryDomain: 'sec.gov',
    euMember: false,
    bridgeCompatible: false,
    registrySystemPrompt: `You are searching for company information in the United States.
Primary sources: sec.gov (for public companies), state corporate filing databases.
Extract: CIK number, stock ticker, company name, headquarters address, CEO, annual revenue, employees.`
  }
};

export const COUNTRY_CODES = Object.keys(COUNTRIES);

export function getCountryConfig(code: string): CountryConfig | undefined {
  return COUNTRIES[code.toUpperCase()];
}

export function getCountriesByRegion(region: string): CountryConfig[] {
  return Object.values(COUNTRIES).filter(c => c.region === region);
}

export function getEUICountries(): CountryConfig[] {
  return Object.values(COUNTRIES).filter(c => c.euMember);
}

export function getCountriesByLanguage(language: string): CountryConfig[] {
  return Object.values(COUNTRIES).filter(c => c.language === language);
}

/**
 * BRIS Configuration (Business Register Interconnection System)
 * EU-wide company information sharing
 */
export interface BRISConfig {
  enabled: boolean;
  portal: string;
  countries: string[];
}

export const BRIS_CONFIG: BRISConfig = {
  enabled: true,
  portal: 'https://e-justice.europa.eu/content_find_a_company-500-en.do',
  countries: ['DK', 'FI', 'DE', 'FR', 'NL', 'BE', 'AT', 'SE']
};

export function shouldUseBRIS(countryCode: string): boolean {
  const country = getCountryConfig(countryCode);
  return country ? country.euMember && BRIS_CONFIG.countries.includes(countryCode) : false;
}
