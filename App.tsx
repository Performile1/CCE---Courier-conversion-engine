
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
import { IntegrationManager } from './components/IntegrationManager';
import { NewsSourceManager } from './components/NewsSourceManager';
import { SNISettingsManager } from './components/SNISettingsManager';
import { ThreePLManager } from './components/ThreePLManager';
import { CarrierSettingsManager } from './components/CarrierSettingsManager';
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
import { generateLeads, generateDeepDiveSequential } from './services/openrouterService'; 
import { signOut, supabase } from './services/supabaseClient';
import { ShieldAlert } from 'lucide-react';
import { 
  SearchFormData, 
  LeadData, 
  NewsSourceMapping, 
  SNIPercentage, 
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

export const App: React.FC = () => {
  // Authentication state - MUST BE BEFORE ALL OTHER STATE
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ready' | 'session_only'>('loading');
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [activeCarrier, setActiveCarrier] = useState<string>(() => localStorage.getItem('dhl_active_carrier') || 'DHL');
  const [carriers, setCarriers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dhl_carriers');
      return saved ? JSON.parse(saved) : DEFAULT_CARRIERS;
    } catch (e) { return DEFAULT_CARRIERS; }
  });
  const [backups, setBackups] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dhl_backups') || '[]');
    } catch (e) { return []; }
  });
  const [error, setError] = useState<string | null>(null);

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
  const [selectedLeadForSharing, setSelectedLeadForSharing] = useState<LeadData | null>(null);

  const [existingCustomers, setExistingCustomers] = useState<string[]>([]);
  const [downloadedLeads, setDownloadedLeads] = useState<string[]>([]);
  const [includedKeywords, setIncludedKeywords] = useState<string[]>([]);
  const [cacheData, setCacheData] = useState<LeadData[]>([]);
  const [integrations, setIntegrations] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dhl_integrations') || '[]');
    } catch (e) { return []; }
  });

  const [sniPercentages, setSNIPercentages] = useState<SNIPercentage[]>(() => {
    try {
      const saved = localStorage.getItem('dhl_sni_percentages');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [threePLProviders, setThreePLProviders] = useState<ThreePLProvider[]>(() => {
    try {
      const saved = localStorage.getItem('dhl_3pl_providers');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [newsSourceMappings, setNewsSourceMappings] = useState<NewsSourceMapping[]>(() => {
    try {
      const saved = localStorage.getItem('dhl_news_sources');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [mailTemplateSv, setMailTemplateSv] = useState(() => localStorage.getItem('dhl_mail_template_sv') || DEFAULT_MAIL_TEMPLATE_SV);
  const [mailTemplateEn, setMailTemplateEn] = useState(() => localStorage.getItem('dhl_mail_template_en') || DEFAULT_MAIL_TEMPLATE_EN);
  const [mailSignature, setMailSignature] = useState(() => localStorage.getItem('dhl_mail_signature') || 'Med vänlig hälsning,<br/>Account Manager, {active_carrier}');
  const [calendarUrl, setCalendarUrl] = useState(() => localStorage.getItem('dhl_user_calendar') || '');
  const [mailAttachments, setMailAttachments] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dhl_mail_attachments');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [mailFocusWords, setMailFocusWords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dhl_mail_focus_words');
      return saved ? JSON.parse(saved) : ['Checkout-strategi', 'Paketskåp', 'Konverteringslyft', 'Last Mile'];
    } catch (e) { return ['Checkout-strategi', 'Paketskåp', 'Konverteringslyft', 'Last Mile']; }
  });

  const [deepDiveLead, setDeepDiveLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [analyzingCompany, setAnalyzingCompany] = useState<string | null>(null); 
  const [analysisSubStatus, setAnalysisSubStatus] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<LeadData | null>(null);
  const abortControllerRef = useRef<boolean>(false);

  const [demoDataTrigger, setDemoDataTrigger] = useState<{ type: 'single' | 'batch', timestamp: number } | null>(null);
  const [resetFormTrigger, setResetFormTrigger] = useState(0);

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

  // Persistence for mail settings
  useEffect(() => { localStorage.setItem('dhl_mail_template_sv', mailTemplateSv); }, [mailTemplateSv]);
  useEffect(() => { localStorage.setItem('dhl_mail_template_en', mailTemplateEn); }, [mailTemplateEn]);
  useEffect(() => { localStorage.setItem('dhl_mail_signature', mailSignature); }, [mailSignature]);
  useEffect(() => { localStorage.setItem('dhl_user_calendar', calendarUrl); }, [calendarUrl]);
  useEffect(() => { localStorage.setItem('dhl_mail_attachments', JSON.stringify(mailAttachments)); }, [mailAttachments]);
  useEffect(() => { localStorage.setItem('dhl_mail_focus_words', JSON.stringify(mailFocusWords)); }, [mailFocusWords]);

  const refreshData = useCallback(async (statusOverride?: string) => {
    const currentStatus = statusOverride || dbStatus;
    if (currentStatus === 'ready') {
      try {
        const allLeads = await db.leads.toArray();
        setLeads(allLeads.sort((a, b) => (b.analysisDate || "").localeCompare(a.analysisDate || "")));
      } catch (e) { console.warn(e); }
    }
    
    try {
        const savedCustomers = localStorage.getItem('dhl_existing_customers');
        if (savedCustomers) setExistingCustomers(JSON.parse(savedCustomers));
        const savedHistory = localStorage.getItem('dhl_downloaded_leads');
        if (savedHistory) setDownloadedLeads(JSON.parse(savedHistory));
        const savedKeywords = localStorage.getItem('dhl_included_keywords');
        if (savedKeywords) setIncludedKeywords(JSON.parse(savedKeywords));
        const savedCache = localStorage.getItem('dhl_candidate_cache');
        if (savedCache) setCacheData(JSON.parse(savedCache));
    } catch (e) {}
  }, [dbStatus]);

  useEffect(() => {
    const initDb = async () => {
      try {
        if (!(db as any).isOpen()) await (db as any).open();
        setDbStatus('ready');
        await refreshData('ready');
      } catch (err) {
        setDbStatus('session_only');
        await refreshData('session_only');
      }
    };
    initDb();
  }, [refreshData]);

  const normalizeCompanyName = (name: string) => {
    if (!name) return '';
    return name.toLowerCase()
      .replace(/\b(ab|aktiebolag|group|gruppen|nordic|sverige|sweden)\b/gi, '')
      .replace(/[^a-z0-9]/gi, '')
      .trim();
  };

  const handleUpdateLead = async (updatedLead: LeadData) => {
    if (!updatedLead) return; 
    
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
        // Behåll det gamla ID:t om det nya är ett temp-ID
        const existingId = newList[idx].id;
        const finalLead = { ...newList[idx], ...updatedLead };
        if (updatedLead.id?.startsWith('temp_') && !existingId.startsWith('temp_')) {
          finalLead.id = existingId;
        }
        newList[idx] = finalLead;
        if (dbStatus === 'ready') db.leads.put(finalLead);
      } else {
        // Om vi inte har ett ID (t.ex. vid manuell tillägg utan ID), generera ett
        if (!updatedLead.id) updatedLead.id = crypto.randomUUID();
        newList = [updatedLead, ...prev];
        if (dbStatus === 'ready') db.leads.put(updatedLead);
      }
      
      return newList;
    });

    if (deepDiveLead) {
      const isSame = (updatedLead.id && deepDiveLead.id === updatedLead.id) || 
                     (updatedLead.companyName === deepDiveLead.companyName);
      if (isSame) {
        setDeepDiveLead(prev => prev ? { ...prev, ...updatedLead } : updatedLead);
      }
    }
  };

  const handleDeleteLead = async (id: string, reason?: string) => {
    if (reason) {
      console.log(`Lead ${id} deleted with reason: ${reason}`);
      // In a real app, we might save this to a 'deleted_leads_stats' table
    }
    setLeads(prev => prev.filter(l => l.id !== id));
    if (deepDiveLead?.id === id) setDeepDiveLead(null);
    if (dbStatus === 'ready') await db.leads.delete(id);
  };

  const handleDownloadLeads = (leadsToDownload: LeadData[]) => {
    if (leadsToDownload.length === 0) return;

    const exportData = leadsToDownload.map(lead => {
      const checkoutSummary = lead.checkoutOptions?.map(opt => `${opt.position}: ${opt.carrier} (${opt.service}) - ${opt.price}`).join(' | ') || '';
      
      const row: any = {
        'Företagsnamn': lead.companyName,
        'Organisationsnummer': lead.orgNumber,
        'Telefon (Växel)': lead.phoneNumber || 'Ej hittat',
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
        'Antal butiker': lead.storeCount || 0,
        'Antal marknader': lead.marketCount || 0,
        'Aktiva marknader': lead.activeMarkets?.join(', ') || '',
        'B2B %': lead.b2bPercentage || 0,
        'B2C %': lead.b2cPercentage || 0,
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
    setDownloadedLeads(updatedDownloadedLeads);
    localStorage.setItem('dhl_downloaded_leads', JSON.stringify(updatedDownloadedLeads));

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
      if (dbStatus === 'ready') {
        for (const id of ids) await db.leads.delete(id);
      }
      if (deepDiveLead && ids.includes(deepDiveLead.id)) setDeepDiveLead(null);
      return;
    }

    if (reason === 'EXISTING_CUSTOMER') {
      const newList = Array.from(new Set([...existingCustomers, ...names, ...orgs]));
      setExistingCustomers(newList);
      localStorage.setItem('dhl_existing_customers', JSON.stringify(newList));
    } else if (reason === 'ALREADY_DOWNLOADED' || reason === 'NOT_RELEVANT' || reason === 'INCORRECT_DATA') {
      const newList = Array.from(new Set([...downloadedLeads, ...names, ...orgs]));
      setDownloadedLeads(newList);
      localStorage.setItem('dhl_downloaded_leads', JSON.stringify(newList));
    }

    if (deepDiveLead && ids.includes(deepDiveLead.id)) setDeepDiveLead(null);
  };

  const handleSelectLead = (lead: LeadData) => {
    setDeepDiveLead(lead);
    setAnalysisResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWait = (s: number, type: 'rate' | 'quota') => {
    if (type === 'quota') {
      setQuotaSeconds(s);
    } else {
      setShowRateLimit(true);
    }
    setAnalysisSubStatus(type === 'quota' ? `Kvotslut (${s}s)` : `Rate limit (${s}s)`);
  };

  const handleSearch = async (formData: SearchFormData) => {
    setLoading(true); setError(null);
    abortControllerRef.current = false;
    try {
      if (formData.companyNameOrOrg?.trim()) {
        // Enstaka sökning -> Kör alltid Deep Dive
        await handleDeepDive(formData.companyNameOrOrg);
      } else {
        // Batch sökning -> Kör generateLeads (QuickScan)
        const exclusionList = [...existingCustomers, ...downloadedLeads, ...leads.map(l => l.companyName)];
        const newLeads = await generateLeads(
          formData, 
          handleWait, 
          sniPercentages, 
          exclusionList, 
          activeCarrier, 
          threePLProviders
        );
        if (newLeads.length === 0) {
          setError("Inga nya leads hittades för den valda orten/branschen. Prova att bredda sökningen.");
        } else {
          for (const lead of newLeads) { await handleUpdateLead(lead); }
        }
      }
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setLoading(false); 
      setAnalysisSubStatus(null); 
    }
  };

  const handleDeepDive = async (companyName: string, forceRefresh = false) => {
    if (!companyName || deepDiveLoading) return;
    
    setError(null); 
    abortControllerRef.current = false;
    setAnalyzingCompany(companyName);
    setDeepDiveLoading(true);
    setAnalysisResult(null);

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
      analysisDate: ''
    };
    setDeepDiveLead(tempLead);

    try {
      const final = await generateDeepDiveSequential(
        { companyNameOrOrg: companyName } as any, 
        (partial, status) => {
          if (status) setAnalysisSubStatus(status);
          setDeepDiveLead(prev => ({ ...prev, ...partial } as LeadData));
          if (partial.id) handleUpdateLead(partial as LeadData);
        },
        handleWait,
        newsSourceMappings,
        sniPercentages,
        integrations,
        activeCarrier,
        threePLProviders
      );
      setDeepDiveLead(final);
      setAnalysisResult(final);
    } catch (err: any) { 
      const msg = (err.message || "").toLowerCase();
      if (msg.includes('429') || msg.includes('quota')) {
        setError("Performile Shield: Rate limit. Systemet vilar 65s för att skydda din kvot.");
      } else {
        setError(err.message); 
      }
    } finally { 
      setDeepDiveLoading(false); 
      setAnalyzingCompany(null); 
      setAnalysisSubStatus(null); 
    }
  };

  const handleCarrierChange = (carrier: string) => {
    setActiveCarrier(carrier);
    localStorage.setItem('dhl_active_carrier', carrier);
  };

  const handleAddCarrier = (newCarrier: string) => {
    if (!newCarrier.trim() || carriers.includes(newCarrier)) return;
    const updated = [...carriers, newCarrier];
    setCarriers(updated);
    localStorage.setItem('dhl_carriers', JSON.stringify(updated));
  };

  const handleSaveThreePL = (providers: ThreePLProvider[]) => {
    setThreePLProviders(providers);
    localStorage.setItem('dhl_3pl_providers', JSON.stringify(providers));
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const d = JSON.parse(text);
      if (d.leads) setLeads(d.leads);
      if (d.existingCustomers) setExistingCustomers(d.existingCustomers);
      if (d.downloadedLeads) setDownloadedLeads(d.downloadedLeads);
      if (d.includedKeywords) setIncludedKeywords(d.includedKeywords);
      if (d.integrations) setIntegrations(d.integrations);
      if (d.sniPercentages) setSNIPercentages(d.sniPercentages);
      if (d.threePLProviders) setThreePLProviders(d.threePLProviders);
      if (d.newsSourceMappings) setNewsSourceMappings(d.newsSourceMappings);
      if (d.mailTemplateSv) setMailTemplateSv(d.mailTemplateSv);
      if (d.mailTemplateEn) setMailTemplateEn(d.mailTemplateEn);
      if (d.mailSignature) setMailSignature(d.mailSignature);
      if (d.calendarUrl) setCalendarUrl(d.calendarUrl);
      if (d.activeCarrier) setActiveCarrier(d.activeCarrier);
      if (d.carriers) setCarriers(d.carriers);

      if (dbStatus === 'ready' && d.leads) {
        await db.leads.clear();
        await db.leads.bulkPut(d.leads);
      }
      alert("Backup återställd!");
    } catch (e) {
      alert("Kunde inte läsa backup-filen.");
    }
  };

  const handleCreateBackup = (name: string) => {
    const dataToSave = {
      leads,
      existingCustomers,
      downloadedLeads,
      includedKeywords,
      integrations,
      sniPercentages,
      threePLProviders,
      newsSourceMappings,
      mailTemplateSv,
      mailTemplateEn,
      mailSignature,
      calendarUrl,
      activeCarrier,
      carriers
    };
    const newBackup = {
      id: crypto.randomUUID(),
      name,
      timestamp: new Date().toISOString(),
      leadCount: leads.length,
      data: dataToSave
    };
    const updated = [newBackup, ...backups];
    setBackups(updated);
    localStorage.setItem('dhl_backups', JSON.stringify(updated));
  };

  const handleRestoreBackup = async (backup: any) => {
    const d = backup.data;
    if (d.leads) setLeads(d.leads);
    if (d.existingCustomers) setExistingCustomers(d.existingCustomers);
    if (d.downloadedLeads) setDownloadedLeads(d.downloadedLeads);
    if (d.includedKeywords) setIncludedKeywords(d.includedKeywords);
    if (d.integrations) setIntegrations(d.integrations);
    if (d.sniPercentages) setSNIPercentages(d.sniPercentages);
    if (d.threePLProviders) setThreePLProviders(d.threePLProviders);
    if (d.newsSourceMappings) setNewsSourceMappings(d.newsSourceMappings);
    if (d.mailTemplateSv) setMailTemplateSv(d.mailTemplateSv);
    if (d.mailTemplateEn) setMailTemplateEn(d.mailTemplateEn);
    if (d.mailSignature) setMailSignature(d.mailSignature);
    if (d.calendarUrl) setCalendarUrl(d.calendarUrl);
    if (d.activeCarrier) setActiveCarrier(d.activeCarrier);
    if (d.carriers) setCarriers(d.carriers);

    if (dbStatus === 'ready' && d.leads) {
      await db.leads.clear();
      await db.leads.bulkPut(d.leads);
    }
  };

  const handleDeleteBackup = (id: string) => {
    const updated = backups.filter(b => b.id !== id);
    setBackups(updated);
    localStorage.setItem('dhl_backups', JSON.stringify(updated));
  };

  const handleDownloadCurrentStatus = () => {
    const data = {
      leads,
      existingCustomers,
      downloadedLeads,
      includedKeywords,
      integrations,
      sniPercentages,
      threePLProviders,
      newsSourceMappings,
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
    localStorage.setItem('dhl_market_settings', JSON.stringify(settings));
  };

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
        onOpenUserProfile={() => setIsUserProfileOpen(true)}
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
      />
      
      <main className="max-w-[1600px] mx-auto px-4 py-6 flex-1 w-full">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 text-red-800 text-sm flex justify-between items-center animate-fadeIn shadow-sm">
             <div className="flex items-center gap-2">
               <ShieldAlert className="w-5 h-5 text-red-600" />
               <span><strong>Systemmeddelande:</strong> {error}</span>
             </div>
             <button onClick={() => setError(null)} className="text-red-900 font-bold px-2">X</button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-3 sticky top-24">
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
          <div className="xl:col-span-9 space-y-6 min-w-0">
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
                   threePLProviders={threePLProviders}
                   onSaveThreePL={handleSaveThreePL}
                 />
               </div>
             )}

             {!(showRateLimit || quotaSeconds !== null) && (
               <ProcessingStatusBanner 
                 loading={loading && !deepDiveLoading} 
                 deepDiveLoading={deepDiveLoading} 
                 analyzingCompany={analyzingCompany} 
                 subStatus={analysisSubStatus} 
                 analysisResult={analysisResult} 
                 onDismiss={() => setAnalysisResult(null)} 
                  onOpenResult={() => {
                    if (analysisResult) {
                      setDeepDiveLead(analysisResult);
                      setAnalysisResult(null);
                    }
                  }} 
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

      <ExclusionManager isOpen={isExclusionOpen} onClose={() => setIsExclusionOpen(false)} existingCustomers={existingCustomers} setExistingCustomers={setExistingCustomers} downloadedLeads={downloadedLeads} setDownloadedLeads={setDownloadedLeads} />
      <InclusionManager isOpen={isInclusionOpen} onClose={() => setIsInclusionOpen(false)} includedKeywords={includedKeywords} setIncludedKeywords={setIncludedKeywords} />
      <IntegrationManager isOpen={isIntegrationOpen} onClose={() => setIsIntegrationOpen(false)} selectedIntegrations={integrations} setIntegrations={setIntegrations} />
      <SNISettingsManager isOpen={isSNISettingsOpen} onClose={() => setIsSNISettingsOpen(false)} settings={sniPercentages} onSave={setSNIPercentages} />
      <ThreePLManager isOpen={isThreePLOpen} onClose={() => setIsThreePLOpen(false)} providers={threePLProviders} onSave={handleSaveThreePL} />
      <CarrierSettingsManager isOpen={isCarrierSettingsOpen} onClose={() => setIsCarrierSettingsOpen(false)} onSave={handleSaveMarketSettings} currentSettings={[]} />
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
      <CacheManager isOpen={isCacheOpen} onClose={() => setIsCacheOpen(false)} cacheData={cacheData} setCacheData={setCacheData} onMoveToActive={(ls) => ls?.filter(Boolean).forEach(handleUpdateLead)} activeLeads={leads} existingCustomers={existingCustomers} downloadedLeads={downloadedLeads} />
      <NewsSourceManager isOpen={isNewsSourceOpen} onClose={() => setIsNewsSourceOpen(false)} mappings={newsSourceMappings} onSave={setNewsSourceMappings} />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Custom API Connector Builder</h2>
            <CustomAPIConnectorBuilder userId="current-user" />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Custom Integration Adapter</h2>
            <CustomIntegrationAdapter />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Custom Report Builder</h2>
            <CustomReportBuilder leads={leads} />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Campaign Analytics</h2>
            <CampaignAnalytics />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Cost Analysis Dashboard</h2>
            <CostAnalysisDashboard />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">CRM Manager</h2>
            <CRMManager />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Email Campaign Builder</h2>
            <EmailCampaignBuilder />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Event Triggers</h2>
            <EventTriggersComponent />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Export Manager</h2>
            <ExportManager leads={leads} />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Slack Manager</h2>
            <SlackManager />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Webhook System Manager</h2>
            <WebhookSystemManager />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Phase 9 Integration Manager</h2>
            <Phase9IntegrationManager />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <UserProfile userId={user.id} onClose={() => setIsUserProfileOpen(false)} />
          </div>
        </div>
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
