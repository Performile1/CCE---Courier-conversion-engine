
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import InputForm from './components/InputForm';
import LeadCard from './components/LeadCard'; 
import { ResultsTable } from './components/ResultsTable'; 
import { ExclusionManager } from './components/ExclusionManager';
import { InclusionManager } from './components/InclusionManager';
import { CacheManager } from './components/CacheManager';
import { BackupManager } from './components/BackupManager';
import { DailyBriefing } from './components/DailyBriefing';
import { ManualAddModal } from './components/ManualAddModal';
import { MailTemplateManager } from './components/MailTemplateManager';
import { DEFAULT_AVAILABLE_SYSTEMS, IntegrationManager } from './components/IntegrationManager';
import { NewsSourceManager } from './components/NewsSourceManager';
import { TechSolutionManager } from './components/TechSolutionManager';
import { SNISettingsManager } from './components/SNISettingsManager';
import { ThreePLManager } from './components/ThreePLManager';
import { CarrierSettingsManager, DEFAULT_CARRIER_SETTINGS } from './components/CarrierSettingsManager';
import { ProcessingStatusBanner } from './components/ProcessingStatusBanner';
import { RateLimitOverlay } from './components/RateLimitOverlay';
import { QuotaTimer } from './components/QuotaTimer';
import { OnboardingTour } from './components/OnboardingTour';
import { ModelSelector } from './components/ModelSelector';
import { CustomAPIConnectorBuilder } from './components/CustomAPIConnectorBuilder';
import { CustomIntegrationAdapter } from './components/CustomIntegrationAdapter';
import { CustomReportBuilder } from './components/CustomReportBuilder';
import { CampaignAnalytics } from './components/CampaignAnalytics';
import { CampaignPerformanceDashboard } from './components/CampaignPerformanceDashboard';
import { CostAnalysisDashboard } from './components/CostAnalysisDashboard';
import { CRMManager } from './components/CRMManager';
import { EmailCampaignBuilder } from './components/EmailCampaignBuilder';
import { EventTriggersComponent } from './components/EventTriggersComponent';
import { ExportManager } from './components/ExportManager';
import { HallucinationIndicator } from './components/HallucinationIndicator';
import { RemovalAnalysisModal } from './components/RemovalAnalysisModal';
import { ROICalculator } from './components/ROICalculator';
import { SlackManager } from './components/SlackManager';
import { WebhookSystemManager } from './components/WebhookSystemManager';
import Phase9IntegrationManager from './components/Phase9IntegrationManager';
import { LoginPage } from './components/LoginPage';
import { UserProfile } from './components/UserProfile';
import { PasswordReset } from './components/PasswordReset';
import { WelcomeLoadingScreen } from './components/WelcomeLoadingScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ShareLeadModal } from './components/ShareLeadModal';
import { ToolAccessManager } from './components/ToolAccessManager';
import { generateLeads, generateDeepDiveSequential } from './services/openrouterService'; 
import { mergeLeadData } from './services/lead/leadMappingService';
import { useCronFormState } from './context/useCronFormState';
import { loadRemoteCronJobs, saveRemoteCronJobs } from './services/scheduledJobsApi';
import { createBackupRecord, deleteBackupRecord, loadBackupRecords, loadSharedSettings, loadUserSettings, saveSharedSetting, saveUserSetting, SHARED_SETTING_KEYS, USER_SETTING_KEYS } from './services/appConfigService';
import { deletePersistedLead, loadPersistedLeads, loadSharedExclusions, replacePersistedLeads, replaceSharedExclusions, upsertPersistedLead } from './services/leadRepository';
import { signOut, supabase } from './services/supabaseClient';
import { buildAnalysisPolicyFromSourcePolicyConfig, buildBatchAnalysisPolicyFromSourcePolicyConfig, buildDeepDiveAnalysisPolicyFromSourcePolicyConfig, DEFAULT_ANALYSIS_CATEGORY_PAGE_HINTS, DEFAULT_ANALYSIS_TRUSTED_DOMAINS, DEFAULT_BATCH_ENRICHMENT_LIMIT } from './services/analysisPolicy';
import { DEFAULT_TECH_SOLUTION_CONFIG, normalizeTechSolutionConfig } from './services/techSolutionConfig';
import { CronJob, CronScheduleMode, getDueCronJobs, loadCronJobs, markCronJobExecuted, saveCronJobs } from './services/cronJobService';
import { ShieldAlert } from 'lucide-react';
import { Language, translate } from './services/i18n';
import { 
  SearchFormData, 
  SearchSubmitOptions,
  LeadData, 
  AnalysisStep,
  BatchLeadFilterDiagnostics,
  NewsSourceMapping, 
  SourcePolicyConfig,
  AnalysisPolicy,
  ToolAccessConfig,
  UserRole,
  IntegrationSystem,
  SNIPercentage, 
  TechSolutionConfig,
  ThreePLProvider, 
  RemovalReason,
  Segment,
  CarrierSettings
} from './types';
import { db } from './db/schema';
import * as XLSX from 'xlsx';

const DEFAULT_MAIL_TEMPLATE_SV = `Hej {fornamn},<br/><br/>Jag har gjort en analys av <strong>{foretag}</strong> och er nuvarande leveranspotential via vår motor för Strategic Analysis. Baserat på branschstandard estimerar vi er årliga fraktbudget till ca <strong>{potential}</strong>. Med den volymen ser jag en betydande uppsida genom att optimera er checkout-strategi tillsammans med oss på {active_carrier}.<br/><br/>Vår statistik visar att en strategisk förflyttning till <strong>Position 1</strong> i kassan i snitt ger ett <strong>konverteringslyft på 27%</strong>. Det beror på att upp till 60% av kunderna föredrar att butiken guidar dem till rätt val; de känner en trygghet i att ni har valt ut den bästa partnern åt dem.<br/><br/><strong>Smart värdehantering via plugins:</strong><br/>Vi har byggt in avancerad logik direkt i våra plugins för de stora plattformarna (Shopify, WooCommerce, Magento) som anpassar leveransvalen efter varukorgens värde. För premiumordrar aktiveras automatiskt utökad varuförsäkring och strikt legitimationskontroll för att skydda era marginaler.<br/><br/><strong>Flexibilitet och räckvidd:</strong><br/>{pitch}<br/><br/><strong>{active_carrier} mervärden för {foretag}:</strong><br/>- <strong>Paketskåp:</strong> Tillgång till Sveriges mest miljösmarta skåpnätverk (iBoxen).<br/>- <strong>Sömlös kundresa:</strong> Full transparens och enkla returer via QR-kod.<br/>- <strong>Total kontroll:</strong> En partner som hanterar allt från enstaka paket till globala Freight-sändningar.<br/><br/>Jag vill gärna presentera min fullständiga analys och diskutera hur vi kan höja ert Customer Lifetime Value.<br/><br/><div style="text-align: center; margin: 30px 0;"><a href="{kalender_lank}" style="background-color: #cc0000; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Boka tid i min kalender här</a></div>`;

const DEFAULT_MAIL_TEMPLATE_EN = `Hi {fornamn},<br/><br/>I have conducted an analysis of <strong>{foretag}</strong> and your current delivery potential via our Strategic Analysis engine. Based on industry standards, we estimate your annual shipping budget to be approximately <strong>{potential}</strong>. With that volume, I see a significant upside in optimizing your checkout strategy together with us at {active_carrier}.<br/><br/>Our statistics show that a strategic move to <strong>Position 1</strong> in the checkout yields an average <strong>conversion lift of 27%</strong>. This is because up to 60% of customers prefer the store to guide them to the right choice; they feel secure knowing you have selected the best partner for them.<br/><br/><strong>Smart value management via plugins:</strong><br/>We have built advanced logic directly into our plugins for major platforms (Shopify, WooCommerce, Magento) that adapts delivery choices based on cart value. For premium orders, extended cargo insurance and strict ID verification are automatically activated to protect your margins.<br/><br/><strong>Flexibility and reach:</strong><br/>{pitch}<br/><br/><strong>{active_carrier} value-adds for {foretag}:</strong><br/>- <strong>Parcel Lockers:</strong> Access to Sweden's most eco-smart locker network (iBoxen).<br/>- <strong>Seamless Customer Journey:</strong> Full transparency and easy returns via QR code.<br/>- <strong>Total Control:</strong> A partner that handles everything from individual parcels to global Freight shipments.<br/><br/>I would love to present my full analysis and discuss how we can increase your Customer Lifetime Value.<br/><br/><div style="text-align: center; margin: 30px 0;"><a href="{kalender_lank}" style="background-color: #cc0000; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Book a meeting in my calendar here</a></div>`;

const DEFAULT_CARRIERS = ['DHL', 'PostNord', 'Bring', 'Budbee', 'Instabox'];
const AUTO_DEEP_DIVE_COOLDOWN_MS = 3 * 60 * 1000;
const SEGMENT_OPTIONS = [Segment.DM, Segment.TS, Segment.FS, Segment.KAM];
const DEFAULT_NEWS_SOURCE_MAPPINGS: NewsSourceMapping[] = [
  {
    id: 'default-registry-sources',
    sniPrefix: '*',
    sources: ['allabolag.se', 'kreditrapporten.se', 'boolag.se', 'ratsit.se']
  },
  {
    id: 'default-commerce-news',
    sniPrefix: '47',
    sources: ['ehandel.se', 'market.se', 'breakit.se']
  }
];
const DEFAULT_SOURCE_POLICIES: SourcePolicyConfig = {
  financial: ['allabolag.se', 'ratsit.se', 'kreditrapporten.se', 'boolag.se', 'bolagsverket.se'],
  addresses: ['hitta.se', 'eniro.se', 'allabolag.se', 'ratsit.se', 'bolagsverket.se'],
  decisionMakers: ['linkedin.com'],
  payment: ['klarna.com', 'stripe.com', 'adyen.com'],
  webSoftware: ['shopify.com', 'woocommerce.com', 'norce.io', 'centra.com'],
  news: ['ehandel.se', 'market.se', 'breakit.se', 'bolagsverket.se'],
  trustedDomains: DEFAULT_ANALYSIS_TRUSTED_DOMAINS,
  categoryPageHints: DEFAULT_ANALYSIS_CATEGORY_PAGE_HINTS,
  batchEnrichmentLimit: DEFAULT_BATCH_ENRICHMENT_LIMIT,
  matchingStrategy: 'strict',
  minConfidenceThreshold: 0.65,
  strictCompanyMatch: true,
  earliestNewsYear: 2025,
  customCategories: {
    revenue: ['allabolag.se', 'ratsit.se', 'kreditrapporten.se'],
    profit: ['allabolag.se', 'ratsit.se', 'kreditrapporten.se'],
    solidity: ['allabolag.se', 'ratsit.se', 'bolagsverket.se'],
    liquidityRatio: ['allabolag.se', 'ratsit.se', 'bolagsverket.se'],
    omsattning: ['allabolag.se', 'ratsit.se', 'kreditrapporten.se'],
    resultat: ['allabolag.se', 'ratsit.se', 'kreditrapporten.se'],
    likviditet: ['allabolag.se', 'ratsit.se', 'bolagsverket.se'],
    riskstatus: ['allabolag.se', 'ratsit.se', 'kronofogden.se', 'bolagsverket.se'],
    status: ['allabolag.se', 'bolagsverket.se', 'ratsit.se'],
    betalningsanmarkning: ['ratsit.se', 'allabolag.se', 'kronofogden.se'],
    skuldsaldo: ['kronofogden.se', 'ratsit.se', 'allabolag.se'],
    skuldsattningsgrad: ['allabolag.se', 'ratsit.se'],
    plattform: ['shopify.com', 'woocommerce.com', 'norce.io', 'centra.com'],
    betalning: ['klarna.com', 'stripe.com', 'adyen.com', 'checkout.com'],
    checkout: ['klarna.com', 'stripe.com', 'adyen.com', 'checkout.com'],
    beslutsfattare: ['linkedin.com'],
    nyheter: ['ehandel.se', 'market.se', 'breakit.se', 'bolagsverket.se']
  },
  categoryFieldMappings: {
    financial: ['revenue', 'profit', 'solidity', 'liquidityRatio', 'creditRatingLabel'],
    revenue: ['revenue', 'revenueYear'],
    profit: ['profit', 'profitMargin'],
    solidity: ['solidity'],
    liquidityRatio: ['liquidityRatio'],
    omsattning: ['revenue', 'revenueYear', 'financialHistory'],
    resultat: ['profit', 'profitMargin', 'financialHistory'],
    likviditet: ['liquidityRatio'],
    riskstatus: ['legalStatus', 'paymentRemarks', 'debtBalance', 'debtEquityRatio', 'riskProfile', 'creditRatingLabel'],
    status: ['legalStatus'],
    betalningsanmarkning: ['paymentRemarks'],
    skuldsaldo: ['debtBalance'],
    skuldsattningsgrad: ['debtEquityRatio'],
    addresses: ['address', 'visitingAddress', 'warehouseAddress'],
    beslutsfattare: ['decisionMakers', 'emailPattern', 'dataConfidence.contacts'],
    decisionMakers: ['decisionMakers'],
    payment: ['paymentProvider', 'checkoutSolution', 'dataConfidence.payment'],
    betalning: ['paymentProvider', 'checkoutSolution', 'dataConfidence.payment'],
    checkout: ['checkoutOptions', 'carriers', 'conversionScore', 'frictionAnalysis', 'dmtMatrix', 'recoveryPotentialSek', 'dataConfidence.checkout'],
    webSoftware: ['ecommercePlatform', 'taSystem', 'techEvidence'],
    plattform: ['ecommercePlatform', 'techEvidence'],
    news: ['latestNews', 'sourceCoverage', 'dataConfidence.news'],
    nyheter: ['latestNews', 'sourceCoverage', 'dataConfidence.news', 'analysisDate']
  }
};
const DEFAULT_ROLE_TOOL_ACCESS: Record<UserRole, string[]> = {
  admin: [
    'carrierSettings', 'inclusions', 'cache', 'mailTemplate', 'sniSettings', 'exclusions', 'backups', 'threePL', 'newsSources',
    'techSolutions',
    'modelSelector', 'campaignAnalytics', 'campaignPerformance', 'costAnalysis', 'exportManager', 'customApi', 'customIntegration',
    'webhookManager', 'slackManager', 'crmManager', 'phase9', 'emailCampaign', 'eventTriggers', 'customReport', 'toolAccess', 'cronJobs',
    'leadTabOverview', 'leadTabAnalysis', 'leadTabDiagnostics', 'leadTabPricing', 'leadTabMail'
  ],
  user: [
    'inclusions', 'cache', 'mailTemplate', 'sniSettings', 'exclusions', 'threePL', 'newsSources', 'techSolutions', 'modelSelector',
    'campaignAnalytics', 'campaignPerformance', 'costAnalysis', 'exportManager', 'emailCampaign', 'customReport', 'cronJobs',
    'leadTabOverview', 'leadTabAnalysis', 'leadTabDiagnostics', 'leadTabPricing', 'leadTabMail'
  ],
  viewer: [
    'cache', 'newsSources', 'campaignPerformance', 'exportManager',
    'leadTabOverview', 'leadTabAnalysis', 'leadTabDiagnostics', 'leadTabPricing', 'leadTabMail'
  ]
};

