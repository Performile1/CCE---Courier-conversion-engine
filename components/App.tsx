
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './Header';
import InputForm from './InputForm';
import LeadCard from './LeadCard'; 
import { ResultsTable } from './ResultsTable'; 
import { ExclusionManager } from './ExclusionManager';
import { InclusionManager } from './InclusionManager';
import { CacheManager } from './CacheManager';
import { BackupManager } from './BackupManager';
import { DailyBriefing } from './DailyBriefing';
import { ManualAddModal } from './ManualAddModal';
import { MailTemplateManager } from './MailTemplateManager';
import { IntegrationManager } from './IntegrationManager';
import { NewsSourceManager } from './NewsSourceManager';
import { SNISettingsManager } from './SNISettingsManager';
import { ThreePLManager } from './ThreePLManager';
import { CarrierSettingsManager } from './CarrierSettingsManager'; // Ny
import { ProcessingStatusBanner } from './ProcessingStatusBanner';
import { RateLimitOverlay } from './RateLimitOverlay';
import { QuotaTimer } from './QuotaTimer';
import { OnboardingTour } from './OnboardingTour';
import { generateLeads, generateDeepDiveSequential } from '../services/openrouterService'; 
import { Language } from '../services/i18n';
import { 
  SearchFormData, 
  LeadData, 
  NewsSourceMapping, 
  SNIPercentage, 
  ThreePLProvider, 
  RemovalReason,
  Segment,
  CarrierSettings
} from '../types';
import { db } from '../db/schema';
import * as XLSX from 'xlsx';

