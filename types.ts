/**
 * PERFORMILE TYPES DEFINITION (v25.1)
 * Intellectual Property of Rickard Wigrund
 */

export enum Segment {
  DM = 'DM',   // Direct Marketing (< 250k SEK)
  TS = 'TS',   // Telesales (250k - 750k SEK)
  FS = 'FS',   // Field Sales (750k - 5M SEK)
  KAM = 'KAM',  // Key Account Management (> 5M SEK)
  UNKNOWN = 'UNKNOWN'
}

export type RemovalReason = 
  | 'DUPLICATE' 
  | 'EXISTING_CUSTOMER' 
  | 'NOT_RELEVANT' 
  | 'ALREADY_DOWNLOADED' 
  | 'INCORRECT_DATA';

export interface CarrierSettings {
  name: string;
  marketShare: number;
  avgPrice: number;
  dmt: number;
  sulfur: number;
  volumeOmbud: number;
  volumeSkap: number;
  volumeHem: number;
}

export interface SearchFormData {
  companyNameOrOrg: string;
  geoArea: string;
  financialScope: string;
  triggers: string;
  leadCount: number;
  focusRole1: string;
  focusRole2: string;
  focusRole3: string;
  icebreakerTopic: string;
  specificPerson?: string;
}

export interface DecisionMaker {
  name: string;
  title: string;
  email: string;
  linkedin: string;
  directPhone?: string;
  verificationNote?: string;
}

export interface FinancialYear {
  year: string;
  revenue: string; 
  profit?: string; 
  revenueChange?: string; 
  ebitda?: string;
}

export interface CheckoutOption {
  position: number;
  carrier: string;
  service: string;
  price: string;
  inCheckout?: boolean; // false = fokuscarrier explicitly not found in checkout crawl
}

export interface NewsSourceMapping {
  id: string;
  sniPrefix: string;
  sources: string[];
}

export interface SourcePolicyConfig {
  financial: string[];
  addresses: string[];
  decisionMakers: string[];
  payment: string[];
  webSoftware: string[];
  news: string[];
  strictCompanyMatch?: boolean;
  earliestNewsYear?: number;
  customCategories?: Record<string, string[]>;
  categoryFieldMappings?: Record<string, string[]>;
  countrySourcePolicies?: Record<string, {
    financial?: string[];
    addresses?: string[];
    decisionMakers?: string[];
    payment?: string[];
    webSoftware?: string[];
    news?: string[];
    strictCompanyMatch?: boolean;
    earliestNewsYear?: number;
    customCategories?: Record<string, string[]>;
    categoryFieldMappings?: Record<string, string[]>;
  }>;
}

export type UserRole = 'admin' | 'user' | 'viewer';

export type InvitationStatus = 'activation-sent' | 'sign-in-link-sent' | 'accepted';

export interface UserInvitationRecord {
  email: string;
  fullName?: string;
  role: UserRole;
  userId?: string;
  invitedAt: string;
  lastSentAt: string;
  sentCount: number;
  status: InvitationStatus;
}

export interface ToolAccessConfig {
  userRoles: Record<string, UserRole>;
  roleToolAccess: Record<UserRole, string[]>;
  userEmails?: Record<string, string>;
  invitationHistory?: Record<string, UserInvitationRecord>;
}

export interface SourceCoverageEntry {
  category: string;
  field: string;
  source: string;
  url?: string;
  isPreferred: boolean;
}

export interface SourcePerformanceEntry {
  domain: string;
  goodHits: number;
  lastSeen: string;
}

export interface SNIPercentage {
  sniPrefix: string;
  percentage: number;
}

export interface ThreePLProvider {
  id: string;
  name: string;
  address: string;
}

/**
 * NEW: DeepScan Specific Types
 */
export interface DMTMatrixRow {
  segment: string;
  currentCost: number;
  targetCost: number;
  savingPercentage: number;
}

export interface FrictionAnalysis {
  companyClicks: number;
  benchmarkClicks: number;
  frictionNote: string;
}

export interface DataConfidence {
  financial: 'verified' | 'estimated' | 'missing';
  checkout: 'crawled' | 'estimated' | 'missing';
  contacts: 'verified' | 'estimated' | 'missing';
  addresses: 'verified' | 'estimated' | 'missing';
  emailPattern: 'found' | 'inferred' | 'missing';
}

