export type Language = 'sv' | 'en' | 'de';

export const LANGUAGE_LABELS: Record<Language, string> = {
  'sv': '🇸🇪 Swedish',
  'en': '🇬🇧 English',
  'de': '🇩🇪 Deutsch'
};

export interface Translations {
  [key: string]: Record<Language, string>;
}

export const UI_TRANSLATIONS: Translations = {
  // Header
  'tools': { sv: 'Verktyg', en: 'Tools', de: 'Werkzeuge' },
  'profile': { sv: 'Profil', en: 'Profile', de: 'Profil' },
  'logout': { sv: 'Logga ut', en: 'Logout', de: 'Abmelden' },
  
  // Market Intelligence
  'market_intelligence': { sv: 'Marknadsintelligens', en: 'Market Intelligence', de: 'Marktintelligenz' },
  'market_intelligence_desc': { sv: 'DMT, Svavel & Prisindex', en: 'DMT, Sulfur & Price Index', de: 'DMT, Schwefel & Preisindex' },
  'market_settings': { sv: 'Marknadsdata', en: 'Market Data', de: 'Marktdaten' },
  'carrier': { sv: 'Transportör', en: 'Carrier', de: 'Beförderer' },
  'market_share': { sv: 'Marknadsandel (%)', en: 'Market Share (%)', de: 'Marktanteil (%)' },
  'avg_price': { sv: 'Snittpris (SEK)', en: 'Avg Price (SEK)', de: 'Durchschnittspreis (SEK)' },
  'dmt': { sv: 'DMT (%)', en: 'DMT (%)', de: 'DMT (%)' },
  'other_charges': { sv: 'Övriga Tillägg (%)', en: 'Other Charges (%)', de: 'Sonstige Gebühren (%)' },
  'volume_locker': { sv: 'Volym Skåp (st)', en: 'Locker Volume (pcs)', de: 'Schließfachvolumen (Stk.)' },
  'volume_home': { sv: 'Volym Hem (st)', en: 'Home Volume (pcs)', de: 'Heimvolumen (Stk.)' },
  'save_market': { sv: 'Spara Marknadsdata', en: 'Save Market Data', de: 'Marktdaten speichern' },
  
  // SNI Settings
  'sni_settings': { sv: 'Fraktpotential per SNI', en: 'Freight Potential per SNI', de: 'Frachtpotenzial pro SNI' },
  'sni_code': { sv: 'SNI Kod', en: 'SNI Code', de: 'SNI-Code' },
  'percentage': { sv: 'Procent (%)', en: 'Percentage (%)', de: 'Prozentsatz (%)' },
  'add_setting': { sv: 'Uppdatera Inställning', en: 'Update Setting', de: 'Einstellung aktualisieren' },
  'save_settings': { sv: 'Spara inställningar', en: 'Save Settings', de: 'Einstellungen speichern' },
  
  // Mail Motor
  'mail_motor': { sv: 'Mailmotor & Mallar', en: 'Mail Motor & Templates', de: 'E-Mail-Motor & Vorlagen' },
  'calendar_link': { sv: 'Min Kalenderlänk', en: 'My Calendar Link', de: 'Mein Kalenderlink' },
  'dynamic_tags': { sv: 'Dynamiska Taggar', en: 'Dynamic Tags', de: 'Dynamische Tags' },
  'contact_first_name': { sv: 'Kontaktens förnamn', en: "Contact's First Name", de: 'Vorname des Kontakts' },
  'company_name': { sv: 'Företagets namn', en: 'Company Name', de: 'Unternehmensname' },
  'freight_budget': { sv: 'Fraktbudget (kr)', en: 'Freight Budget', de: 'Frachtbudget' },
  'strategic_gap': { sv: 'Strategiskt gap', en: 'Strategic Gap', de: 'Strategische Lücke' },
  'ecommerce_platform': { sv: 'E-handelssystem', en: 'E-commerce Platform', de: 'E-Commerce-Plattform' },
  'annual_packages': { sv: 'Årliga paket', en: 'Annual Packages', de: 'Jährliche Pakete' },
  'warehouse_city': { sv: 'Stad för lagret', en: 'Warehouse City', de: 'Lagerstadt' },
  'template_sv': { sv: 'Svenska', en: 'Swedish', de: 'Schwedisch' },
  'template_en': { sv: 'Engelska', en: 'English', de: 'Englisch' },
  'template_de': { sv: 'Tyska', en: 'German', de: 'Deutsch' },
  'generate': { sv: 'Generera ny mall med AI', en: 'Generate new template with AI', de: 'Neue Vorlage mit KI generieren' },
  'signature': { sv: 'Signatur', en: 'Signature', de: 'Unterschrift' },
  'main_template': { sv: 'Huvudmall', en: 'Main Template', de: 'Hauptvorlage' },
  
  // Search & General
  'search': { sv: 'Sök', en: 'Search', de: 'Suche' },
  'targeted_search': { sv: 'Riktad Sökning (SNI)', en: 'Targeted Search (SNI)', de: 'Gezielt Suche (SNI)' },
  'inclusions': { sv: 'Inkludera specifika segment', en: 'Include Specific Segments', de: 'Bestimmte Segmente einbinden' },
  'cancel': { sv: 'Avbryt', en: 'Cancel', de: 'Abbrechen' },
  'save': { sv: 'Spara', en: 'Save', de: 'Speichern' },
};

export function translate(key: string, lang: Language): string {
  return UI_TRANSLATIONS[key]?.[lang] || key;
}

export function getLanguageLabel(lang: Language): string {
  return LANGUAGE_LABELS[lang];
}