export const App: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<'loading' | 'ready' | 'session_only'>('loading');
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [activeCarrier, setActiveCarrier] = useState<string>(() => localStorage.getItem('dhl_active_carrier') || 'DHL');
  const [appLanguage, setAppLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('dhl_app_language');
    return (saved as Language) || 'sv';
  });
  const [carrierSettings, setCarrierSettings] = useState<CarrierSettings[]>(() => {
    try {
      const saved = localStorage.getItem('dhl_market_settings');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

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
  const [isCarrierSettingsOpen, setIsCarrierSettingsOpen] = useState(false); // Ny
  const [showTour, setShowTour] = useState(false);

  const [existingCustomers, setExistingCustomers] = useState<string[]>([]);
  const [downloadedLeads, setDownloadedLeads] = useState<string[]>([]);
  const [includedKeywords, setIncludedKeywords] = useState<string[]>([]);
  const [cacheData, setCacheData] = useState<LeadData[]>([]);
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [sniPercentages, setSNIPercentages] = useState<SNIPercentage[]>([]);
  const [threePLProviders, setThreePLProviders] = useState<ThreePLProvider[]>([]);
  const [newsSourceMappings, setNewsSourceMappings] = useState<NewsSourceMapping[]>([]);
  
  const [mailTemplate, setMailTemplate] = useState(() => localStorage.getItem('dhl_mail_template') || '');
  const [mailSignature, setMailSignature] = useState(() => localStorage.getItem('dhl_mail_signature') || '');
  const [calendarUrl, setCalendarUrl] = useState(() => localStorage.getItem('dhl_user_calendar') || '');

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

  const [deepDiveLead, setDeepDiveLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [analyzingCompany, setAnalyzingCompany] = useState<string | null>(null); 
  const [analysisSubStatus, setAnalysisSubStatus] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<LeadData | null>(null);

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

  useEffect(() => { 
    localStorage.setItem('dhl_app_language', appLanguage); 
  }, [appLanguage]);

  const handleUpdateLead = async (updatedLead: LeadData) => {
    if (!updatedLead || !updatedLead.id) return; 
    setLeads(prev => {
      const idx = prev.findIndex(l => l.id === updatedLead.id || l.companyName === updatedLead.companyName);
      let newList = idx > -1 ? [...prev] : [updatedLead, ...prev];
      if (idx > -1) newList[idx] = { ...newList[idx], ...updatedLead };
      if (dbStatus === 'ready') db.leads.put(updatedLead);
      return newList;
    });
    if (deepDiveLead?.id === updatedLead.id || (deepDiveLead?.companyName === updatedLead.companyName)) {
      setDeepDiveLead(prev => prev ? { ...prev, ...updatedLead } : updatedLead);
    }
  };

  const handleSearch = async (formData: SearchFormData) => {
    setLoading(true);
    try {
      if (formData.companyNameOrOrg?.trim()) {
        await handleDeepDive(formData.companyNameOrOrg);
      } else {
        const exclusionList = [...existingCustomers, ...downloadedLeads, ...leads.map(l => l.companyName)];
        const newLeads = await generateLeads(formData, () => {}, sniPercentages, exclusionList, activeCarrier, threePLProviders);
        for (const lead of newLeads) { await handleUpdateLead(lead); }
      }
    } catch (err: any) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDeepDive = async (companyName: string) => {
    if (!companyName) return;
    setAnalyzingCompany(companyName);
    setDeepDiveLoading(true);
    setDeepDiveLead({ companyName, revenue: 'Analyserar...', segment: Segment.UNKNOWN, id: 'temp', orgNumber: '', address: '', freightBudget: '', legalStatus: '', creditRatingLabel: '', decisionMakers: [], websiteUrl: '', carriers: '' });

    try {
      const final = await generateDeepDiveSequential({ companyNameOrOrg: companyName } as any, (partial, status) => {
        if (status) setAnalysisSubStatus(status);
        setDeepDiveLead(prev => ({ ...prev, ...partial } as LeadData));
      }, () => {}, newsSourceMappings, sniPercentages, integrations, activeCarrier, threePLProviders);
      handleUpdateLead(final);
      setDeepDiveLead(final);
      setAnalysisResult(final);
    } catch (err: any) { console.error(err); }
    finally { setDeepDiveLoading(false); setAnalyzingCompany(null); }
  };

  const handleSaveMarketSettings = (settings: CarrierSettings[]) => {
    setCarrierSettings(settings);
    localStorage.setItem('dhl_market_settings', JSON.stringify(settings));
  };

  return (
    <div className="min-h-screen bg-dhl-gray-light flex flex-col font-sans">
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
        onOpenCarrierSettings={() => setIsCarrierSettingsOpen(true)} // Ny
        inclusionCount={includedKeywords.length} 
        exclusionCount={existingCustomers.length + downloadedLeads.length} 
        cacheCount={cacheData.length} 
        protocolMode="deep" 
        setProtocolMode={() => {}} 
        onAddNewLead={() => setIsManualAddOpen(true)} 
        activeCarrier={activeCarrier}
        setActiveCarrier={setActiveCarrier}
        language={appLanguage}
        setLanguage={setAppLanguage}
      />
      
      <main className="max-w-[1600px] mx-auto px-4 py-6 flex-1 w-full">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-3 sticky top-24">
            <InputForm onSubmit={handleSearch} isLoading={loading || deepDiveLoading} protocolMode="deep" setProtocolMode={() => {}} onOpenTour={() => setShowTour(true)} />
          </div>
          <div className="xl:col-span-9 space-y-6 min-w-0">
             <ProcessingStatusBanner loading={loading} deepDiveLoading={deepDiveLoading} analyzingCompany={analyzingCompany} subStatus={analysisSubStatus} analysisResult={analysisResult} onDismiss={() => setAnalysisResult(null)} />
             {deepDiveLead && (
               <LeadCard 
                 data={deepDiveLead} 
                 activeCarrier={activeCarrier} 
                 onClose={() => setDeepDiveLead(null)}
                 onUpdateLead={handleUpdateLead}
                 onDeleteLead={(id) => {
                   setLeads(prev => prev.filter(l => l.id !== id));
                   setDeepDiveLead(null);
                 }}
                 onDownloadSingle={(lead) => {
                   // Implement download logic if needed or pass it from App
                 }}
               />
             )}
             <ResultsTable data={leads} onDeepDive={handleDeepDive} onSelectLead={setDeepDiveLead} />
          </div>
        </div>
      </main>

      <CarrierSettingsManager 
        isOpen={isCarrierSettingsOpen} 
        onClose={() => setIsCarrierSettingsOpen(false)} 
        onSave={handleSaveMarketSettings} 
        currentSettings={carrierSettings} 
      />
      
      <ExclusionManager isOpen={isExclusionOpen} onClose={() => setIsExclusionOpen(false)} existingCustomers={existingCustomers} setExistingCustomers={setExistingCustomers} downloadedLeads={downloadedLeads} setDownloadedLeads={setDownloadedLeads} />
      <InclusionManager isOpen={isInclusionOpen} onClose={() => setIsInclusionOpen(false)} includedKeywords={includedKeywords} setIncludedKeywords={setIncludedKeywords} />
      <SNISettingsManager isOpen={isSNISettingsOpen} onClose={() => setIsSNISettingsOpen(false)} settings={sniPercentages} onSave={setSNIPercentages} />
      <ThreePLManager isOpen={isThreePLOpen} onClose={() => setIsThreePLOpen(false)} providers={threePLProviders} onSave={setThreePLProviders} />
      <MailTemplateManager isOpen={isMailTemplateOpen} onClose={() => setIsMailTemplateOpen(false)} template={mailTemplate} signature={mailSignature} calendarUrl={calendarUrl} setTemplate={setMailTemplate} setSignature={setMailSignature} setCalendarUrl={setCalendarUrl} attachments={[]} setAttachments={() => {}} focusWords={[]} setFocusWords={() => {}} activeCarrier={activeCarrier} deepDiveLead={deepDiveLead} />
    </div>
  );
};