export interface LeadFieldChange {
  field: string;
  label: string;
  previous: string;
  current: string;
  detectedAt: string;
}

export interface VerifiedRegistrySnapshot {
  sourceUrl?: string;
  sourceLabel?: string;
  orgNumber?: string;
  registeredAddress?: string;
  revenue?: string;
  profit?: string;
  capturedAt: string;
}

export interface LeadData {
  // Identitet
  id: string;
  companyName: string;
  orgNumber: string;
  domain?: string;
  websiteUrl: string;
  phoneNumber?: string;
  
  // Geografi & Adress
  address: string;
  visitingAddress?: string;
  warehouseAddress?: string;
  returnAddress?: string;
  
  // Klassificering & Segmentering
  segment: Segment;
  industry?: string;
  industryDescription?: string;
  sniCode?: string;
  businessModel?: 'Retailer' | 'PurePlayer' | 'Manufacturer' | string;
  
  // Finansiell Data (Mirror Mode)
  revenue: string; 
  revenueYear?: string;
  profit?: string;
  financialHistory?: FinancialYear[]; 
  solidity?: string;
  liquidityRatio?: string;
  profitMargin?: string;
  employeesCount?: number;
  debtBalance?: string;
  debtEquityRatio?: string;
  paymentRemarks?: string;
  isBankruptOrLiquidated?: boolean;
  financialSource?: string;
  legalStatus: string; 
  creditRatingLabel: string; 
  creditRatingMotivation?: string;
  riskProfile?: string;
  financialTrend?: string;
  hasRemarks?: boolean;
  vatRegistered?: boolean;
  
  // Logistik & Potential (Analyst Mode)
  potentialSek?: number;
  freightBudget: string;
  annualPackages?: number;
  pos1Volume?: number;
  pos2Volume?: number;
  estimatedAOV?: number;
  marketShareOfTotal?: string;
  conversionFactor?: number;
  activeMarkets?: string[];
  marketCount?: number;
  b2bPercentage?: number;
  b2cPercentage?: number;
  storeCount?: number;
  
  // Tech Stack (v25.1 DETECTIVE)
  ecommercePlatform?: string;
  paymentProvider?: string; // <--- PSP (Klarna, Adyen, etc.)
  checkoutSolution?: string;
  taSystem?: string;
  techEvidence?: string;
  carriers: string;
  checkoutOptions?: CheckoutOption[];
  
  // Operations & Metadata
  is3pl?: boolean;
  detected3plProvider?: string;
  latestNews?: string;
  strategicPitch?: string;
  analysisDate?: string;
  source?: 'ai' | 'cache' | 'manual';
  decisionMakers: DecisionMaker[];
  feedback?: 'positive' | 'negative' | null;

  // --- v25.1 SURGICAL DEEPSCAN DATA ---
  deepScanPerformed?: boolean;
  conversionScore?: number;
  recoveryPotentialSek?: string;
  frictionAnalysis?: FrictionAnalysis;
  dmtMatrix?: DMTMatrixRow[];

  // --- OPENROUTER & HALLUCINATION PREVENTION ---
  aiModel?: 'llama-3.1-70b' | 'gpt-4-turbo' | 'google-gemini-free' | 'gpt-3.5-turbo' | 'mistral-7b' | 'gemini-3-flash-preview';
  halluccinationScore?: number; // 0-100, higher = more unverified claims
  halluccinationAnalysis?: {
    verifiedFields?: string[];
    unverifiedFields?: string[];
    overallTrust?: 'high' | 'medium' | 'low';
    recommendations?: string[];
  };

  sourceCoverage?: SourceCoverageEntry[];

  // ── Anti-hallucination: per-field source confidence ──────────────────────
  emailPattern?: string;
  dataConfidence?: DataConfidence;
  verifiedRegistrySnapshot?: VerifiedRegistrySnapshot;

  // ── Change monitoring (bokslut/risk deltas between scans) ─────────────────
  changeHighlights?: LeadFieldChange[];
  hasMonitoredChanges?: boolean;
  lastMonitoredCheckAt?: string;
}