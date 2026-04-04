
import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldBan, Target, Database, Settings, ChevronDown, Radar, PlusCircle, 
  Check, Truck, Mail, Layers, Newspaper, Percent, Plus, Package, 
   TrendingUp, History, Globe, Search, Download, LogOut, User, Clock3, Cpu
} from 'lucide-react';
import { Language, LANGUAGE_LABELS } from '../services/i18n';

interface HeaderProps {
  onOpenExclusions: () => void;
  onOpenInclusions: () => void;
  onOpenCache: () => void;
  onOpenBriefing: () => void; 
  onOpenBackups: () => void; 
  onOpenMailTemplate: () => void;
  onOpenIntegrations: () => void;
  onOpenNewsSources: () => void;
   onOpenTechSolutions?: () => void;
  onOpenSNISettings: () => void;
  onOpenThreePL: () => void;
  onOpenCarrierSettings: () => void;
  onOpenModelSelector?: () => void;
  onOpenCustomAPI?: () => void;
  onOpenCustomIntegration?: () => void;
  onOpenCustomReport?: () => void;
  onOpenCampaignAnalytics?: () => void;
  onOpenCampaignPerformance?: () => void;
  onOpenCostAnalysis?: () => void;
  onOpenCRMManager?: () => void;
  onOpenEmailCampaignBuilder?: () => void;
  onOpenEventTriggers?: () => void;
  onOpenExportManager?: () => void;
  onOpenSlackManager?: () => void;
  onOpenWebhookManager?: () => void;
  onOpenPhase9Integration?: () => void;
   onOpenCronJobs?: () => void;
  onOpenUserProfile?: () => void;
  onLogout?: () => void;
  inclusionCount: number;
  exclusionCount: number;
  cacheCount: number;
  protocolMode: 'quick' | 'deep' | 'deep_pro' | 'batch_prospecting';
  setProtocolMode: (mode: 'quick' | 'deep' | 'deep_pro' | 'batch_prospecting') => void;
  onAddNewLead: () => void; 
  activeCarrier: string;
  setActiveCarrier: (carrier: string) => void;
  availableCarriers?: string[];
  onAddCarrier?: (carrier: string) => void;
  activeSourceCountry?: string;
  setActiveSourceCountry?: (country: string) => void;
  availableSourceCountries?: string[];
   visibleTools?: string[];
   onOpenToolAccess?: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onOpenExclusions, onOpenInclusions, onOpenCache, onOpenBriefing, onOpenBackups, 
   onOpenMailTemplate, onOpenIntegrations, onOpenNewsSources, onOpenTechSolutions, onOpenSNISettings, 
  onOpenThreePL, onOpenCarrierSettings, onOpenModelSelector, onOpenCustomAPI, 
  onOpenCustomIntegration, onOpenCustomReport, onOpenCampaignAnalytics, 
  onOpenCampaignPerformance, onOpenCostAnalysis, onOpenCRMManager, 
  onOpenEmailCampaignBuilder, onOpenEventTriggers, onOpenExportManager, 
  onOpenSlackManager, onOpenWebhookManager, onOpenPhase9Integration,
   onOpenCronJobs,
  onOpenUserProfile, onLogout,
  inclusionCount, exclusionCount, cacheCount, 
  protocolMode, setProtocolMode, onAddNewLead, activeCarrier, setActiveCarrier, 
   availableCarriers = ['DHL', 'PostNord', 'Bring', 'Budbee', 'Instabox'], onAddCarrier,
  activeSourceCountry = 'global', setActiveSourceCountry,
  availableSourceCountries = ['global', 'se', 'no', 'dk', 'fi'],
   visibleTools,
   onOpenToolAccess,
  language,
  setLanguage
}) => {
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
   const hasTool = (toolKey: string) => !visibleTools || visibleTools.includes(toolKey);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) setIsToolsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
   <header className="bg-[#ffcc00] shadow-md sticky top-0 z-sticky border-b-4 border-red-600">
      <div className="max-w-[1920px] mx-auto px-4 py-2 flex items-center justify-between">
        
        {/* Logo & Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onOpenBriefing()}>
            <div className="bg-red-600 p-2 rounded-sm shadow-sm group-hover:rotate-12 transition-transform">
              <Radar className="h-6 w-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-red-700 font-black italic uppercase tracking-widest text-xl leading-none">Strategic Analysis</div>
              <div className="text-[10px] text-red-900 font-bold uppercase tracking-wide opacity-80 flex items-center gap-2">
                Performile Engine v24.7
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Controls */}
        <div className="flex items-center gap-3">
           <div className="relative" ref={toolsRef}>
              <button 
                onClick={() => setIsToolsOpen(!isToolsOpen)} 
                className={`flex items-center gap-2 px-3 py-2 rounded-sm transition-all shadow-sm border border-black/5 ${isToolsOpen ? 'bg-white text-black' : 'bg-white/50 hover:bg-white text-slate-800'}`}
              >
                <Settings className="w-4 h-4 text-slate-700" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Verktyg</span>
                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isToolsOpen ? 'rotate-180' : ''}`} />
              </button>
              
                     {isToolsOpen && (
                        <div className="absolute top-full right-0 mt-2 w-[95vw] max-w-[1200px] bg-white shadow-2xl border-t-4 border-red-600 animate-fadeIn z-dropdown rounded-b-sm overflow-hidden ring-1 ring-black/5">
                           <div className="max-h-[75vh] overflow-y-auto p-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                 <div className="space-y-3">
                                    <div className="border border-slate-200 rounded-sm overflow-hidden">
                                       <div className="px-3 py-2 bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">Fokus & Marknad</div>
                                       <div className="p-3 border-t border-slate-100">
                                          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Fokustransportör</div>
                                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-sm">
                                             <Truck className="w-4 h-4 text-red-600 ml-2" />
                                             <select
                                                value={activeCarrier}
                                                onChange={(e) => { setActiveCarrier(e.target.value); }}
                                                className="flex-1 bg-slate-50 text-xs font-black text-slate-900 uppercase py-2 px-2 outline-none cursor-pointer"
                                             >
                                                {availableCarriers.map((c) => (
                                                   <option key={c} value={c}>{c}</option>
                                                ))}
                                             </select>
                                          </div>
                                       </div>
                                       {setActiveSourceCountry && (
                                          <div className="px-3 pb-3">
                                             <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Källprofil (Land)</div>
                                             <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-sm">
                                                <Globe className="w-4 h-4 text-red-600 ml-2" />
                                                <select
                                                   value={activeSourceCountry}
                                                   onChange={(e) => setActiveSourceCountry(e.target.value)}
                                                   className="flex-1 bg-slate-50 text-xs font-black text-slate-900 uppercase py-2 px-2 outline-none cursor-pointer"
                                                >
                                                   {availableSourceCountries.map((c) => (
                                                      <option key={c} value={c}>{c === 'global' ? 'GLOBAL' : c.toUpperCase()}</option>
                                                   ))}
                                                </select>
                                             </div>
                                          </div>
                                       )}
                                       {/* Language Selector */}
                                       <div className="px-3 pb-3">
                                          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Språk</div>
                                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-sm">
                                             <Globe className="w-4 h-4 text-red-600 ml-2" />
                                             <select
                                                value={language}
                                                onChange={(e) => setLanguage(e.target.value as Language)}
                                                className="flex-1 bg-slate-50 text-xs font-black text-slate-900 uppercase py-2 px-2 outline-none cursor-pointer"
                                             >
                                                {Object.entries(LANGUAGE_LABELS).map(([lang, label]) => (
                                                   <option key={lang} value={lang}>{label}</option>
                                                ))}
                                             </select>
                                          </div>
                                       </div>
                                       {hasTool('carrierSettings') && <button onClick={() => { onOpenCarrierSettings(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <TrendingUp className="w-4 h-4 text-red-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Market Intelligence Center</span>
                                             <span className="text-[9px] text-slate-400 font-medium tracking-tight">DMT, Svavel & Prisindex (2026)</span>
                                          </div>
                                       </button>}
                                    </div>

                                    <div className="border border-slate-200 rounded-sm overflow-hidden">
                                       <div className="px-3 py-2 bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">Protokoll & Sökning</div>
                                       {hasTool('inclusions') && <button onClick={() => { onOpenInclusions(); setIsToolsOpen(false); }} className="relative w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Search className="w-4 h-4 text-[#D40511]" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Riktad Sökning (SNI)</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Inkludera specifika segment</span>
                                             {inclusionCount > 0 && <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#D40511] text-white text-[8px] px-1.5 rounded-full font-bold">{inclusionCount}</span>}
                                          </div>
                                       </button>}
                                       {hasTool('cache') && <button onClick={() => { onOpenCache(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Database className="w-4 h-4 text-slate-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Lead Reservoir (Cachen)</span>
                                             <span className="text-[9px] text-slate-400 font-medium">{cacheCount} bolag redo</span>
                                          </div>
                                       </button>}
                                    </div>

                                    <div className="border border-slate-200 rounded-sm overflow-hidden">
                                       <div className="px-3 py-2 bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">Sälj & Kommunikation</div>
                                       {hasTool('mailTemplate') && <button onClick={() => { onOpenMailTemplate(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Mail className="w-4 h-4 text-dhl-yellow" />
                                          <span className="text-xs font-black text-slate-800 uppercase">Mailmotor & Mallar</span>
                                       </button>}
                                       {hasTool('sniSettings') && <button onClick={() => { onOpenSNISettings(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Percent className="w-4 h-4 text-red-600" />
                                          <span className="text-xs font-black text-slate-800 uppercase">Fraktpotential per SNI</span>
                                       </button>}
                                    </div>
                                 </div>

                                 <div className="space-y-3">
                                    <div className="border border-slate-200 rounded-sm overflow-hidden">
                                       <div className="px-3 py-2 bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">System & Drift</div>
                                       {hasTool('exclusions') && <button onClick={() => { onOpenExclusions(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <ShieldBan className="w-4 h-4 text-slate-400" />
                                          <span className="text-xs font-black text-slate-800 uppercase">Exkluderingar</span>
                                       </button>}
                                       {hasTool('backups') && <button onClick={() => { onOpenBackups(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <History className="w-4 h-4 text-dhl-yellow" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">System Backup</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Importera/Exportera data</span>
                                          </div>
                                       </button>}
                                       {hasTool('threePL') && <button onClick={() => { onOpenThreePL(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Package className="w-4 h-4 text-red-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">3PL Manager</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Hantera 3PL-partners & adresser</span>
                                          </div>
                                       </button>}
                                       {hasTool('newsSources') && <button onClick={() => { onOpenNewsSources(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Newspaper className="w-4 h-4 text-red-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Source Managers</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Källor per SNI och per datadel</span>
                                          </div>
                                       </button>}
                                       {hasTool('techSolutions') && onOpenTechSolutions && <button onClick={() => { onOpenTechSolutions(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Cpu className="w-4 h-4 text-red-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Tech Solution Manager</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Plattformar, checkout, betalning och TA</span>
                                          </div>
                                       </button>}
                                       {hasTool('cronJobs') && onOpenCronJobs && <button onClick={() => { onOpenCronJobs(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Clock3 className="w-4 h-4 text-red-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Cron Job Manager</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Schemalagg analyser & batch</span>
                                          </div>
                                       </button>}
                                       {hasTool('toolAccess') && onOpenToolAccess && <button onClick={() => { onOpenToolAccess(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <User className="w-4 h-4 text-red-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Role & Tool Access</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Styr vad olika roller ser</span>
                                          </div>
                                       </button>}
                                    </div>

                                    <div className="border border-slate-200 rounded-sm overflow-hidden">
                                       <div className="px-3 py-2 bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">Kampanjer & Mail</div>
                                       {hasTool('emailCampaign') && <button onClick={() => { onOpenEmailCampaignBuilder?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Mail className="w-4 h-4 text-red-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Email Campaign Builder</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Skapa avancerade emailkampanjer</span>
                                          </div>
                                       </button>}
                                       {hasTool('eventTriggers') && <button onClick={() => { onOpenEventTriggers?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Settings className="w-4 h-4 text-red-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Event Triggers</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Automatisk triggering baserat på event</span>
                                          </div>
                                       </button>}
                                       {hasTool('customReport') && <button onClick={() => { onOpenCustomReport?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Download className="w-4 h-4 text-dhl-red" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Custom Report Builder</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Generera anpassade rapporter</span>
                                          </div>
                                       </button>}
                                    </div>
                                 </div>

                                 <div className="space-y-3">
                                    <div className="border border-slate-200 rounded-sm overflow-hidden">
                                       <div className="px-3 py-2 bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">Analytics & Rapporter</div>
                                       {hasTool('modelSelector') && <button onClick={() => { onOpenModelSelector?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <TrendingUp className="w-4 h-4 text-dhl-red" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">AI Model Selection</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Välj LLM & spåra kostnad</span>
                                          </div>
                                       </button>}
                                       {hasTool('campaignAnalytics') && <button onClick={() => { onOpenCampaignAnalytics?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <TrendingUp className="w-4 h-4 text-dhl-yellow" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Kampanj Analytics</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Detaljerade kampanjstatistik</span>
                                          </div>
                                       </button>}
                                       {hasTool('campaignPerformance') && <button onClick={() => { onOpenCampaignPerformance?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <TrendingUp className="w-4 h-4 text-dhl-red" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Performance Dashboard</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Kampanjprestanda i realtid</span>
                                          </div>
                                       </button>}
                                       {hasTool('costAnalysis') && <button onClick={() => { onOpenCostAnalysis?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <TrendingUp className="w-4 h-4 text-dhl-red" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Kostnadsanalys</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Kostnad per kampanj & segment</span>
                                          </div>
                                       </button>}
                                       {hasTool('exportManager') && <button onClick={() => { onOpenExportManager?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Download className="w-4 h-4 text-slate-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Export Manager</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Exportera leads & rapporter</span>
                                          </div>
                                       </button>}
                                    </div>

                                    <div className="border border-slate-200 rounded-sm overflow-hidden">
                                       <div className="px-3 py-2 bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">Integrations & Webhooks</div>
                                       {hasTool('customApi') && <button onClick={() => { onOpenCustomAPI?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Settings className="w-4 h-4 text-cyan-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Custom API Builder</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Koppla egna API:er</span>
                                          </div>
                                       </button>}
                                       {hasTool('customIntegration') && <button onClick={() => { onOpenCustomIntegration?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Layers className="w-4 h-4 text-teal-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Custom Integration</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Anpassade integrationsadaptrar</span>
                                          </div>
                                       </button>}
                                       {hasTool('webhookManager') && <button onClick={() => { onOpenWebhookManager?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Layers className="w-4 h-4 text-dhl-yellow" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Webhook System</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Hantera webhooks & events</span>
                                          </div>
                                       </button>}
                                       {hasTool('slackManager') && <button onClick={() => { onOpenSlackManager?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Layers className="w-4 h-4 text-slate-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Slack Integration</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Koppla Slack-notifieringar</span>
                                          </div>
                                       </button>}
                                       {hasTool('crmManager') && <button onClick={() => { onOpenCRMManager?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Database className="w-4 h-4 text-yellow-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">CRM Manager</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Synka leads till CRM</span>
                                          </div>
                                       </button>}
                                       {hasTool('phase9') && <button onClick={() => { onOpenPhase9Integration?.(); setIsToolsOpen(false); }} className="w-full text-left px-3 py-3 hover:bg-dhl-gray-light flex items-center gap-3 group border-t border-slate-100">
                                          <Layers className="w-4 h-4 text-pink-600" />
                                          <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-800 uppercase">Advanced Integrations</span>
                                             <span className="text-[9px] text-slate-400 font-medium">Avancerade integrations & phase 9</span>
                                          </div>
                                       </button>}
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                     )}
           </div>

           <button onClick={onAddNewLead} className="flex items-center gap-2 bg-dhl-red hover:bg-red-800 text-white px-3 py-2 rounded-sm transition-all shadow-lg active:scale-95 group">
             <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform" />
             <span className="text-[10px] font-black uppercase hidden lg:inline tracking-widest">Nytt Företag</span>
           </button>

           {/* User Actions - Icons Only - Moved to right of Nytt Företag */}
           <div className="flex items-center gap-1">
             {onOpenUserProfile && (
               <button 
                 onClick={() => { onOpenUserProfile(); setIsToolsOpen(false); }} 
                 className="p-2 hover:bg-dhl-gray-medium text-dhl-black rounded-sm transition-all shadow-sm group" 
                 title="Profil"
               >
                 <User className="w-4 h-4 group-hover:scale-110 transition-transform" />
               </button>
             )}
             {onLogout && (
               <button 
                 onClick={onLogout} 
                 className="p-2 hover:bg-dhl-gray-light text-dhl-black hover:text-dhl-red rounded-sm transition-all shadow-sm group" 
                 title="Logga ut"
               >
                 <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
               </button>
             )}
           </div>
        </div>
      </div>
    </header>
  );
};