const LEAD_TAB_TOOL_KEY_MAP = {
  overview: 'leadTabOverview',
  analysis: 'leadTabAnalysis',
  diagnostics: 'leadTabDiagnostics',
  pricing: 'leadTabPricing',
  mail: 'leadTabMail'
} as const;

type LeadCardTabId = keyof typeof LEAD_TAB_TOOL_KEY_MAP;

const LEAD_CARD_TAB_ORDER: LeadCardTabId[] = ['overview', 'analysis', 'diagnostics', 'pricing', 'mail'];
const LEAD_TAB_TOOL_KEYS = Object.values(LEAD_TAB_TOOL_KEY_MAP);

export const App: React.FC = () => {
  // Authentication state - MUST BE BEFORE ALL OTHER STATE
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ready' | 'session_only'>('loading');
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  
  // Language state
  const [appLanguage, setAppLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('dhl_app_language');
    return (saved as Language) || 'sv';
  });
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [activeCarrier, setActiveCarrier] = useState<string>('DHL');
  const [carriers, setCarriers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dhl_carriers');
      return saved ? JSON.parse(saved) : DEFAULT_CARRIERS;
    } catch (e) { return DEFAULT_CARRIERS; }
  });
  const [backups, setBackups] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [batchDiagnostics, setBatchDiagnostics] = useState<BatchLeadFilterDiagnostics | null>(null);

  const [showRateLimit, setShowRateLimit] = useState(false);
  const [quotaSeconds, setQuotaSeconds] = useState<number | null>(null);

  const [isExclusionOpen, setIsExclusionOpen] = useState(false);
  const [isInclusionOpen, setIsInclusionOpen] = useState(false);
  const [isCacheOpen, setIsCacheOpen] = useState(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [isBackupsOpen, setIsBackupsOpen] = useState(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [isMailTemplateOpen, setIsMailTemplateOpen] = useState(false);
  const [isIntegrationOpen, setIsIntegrationOpen] = useState(false);
  const [isNewsSourceOpen, setIsNewsSourceOpen] = useState(false);
  const [isTechSolutionsOpen, setIsTechSolutionsOpen] = useState(false);
  const [isSNISettingsOpen, setIsSNISettingsOpen] = useState(false);
  const [isThreePLOpen, setIsThreePLOpen] = useState(false);
  const [isCarrierSettingsOpen, setIsCarrierSettingsOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Additional component states
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isCustomAPIOpen, setIsCustomAPIOpen] = useState(false);
  const [isCustomIntegrationOpen, setIsCustomIntegrationOpen] = useState(false);
  const [isCustomReportOpen, setIsCustomReportOpen] = useState(false);
  const [isCampaignAnalyticsOpen, setIsCampaignAnalyticsOpen] = useState(false);
  const [isCampaignPerformanceOpen, setIsCampaignPerformanceOpen] = useState(false);
  const [isCostAnalysisOpen, setIsCostAnalysisOpen] = useState(false);
  const [isCRMManagerOpen, setIsCRMManagerOpen] = useState(false);
  const [isEmailCampaignBuilderOpen, setIsEmailCampaignBuilderOpen] = useState(false);
  const [isEventTriggersOpen, setIsEventTriggersOpen] = useState(false);
  const [isExportManagerOpen, setIsExportManagerOpen] = useState(false);
  const [isHallucinationIndicatorOpen, setIsHallucinationIndicatorOpen] = useState(false);
  const [isRemovalAnalysisOpen, setIsRemovalAnalysisOpen] = useState(false);
  const [isROICalculatorOpen, setIsROICalculatorOpen] = useState(false);
  const [isSlackManagerOpen, setIsSlackManagerOpen] = useState(false);
  const [isWebhookManagerOpen, setIsWebhookManagerOpen] = useState(false);
  const [isPhase9IntegrationOpen, setIsPhase9IntegrationOpen] = useState(false);
  const [isShareLeadOpen, setIsShareLeadOpen] = useState(false);
  const [isToolAccessOpen, setIsToolAccessOpen] = useState(false);
  const [isCronJobsOpen, setIsCronJobsOpen] = useState(false);
  const [selectedLeadForSharing, setSelectedLeadForSharing] = useState<LeadData | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>(() => loadCronJobs());
  const [useRemoteCronExecution, setUseRemoteCronExecution] = useState(false);
  const [cronSyncError, setCronSyncError] = useState<string | null>(null);

  // All cron form state (16 fields + helpers) lives in this headless hook.
  const cronForm = useCronFormState();
  const {
    cronName, setCronName,
    cronType, setCronType,
    cronScheduleMode, setCronScheduleMode,
    cronExpression, setCronExpression,
    cronRunHour, setCronRunHour,
    cronRunMinute, setCronRunMinute,
    cronWeekdaysOnly, setCronWeekdaysOnly,
    cronIntervalMinutes, setCronIntervalMinutes,
    cronCompany, setCronCompany,
    cronGeo, setCronGeo,
    cronFinancialScope, setCronFinancialScope,
    cronTriggers, setCronTriggers,
    cronLeadCount, setCronLeadCount,
    cronTargetSegments, setCronTargetSegments,
    cronReanalysisScope, setCronReanalysisScope,
    cronReanalysisLimit, setCronReanalysisLimit,
  } = cronForm;

  const [existingCustomers, setExistingCustomers] = useState<string[]>([]);
  const [downloadedLeads, setDownloadedLeads] = useState<string[]>([]);
  const [includedKeywords, setIncludedKeywords] = useState<string[]>([]);
  const [cacheData, setCacheData] = useState<LeadData[]>([]);
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [availableSystems, setAvailableSystems] = useState<IntegrationSystem[]>(DEFAULT_AVAILABLE_SYSTEMS);
  const [sniPercentages, setSNIPercentages] = useState<SNIPercentage[]>([]);
  const [threePLProviders, setThreePLProviders] = useState<ThreePLProvider[]>([]);
  const [marketSettings, setMarketSettings] = useState<CarrierSettings[]>(DEFAULT_CARRIER_SETTINGS);
  const [techSolutionConfig, setTechSolutionConfig] = useState<TechSolutionConfig>(DEFAULT_TECH_SOLUTION_CONFIG);
  const [newsSourceMappings, setNewsSourceMappings] = useState<NewsSourceMapping[]>(DEFAULT_NEWS_SOURCE_MAPPINGS);
  const [sourcePolicies, setSourcePolicies] = useState<SourcePolicyConfig>(DEFAULT_SOURCE_POLICIES);
  const [activeSourceCountry, setActiveSourceCountry] = useState<string>('global');
  const [toolAccessConfig, setToolAccessConfig] = useState<ToolAccessConfig>({ userRoles: {}, roleToolAccess: DEFAULT_ROLE_TOOL_ACCESS });

  const [mailTemplateSv, setMailTemplateSv] = useState(DEFAULT_MAIL_TEMPLATE_SV);
  const [mailTemplateEn, setMailTemplateEn] = useState(DEFAULT_MAIL_TEMPLATE_EN);
  const [mailSignature, setMailSignature] = useState('Med vänlig hälsning,<br/>Account Manager, {active_carrier}');
  const [calendarUrl, setCalendarUrl] = useState('');
  const [mailAttachments, setMailAttachments] = useState<string[]>([]);
  const [mailFocusWords, setMailFocusWords] = useState<string[]>(['Checkout-strategi', 'Paketskåp', 'Konverteringslyft', 'Last Mile']);

  const [deepDiveLead, setDeepDiveLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [analyzingCompany, setAnalyzingCompany] = useState<string | null>(null); 
  const [analysisSubStatus, setAnalysisSubStatus] = useState<string | null>(null);
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([]);
  const [analysisResult, setAnalysisResult] = useState<LeadData | null>(null);
  const abortControllerRef = useRef<boolean>(false);
  const activeAnalysisRunIdRef = useRef(0);
  const deepDiveCooldownRef = useRef<Record<string, number>>({});
  const cronExecutionRef = useRef<boolean>(false);
  const cronJobsHydratedRef = useRef(false);
  const settingsHydratedRef = useRef(false);
  const backupsHydratedRef = useRef(false);
  const [settingsInitializationStatus, setSettingsInitializationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const canPersistHydratedSettings = Boolean(user?.id && settingsInitializationStatus === 'success');

  const [demoDataTrigger, setDemoDataTrigger] = useState<{ type: 'single' | 'batch', timestamp: number } | null>(null);
  const [resetFormTrigger, setResetFormTrigger] = useState(0);

  const persistReservoirData = useCallback(async (nextCacheData: LeadData[]) => {
    setCacheData(nextCacheData);

    if (!user?.id) return;

    try {
      await replacePersistedLeads(user.id, nextCacheData, 'reservoir');
    } catch (persistError: any) {
      console.error('Could not persist reservoir leads:', persistError);
      setError(persistError?.message || 'Kunde inte spara reservoaren till Supabase.');
    }
  }, [user?.id]);

  const persistExclusionList = useCallback(async (type: 'customer' | 'history', list: string[]) => {
    const uniqueList = Array.from(new Set((list || []).map(v => String(v).trim()).filter(Boolean)));

    if (user?.id) {
      try {
        await replaceSharedExclusions(type, uniqueList, user.id);
      } catch (persistError: any) {
        console.error('Could not persist shared exclusions:', persistError);
        setError(persistError?.message || 'Kunde inte spara delade exkluderingar till Supabase.');
        return;
      }
    }

    if (type === 'customer') {
      setExistingCustomers(uniqueList);
      localStorage.setItem('dhl_existing_customers', JSON.stringify(uniqueList));
    } else {
      setDownloadedLeads(uniqueList);
      localStorage.setItem('dhl_downloaded_leads', JSON.stringify(uniqueList));
    }

    if (dbStatus !== 'ready') return;

    try {
      await db.exclusions.where('type').equals(type).delete();
      if (uniqueList.length > 0) {
        await db.exclusions.bulkPut(uniqueList.map(value => ({
          orgNumber: /\d{6}-?\d{4}|\d{10,12}|^SE\d+/i.test(value) ? value : '',
          companyName: /\d{6}-?\d{4}|\d{10,12}|^SE\d+/i.test(value) ? '' : value,
          type
        })));
      }
    } catch (e) {
      console.warn('Could not persist exclusions to DB:', e);
    }
  }, [dbStatus, user?.id]);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Handle email confirmation callback (hash parameters from email link)
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          // Supabase will automatically process the hash - just wait for session
          // The onAuthStateChange listener below will catch it
        }

        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        // Always set authLoading to false after initial check
        setAuthLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user || null;
      setUser(newUser);
      
      // Show welcome screen on successful login
      if (newUser && _event === 'SIGNED_IN') {
        setShowWelcomeScreen(true);
        // Auto-hide after 3 seconds
        const timer = setTimeout(() => {
          setShowWelcomeScreen(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
      setIsUserProfileOpen(false);
    } catch (err: any) {
      console.error('Logout failed:', err);
    }
  };

  const openShareLead = (lead: LeadData) => {
    setSelectedLeadForSharing(lead);
    setIsShareLeadOpen(true);
  };

  useEffect(() => { localStorage.setItem('dhl_app_language', appLanguage); }, [appLanguage]);
  useEffect(() => { saveCronJobs(cronJobs); }, [cronJobs]);

  useEffect(() => {
    if (!user?.id) {
      settingsHydratedRef.current = false;
      backupsHydratedRef.current = false;
      setSettingsInitializationStatus('idle');
      return;
    }

    let cancelled = false;

    const hydrateConfig = async () => {
      settingsHydratedRef.current = false;
      backupsHydratedRef.current = false;
      setSettingsInitializationStatus('loading');

      try {
        const [userSettings, sharedSettings, backupRecords] = await Promise.all([
          loadUserSettings(user.id, [USER_SETTING_KEYS.mailSettings, USER_SETTING_KEYS.selectedIntegrations]),
          loadSharedSettings([
            SHARED_SETTING_KEYS.sourceConfiguration,
            SHARED_SETTING_KEYS.toolAccessConfig,
            SHARED_SETTING_KEYS.availableSystems,
            SHARED_SETTING_KEYS.sniPercentages,
            SHARED_SETTING_KEYS.threePLProviders,
            SHARED_SETTING_KEYS.marketSettings,
            SHARED_SETTING_KEYS.activeCarrier,
            SHARED_SETTING_KEYS.techSolutions
          ]),
          loadBackupRecords(user.id)
        ]);

        if (cancelled) return;

        const mailSettings = userSettings[USER_SETTING_KEYS.mailSettings];
        if (mailSettings) {
          if (typeof mailSettings.templateSv === 'string') setMailTemplateSv(mailSettings.templateSv);
          if (typeof mailSettings.templateEn === 'string') setMailTemplateEn(mailSettings.templateEn);
          if (typeof mailSettings.signature === 'string') setMailSignature(mailSettings.signature);
          if (typeof mailSettings.calendarUrl === 'string') setCalendarUrl(mailSettings.calendarUrl);
          if (Array.isArray(mailSettings.attachments)) setMailAttachments(mailSettings.attachments);
          if (Array.isArray(mailSettings.focusWords)) setMailFocusWords(mailSettings.focusWords);
        }

        const selectedIntegrationsSetting = userSettings[USER_SETTING_KEYS.selectedIntegrations];
        if (Array.isArray(selectedIntegrationsSetting)) {
          setIntegrations(selectedIntegrationsSetting);
        }

        const sharedSourceConfig = sharedSettings[SHARED_SETTING_KEYS.sourceConfiguration];
        if (sharedSourceConfig) {
          if (Array.isArray(sharedSourceConfig.newsSourceMappings)) setNewsSourceMappings(sharedSourceConfig.newsSourceMappings);
          if (sharedSourceConfig.sourcePolicies) setSourcePolicies(sharedSourceConfig.sourcePolicies);
          if (typeof sharedSourceConfig.activeSourceCountry === 'string') setActiveSourceCountry(sharedSourceConfig.activeSourceCountry);
        }

        const sharedToolAccessConfig = sharedSettings[SHARED_SETTING_KEYS.toolAccessConfig];
        if (sharedToolAccessConfig) {
          setToolAccessConfig(sharedToolAccessConfig);
        }

        const sharedAvailableSystems = sharedSettings[SHARED_SETTING_KEYS.availableSystems];
        if (Array.isArray(sharedAvailableSystems)) {
          setAvailableSystems(sharedAvailableSystems);
        }

        const sharedSNIPercentages = sharedSettings[SHARED_SETTING_KEYS.sniPercentages];
        if (Array.isArray(sharedSNIPercentages)) {
          setSNIPercentages(sharedSNIPercentages);
        }

        const sharedThreePLProviders = sharedSettings[SHARED_SETTING_KEYS.threePLProviders];
        if (Array.isArray(sharedThreePLProviders)) {
          setThreePLProviders(sharedThreePLProviders);
        }

        const sharedMarketSettings = sharedSettings[SHARED_SETTING_KEYS.marketSettings];
        if (Array.isArray(sharedMarketSettings)) {
          setMarketSettings(sharedMarketSettings);
        }

        const sharedActiveCarrier = sharedSettings[SHARED_SETTING_KEYS.activeCarrier];
        if (typeof sharedActiveCarrier === 'string' && sharedActiveCarrier.trim()) {
          setActiveCarrier(sharedActiveCarrier);
        }

        const sharedTechSolutions = sharedSettings[SHARED_SETTING_KEYS.techSolutions];
        if (sharedTechSolutions) {
          setTechSolutionConfig(normalizeTechSolutionConfig(sharedTechSolutions));
        }

        setBackups(backupRecords);
      } catch (error) {
        if (!cancelled) {
          setSettingsInitializationStatus('error');
        }
        console.warn('Could not hydrate app config from Supabase:', error);
        return;
      }

      if (!cancelled) {
        settingsHydratedRef.current = true;
        backupsHydratedRef.current = true;
        setSettingsInitializationStatus('success');
      }

    };

    hydrateConfig();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!canPersistHydratedSettings) return;

    void saveUserSetting(user.id, USER_SETTING_KEYS.mailSettings, {
      templateSv: mailTemplateSv,
      templateEn: mailTemplateEn,
      signature: mailSignature,
      calendarUrl,
      attachments: mailAttachments,
      focusWords: mailFocusWords
    }).catch((error) => {
      console.warn('Could not persist mail settings:', error);
    });
  }, [calendarUrl, canPersistHydratedSettings, mailAttachments, mailFocusWords, mailSignature, mailTemplateEn, mailTemplateSv, user?.id]);

  useEffect(() => {
    if (!canPersistHydratedSettings) return;

    void saveUserSetting(user.id, USER_SETTING_KEYS.selectedIntegrations, integrations).catch((error) => {
      console.warn('Could not persist selected integrations:', error);
    });
  }, [canPersistHydratedSettings, integrations, user?.id]);

  useEffect(() => {
    if (!canPersistHydratedSettings) return;

    void saveSharedSetting(SHARED_SETTING_KEYS.sourceConfiguration, {
      newsSourceMappings,
      sourcePolicies,
      activeSourceCountry
    }, user.id).catch((error) => {
      console.warn('Could not persist shared source configuration:', error);
    });
  }, [activeSourceCountry, canPersistHydratedSettings, newsSourceMappings, sourcePolicies, user?.id]);

  useEffect(() => {
    if (!canPersistHydratedSettings) return;

    void saveSharedSetting(SHARED_SETTING_KEYS.toolAccessConfig, toolAccessConfig, user.id).catch((error) => {
      console.warn('Could not persist tool access config:', error);
    });
  }, [canPersistHydratedSettings, toolAccessConfig, user?.id]);

  useEffect(() => {
    if (!canPersistHydratedSettings) return;

    void saveSharedSetting(SHARED_SETTING_KEYS.availableSystems, availableSystems, user.id).catch((error) => {
      console.warn('Could not persist available systems:', error);
    });
  }, [availableSystems, canPersistHydratedSettings, user?.id]);

  useEffect(() => {
    if (!canPersistHydratedSettings) return;

    void saveSharedSetting(SHARED_SETTING_KEYS.sniPercentages, sniPercentages, user.id).catch((error) => {
      console.warn('Could not persist SNI percentages:', error);
    });
  }, [canPersistHydratedSettings, sniPercentages, user?.id]);

  useEffect(() => {
    if (!canPersistHydratedSettings) return;

    void saveSharedSetting(SHARED_SETTING_KEYS.threePLProviders, threePLProviders, user.id).catch((error) => {
      console.warn('Could not persist 3PL providers:', error);
    });
  }, [canPersistHydratedSettings, threePLProviders, user?.id]);

  useEffect(() => {
    if (!canPersistHydratedSettings) return;

    void saveSharedSetting(SHARED_SETTING_KEYS.marketSettings, marketSettings, user.id).catch((error) => {
      console.warn('Could not persist market settings:', error);
    });
  }, [canPersistHydratedSettings, marketSettings, user?.id]);

  useEffect(() => {
    if (!canPersistHydratedSettings) return;

    void saveSharedSetting(SHARED_SETTING_KEYS.activeCarrier, activeCarrier, user.id).catch((error) => {
      console.warn('Could not persist active carrier:', error);
    });
  }, [activeCarrier, canPersistHydratedSettings, user?.id]);

  useEffect(() => {
    if (!canPersistHydratedSettings) return;

    void saveSharedSetting(SHARED_SETTING_KEYS.techSolutions, techSolutionConfig, user.id).catch((error) => {
      console.warn('Could not persist tech solution config:', error);
    });
  }, [canPersistHydratedSettings, techSolutionConfig, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      cronJobsHydratedRef.current = false;
      setUseRemoteCronExecution(false);
      setCronSyncError(null);
      return;
    }

    let cancelled = false;

    const hydrateRemoteCronJobs = async () => {
      try {
        const remoteJobs = await loadRemoteCronJobs();
        if (cancelled) return;
        const localJobs = loadCronJobs();
        setCronJobs(remoteJobs.length === 0 && localJobs.length > 0 ? localJobs : remoteJobs);
        cronJobsHydratedRef.current = true;
        setUseRemoteCronExecution(true);
        setCronSyncError(null);
      } catch (error: any) {
        if (cancelled) return;
        cronJobsHydratedRef.current = true;
        setUseRemoteCronExecution(false);
        setCronSyncError(error?.message || 'Kunde inte synka cron-jobb mot backend');
      }
    };

    hydrateRemoteCronJobs();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !cronJobsHydratedRef.current) return;

    let cancelled = false;

    const persistRemoteCronJobs = async () => {
      try {
        const syncedJobs = await saveRemoteCronJobs(cronJobs);
        if (cancelled) return;
        setCronJobs((prev) => {
          const prevJson = JSON.stringify(prev);
          const nextJson = JSON.stringify(syncedJobs);
          return prevJson === nextJson ? prev : syncedJobs;
        });
        setUseRemoteCronExecution(true);
        setCronSyncError(null);
      } catch (error: any) {
        if (cancelled) return;
        setUseRemoteCronExecution(false);
        setCronSyncError(error?.message || 'Kunde inte spara cron-jobb till backend');
      }
    };

    persistRemoteCronJobs();

    return () => {
      cancelled = true;
    };
  }, [cronJobs, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const hasRole = !!toolAccessConfig.userRoles[user.id];
    const hasEmail = !!toolAccessConfig.userEmails?.[user.id];
    if (!hasRole || !hasEmail) {
      setToolAccessConfig(prev => ({
        ...prev,
        userRoles: {
          ...prev.userRoles,
          [user.id]: prev.userRoles[user.id] || (Object.keys(prev.userRoles).length === 0 ? 'admin' : 'user')
        },
        userEmails: {
          ...(prev.userEmails || {}),
          [user.id]: prev.userEmails?.[user.id] || user.email || ''
        }
      }));
    }
  }, [user?.id, user?.email, toolAccessConfig.userRoles, toolAccessConfig.userEmails]);

  useEffect(() => {
    const normalizedEmail = String(user?.email || '').trim().toLowerCase();
    if (!user?.id || !normalizedEmail) return;

    const invitation = toolAccessConfig.invitationHistory?.[normalizedEmail];
    if (!invitation) return;

    if (invitation.status !== 'accepted' || invitation.userId !== user.id) {
      setToolAccessConfig(prev => ({
        ...prev,
        invitationHistory: {
          ...(prev.invitationHistory || {}),
          [normalizedEmail]: {
            ...prev.invitationHistory?.[normalizedEmail],
            email: normalizedEmail,
            role: prev.invitationHistory?.[normalizedEmail]?.role || prev.userRoles[user.id] || 'user',
            userId: user.id,
            invitedAt: prev.invitationHistory?.[normalizedEmail]?.invitedAt || new Date().toISOString(),
            lastSentAt: prev.invitationHistory?.[normalizedEmail]?.lastSentAt || new Date().toISOString(),
            sentCount: prev.invitationHistory?.[normalizedEmail]?.sentCount || 1,
            status: 'accepted'
          }
        }
      }));
    }
  }, [user?.id, user?.email, toolAccessConfig.invitationHistory, toolAccessConfig.userRoles]);

  const currentUserRole: UserRole = user?.id ? (toolAccessConfig.userRoles[user.id] || 'user') : 'viewer';
  const roleTools = toolAccessConfig.roleToolAccess[currentUserRole] || [];
  // Migrate cronJobs into roles if missing from saved config
  useEffect(() => {
    if (roleTools.length > 0 && !roleTools.includes('cronJobs') && currentUserRole !== 'viewer') {
      setToolAccessConfig(prev => ({
        ...prev,
        roleToolAccess: {
          ...prev.roleToolAccess,
          [currentUserRole]: [...(prev.roleToolAccess[currentUserRole] || []), 'cronJobs']
        }
      }));
    }
  }, [currentUserRole, roleTools.length]);
  const visibleTools = roleTools.includes('cronJobs') ? roleTools : [...roleTools, 'cronJobs'];
  const hasConfiguredLeadTabRules = Object.values(toolAccessConfig.roleToolAccess).some((tools) =>
    tools.some((toolKey) => LEAD_TAB_TOOL_KEYS.includes(toolKey as typeof LEAD_TAB_TOOL_KEYS[number]))
  );
  const leadCardVisibleTabs: LeadCardTabId[] = hasConfiguredLeadTabRules
    ? LEAD_CARD_TAB_ORDER.filter((tabId) => roleTools.includes(LEAD_TAB_TOOL_KEY_MAP[tabId]))
    : LEAD_CARD_TAB_ORDER;

  const sortLeadsByAnalysisDate = useCallback((leadList: LeadData[]) => {
    return [...leadList].sort((a, b) => (b.analysisDate || '').localeCompare(a.analysisDate || ''));
  }, []);

  const syncLeadMirrorToDexie = useCallback(async (leadList: LeadData[]) => {
    if (dbStatus !== 'ready') return;

    try {
      await db.leads.clear();
      if (leadList.length > 0) {
        await db.leads.bulkPut(leadList);
      }
    } catch (mirrorError) {
      console.warn('Could not sync lead mirror to IndexedDB:', mirrorError);
    }
  }, [dbStatus]);

  const refreshData = useCallback(async (statusOverride?: string) => {
    const currentStatus = statusOverride || dbStatus;
    if (user?.id) {
      try {
        const [persistedLeads, persistedReservoir, sharedExclusions] = await Promise.all([
          loadPersistedLeads(user.id, 'active'),
          loadPersistedLeads(user.id, 'reservoir'),
          loadSharedExclusions()
        ]);
        setLeads(sortLeadsByAnalysisDate(persistedLeads));
        setCacheData(sortLeadsByAnalysisDate(persistedReservoir));
        setExistingCustomers(sharedExclusions.customer);
        setDownloadedLeads(sharedExclusions.history);
        if (currentStatus === 'ready') {
          await syncLeadMirrorToDexie(persistedLeads);
        }
      } catch (remoteError) {
        console.warn('Could not load leads from Supabase, falling back to IndexedDB:', remoteError);
        if (currentStatus === 'ready') {
          try {
            const allLeads = await db.leads.toArray();
            setLeads(sortLeadsByAnalysisDate(allLeads));
          } catch (localLeadError) {
            console.warn(localLeadError);
          }
        }
      }
    } else if (currentStatus === 'ready') {
      try {
        const allLeads = await db.leads.toArray();
        setLeads(sortLeadsByAnalysisDate(allLeads));
      } catch (leadError) {
        console.warn(leadError);
      }
    }

    if (currentStatus === 'ready') {
      try {
        const allExclusions = await db.exclusions.toArray();
        const existingFromDb = allExclusions
          .filter(e => e.type === 'customer')
          .map(e => e.orgNumber || e.companyName)
          .filter(Boolean);
        const historyFromDb = allExclusions
          .filter(e => e.type === 'history')
          .map(e => e.orgNumber || e.companyName)
          .filter(Boolean);

        setExistingCustomers(existingFromDb);
        setDownloadedLeads(historyFromDb);
        localStorage.setItem('dhl_existing_customers', JSON.stringify(existingFromDb));
        localStorage.setItem('dhl_downloaded_leads', JSON.stringify(historyFromDb));
      } catch (e) { console.warn(e); }
    }
    
    try {
        if (currentStatus !== 'ready') {
          const savedCustomers = localStorage.getItem('dhl_existing_customers');
          if (savedCustomers) setExistingCustomers(JSON.parse(savedCustomers));
          const savedHistory = localStorage.getItem('dhl_downloaded_leads');
          if (savedHistory) setDownloadedLeads(JSON.parse(savedHistory));
        }
        const savedKeywords = localStorage.getItem('dhl_included_keywords');
        if (savedKeywords) setIncludedKeywords(JSON.parse(savedKeywords));
    } catch (e) {}
  }, [dbStatus, sortLeadsByAnalysisDate, syncLeadMirrorToDexie, user?.id]);

  useEffect(() => {
    const initDb = async () => {
      try {
        if (!(db as any).isOpen()) await (db as any).open();
        setDbStatus('ready');
      } catch (err) {
        setDbStatus('session_only');
      }
    };
    initDb();
  }, []);

  useEffect(() => {
    if (authLoading || dbStatus === 'loading') return;
    void refreshData();
  }, [authLoading, dbStatus, refreshData, user?.id]);

  const normalizeCompanyName = (name: string) => {
    if (!name) return '';
    return name.toLowerCase()
      .replace(/\b(ab|aktiebolag|group|gruppen|nordic|sverige|sweden)\b/gi, '')
      .replace(/[^a-z0-9]/gi, '')
      .trim();
  };

  const monitoredFieldLabels: Record<string, string> = {
    revenue: 'Omsättning',
    profit: 'Resultat',
    debtBalance: 'Skuldsaldo (KFM)',
    paymentRemarks: 'Betalningsanmärkningar',
    debtEquityRatio: 'Skuldsättningsgrad',
    legalStatus: 'Status',
    solidity: 'Soliditet',
    liquidityRatio: 'Likviditet',
    creditRatingLabel: 'Kreditbetyg'
  };

  const normalizeMonitoredValue = (field: string, value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    if (['revenue', 'profit', 'debtBalance', 'debtEquityRatio', 'solidity', 'liquidityRatio'].includes(field)) {
      const cleaned = raw
        .toLowerCase()
        .replace(/tkr|msek|kr|sek|%/g, '')
        .replace(/\s/g, '')
        .replace(',', '.');
      const parsed = Number(cleaned.replace(/[^0-9.-]/g, ''));
      if (!Number.isNaN(parsed)) return String(parsed);
    }

    return raw.toLowerCase().replace(/\s+/g, ' ').trim();
  };

  const buildLeadChanges = (previous: LeadData, next: LeadData) => {
    const now = new Date().toISOString();
    return Object.keys(monitoredFieldLabels)
      .map((field) => {
        const before = normalizeMonitoredValue(field, (previous as any)[field]);
        const after = normalizeMonitoredValue(field, (next as any)[field]);
        if (!before || !after || before === after) return null;
        return {
          field,
          label: monitoredFieldLabels[field],
          previous: String((previous as any)[field] ?? ''),
          current: String((next as any)[field] ?? ''),
          detectedAt: now
        };
      })
      .filter(Boolean);
  };

  const getLeadIdentityKey = (lead: Partial<LeadData>) => {
    if (lead.id) return `id:${lead.id}`;
    if (lead.orgNumber) return `org:${lead.orgNumber}`;
    return `name:${normalizeCompanyName(lead.companyName || '')}`;
  };

  const mergeMonitoredLead = (previous: LeadData, next: LeadData): LeadData => {
    // Use field-wise Truth Persistence merge instead of blanket spread.
    // Identity fields (id, orgNumber) and address are preserved from previous;
    // all other fields follow per-category merge rules in leadMappingService.
    const merged = mergeLeadData(previous, next);
    // Always keep original id and source — orchestrator responsibility.
    merged.id = previous.id || next.id;
    merged.source = previous.source || next.source;

    const detectedChanges = buildLeadChanges(previous, merged);
    merged.changeHighlights = detectedChanges;
    merged.hasMonitoredChanges = detectedChanges.length > 0;
    merged.lastMonitoredCheckAt = new Date().toISOString();

    return merged;
  };

  const handleUpdateLead = async (updatedLead: LeadData) => {
    if (!updatedLead) return; 

    let nextLead: LeadData | null = null;
    let matchedDeepDiveLead = false;

    setLeads(prev => {
      const normalizedNewName = normalizeCompanyName(updatedLead.companyName);
      const idx = prev.findIndex(l => 
        (updatedLead.id && l.id === updatedLead.id) || 
        (updatedLead.orgNumber && l.orgNumber === updatedLead.orgNumber && updatedLead.orgNumber !== '') ||
        (normalizeCompanyName(l.companyName) === normalizedNewName && normalizedNewName !== '')
      );

      let newList;
      if (idx > -1) {
        newList = [...prev];
        const existingLead = newList[idx];
        // Use field-wise Truth Persistence merge. mergeLeadData preserves
        // existingLead.id, existingLead.address, and all confidence-locked
        // fields; it does NOT perform a blanket spread.
        const finalLead = mergeLeadData(existingLead, updatedLead);
        // Safety: always keep the stored id (mergeLeadData never updates id,
        // but be explicit in case a temp id slipped through upstream).
        if (existingLead.id && !existingLead.id.startsWith('temp_')) {
          finalLead.id = existingLead.id;
        }

        const shouldMonitorChanges =
          finalLead.source === 'ai' ||
          (!!updatedLead.analysisDate && updatedLead.analysisDate !== existingLead.analysisDate);

        if (shouldMonitorChanges) {
          const detectedChanges = buildLeadChanges(existingLead, finalLead);
          if (detectedChanges.length > 0) {
            finalLead.changeHighlights = detectedChanges;
            finalLead.hasMonitoredChanges = true;
          }
          finalLead.lastMonitoredCheckAt = new Date().toISOString();
        }

        newList[idx] = finalLead;
        nextLead = finalLead;
      } else {
        const createdLead: LeadData = {
          ...updatedLead,
          id: !updatedLead.id || updatedLead.id.startsWith('temp_') ? crypto.randomUUID() : updatedLead.id,
          hasMonitoredChanges: false,
          lastMonitoredCheckAt: new Date().toISOString()
        };
        nextLead = createdLead;
        newList = [createdLead, ...prev];
      }

      matchedDeepDiveLead = !!deepDiveLead && (
        (nextLead?.id && deepDiveLead.id === nextLead.id) ||
        nextLead?.companyName === deepDiveLead.companyName
      );

      return sortLeadsByAnalysisDate(newList);
    });

    if (!nextLead) return;

    try {
      let persistedLead = nextLead;
      if (user?.id) {
        persistedLead = await upsertPersistedLead(user.id, nextLead, nextLead.id, 'active');
      }

      if (dbStatus === 'ready') {
        await db.leads.put(persistedLead);
      }

      setLeads(prev => sortLeadsByAnalysisDate(prev.map((lead) => {
        const isSameLead =
          lead.id === nextLead?.id ||
          (!!persistedLead.orgNumber && lead.orgNumber === persistedLead.orgNumber) ||
          normalizeCompanyName(lead.companyName) === normalizeCompanyName(persistedLead.companyName);
        return isSameLead ? persistedLead : lead;
      })));

      if (matchedDeepDiveLead) {
        setDeepDiveLead(prev => prev ? { ...prev, ...persistedLead } : persistedLead);
      }
    } catch (persistError: any) {
      console.error('Could not persist lead:', persistError);
      setError(persistError?.message || 'Kunde inte spara lead till Supabase. Laddar om senaste serverdata.');
      await refreshData();
    }
  };

  const handleDeleteLead = async (id: string, reason?: string) => {
    if (reason) {
      console.log(`Lead ${id} deleted with reason: ${reason}`);
      // In a real app, we might save this to a 'deleted_leads_stats' table
    }
    setLeads(prev => prev.filter(l => l.id !== id));
    if (deepDiveLead?.id === id) setDeepDiveLead(null);
    try {
      if (user?.id) {
        await deletePersistedLead(user.id, id);
      }
      if (dbStatus === 'ready') await db.leads.delete(id);
    } catch (deleteError: any) {
      console.error('Could not delete lead:', deleteError);
      setError(deleteError?.message || 'Kunde inte radera lead i Supabase. Laddar om senaste serverdata.');
      await refreshData();
    }
  };

  const handleDownloadLeads = (leadsToDownload: LeadData[]) => {
    if (leadsToDownload.length === 0) return;

    const exportData = leadsToDownload.map(lead => {
      const checkoutSummary = lead.checkoutOptions?.map(opt => `${opt.position}: ${opt.carrier} (${opt.service}) - ${opt.price}`).join(' | ') || '';
      
      const row: any = {
        'Företagsnamn': lead.companyName,
        'Organisationsnummer': lead.orgNumber,
        'Telefon (Växel)': lead.phoneNumber || '',
        'Domän': lead.domain,
        'SNI-kod': lead.sniCode,
        'Bransch': lead.industry,
        'Adress': lead.address,
        'Besöksadress': lead.visitingAddress || '',
        'Lageradress': lead.warehouseAddress || '',
        'Returadress': lead.returnAddress || '',
        'Segment (Fraktpotential)': lead.segment,
        'Omsättning': lead.revenue,
        'Omsättningsår': lead.revenueYear || '',
        'Resultat': lead.profit || '',
        'Soliditet': lead.solidity || '',
        'Likviditet': lead.liquidityRatio || '',
        'Vinstmarginal': lead.profitMargin || '',
        'Antal anställda': lead.employeesCount || '',
        'Skuldsaldo (KFM)': lead.debtBalance || '',
        'Skuldsättningsgrad': lead.debtEquityRatio || '',
        'Betalningsanmärkningar': lead.paymentRemarks || '',
        'Juridisk Status': lead.legalStatus || '',
        'Kreditvärdighet': lead.creditRatingLabel || '',
        'Total Fraktpotential (SEK)': lead.potentialSek,
        'Fingervisning Pos 1 (60%) Volym': lead.pos1Volume,
        'Fingervisning Pos 2 (22%) Volym': lead.pos2Volume,
        'Årliga Paket (Totalt)': lead.annualPackages,
        'E-handelsplattform': lead.ecommercePlatform,
        'Betallösning (PSP)': lead.paymentProvider || '',
        'Checkout-lösning': lead.checkoutSolution || '',
        'TA-system': lead.taSystem || '',
        'Tekniska bevis': lead.techEvidence || '',
        'Affärsmodell': lead.businessModel || '',
        'Antal butiker': lead.storeCount ?? '',
        'Antal marknader': lead.marketCount ?? '',
        'Aktiva marknader': lead.activeMarkets?.join(', ') || '',
        'B2B %': lead.b2bPercentage ?? '',
        'B2C %': lead.b2cPercentage ?? '',
        'Transportörer i kassan': lead.carriers,
        'Checkout-placeringar': checkoutSummary,
        '3PL': lead.is3pl ? `Ja (${lead.detected3plProvider || 'Identifierad'})` : 'Nej',
        'Senaste Nyheter/Triggers': lead.latestNews || '',
        'Branschbeskrivning': lead.industryDescription || '',
        'Kreditmotivering': lead.creditRatingMotivation || '',
        'Riskprofil': lead.riskProfile || '',
        'Finansiell Trend': lead.financialTrend || '',
        'Momsregistrerad': lead.vatRegistered ? 'Ja' : 'Nej',
        'Snittorder-värde (AOV)': lead.estimatedAOV || 0,
        'Marknadsandel': lead.marketShareOfTotal || '',
        'Konverteringsfaktor': lead.conversionFactor || 0,
        'Recovery Potential (SEK)': lead.recoveryPotentialSek || '',
        'Conversion Score': lead.conversionScore || 0,
        'Friktionsanalys': lead.frictionAnalysis?.frictionNote || '',
        'Strategisk Pitch': lead.strategicPitch,
        'Analysdatum': lead.analysisDate,
      };

      for (let i = 0; i < 3; i++) {
        const dm = lead.decisionMakers?.[i];
        const num = i + 1;
        row[`Kontakt ${num} Namn`] = dm?.name || '';
        row[`Kontakt ${num} Titel`] = dm?.title || '';
        row[`Kontakt ${num} E-post`] = dm?.email || '';
        row[`Kontakt ${num} LinkedIn`] = dm?.linkedin || '';
        row[`Kontakt ${num} Direktnummer`] = dm?.directPhone || '';
      }

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    
    const fileName = leadsToDownload.length === 1 
      ? `${activeCarrier}_Lead_${leadsToDownload[0].companyName.replace(/\s+/g, '_')}.csv`
      : `${activeCarrier}_Leads_Batch_${new Date().toISOString().slice(0, 10)}.csv`;
      
    XLSX.writeFile(wb, fileName, { bookType: 'csv' });

    const newExclusions = leadsToDownload.map(l => l.companyName);
    const updatedDownloadedLeads = Array.from(new Set([...downloadedLeads, ...newExclusions]));
    void persistExclusionList('history', updatedDownloadedLeads);

    if (deepDiveLead && leadsToDownload.some(l => l.id === deepDiveLead.id)) {
      setDeepDiveLead(null);
    }
  };

  const handleRemoveWithReason = async (leadsToRemove: LeadData[], reason: RemovalReason) => {
    const ids = leadsToRemove.map(l => l.id);
    const names = leadsToRemove.map(l => l.companyName);
    const orgs = leadsToRemove.map(l => l.orgNumber).filter(Boolean);
    
    if (reason === 'DUPLICATE') {
      setLeads(prev => prev.filter(l => !ids.includes(l.id)));
      try {
        if (user?.id) {
          await Promise.all(ids.map((leadId) => deletePersistedLead(user.id, leadId)));
        }
        if (dbStatus === 'ready') {
          for (const id of ids) await db.leads.delete(id);
        }
      } catch (deleteError: any) {
        console.error('Could not remove duplicate leads:', deleteError);
        setError(deleteError?.message || 'Kunde inte radera dubbletter i Supabase. Laddar om senaste serverdata.');
        await refreshData();
        return;
      }
      if (deepDiveLead && ids.includes(deepDiveLead.id)) setDeepDiveLead(null);
      return;
    }

    if (reason === 'EXISTING_CUSTOMER') {
      const newList = Array.from(new Set([...existingCustomers, ...names, ...orgs]));
      await persistExclusionList('customer', newList);
    } else if (reason === 'ALREADY_DOWNLOADED' || reason === 'NOT_RELEVANT' || reason === 'INCORRECT_DATA') {
      const newList = Array.from(new Set([...downloadedLeads, ...names, ...orgs]));
      await persistExclusionList('history', newList);
    }

    if (deepDiveLead && ids.includes(deepDiveLead.id)) setDeepDiveLead(null);
  };

  const getLeadCooldownKey = (lead: LeadData) => {
    return String(lead.orgNumber || lead.companyName || '').trim().toLowerCase();
  };

  const hasThinLeadData = (lead: LeadData) => {
    const hasDecisionMaker = Array.isArray(lead.decisionMakers) && lead.decisionMakers.length > 0;
    const hasRevenue = !!lead.revenue && lead.revenue !== 'Analyserar...' && lead.revenue !== 'Ej tillganglig';
    const hasWebsite = !!lead.websiteUrl;
    const hasAnalysisStamp = !!lead.analysisDate;
    return !(hasDecisionMaker && hasRevenue && hasWebsite && hasAnalysisStamp);
  };

  const handleCancelProcessing = () => {
    abortControllerRef.current = true;
    activeAnalysisRunIdRef.current += 1;
    setLoading(false);
    setDeepDiveLoading(false);
    setAnalyzingCompany(null);
    setAnalysisSubStatus('Avbruten av användare');
    setAnalysisSteps([]);
  };

  const clearCompletedAnalysisBanner = () => {
    // Ensure late async updates from a finished run cannot mutate UI state again.
    abortControllerRef.current = true;
    activeAnalysisRunIdRef.current += 1;
    setLoading(false);
    setDeepDiveLoading(false);
    setAnalyzingCompany(null);
    setAnalysisSubStatus(null);
    setAnalysisResult(null);
  };

  const openCompletedAnalysisResult = () => {
    if (!analysisResult) return;
    const finalResult = analysisResult;
    clearCompletedAnalysisBanner();
    setDeepDiveLead(finalResult);
    setAnalysisSteps(finalResult.analysisSteps || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectLead = (lead: LeadData) => {
    setDeepDiveLead(lead);
    setAnalysisResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Open immediately, then enrich in the background if the lead looks under-analyzed.
    const cooldownKey = getLeadCooldownKey(lead);
    const now = Date.now();
    const inCooldown = cooldownKey && now - (deepDiveCooldownRef.current[cooldownKey] || 0) < AUTO_DEEP_DIVE_COOLDOWN_MS;

    const shouldAutoDeepDive =
      hasThinLeadData(lead) &&
      !inCooldown &&
      !deepDiveLoading &&
      analyzingCompany !== lead.companyName;

    if (shouldAutoDeepDive) {
      const query = lead.orgNumber?.trim() || lead.companyName;
      if (cooldownKey) {
        deepDiveCooldownRef.current[cooldownKey] = now;
      }
      void handleDeepDive(query, true);
    }
  };

  const handleWait = (s: number, type: 'rate' | 'quota') => {
    if (type === 'quota') {
      setQuotaSeconds(s);
    } else {
      setShowRateLimit(true);
    }
    setAnalysisSubStatus(type === 'quota' ? `Kvotslut (${s}s)` : `Rate limit (${s}s)`);
  };

  const getResolvedCronExpression = () => cronForm.resolvedCronExpression;

  const toggleCronSegment = (segment: Segment) => cronForm.toggleCronSegment(segment);

  const runScheduledLeadReanalysis = async (job: CronJob) => {
    const deepDiveAnalysisPolicy: AnalysisPolicy = buildDeepDiveAnalysisPolicyFromSourcePolicyConfig(sourcePolicies, activeSourceCountry);
    const targetSegments = job.payload.targetSegments || [];
    const reanalysisScope = job.payload.reanalysisScope || 'active';
    const reanalysisLimit = Math.max(1, Number(job.payload.reanalysisLimit || 10));
    const candidatesByKey = new Map<string, { lead: LeadData; active: boolean; cached: boolean }>();

    const registerCandidate = (lead: LeadData, active: boolean, cached: boolean) => {
      const key = getLeadIdentityKey(lead);
      const existing = candidatesByKey.get(key);
      if (existing) {
        candidatesByKey.set(key, {
          lead: existing.lead,
          active: existing.active || active,
          cached: existing.cached || cached
        });
        return;
      }
      candidatesByKey.set(key, { lead, active, cached });
    };

    if (reanalysisScope === 'active' || reanalysisScope === 'both') {
      leads.forEach((lead) => registerCandidate(lead, true, false));
    }

    if (reanalysisScope === 'cache' || reanalysisScope === 'both') {
      cacheData.forEach((lead) => registerCandidate(lead, false, true));
    }

    const candidates = Array.from(candidatesByKey.values())
      .filter(({ lead }) => !targetSegments.length || targetSegments.includes(lead.segment))
      .sort((a, b) => {
        const aDate = new Date(a.lead.lastMonitoredCheckAt || a.lead.analysisDate || 0).getTime();
        const bDate = new Date(b.lead.lastMonitoredCheckAt || b.lead.analysisDate || 0).getTime();
        return aDate - bDate;
      })
      .slice(0, reanalysisLimit);

    for (const candidate of candidates) {
      setAnalysisSubStatus(`Schemalagd återanalys: ${candidate.lead.companyName}`);
      const refreshed = await generateDeepDiveSequential(
        {
          companyNameOrOrg: candidate.lead.orgNumber || candidate.lead.companyName,
          geoArea: '',
          financialScope: '',
          triggers: '',
          leadCount: 1,
          focusRole1: 'VD',
          focusRole2: 'Logistikchef',
          focusRole3: 'E-handelschef',
          icebreakerTopic: 'Leveransoptimering'
        },
        () => {},
        handleWait,
        newsSourceMappings,
        sniPercentages,
        integrations,
        activeCarrier,
        threePLProviders,
        undefined,
        sourcePolicies,
        activeSourceCountry,
        techSolutionConfig,
        deepDiveAnalysisPolicy,
        marketSettings
      );

      const mergedLead = mergeMonitoredLead(candidate.lead, { ...refreshed, id: candidate.lead.id });

      if (candidate.active) {
        await handleUpdateLead(mergedLead);
      }

      if (candidate.cached) {
        const nextReservoir = cacheData.map((lead) => getLeadIdentityKey(lead) === getLeadIdentityKey(candidate.lead) ? mergedLead : lead);
        await persistReservoirData(nextReservoir);
      }
    }
  };

  const handleSearch = async (formData: SearchFormData, options?: SearchSubmitOptions) => {
    const runId = Date.now();
    const batchAnalysisPolicy: AnalysisPolicy = buildBatchAnalysisPolicyFromSourcePolicyConfig(sourcePolicies, activeSourceCountry);
    const bypassExclusionsOnce = Boolean(options?.bypassExclusionsOnce);
    activeAnalysisRunIdRef.current = runId;
    setLoading(true); setError(null);
    setBatchDiagnostics(null);
    setAnalysisSteps([]);
    abortControllerRef.current = false;
    try {
      if (formData.companyNameOrOrg?.trim()) {
        // Enstaka sökning -> Kör alltid Deep Dive
        await handleDeepDive(formData.companyNameOrOrg);
      } else {
        // Batch sökning -> Kör generateLeads (QuickScan)
        const exclusionList = bypassExclusionsOnce ? [] : [...existingCustomers, ...downloadedLeads, ...leads.map(l => l.companyName)];
        let diagnosticsFromRun: BatchLeadFilterDiagnostics | null = null;
        const newLeads = await generateLeads(
          formData, 
          handleWait, 
          sniPercentages, 
          exclusionList, 
          activeCarrier, 
          threePLProviders,
          undefined,
          sourcePolicies,
          activeSourceCountry,
          techSolutionConfig,
          batchAnalysisPolicy,
          marketSettings,
          {
            bypassExclusions: bypassExclusionsOnce,
            includeUnknownSegmentWhenFiltering: true,
            onDiagnostics: (diagnostics) => {
              diagnosticsFromRun = diagnostics;
            }
          }
        );
        if (diagnosticsFromRun) {
          setBatchDiagnostics(diagnosticsFromRun);
        }

        if (newLeads.length === 0) {
          const diagnosticsMessage = diagnosticsFromRun
            ? `Kandidater: ${diagnosticsFromRun.rawCandidateCount}, exkluderade: ${diagnosticsFromRun.removedByExclusion}, segmentfiltrerade: ${diagnosticsFromRun.removedBySegment}, kvar: ${diagnosticsFromRun.finalCount}.`
            : 'Inga nya leads hittades för den valda orten/branschen. Prova att bredda sökningen.';
          setError(`Inga leads kvar efter filtrering. ${diagnosticsMessage}`);
        } else {
          for (const lead of newLeads) {
            if (abortControllerRef.current || activeAnalysisRunIdRef.current !== runId) break;
            await handleUpdateLead(lead);
          }
        }
      }
    } catch (err: any) { 
      if (abortControllerRef.current || activeAnalysisRunIdRef.current !== runId) {
        return;
      }
      const errorMsg = typeof err === 'string' ? err : (err?.message || String(err));
      setBatchDiagnostics(null);
      setError(errorMsg); 
    } finally { 
      if (activeAnalysisRunIdRef.current !== runId) return;
      setLoading(false); 
      setAnalysisSubStatus(null); 
    }
  };

  const handleDeepDive = async (companyName: string, forceRefresh = false) => {
    if (!companyName || deepDiveLoading) return;

    const runId = Date.now();
    const deepDiveAnalysisPolicy: AnalysisPolicy = buildDeepDiveAnalysisPolicyFromSourcePolicyConfig(sourcePolicies, activeSourceCountry);
    activeAnalysisRunIdRef.current = runId;
    
    setError(null); 
    abortControllerRef.current = false;
    setAnalyzingCompany(companyName);
    setDeepDiveLoading(true);
    setAnalysisResult(null);
    setAnalysisSteps([]);

    const shouldReplaceWithTempLead = !forceRefresh || !deepDiveLead;
    if (shouldReplaceWithTempLead) {
      const tempLead: LeadData = {
        id: `temp_${Date.now()}`,
        companyName: companyName,
        orgNumber: '',
        address: '',
        segment: Segment.UNKNOWN,
        revenue: 'Analyserar...',
        freightBudget: 'Väntar...',
        legalStatus: 'Väntar på data...',
        creditRatingLabel: '',
        decisionMakers: [],
        websiteUrl: '',
        carriers: '',
        analysisDate: '',
        analysisSteps: []
      };
      setDeepDiveLead(tempLead);
    }

    try {
      const final = await generateDeepDiveSequential(
        { companyNameOrOrg: companyName } as any, 
        (partial, status) => {
          if (abortControllerRef.current || activeAnalysisRunIdRef.current !== runId) return;
          if (status) setAnalysisSubStatus(status);
          if (partial.analysisSteps) setAnalysisSteps(partial.analysisSteps);
          setDeepDiveLead(prev => ({ ...prev, ...partial } as LeadData));
          if (partial.id) handleUpdateLead(partial as LeadData);
        },
        handleWait,
        newsSourceMappings,
        sniPercentages,
        integrations,
        activeCarrier,
        threePLProviders,
        undefined,
        sourcePolicies,
        activeSourceCountry,
        techSolutionConfig,
        deepDiveAnalysisPolicy,
        marketSettings
      );
      if (abortControllerRef.current || activeAnalysisRunIdRef.current !== runId) return;
      setAnalysisSteps(final.analysisSteps || []);
      setDeepDiveLead(final);
      setAnalysisResult(final);
      await handleUpdateLead(final);
    } catch (err: any) { 
      if (abortControllerRef.current || activeAnalysisRunIdRef.current !== runId) {
        return;
      }
      const errorMsg = typeof err === 'string' ? err : (err?.message || String(err));
      const msg = (errorMsg || "").toLowerCase();
      if (msg.includes('429') || msg.includes('quota')) {
        setError("Performile Shield: Rate limit. Systemet vilar 65s för att skydda din kvot.");
      } else {
        setError(errorMsg); 
      }
    } finally { 
      if (activeAnalysisRunIdRef.current !== runId) return;
      setDeepDiveLoading(false); 
      setAnalyzingCompany(null); 
      setAnalysisSubStatus(null); 
    }
  };

  const handleCarrierChange = (carrier: string) => {
    setActiveCarrier(carrier);
  };

  const handleAddCarrier = (newCarrier: string) => {
    if (!newCarrier.trim() || carriers.includes(newCarrier)) return;
    const updated = [...carriers, newCarrier];
    setCarriers(updated);
    localStorage.setItem('dhl_carriers', JSON.stringify(updated));
  };

  const handleSaveThreePL = (providers: ThreePLProvider[]) => {
    setThreePLProviders(providers);
  };

  const handleSaveIntegrationSettings = (nextIntegrations: string[], nextAvailableSystems: IntegrationSystem[]) => {
    setIntegrations(nextIntegrations);
    setAvailableSystems(nextAvailableSystems);
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const payload = (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') ? raw.data : raw;
      const leadsFromBackupsArray = Array.isArray(raw?.backups) ? raw.backups.flatMap((b: any) => (Array.isArray(b?.data?.leads) ? b.data.leads : [])) : [];
      const importedLeads = Array.isArray(payload?.leads) ? payload.leads : leadsFromBackupsArray;
      const importedReservoir = Array.isArray(payload?.cacheData) ? payload.cacheData : [];

      let persistedImportedLeads = Array.isArray(importedLeads)
        ? importedLeads.filter(Boolean).map((lead) => ({
            ...lead,
            id: lead.id || crypto.randomUUID()
          }))
        : [];

      if (user?.id && Array.isArray(importedLeads)) {
        persistedImportedLeads = await replacePersistedLeads(user.id, persistedImportedLeads, 'active');
      }

      if (Array.isArray(importedLeads)) {
        const sortedImportedLeads = sortLeadsByAnalysisDate(persistedImportedLeads);
        setLeads(sortedImportedLeads);
        await syncLeadMirrorToDexie(sortedImportedLeads);
      }

      if (Array.isArray(importedReservoir)) {
        const normalizedReservoir = importedReservoir.filter(Boolean).map((lead) => ({
          ...lead,
          id: lead.id || crypto.randomUUID()
        }));
        await persistReservoirData(sortLeadsByAnalysisDate(normalizedReservoir));
      }

      if (Array.isArray(payload?.existingCustomers)) await persistExclusionList('customer', payload.existingCustomers);
      if (Array.isArray(payload?.downloadedLeads)) await persistExclusionList('history', payload.downloadedLeads);
      if (payload?.includedKeywords) setIncludedKeywords(payload.includedKeywords);
      if (payload?.integrations) setIntegrations(payload.integrations);
      if (payload?.availableSystems) setAvailableSystems(payload.availableSystems);
      if (payload?.sniPercentages) setSNIPercentages(payload.sniPercentages);
      if (payload?.threePLProviders) setThreePLProviders(payload.threePLProviders);
      if (payload?.marketSettings) setMarketSettings(payload.marketSettings);
      if (payload?.newsSourceMappings) setNewsSourceMappings(payload.newsSourceMappings);
      if (payload?.sourcePolicies) setSourcePolicies(payload.sourcePolicies);
      if (payload?.activeSourceCountry) setActiveSourceCountry(payload.activeSourceCountry);
      if (payload?.cronJobs) setCronJobs(payload.cronJobs);
      if (payload?.mailTemplateSv) setMailTemplateSv(payload.mailTemplateSv);
      if (payload?.mailTemplateEn) setMailTemplateEn(payload.mailTemplateEn);
      if (payload?.mailSignature) setMailSignature(payload.mailSignature);
      if (payload?.calendarUrl) setCalendarUrl(payload.calendarUrl);
      if (payload?.activeCarrier) setActiveCarrier(payload.activeCarrier);
      if (payload?.carriers) setCarriers(payload.carriers);

      if (!Array.isArray(importedLeads) || importedLeads.length === 0) {
        alert("Backup laddades, men inga leads hittades i filen.");
      } else {
        alert(`Backup återställd! ${persistedImportedLeads.length} leads inlästa.`);
      }
    } catch (e) {
      alert("Kunde inte läsa backup-filen.");
    }
  };

  const handleCreateBackup = (name: string) => {
    const dataToSave = {
      leads,
      cacheData,
      existingCustomers,
      downloadedLeads,
      includedKeywords,
      integrations,
      availableSystems,
      sniPercentages,
      threePLProviders,
      marketSettings,
      newsSourceMappings,
      sourcePolicies,
      activeSourceCountry,
      cronJobs,
      mailTemplateSv,
      mailTemplateEn,
      mailSignature,
      calendarUrl,
      activeCarrier,
      carriers
    };
    const persistBackup = async () => {
      if (user?.id) {
        try {
          const newBackup = await createBackupRecord(user.id, name, dataToSave, leads.length);
          setBackups((prev) => [newBackup, ...prev]);
          return;
        } catch (error) {
          console.warn('Could not persist backup to Supabase:', error);
        }
      }

      const fallbackBackup = {
        id: crypto.randomUUID(),
        name,
        timestamp: new Date().toISOString(),
        leadCount: leads.length,
        data: dataToSave
      };
      const updated = [fallbackBackup, ...backups];
      setBackups(updated);
    };

    void persistBackup();
  };

  const handleRestoreBackup = async (backup: any) => {
    const d = backup.data;
    if (d.leads) {
      let restoredLeads = d.leads.map((lead: LeadData) => ({
        ...lead,
        id: lead.id || crypto.randomUUID()
      }));

      if (user?.id) {
        restoredLeads = await replacePersistedLeads(user.id, restoredLeads, 'active');
      }

      const sortedRestoredLeads = sortLeadsByAnalysisDate(restoredLeads);
      setLeads(sortedRestoredLeads);
      await syncLeadMirrorToDexie(sortedRestoredLeads);
    }

    if (Array.isArray(d.cacheData)) {
      const restoredReservoir = d.cacheData.map((lead: LeadData) => ({
        ...lead,
        id: lead.id || crypto.randomUUID()
      }));
      await persistReservoirData(sortLeadsByAnalysisDate(restoredReservoir));
    }

    if (Array.isArray(d.existingCustomers)) await persistExclusionList('customer', d.existingCustomers);
    if (Array.isArray(d.downloadedLeads)) await persistExclusionList('history', d.downloadedLeads);
    if (d.includedKeywords) setIncludedKeywords(d.includedKeywords);
    if (d.integrations) setIntegrations(d.integrations);
    if (d.availableSystems) setAvailableSystems(d.availableSystems);
    if (d.sniPercentages) setSNIPercentages(d.sniPercentages);
    if (d.threePLProviders) setThreePLProviders(d.threePLProviders);
    if (d.marketSettings) setMarketSettings(d.marketSettings);
    if (d.newsSourceMappings) setNewsSourceMappings(d.newsSourceMappings);
    if (d.sourcePolicies) setSourcePolicies(d.sourcePolicies);
    if (d.activeSourceCountry) setActiveSourceCountry(d.activeSourceCountry);
    if (d.cronJobs) setCronJobs(d.cronJobs);
    if (d.mailTemplateSv) setMailTemplateSv(d.mailTemplateSv);
    if (d.mailTemplateEn) setMailTemplateEn(d.mailTemplateEn);
    if (d.mailSignature) setMailSignature(d.mailSignature);
    if (d.calendarUrl) setCalendarUrl(d.calendarUrl);
    if (d.activeCarrier) setActiveCarrier(d.activeCarrier);
    if (d.carriers) setCarriers(d.carriers);
  };

  const handleDeleteBackup = (id: string) => {
    const removeBackup = async () => {
      const backupToDelete = backups.find((backup) => backup.id === id);
      if (user?.id && backupToDelete?.storagePath) {
        try {
          await deleteBackupRecord(id, backupToDelete.storagePath);
        } catch (error) {
          console.warn('Could not delete backup from Supabase:', error);
        }
      }

      const updated = backups.filter(b => b.id !== id);
      setBackups(updated);
    };

    void removeBackup();
  };

  const handleDownloadCurrentStatus = () => {
    const data = {
      leads,
      cacheData,
      existingCustomers,
      downloadedLeads,
      includedKeywords,
      integrations,
      availableSystems,
      sniPercentages,
      threePLProviders,
      marketSettings,
      newsSourceMappings,
      sourcePolicies,
      activeSourceCountry,
      cronJobs,
      mailTemplateSv,
      mailTemplateEn,
      mailSignature,
      calendarUrl,
      activeCarrier,
      carriers
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `System_Status_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleOpenTour = () => {
    setShowTour(true);
    setResetFormTrigger(prev => prev + 1);
    setDemoDataTrigger(null);
  };

  const handleDemoFill = (type: 'single' | 'batch') => {
    setDemoDataTrigger({ type, timestamp: Date.now() });
  };

  const handleSaveMarketSettings = (settings: CarrierSettings[]) => {
    setMarketSettings(settings);
  };

  const handleAddCronJob = () => {
    const job = cronForm.buildJobFromForm();
    if (!job) return;
    setCronJobs(prev => [job, ...prev]);
  };

  const toggleCronJob = (jobId: string) => {
    setCronJobs(prev => prev.map((job) =>
      job.id === jobId ? { ...job, enabled: !job.enabled, updatedAt: new Date().toISOString() } : job
    ));
  };

  const removeCronJob = (jobId: string) => {
    setCronJobs(prev => prev.filter((job) => job.id !== jobId));
  };

  useEffect(() => {
    const timer = setInterval(async () => {
      if (useRemoteCronExecution) return;
      if (cronExecutionRef.current || loading || deepDiveLoading) return;

      const due = getDueCronJobs(cronJobs, new Date());
      if (!due.length) return;

      cronExecutionRef.current = true;
      try {
        let updated = [...cronJobs];

        for (const job of due) {
          if (job.type === 'deep_dive') {
            const query = String(job.payload.companyNameOrOrg || '').trim();
            if (query) {
              await handleDeepDive(query, true);
            }
          } else if (job.type === 'lead_reanalysis') {
            await runScheduledLeadReanalysis(job);
          } else {
            await handleSearch({
              companyNameOrOrg: '',
              geoArea: String(job.payload.geoArea || 'Sverige'),
              financialScope: String(job.payload.financialScope || '10-100 MSEK'),
              triggers: String(job.payload.triggers || 'E-handel, logistik, expansion'),
              leadCount: Number(job.payload.leadCount || 20),
              focusRole1: String(job.payload.focusRole1 || 'VD'),
              focusRole2: String(job.payload.focusRole2 || 'Logistikchef'),
              focusRole3: String(job.payload.focusRole3 || 'E-handelschef'),
              icebreakerTopic: String(job.payload.icebreakerTopic || 'Leveransoptimering'),
              targetSegments: job.payload.targetSegments
            });
          }

          updated = updated.map((candidate) =>
            candidate.id === job.id ? markCronJobExecuted(candidate, new Date()) : candidate
          );
        }

        setCronJobs(updated);
      } catch (err) {
        console.error('Cron execution failed:', err);
      } finally {
        cronExecutionRef.current = false;
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [cronJobs, loading, deepDiveLoading, leads, cacheData, newsSourceMappings, sniPercentages, integrations, activeCarrier, threePLProviders, sourcePolicies, activeSourceCountry, techSolutionConfig, useRemoteCronExecution]);

  const resolvedCronExpression = cronForm.resolvedCronExpression;
  const isCronFormValid = cronForm.isCronFormValid;

  const describeCronJobType = (type: CronJob['type']) => cronForm.describeCronJobType(type);

  const parseCronLastError = (rawValue?: string) => cronForm.parseCronLastError(rawValue);

  const cronJobsWithMeta = cronJobs.map((job) => ({
    ...job,
    parsedLastError: parseCronLastError(job.lastError)
  }));

  const cronStatusCounts = cronJobsWithMeta.reduce((acc, job) => {
    if (job.lastStatus === 'success') acc.success += 1;
    else if (job.lastStatus === 'error') acc.error += 1;
    else if (job.lastStatus === 'running') acc.running += 1;
    else acc.idle += 1;
    return acc;
  }, { success: 0, error: 0, running: 0, idle: 0 });

  const latestCronJob = [...cronJobsWithMeta]
    .sort((a, b) => {
      const aTime = new Date(a.parsedLastError?.timestamp || a.lastRunAt || 0).getTime();
      const bTime = new Date(b.parsedLastError?.timestamp || b.lastRunAt || 0).getTime();
      return bTime - aTime;
    })[0];

  return (
    <>
      {/* Show loading or login based on auth state */}
      {authLoading && (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-400 to-gray-500">
          <div className="text-white text-center">
            <div className="text-4xl font-bold mb-4">Loading...</div>
          </div>
        </div>
      )}

      {!authLoading && !user && <LoginPage onAuthSuccess={() => setAuthLoading(false)} />}

      {!authLoading && user && (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <WelcomeScreen isVisible={showWelcomeScreen} userName={user?.email?.split('@')[0] || 'User'} />
      <Header 
        onOpenExclusions={() => setIsExclusionOpen(true)} 
        onOpenInclusions={() => setIsInclusionOpen(true)} 
        onOpenCache={() => setIsCacheOpen(true)} 
        onOpenBriefing={() => setIsBriefingOpen(true)} 
        onOpenBackups={() => setIsBackupsOpen(true)} 
        onOpenMailTemplate={() => setIsMailTemplateOpen(true)}
        onOpenIntegrations={() => setIsIntegrationOpen(true)}
        onOpenNewsSources={() => setIsNewsSourceOpen(true)}
        onOpenTechSolutions={() => setIsTechSolutionsOpen(true)}
        onOpenSNISettings={() => setIsSNISettingsOpen(true)}
        onOpenThreePL={() => setIsThreePLOpen(true)}
        onOpenCarrierSettings={() => setIsCarrierSettingsOpen(true)}
        onOpenModelSelector={() => setIsModelSelectorOpen(true)}
        onOpenCustomAPI={() => setIsCustomAPIOpen(true)}
        onOpenCustomIntegration={() => setIsCustomIntegrationOpen(true)}
        onOpenCustomReport={() => setIsCustomReportOpen(true)}
        onOpenCampaignAnalytics={() => setIsCampaignAnalyticsOpen(true)}
        onOpenCampaignPerformance={() => setIsCampaignPerformanceOpen(true)}
        onOpenCostAnalysis={() => setIsCostAnalysisOpen(true)}
        onOpenCRMManager={() => setIsCRMManagerOpen(true)}
        onOpenEmailCampaignBuilder={() => setIsEmailCampaignBuilderOpen(true)}
        onOpenEventTriggers={() => setIsEventTriggersOpen(true)}
        onOpenExportManager={() => setIsExportManagerOpen(true)}
        onOpenSlackManager={() => setIsSlackManagerOpen(true)}
        onOpenWebhookManager={() => setIsWebhookManagerOpen(true)}
        onOpenPhase9Integration={() => setIsPhase9IntegrationOpen(true)}
        onOpenCronJobs={() => setIsCronJobsOpen(true)}
        onOpenUserProfile={() => setIsUserProfileOpen(true)}
        onOpenToolAccess={() => setIsToolAccessOpen(true)}
        onLogout={handleLogout}
        inclusionCount={includedKeywords.length} 
        exclusionCount={existingCustomers.length + downloadedLeads.length} 
        cacheCount={cacheData.length} 
        protocolMode="deep" 
        setProtocolMode={() => {}} 
        onAddNewLead={() => setIsManualAddOpen(true)} 
        activeCarrier={activeCarrier}
        setActiveCarrier={handleCarrierChange}
        availableCarriers={carriers}
        onAddCarrier={handleAddCarrier}
        activeSourceCountry={activeSourceCountry}
        setActiveSourceCountry={setActiveSourceCountry}
        visibleTools={visibleTools}
        language={appLanguage}
        setLanguage={setAppLanguage}
      />
      
      <main className="max-w-[1920px] mx-auto px-4 py-6 flex-1 w-full">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 text-red-800 text-sm flex justify-between items-center animate-fadeIn shadow-sm">
             <div className="flex items-center gap-2">
               <ShieldAlert className="w-5 h-5 text-red-600" />
               <span><strong>Systemmeddelande:</strong> {error}</span>
             </div>
             <button onClick={() => setError(null)} className="text-red-900 font-bold px-2">X</button>
          </div>
        )}

        {batchDiagnostics && batchDiagnostics.finalCount === 0 && (
          <div className="mb-6 rounded-sm border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm animate-fadeIn">
            <div className="text-[11px] font-black uppercase tracking-wide text-amber-800">Batchdiagnostik: 0 resultat</div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="rounded-sm border border-amber-200 bg-white px-3 py-2">Kandidater från modell: <strong>{batchDiagnostics.rawCandidateCount}</strong></div>
              <div className="rounded-sm border border-amber-200 bg-white px-3 py-2">Validerade kandidater: <strong>{batchDiagnostics.objectCandidateCount}</strong></div>
              <div className="rounded-sm border border-amber-200 bg-white px-3 py-2">Borttagna av exkludering: <strong>{batchDiagnostics.removedByExclusion}</strong></div>
              <div className="rounded-sm border border-amber-200 bg-white px-3 py-2">Borttagna av segmentfilter: <strong>{batchDiagnostics.removedBySegment}</strong></div>
              <div className="rounded-sm border border-amber-200 bg-white px-3 py-2 md:col-span-2">Kvar efter filter: <strong>{batchDiagnostics.finalCount}</strong></div>
            </div>
            <div className="mt-2 text-[11px] text-amber-800">
              Exkludering: <strong>{batchDiagnostics.bypassedExclusions ? 'Bypassad för denna körning' : `Aktiv (${batchDiagnostics.exclusionCount} poster)`}</strong>
              {batchDiagnostics.targetSegments.length > 0 && (
                <span> • Segmentfilter: <strong>{batchDiagnostics.targetSegments.join(', ')}</strong> (UNKNOWN inkluderas: <strong>{batchDiagnostics.includesUnknownSegmentFallback ? 'Ja' : 'Nej'}</strong>)</span>
              )}
            </div>
          </div>
        )}

        {cronJobs.length > 0 && (
          <div className="mb-6 rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Driftstatus cron</div>
                <div className="mt-1 text-sm text-slate-700">
                  {useRemoteCronExecution ? 'Backend-scheduler aktiv' : 'Lokal scheduler aktiv'}
                  {latestCronJob?.name ? ` • Senast uppdaterad: ${latestCronJob.name}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
                <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">Jobb {cronJobs.length}</span>
                <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">Success {cronStatusCounts.success}</span>
                <span className="rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-red-700">Error {cronStatusCounts.error}</span>
                <span className="rounded-sm border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">Running {cronStatusCounts.running}</span>
              </div>
            </div>
            {(latestCronJob?.lastStatus || latestCronJob?.lastResultSummary || latestCronJob?.parsedLastError) && (
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {latestCronJob?.lastStatus && (
                    <span className={`rounded-sm border px-2 py-1 font-black uppercase ${latestCronJob.lastStatus === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : latestCronJob.lastStatus === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                      {latestCronJob.lastStatus}
                    </span>
                  )}
                  {latestCronJob?.lastResultSummary && <span>{latestCronJob.lastResultSummary}</span>}
                </div>
                {latestCronJob?.parsedLastError && (
                  <div className="truncate text-red-700 lg:max-w-[55%]">
                    {latestCronJob.parsedLastError.processingErrorCode ? `${latestCronJob.parsedLastError.processingErrorCode}: ` : ''}
                    {latestCronJob.parsedLastError.message}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-2 sticky top-24">
            <InputForm 
              onSubmit={handleSearch} 
              isLoading={loading || deepDiveLoading} 
              protocolMode="deep" 
              setProtocolMode={() => {}} 
              onOpenTour={handleOpenTour}
              demoDataTrigger={demoDataTrigger}
              resetTrigger={resetFormTrigger}
            />
          </div>
          <div className="xl:col-span-10 space-y-6 min-w-0">
             {showRateLimit && (
               <RateLimitOverlay onComplete={() => setShowRateLimit(false)} />
             )}
             {quotaSeconds !== null && (
               <QuotaTimer customWaitSeconds={quotaSeconds} onComplete={() => setQuotaSeconds(null)} />
             )}
             
             {deepDiveLead && (
               <div className="z-10 mb-6">
                 <LeadCard 
                   data={deepDiveLead} 
                   onUpdateLead={handleUpdateLead}
                   onDeleteLead={handleDeleteLead}
                   onRefreshAnalysis={handleDeepDive} 
                   onDownloadSingle={(lead) => handleDownloadLeads([lead])}
                   onOpenMailSettings={() => setIsMailTemplateOpen(true)}
                   onShareLead={openShareLead}
                   customTemplateSv={mailTemplateSv} 
                   customTemplateEn={mailTemplateEn} 
                   customSignature={mailSignature} 
                   calendarUrl={calendarUrl}
                   mailFocusWords={mailFocusWords}
                   activeIntegrations={integrations}
                   activeCarrier={activeCarrier}
                   marketSettings={marketSettings}
                   threePLProviders={threePLProviders}
                   onSaveThreePL={handleSaveThreePL}
                   visibleTabs={leadCardVisibleTabs}
                 />
               </div>
             )}

             {!(showRateLimit || quotaSeconds !== null) && (
               <ProcessingStatusBanner 
                 loading={loading && !deepDiveLoading} 
                 deepDiveLoading={deepDiveLoading} 
                 analyzingCompany={analyzingCompany} 
                 subStatus={analysisSubStatus} 
                  analysisSteps={analysisSteps}
                 analysisResult={analysisResult} 
                 onDismiss={clearCompletedAnalysisBanner} 
                   onCancel={handleCancelProcessing}
                  onOpenResult={openCompletedAnalysisResult} 
               />
             )}
             <ResultsTable 
                data={leads} 
                onDeepDive={handleDeepDive} 
                onSelectLead={handleSelectLead}
                onRemoveWithReason={handleRemoveWithReason}
                onDownloadSingle={(lead) => handleDownloadLeads([lead])}
                onDownloadSelected={handleDownloadLeads}
                allExclusions={[...existingCustomers, ...downloadedLeads]}
                threePLProviders={threePLProviders}
             />
          </div>
        </div>
      </main>

      <ExclusionManager isOpen={isExclusionOpen} onClose={() => setIsExclusionOpen(false)} existingCustomers={existingCustomers} setExistingCustomers={(list) => { void persistExclusionList('customer', list); }} downloadedLeads={downloadedLeads} setDownloadedLeads={(list) => { void persistExclusionList('history', list); }} />
      <InclusionManager isOpen={isInclusionOpen} onClose={() => setIsInclusionOpen(false)} includedKeywords={includedKeywords} setIncludedKeywords={setIncludedKeywords} />
      <IntegrationManager isOpen={isIntegrationOpen} onClose={() => setIsIntegrationOpen(false)} availableSystems={availableSystems} selectedIntegrations={integrations} onSave={handleSaveIntegrationSettings} />
      <TechSolutionManager isOpen={isTechSolutionsOpen} onClose={() => setIsTechSolutionsOpen(false)} config={techSolutionConfig} onSave={setTechSolutionConfig} />
      <SNISettingsManager isOpen={isSNISettingsOpen} onClose={() => setIsSNISettingsOpen(false)} settings={sniPercentages} onSave={setSNIPercentages} />
      <ThreePLManager isOpen={isThreePLOpen} onClose={() => setIsThreePLOpen(false)} providers={threePLProviders} onSave={handleSaveThreePL} />
      <CarrierSettingsManager isOpen={isCarrierSettingsOpen} onClose={() => setIsCarrierSettingsOpen(false)} onSave={handleSaveMarketSettings} currentSettings={marketSettings} />
      <MailTemplateManager 
        isOpen={isMailTemplateOpen} 
        onClose={() => setIsMailTemplateOpen(false)} 
        templateSv={mailTemplateSv} 
        templateEn={mailTemplateEn} 
        signature={mailSignature} 
        calendarUrl={calendarUrl} 
        setTemplateSv={setMailTemplateSv} 
        setTemplateEn={setMailTemplateEn} 
        setSignature={setMailSignature} 
        setCalendarUrl={setCalendarUrl} 
        attachments={mailAttachments} 
        setAttachments={setMailAttachments} 
        focusWords={mailFocusWords} 
        setFocusWords={setMailFocusWords} 
        activeCarrier={activeCarrier}
        deepDiveLead={deepDiveLead}
      />
      <CacheManager isOpen={isCacheOpen} onClose={() => setIsCacheOpen(false)} cacheData={cacheData} setCacheData={(next) => { void persistReservoirData(next); }} onMoveToActive={(ls) => ls?.filter(Boolean).forEach(handleUpdateLead)} activeLeads={leads} existingCustomers={existingCustomers} downloadedLeads={downloadedLeads} />
      <NewsSourceManager
        isOpen={isNewsSourceOpen}
        onClose={() => setIsNewsSourceOpen(false)}
        mappings={newsSourceMappings}
        onSave={setNewsSourceMappings}
        sourcePolicies={sourcePolicies}
        onSaveSourcePolicies={setSourcePolicies}
        selectedCountry={activeSourceCountry}
        onSelectCountry={setActiveSourceCountry}
      />
      {isCronJobsOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Cron Job Hantering</h2>
              <button onClick={() => setIsCronJobsOpen(false)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-sm">Stang</button>
            </div>

            <div className={`mb-4 rounded-sm border p-3 text-xs ${useRemoteCronExecution ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              {useRemoteCronExecution
                ? 'Backend-scheduler aktiv: dessa jobb kan köras obevakat utan att appen är öppen. Obs: lokal reservoar i browsern ingår inte i backendläge.'
                : 'Lokal fallback aktiv: om backend-sync saknas körs jobben bara när appen är öppen.'}
              {cronSyncError && <div className="mt-1 text-[11px] text-red-700">{cronSyncError}</div>}
            </div>

            <div className="border border-dhl-gray-medium rounded-sm p-4 bg-dhl-gray-light space-y-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input value={cronName} onChange={(e) => setCronName(e.target.value)} placeholder="Jobbnamn" className="text-xs border border-dhl-gray-medium rounded-sm p-2" />
                <select value={cronType} onChange={(e) => setCronType(e.target.value as 'deep_dive' | 'batch_search' | 'lead_reanalysis')} className="text-xs border border-dhl-gray-medium rounded-sm p-2">
                  <option value="deep_dive">Analys (Deep Dive)</option>
                  <option value="batch_search">Batchsokning</option>
                  <option value="lead_reanalysis">Tidigare analyser</option>
                </select>
                <select value={cronScheduleMode} onChange={(e) => setCronScheduleMode(e.target.value as CronScheduleMode)} className="text-xs border border-dhl-gray-medium rounded-sm p-2">
                  <option value="daily">Daglig tid</option>
                  <option value="interval">Intervall</option>
                  <option value="custom">Egen cron</option>
                </select>
                {cronScheduleMode === 'custom' ? (
                  <input value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} placeholder="Cron: 0 8 * * 1-5" className={`text-xs border rounded-sm p-2 ${isCronFormValid ? 'border-dhl-gray-medium' : 'border-red-500'}`} />
                ) : cronScheduleMode === 'daily' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min={0} max={23} value={cronRunHour} onChange={(e) => setCronRunHour(Math.max(0, Math.min(23, Number(e.target.value || 0))))} placeholder="Timme" className="text-xs border border-dhl-gray-medium rounded-sm p-2" />
                    <input type="number" min={0} max={59} value={cronRunMinute} onChange={(e) => setCronRunMinute(Math.max(0, Math.min(59, Number(e.target.value || 0))))} placeholder="Minut" className="text-xs border border-dhl-gray-medium rounded-sm p-2" />
                  </div>
                ) : (
                  <input type="number" min={15} step={15} value={cronIntervalMinutes} onChange={(e) => setCronIntervalMinutes(Math.max(15, Number(e.target.value || 15)))} placeholder="Intervall i minuter" className="text-xs border border-dhl-gray-medium rounded-sm p-2" />
                )}
              </div>

              {cronScheduleMode === 'daily' && (
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={cronWeekdaysOnly} onChange={(e) => setCronWeekdaysOnly(e.target.checked)} />
                  Endast vardagar
                </label>
              )}

              {cronType === 'deep_dive' ? (
                <input value={cronCompany} onChange={(e) => setCronCompany(e.target.value)} placeholder="Foretagsnamn eller org.nr" className="w-full text-xs border border-dhl-gray-medium rounded-sm p-2" />
              ) : cronType === 'lead_reanalysis' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select value={cronReanalysisScope} onChange={(e) => setCronReanalysisScope(e.target.value as 'active' | 'cache' | 'both')} className="text-xs border border-dhl-gray-medium rounded-sm p-2">
                    <option value="active">Aktiva leads</option>
                    <option value="cache">Reservoar</option>
                    <option value="both">Aktiva + reservoar</option>
                  </select>
                  <input type="number" min={1} max={100} value={cronReanalysisLimit} onChange={(e) => setCronReanalysisLimit(Math.max(1, Number(e.target.value || 1)))} placeholder="Max bolag per körning" className="text-xs border border-dhl-gray-medium rounded-sm p-2" />
                  <div className="text-[10px] text-slate-500 flex items-center">Kör om äldst övervakade bolag först och jämför bokslut/risk mot senaste analys. Obevakad backendkörning når bara persisterade leads, inte lokal reservoar i browsern.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={cronGeo} onChange={(e) => setCronGeo(e.target.value)} placeholder="Geografi" className="text-xs border border-dhl-gray-medium rounded-sm p-2" />
                  <input value={cronFinancialScope} onChange={(e) => setCronFinancialScope(e.target.value)} placeholder="Omsattningssegment" className="text-xs border border-dhl-gray-medium rounded-sm p-2" />
                  <input value={cronTriggers} onChange={(e) => setCronTriggers(e.target.value)} placeholder="Triggers" className="text-xs border border-dhl-gray-medium rounded-sm p-2 md:col-span-2" />
                  <input type="number" value={cronLeadCount} onChange={(e) => setCronLeadCount(Math.max(1, Number(e.target.value || 1)))} placeholder="Antal leads" className="text-xs border border-dhl-gray-medium rounded-sm p-2" />
                </div>
              )}

              {cronType !== 'deep_dive' && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Segmentfilter</div>
                  <div className="flex flex-wrap gap-2">
                    {SEGMENT_OPTIONS.map((segment) => (
                      <label key={segment} className={`px-3 py-1 text-[10px] font-black rounded-sm border cursor-pointer ${cronTargetSegments.includes(segment) ? 'bg-dhl-black text-white border-dhl-black' : 'bg-white text-slate-700 border-dhl-gray-medium'}`}>
                        <input type="checkbox" checked={cronTargetSegments.includes(segment)} onChange={() => toggleCronSegment(segment)} className="hidden" />
                        {segment}
                      </label>
                    ))}
                    <button type="button" onClick={() => setCronTargetSegments([])} className="px-3 py-1 text-[10px] font-black rounded-sm border border-dhl-gray-medium bg-white text-slate-700">
                      Alla segment
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500">Tomt urval betyder att jobbet kör alla segment. Batchjobb filtrerar resultat efter DM, TS, FS och KAM. Återanalys kan begränsas till samma segment.</div>
                </div>
              )}

              <div className="text-[10px] text-slate-500">Schema: <span className="font-mono">{resolvedCronExpression}</span> • Exempel cron: 0 8 * * 1-5, */30 * * * *</div>
              <button onClick={handleAddCronJob} disabled={!isCronFormValid} className="bg-dhl-black text-white px-4 py-2 text-xs font-black uppercase rounded-sm hover:bg-red-600 disabled:opacity-50">
                Lagg till cron-jobb
              </button>
            </div>

            <div className="space-y-2">
              {cronJobs.length === 0 && <div className="text-xs text-slate-500 italic">Inga cron-jobb skapade.</div>}
              {cronJobsWithMeta.map((job) => (
                <div key={job.id} className="border border-dhl-gray-medium rounded-sm p-3 bg-white flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black uppercase text-dhl-black">{job.name}</div>
                      <div className="text-[10px] text-slate-500">{describeCronJobType(job.type)} • {job.cronExpression}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleCronJob(job.id)} className={`px-2 py-1 text-[10px] font-black rounded-sm ${job.enabled ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {job.enabled ? 'AKTIV' : 'PAUSAD'}
                      </button>
                      <button onClick={() => removeCronJob(job.id)} className="px-2 py-1 text-[10px] font-black bg-red-50 text-red-700 rounded-sm">Ta bort</button>
                    </div>
                  </div>
                  {job.payload.targetSegments && job.payload.targetSegments.length > 0 && (
                    <div className="text-[10px] text-slate-500">Segment: {job.payload.targetSegments.join(', ')}</div>
                  )}
                  {job.type === 'lead_reanalysis' && (
                    <div className="text-[10px] text-slate-500">Omfång: {job.payload.reanalysisScope || 'active'} • Max per körning: {job.payload.reanalysisLimit || 10}</div>
                  )}
                  <div className="text-[10px] text-slate-500">Senast: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString('sv-SE') : 'Aldrig'} • Nasta: {job.nextRunAt ? new Date(job.nextRunAt).toLocaleString('sv-SE') : '-'}</div>
                  {job.lastStatus && (
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span className={`px-2 py-1 rounded-sm font-black uppercase ${job.lastStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : job.lastStatus === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                        {job.lastStatus}
                      </span>
                      {job.lastResultSummary && <span className="text-slate-600">{job.lastResultSummary}</span>}
                    </div>
                  )}
                  {job.parsedLastError && (
                    <div className="border border-red-100 bg-red-50 rounded-sm p-2 text-[10px] text-red-800">
                      <div className="font-black uppercase">Senaste fel</div>
                      {job.parsedLastError.processingErrorCode && (
                        <div className="mt-1 font-mono text-red-700">Kod: {job.parsedLastError.processingErrorCode}</div>
                      )}
                      <div className="mt-1">{job.parsedLastError.message}</div>
                      {job.parsedLastError.timestamp && (
                        <div className="mt-1 text-red-600">{new Date(job.parsedLastError.timestamp).toLocaleString('sv-SE')}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <BackupManager 
        isOpen={isBackupsOpen} 
        onClose={() => setIsBackupsOpen(false)} 
        backups={backups} 
        onCreateBackup={handleCreateBackup} 
        onRestoreBackup={handleRestoreBackup} 
        onDeleteBackup={handleDeleteBackup} 
        onImportBackup={handleImportBackup} 
        onDownloadCurrent={handleDownloadCurrentStatus}
      />
      <DailyBriefing isOpen={isBriefingOpen} onClose={() => setIsBriefingOpen(false)} cacheCount={cacheData.length} />
      <ManualAddModal isOpen={isManualAddOpen} onClose={() => setIsManualAddOpen(false)} onAdd={handleUpdateLead} />

      {/* Additional Component Modals */}
      {isModelSelectorOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">AI Model Selection</h2>
            <ModelSelector showCostTracker={true} />
            <button 
              onClick={() => setIsModelSelectorOpen(false)}
              className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isCustomAPIOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Custom API Connector Builder</h2>
            <CustomAPIConnectorBuilder userId={user?.id || 'current-user'} />
            <button 
              onClick={() => setIsCustomAPIOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isCustomIntegrationOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Custom Integration Adapter</h2>
            <CustomIntegrationAdapter userId={user?.id || 'current-user'} />
            <button 
              onClick={() => setIsCustomIntegrationOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isCustomReportOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Custom Report Builder</h2>
            <CustomReportBuilder userId={user?.id || 'current-user'} />
            <button 
              onClick={() => setIsCustomReportOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isCampaignAnalyticsOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Campaign Analytics</h2>
            <CampaignAnalytics campaignId="" campaignName="Campaign" />
            <button 
              onClick={() => setIsCampaignAnalyticsOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isCampaignPerformanceOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Campaign Performance Dashboard</h2>
            {user?.id ? <CampaignPerformanceDashboard userId={user.id} /> : <div className="text-slate-500">Please log in to view analytics</div>}
            <button 
              onClick={() => setIsCampaignPerformanceOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isCostAnalysisOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Cost Analysis Dashboard</h2>
            <CostAnalysisDashboard userId={user?.id || 'current-user'} />
            <button 
              onClick={() => setIsCostAnalysisOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isCRMManagerOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">CRM Manager</h2>
            <CRMManager userId={user?.id || 'current-user'} leads={leads} />
            <button 
              onClick={() => setIsCRMManagerOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isEmailCampaignBuilderOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Email Campaign Builder</h2>
            <EmailCampaignBuilder userId={user?.id || 'current-user'} leads={leads} />
            <button 
              onClick={() => setIsEmailCampaignBuilderOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isEventTriggersOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Event Triggers</h2>
            <EventTriggersComponent userId={user?.id || 'current-user'} />
            <button 
              onClick={() => setIsEventTriggersOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isExportManagerOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Export Manager</h2>
            <ExportManager userId={user?.id || 'current-user'} />
            <button 
              onClick={() => setIsExportManagerOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isSlackManagerOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Slack Manager</h2>
            <SlackManager userId={user?.id || 'current-user'} />
            <button 
              onClick={() => setIsSlackManagerOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isWebhookManagerOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Webhook System Manager</h2>
            <WebhookSystemManager userId={user?.id || 'current-user'} />
            <button 
              onClick={() => setIsWebhookManagerOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isPhase9IntegrationOpen && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Phase 9 Integration Manager</h2>
            <Phase9IntegrationManager userId={user?.id || 'current-user'} />
            <button 
              onClick={() => setIsPhase9IntegrationOpen(false)}
              className="mt-4 w-full bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Share Lead Modal */}
      <ShareLeadModal
        isOpen={isShareLeadOpen}
        lead={selectedLeadForSharing}
        onClose={() => {
          setIsShareLeadOpen(false);
          setSelectedLeadForSharing(null);
        }}
        onSuccess={() => {
          // Refresh leads or show notification
          setIsShareLeadOpen(false);
          setSelectedLeadForSharing(null);
        }}
      />

      {/* User Profile Modal */}
      {isUserProfileOpen && user && (
        <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <UserProfile userId={user.id} onClose={() => setIsUserProfileOpen(false)} activeSourceCountry={activeSourceCountry} setActiveSourceCountry={setActiveSourceCountry} />
          </div>
        </div>
      )}

      {isToolAccessOpen && currentUserRole === 'admin' && user?.id && (
        <ToolAccessManager
          isOpen={isToolAccessOpen}
          onClose={() => setIsToolAccessOpen(false)}
          config={toolAccessConfig}
          onSave={setToolAccessConfig}
          currentUserId={user.id}
        />
      )}

      <OnboardingTour 
        isOpen={showTour} 
        onClose={() => setShowTour(false)} 
        onDemoFill={handleDemoFill}
      />
    </div>
      )}
    </>
  );
};
