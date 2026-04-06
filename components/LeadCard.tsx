import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Plus, Trash2, Linkedin, Mail, ChevronRight, 
  MapPin, Building, Package, DollarSign, Microscope, 
  TrendingUp, CheckCircle2, ShieldAlert, Layout, Truck, ThumbsUp, ThumbsDown, Edit, Download,
  ArrowDownRight, RefreshCw, UserCheck, Calendar as CalendarIcon,
  MessageSquare, ExternalLink, Save, Loader2, Check, X, Zap, Target, BarChart3, FileText, Share2, AlertCircle
} from 'lucide-react';
import { CarrierSettings, LeadData, Segment, ThreePLProvider, VerifiedFieldEvidence, VerifiedLeadField } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { generateEmailSuggestion } from '../services/openrouterService';
import { buildOfferRecommendation, derivePricingScenarioFromLead, formatSek, normalizeCarrierSettings } from '../services/pricingService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface LeadCardProps {
  data: LeadData;
  onUpdateLead?: (lead: LeadData) => void;
  onDeleteLead?: (id: string, reason?: string) => void;
  onRefreshAnalysis?: (companyName: string) => void;
  onDownloadSingle?: (lead: LeadData) => void;
  onOpenMailSettings?: () => void;
  onShareLead?: (lead: LeadData) => void;
  customTemplateSv?: string;
  customTemplateEn?: string;
  customSignature?: string;
  calendarUrl?: string;
  mailFocusWords?: string[];
  activeIntegrations?: string[];
  activeCarrier?: string;
  marketSettings?: CarrierSettings[];
  threePLProviders?: ThreePLProvider[];
  onSaveThreePL?: (providers: ThreePLProvider[]) => void;
}

const ConfidenceBadge = ({ level }: {
  level?: 'verified' | 'crawled' | 'estimated' | 'missing' | 'found' | 'inferred'
}) => {
  if (!level) return null;
  if (level === 'verified' || level === 'crawled' || level === 'found')
    return <span className="ml-1.5 px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[7px] font-black uppercase border border-emerald-200 tracking-wider">VERIFIERAD</span>;
  if (level === 'estimated' || level === 'inferred')
    return <span className="ml-1.5 px-1 py-0.5 bg-yellow-100 text-yellow-700 text-[7px] font-black uppercase border border-yellow-200 tracking-wider">ESTIMERING</span>;
  if (level === 'missing')
    return <span className="ml-1.5 px-1 py-0.5 bg-red-50 text-red-600 text-[7px] font-black uppercase border border-red-100 tracking-wider">EJ HITTAD</span>;
  return null;
};

const FieldSourceBadge = ({ evidence, missingLabel = 'Källa saknas' }: {
  evidence?: VerifiedFieldEvidence;
  missingLabel?: string;
}) => {
  if (!evidence?.sourceUrl) {
    return <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-red-600">{missingLabel}</span>;
  }

  const badgeClassName = evidence.confidence === 'verified'
    ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
    : evidence.confidence === 'estimated'
      ? 'text-yellow-700 border-yellow-200 bg-yellow-50'
      : 'text-red-600 border-red-100 bg-red-50';

  return (
    <a
      href={evidence.sourceUrl}
      target="_blank"
      rel="noreferrer"
      title={evidence.snippet || evidence.sourceLabel || 'Verifierad källa'}
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${badgeClassName}`}
    >
      <ExternalLink className="w-2.5 h-2.5" />
      {evidence.sourceLabel || 'Källa'}
    </a>
  );
};

const VERIFIED_FIELD_LABELS: Record<VerifiedLeadField, string> = {
  revenue: 'Omsättning',
  profit: 'Resultat',
  financialHistory: 'Finansiell historik',
  solidity: 'Soliditet',
  liquidityRatio: 'Likviditet',
  profitMargin: 'Vinstmarginal',
  legalStatus: 'Status',
  paymentRemarks: 'Betalningsanmärkningar',
  debtBalance: 'Skuldsaldo',
  debtEquityRatio: 'Skuldsättningsgrad',
  address: 'Huvudadress',
  visitingAddress: 'Besöksadress',
  warehouseAddress: 'Lageradress',
  checkoutOptions: 'Checkout-positioner',
  ecommercePlatform: 'Plattform',
  taSystem: 'TA-system',
  paymentProvider: 'Betalning',
  checkoutSolution: 'Checkout-lösning',
  activeMarkets: 'Marknader',
  storeCount: 'Antal butiker',
  decisionMakers: 'Beslutsfattare',
  latestNews: 'Nyheter',
  emailPattern: 'E-postmönster'
};

const ANNUAL_PACKAGE_SOURCE_LABELS: Record<string, string> = {
  'pricing-model': 'Prismodell',
  'llm-logistics': 'AI-logistikdata',
  'lead-volume': 'Leadets volym',
  'position-breakdown': 'Position 1 + 2',
  'aov-fallback': 'AOV-fallback',
  'default-fallback': 'Standardfallback'
};

const PRODUCT_SOURCE_LABELS: Record<string, string> = {
  'lead-product': 'Sparad produkt',
  'checkout-mapping': 'Checkoutmappning',
  'checkout-service': 'Checkoutsignal',
  'volume-band': 'Volymband',
  'segment-default': 'Segmentdefault',
  'configured-default': 'Konfigurerad standard'
};

const LeadCard: React.FC<LeadCardProps> = ({ 
  data, 
  onUpdateLead, 
  onDeleteLead, 
  onRefreshAnalysis,
  onDownloadSingle,
  onOpenMailSettings,
  onShareLead,
  customTemplateSv,
  customTemplateEn,
  customSignature,
  calendarUrl: calendarUrlProp,
  mailFocusWords = [],
  activeIntegrations = [],
  activeCarrier: activeCarrierProp,
  marketSettings = [],
  threePLProviders = [],
  onSaveThreePL
}) => {
  // --- States ---
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [deepScanActive, setDeepScanActive] = useState(false);
  const [analysisText, setAnalysisText] = useState('Kör Surgical QuickScan AI...');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [mailLanguage, setMailLanguage] = useState<'sv' | 'en'>('sv');
  const [selectedContactIndex, setSelectedContactIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // --- Konstanter ---
  const activeCarrier = activeCarrierProp || "";
  const calendarUrl = calendarUrlProp || "";

  // Initial data
  const [editData, setEditData] = useState<LeadData>({
    id: data?.id ?? crypto.randomUUID(),
    companyName: data?.companyName ?? "",
    orgNumber: data?.orgNumber ?? "",
    revenue: data?.revenue ?? "",
    revenueYear: data?.revenueYear ?? "",
    profit: data?.profit ?? "",
    segment: data?.segment ?? Segment.UNKNOWN,
    address: data?.address ?? "",
    visitingAddress: data?.visitingAddress ?? "",
    warehouseAddress: data?.warehouseAddress ?? "",
    annualPackages: data?.annualPackages,
    pos1Volume: data?.pos1Volume,
    pos2Volume: data?.pos2Volume,
    freightBudget: data?.freightBudget ?? "",
    ecommercePlatform: data?.ecommercePlatform ?? "",
    paymentProvider: data?.paymentProvider ?? "",
    latestNews: data?.latestNews ?? "",
    sourceCoverage: data?.sourceCoverage ?? [],
    taSystem: data?.taSystem ?? "",
    techEvidence: data?.techEvidence ?? "",
    marketCount: data?.marketCount,
    activeMarkets: data?.activeMarkets ?? [],
    b2bPercentage: data?.b2bPercentage,
    b2cPercentage: data?.b2cPercentage,
    strategicPitch: data?.strategicPitch ?? "",
    phoneNumber: data?.phoneNumber ?? "",
    decisionMakers: data?.decisionMakers ?? [],
    businessModel: data?.businessModel ?? "",
    storeCount: data?.storeCount,
    debtEquityRatio: data?.debtEquityRatio ?? "",
    debtBalance: data?.debtBalance ?? "",
    solidity: data?.solidity ?? "",
    liquidityRatio: data?.liquidityRatio ?? "",
    profitMargin: data?.profitMargin ?? "",
    legalStatus: data?.legalStatus ?? "",
    creditRatingLabel: data?.creditRatingLabel ?? "",
    creditRatingMotivation: data?.creditRatingMotivation ?? "",
    riskProfile: data?.riskProfile ?? "",
    financialTrend: data?.financialTrend ?? "",
    websiteUrl: data?.websiteUrl ?? "",
    carriers: data?.carriers ?? "",
    checkoutOptions: data?.checkoutOptions ?? [],
    financialHistory: data?.financialHistory?.length ? data.financialHistory : [],
    paymentRemarks: data?.paymentRemarks ?? "",
    recoveryPotentialSek: data?.recoveryPotentialSek ?? "",
    conversionScore: data?.conversionScore,
    frictionAnalysis: data?.frictionAnalysis,
    dmtMatrix: data?.dmtMatrix ?? [],
    estimatedAOV: data?.estimatedAOV,
    employeesCount: data?.employeesCount,
  });

  const [is3PLModalOpen, setIs3PLModalOpen] = useState(false);
  const [new3PLName, setNew3PLName] = useState('');

  const matched3PL = threePLProviders.find(p => 
    p.address && editData.warehouseAddress && 
    p.address.toLowerCase().trim() === editData.warehouseAddress.toLowerCase().trim()
  );

  const normalizedMarketSettings = normalizeCarrierSettings(marketSettings || []);
  const pricingScenario = normalizedMarketSettings.length ? derivePricingScenarioFromLead(editData, normalizedMarketSettings) : null;
  const offerRecommendation = normalizedMarketSettings.length ? buildOfferRecommendation(normalizedMarketSettings, editData) : null;
  const hasAnalysisDiagnostics = Boolean(
    editData.analysisSteps?.length
    || editData.analysisWarnings?.length
    || editData.analysisTelemetry?.length
    || editData.analysisCompleteness
  );
  const hasOfferRecommendation = Boolean(offerRecommendation && pricingScenario);
  const diagnosticsCount = (editData.analysisSteps?.length || 0) + (editData.analysisWarnings?.length || 0);
  const pricingMatchesCount = offerRecommendation?.allMatches.length || 0;
  const mailRecipientsCount = editData.decisionMakers?.length || 0;
  const showDiagnosticsWarningDot = Boolean((editData.analysisWarnings?.length || 0) > 0 || editData.analysisCompleteness === 'thin');
  const showPricingWarningDot = Boolean(!hasOfferRecommendation || !offerRecommendation?.focusMatch || !offerRecommendation?.targetPrice);
  const addressEvidence = editData.verifiedFieldEvidence?.address;
  const visitingAddressEvidence = editData.verifiedFieldEvidence?.visitingAddress;
  const warehouseAddressEvidence = editData.verifiedFieldEvidence?.warehouseAddress;
  const checkoutEvidence = editData.verifiedFieldEvidence?.checkoutOptions;
  const activeMarketsEvidence = editData.verifiedFieldEvidence?.activeMarkets;
  const storeCountEvidence = editData.verifiedFieldEvidence?.storeCount;

  const buildQuoteRecommendationHtml = () => {
    if (!pricingScenario || !offerRecommendation || !offerRecommendation.targetPrice) {
      return '';
    }

    const productLabel = pricingScenario.productName || 'vald transportprodukt';
    const focusCarrierLabel = offerRecommendation.focusMatch?.carrier.name || activeCarrier || 'fokuscarrier';
    const floorLabel = offerRecommendation.recommendedPriceFloor ? formatSek(offerRecommendation.recommendedPriceFloor) : 'Ej satt';
    const ceilingLabel = offerRecommendation.recommendedPriceCeiling ? formatSek(offerRecommendation.recommendedPriceCeiling) : 'Ej satt';
    const currentFocusLabel = offerRecommendation.focusMatch ? formatSek(offerRecommendation.focusMatch.effectivePrice) : 'Ingen prisrad';
    const annualPackagesLabel = pricingScenario.annualPackages.toLocaleString('sv-SE');

    return `
      <div style="margin-top: 20px; padding: 16px; border: 1px solid #fecaca; background: #fff7f7;">
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #991b1b;">Prisrekommendation</p>
        <p style="margin: 0 0 10px; font-size: 14px; color: #111827;">
          Rekommenderad offertniva for <strong>${productLabel}</strong> vid cirka <strong>${annualPackagesLabel}</strong> paket per ar: <strong>${formatSek(offerRecommendation.targetPrice)}</strong>.
        </p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #334155;">Nuvarande fokuspris hos ${focusCarrierLabel}: <strong>${currentFocusLabel}</strong></p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #334155;">Prisgolv: <strong>${floorLabel}</strong> | Pristak: <strong>${ceilingLabel}</strong></p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #334155;">Volymkalla: ${ANNUAL_PACKAGE_SOURCE_LABELS[editData.annualPackageEstimateSource || ''] || 'Leaddata'}</p>
        <p style="margin: 0; font-size: 13px; color: #334155;">Positionering: ${offerRecommendation.positioning}</p>
      </div>
    `;
  };

  const getTabButtonClass = (tabId: string) => `group relative min-w-[128px] px-3 py-2 border text-left rounded-none transition-all ${
    activeTab === tabId
      ? 'bg-[#D40511] text-white border-[#D40511] shadow-sm'
      : 'bg-white text-dhl-gray-dark border-dhl-gray-medium hover:bg-dhl-gray-light hover:border-slate-400'
  }`;

  const getTabBadgeClass = (tabId: string, tone: 'neutral' | 'warning' | 'accent' = 'neutral') => {
    if (activeTab === tabId) {
      return 'bg-white/20 text-white border border-white/20';
    }

    if (tone === 'warning') {
      return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
    }

    if (tone === 'accent') {
      return 'bg-red-50 text-red-700 border border-red-200';
    }

    return 'bg-slate-100 text-slate-600 border border-slate-200';
  };

  const analysisStepLabelMap: Record<string, string> = {
    identity: 'Identitet',
    source_grounding: 'Kallunderlag',
    financials: 'Finans',
    logistics: 'Logistik',
    checkout: 'Checkout',
    payment: 'Betalning',
    tech_stack: 'Tech',
    contacts: 'Kontakter',
    news: 'Nyheter'
  };

  const analysisProviderLabelMap: Record<string, string> = {
    openrouter: 'OpenRouter',
    tavily: 'Tavily',
    crawl4ai: 'Crawl4AI',
    registry: 'Register',
    internal: 'Intern'
  };

  const sourceCoverageMethodLabelMap: Record<string, string> = {
    direct_registry: 'Direct registry',
    site_search: 'Site search',
    broad_search: 'Broad search',
    crawl_extract: 'Crawl extract',
    ai_inference: 'AI inference'
  };

  const getAnalysisStepStatusClass = (status?: string) => {
    if (status === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
    if (status === 'partial' || status === 'fallback_used') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (status === 'skipped') return 'bg-slate-100 text-slate-600 border-slate-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const formatAnalysisStepTime = (value?: string) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const processingStatusBadgeClass = editData.processingStatus === 'failed'
    ? 'bg-red-50 text-red-700 border border-red-200'
    : editData.processingStatus === 'partial'
      ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
      : 'bg-emerald-50 text-emerald-700 border border-emerald-200';

  const processingStatusLabel = editData.processingStatus === 'failed'
    ? 'Processing failed'
    : editData.processingStatus === 'partial'
      ? 'Processing partial'
      : 'Processing ready';

  const diagnosticsTabContent = (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Analysdiagnostik</p>
          <h3 className="text-sm font-black text-slate-900">Pipeline, varningar och underlagsstatus</h3>
          <p className="text-xs text-slate-500 mt-1">Visar hur lead-analysen byggdes upp, vilka steg som lyckades och var underlaget blev tunnare.</p>
        </div>
        {editData.analysisCompleteness && (
          <span className={`px-2 py-1 text-[9px] font-black uppercase rounded-sm border ${
            editData.analysisCompleteness === 'full'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : editData.analysisCompleteness === 'partial'
                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {editData.analysisCompleteness === 'full' ? 'Full' : editData.analysisCompleteness === 'partial' ? 'Partial' : 'Thin'}
          </span>
        )}
      </div>

      {!hasAnalysisDiagnostics ? (
        <div className="border border-dashed border-slate-300 bg-white p-8 text-center">
          <AlertCircle className="w-7 h-7 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-900">Ingen analysdiagnostik ännu</p>
          <p className="text-xs text-slate-500 mt-1">Kör eller uppdatera analysen för att se stegstatus, varningar och telemetri här.</p>
        </div>
      ) : (
        <>
          {(editData.analysisSteps?.length || 0) > 0 && (
            <div className="border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Analyssteg</p>
              <div className="hidden lg:flex items-stretch gap-2 overflow-x-auto pb-3 mb-4 border-b border-slate-100">
                {editData.analysisSteps?.map((step) => (
                  <div key={`${step.step}-timeline`} className="min-w-[152px] border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                        {step.label || analysisStepLabelMap[step.step] || step.step.replace(/_/g, ' ')}
                      </p>
                      <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase border ${getAnalysisStepStatusClass(step.status)}`}>
                        {step.status}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 bg-slate-200 overflow-hidden">
                      <div className={`h-full ${
                        step.status === 'success'
                          ? 'bg-emerald-500'
                          : step.status === 'failed'
                            ? 'bg-red-500'
                            : step.status === 'partial' || step.status === 'fallback_used'
                              ? 'bg-yellow-500'
                              : step.status === 'skipped'
                                ? 'bg-slate-400'
                                : 'bg-blue-500'
                      }`} style={{ width: `${Math.max(12, Math.round((step.confidence || 0) * 100))}%` }} />
                    </div>
                    <div className="mt-3 text-[10px] text-slate-500 space-y-1">
                      <p><span className="font-black text-slate-700">Engine:</span> {step.diagnostics?.engine || '—'}</p>
                      <p><span className="font-black text-slate-700">Klart:</span> {formatAnalysisStepTime(step.completedAt || step.startedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {editData.analysisSteps?.map((step) => (
                  <div key={step.step} className="border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{step.label || analysisStepLabelMap[step.step] || step.step.replace(/_/g, ' ')}</p>
                          <span className="px-1.5 py-0.5 text-[8px] font-black uppercase border border-slate-200 bg-white text-slate-600">{analysisProviderLabelMap[step.provider || ''] || step.provider || 'Provider okand'}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 mt-1">{step.summary}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-sm border ${getAnalysisStepStatusClass(step.status)}`}>
                        {step.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-[10px] text-slate-600">
                      <div className="border border-slate-200 bg-white p-2">
                        <div className="uppercase font-black text-slate-400">Confidence</div>
                        <div className="font-bold text-slate-900 mt-1">{Math.round(((step.confidenceScore ?? step.confidence) || 0) * 100)}%</div>
                      </div>
                      <div className="border border-slate-200 bg-white p-2">
                        <div className="uppercase font-black text-slate-400">Coverage</div>
                        <div className="font-bold text-slate-900 mt-1">{step.fieldCoverage ? `${step.fieldCoverage.filled}/${step.fieldCoverage.total}` : (step.evidenceCount || 0)}</div>
                      </div>
                      <div className="border border-slate-200 bg-white p-2">
                        <div className="uppercase font-black text-slate-400">Tid</div>
                        <div className="font-bold text-slate-900 mt-1">{step.diagnostics?.durationMs ? `${step.diagnostics.durationMs} ms` : (step.durationMs ? `${step.durationMs} ms` : '—')}</div>
                      </div>
                    </div>
                    {step.fieldCoverage && (
                      <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-slate-600">
                        <div className="border border-slate-200 bg-white p-2">
                          <div className="uppercase font-black text-slate-400">Filled</div>
                          <div className="font-bold text-slate-900 mt-1">{step.fieldCoverage.filled}</div>
                        </div>
                        <div className="border border-slate-200 bg-white p-2">
                          <div className="uppercase font-black text-slate-400">Verified</div>
                          <div className="font-bold text-slate-900 mt-1">{step.fieldCoverage.verified}</div>
                        </div>
                        <div className="border border-slate-200 bg-white p-2">
                          <div className="uppercase font-black text-slate-400">Engine</div>
                          <div className="font-bold text-slate-900 mt-1">{step.diagnostics?.engine || '—'}</div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-600">
                      <div className="border border-slate-200 bg-white p-2">
                        <div className="uppercase font-black text-slate-400">Start</div>
                        <div className="font-bold text-slate-900 mt-1">{formatAnalysisStepTime(step.startedAt)}</div>
                      </div>
                      <div className="border border-slate-200 bg-white p-2">
                        <div className="uppercase font-black text-slate-400">Klart</div>
                        <div className="font-bold text-slate-900 mt-1">{formatAnalysisStepTime(step.completedAt)}</div>
                      </div>
                    </div>
                    {!!step.affectedFields?.length && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {step.affectedFields.map((field) => (
                          <span key={`${step.step}-${field}`} className="px-1.5 py-1 text-[9px] font-black uppercase tracking-wide border border-slate-200 bg-white text-slate-600">
                            {field}
                          </span>
                        ))}
                      </div>
                    )}
                    {!!step.sourceDomains?.length && (
                      <p className="text-[10px] text-slate-500 mt-3">Källor: {step.sourceDomains.join(', ')}</p>
                    )}
                    {!!step.diagnostics?.sources?.length && (
                      <div className="mt-3 space-y-1">
                        {step.diagnostics.sources.slice(0, 3).map((source) => (
                          <div key={`${step.step}-${source.url}`} className="text-[10px] text-slate-500 break-all">
                            {source.type} · {Math.round(source.weight * 100)}% · {source.url}
                          </div>
                        ))}
                      </div>
                    )}
                    {step.fallbackFromStep && (
                      <p className="text-[10px] text-yellow-700 mt-1 uppercase font-black">Fallback fran: {analysisStepLabelMap[step.fallbackFromStep] || step.fallbackFromStep}</p>
                    )}
                    {(step.diagnostics?.errorContext || step.errorCode) && (
                      <p className="text-[10px] text-red-600 mt-1 uppercase font-black">Fel: {step.diagnostics?.errorContext?.code || step.errorCode}</p>
                    )}
                    {step.diagnostics?.errorContext?.message && (
                      <p className="text-[10px] text-red-600 mt-1">{step.diagnostics.errorContext.message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(editData.analysisWarnings?.length || 0) > 0 && (
            <div className="border border-red-200 bg-red-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-red-600 mb-3">Varningar</p>
              <div className="space-y-2">
                {editData.analysisWarnings?.map((warning, index) => (
                  <div key={`warning-${index}`} className="text-[11px] bg-white border border-red-100 p-3 text-slate-700">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(editData.analysisTelemetry?.length || 0) > 0 && (
            <div className="border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Telemetri</p>
              <div className="space-y-2">
                {editData.analysisTelemetry?.map((entry, index) => (
                  <div key={`telemetry-${index}`} className="text-[11px] border border-slate-200 bg-slate-50 p-3 text-slate-700">
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const offerRecommendationTabContent = (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 border border-slate-900 bg-slate-950 p-4 text-white">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Offertrekommendation</p>
          <h3 className="text-sm font-black">Pris mot globalt prisbibliotek</h3>
          <p className="text-xs text-slate-300 mt-1">Bygger rekommendationen från Market Intelligence Center, volymband och matchande konkurrentpriser.</p>
        </div>
        <Target className="w-5 h-5 text-[#ffcc00]" />
      </div>

      {!hasOfferRecommendation ? (
        <div className="border border-dashed border-slate-300 bg-white p-8 text-center">
          <Target className="w-7 h-7 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-900">Ingen offertrekommendation ännu</p>
          <p className="text-xs text-slate-500 mt-1">Lägg in prisregler i Market Intelligence Center för att få en separat prisflik här.</p>
        </div>
      ) : (
        <div className="p-4 bg-slate-950 text-white rounded-none border border-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="bg-white/5 border border-white/10 p-3">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Produktprofil</p>
              <p className="text-xs font-bold text-white">{pricingScenario?.productName}</p>
              <p className="text-[10px] text-slate-300 mt-1">{pricingScenario?.weightKg} kg, {pricingScenario?.lengthCm}x{pricingScenario?.widthCm}x{pricingScenario?.heightCm} cm</p>
              <p className="text-[10px] text-slate-300 mt-1">Prisbas: Globalt prisbibliotek i Market Intelligence Center</p>
              <p className="text-[10px] text-slate-300 mt-1">Produktkalla: {PRODUCT_SOURCE_LABELS[editData.pricingProductSource || ''] || 'Beraknad standard'}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Arsvolym</p>
              <p className="text-xs font-bold text-white">{pricingScenario?.annualPackages.toLocaleString('sv-SE')} paket</p>
              <p className="text-[10px] text-slate-300 mt-1">Volymkalla: {ANNUAL_PACKAGE_SOURCE_LABELS[editData.annualPackageEstimateSource || ''] || 'Leaddata'}</p>
              <p className="text-[10px] text-slate-300 mt-1">Prissatt enbart pa volymband, inte kundprofil.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="bg-emerald-500/10 border border-emerald-400/30 p-3">
              <p className="text-[10px] font-black uppercase text-emerald-300 mb-1">Fokuscarrier idag</p>
              <p className="text-lg font-black text-white">{offerRecommendation?.focusMatch ? formatSek(offerRecommendation.focusMatch.effectivePrice) : 'Saknar prisrad'}</p>
              <p className="text-[10px] text-slate-300 mt-1">{offerRecommendation?.focusMatch?.carrier.name || 'Valj eller konfigurera fokuscarrier i Market Intelligence Center.'}</p>
            </div>
            <div className="bg-[#ffcc00]/10 border border-[#ffcc00]/30 p-3">
              <p className="text-[10px] font-black uppercase text-[#ffcc00] mb-1">Rekommenderad offertniva</p>
              <p className="text-lg font-black text-white">{offerRecommendation?.targetPrice ? formatSek(offerRecommendation.targetPrice) : 'Ingen rekommendation'}</p>
              <p className={`text-[10px] mt-1 ${(offerRecommendation?.priceDelta || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {offerRecommendation?.targetPrice && offerRecommendation?.focusMatch
                  ? `${offerRecommendation.priceDelta >= 0 ? '+' : ''}${offerRecommendation.priceDelta.toFixed(2)} SEK mot nuvarande fokuspris`
                  : offerRecommendation?.positioning}
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-3 mb-3">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Prisintervall att spela inom</p>
            <div className="flex items-center justify-between text-xs gap-3">
              <span className="font-bold text-white">Golv: {offerRecommendation?.recommendedPriceFloor ? formatSek(offerRecommendation.recommendedPriceFloor) : '—'}</span>
              <span className="font-bold text-white">Tak: {offerRecommendation?.recommendedPriceCeiling ? formatSek(offerRecommendation.recommendedPriceCeiling) : '—'}</span>
            </div>
            <p className="text-[10px] text-slate-300 mt-2">{offerRecommendation?.positioning}</p>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase text-slate-400">Matchande konkurrenter</p>
            {offerRecommendation?.allMatches.length ? offerRecommendation.allMatches.map((entry) => (
              <div key={`${entry.carrier.name}-${entry.matchedRule.id}`} className={`flex items-center justify-between gap-3 p-2 border ${entry.carrier.isFocusCarrier ? 'border-[#ffcc00]/40 bg-[#ffcc00]/10' : 'border-white/10 bg-white/5'}`}>
                <div>
                  <p className="text-xs font-black text-white">{entry.carrier.name}{entry.carrier.isFocusCarrier ? ' (fokus)' : ''}</p>
                  <p className="text-[10px] text-slate-300">{entry.matchedRule.productName} • {entry.matchedRule.customerAnnualPackagesMin.toLocaleString('sv-SE')}-{entry.matchedRule.customerAnnualPackagesMax.toLocaleString('sv-SE')} paket</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-white">{formatSek(entry.effectivePrice)}</p>
                  <p className="text-[10px] text-slate-300">Baspris {formatSek(entry.matchedRule.priceSek)}</p>
                </div>
              </div>
            )) : (
              <div className="text-[10px] text-slate-300">Inga prisrader matchar detta lead. Lagg in fler produkt- och volymintervall i Market Intelligence Center.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Sync state when data prop changes
  useEffect(() => {
    if (data) {
      setEditData(prev => ({
        ...prev,
        ...data
      }));
      if (data.analysisDate) {
        setIsAnalyzing(false);
        setAnalysisText('Kör Surgical QuickScan AI...');
        setDeepScanActive(true);
        setScanComplete(true);
      } else {
        setDeepScanActive(false);
        setScanComplete(false);
      }
    }
  }, [data]);

  // --- Handlers ---
  const handleSave = () => {
    setIsEditing(false);
    if (onUpdateLead) onUpdateLead(editData);
  };

  const handleQuickScan = () => {
    if (onRefreshAnalysis) {
      onRefreshAnalysis(editData.companyName);
    } else {
      setIsAnalyzing(true);
      setScanComplete(false);
      setAnalysisText('Ansluter till Surgical Engine...');
      
      setTimeout(() => setAnalysisText('Söker finansiella avvikelser...'), 800);
      setTimeout(() => setAnalysisText('Analyserar checkout-logik...'), 1600);
      setTimeout(() => setAnalysisText('Kalkylerar Revenue Recovery...'), 2400);
      
      setTimeout(() => {
        setIsAnalyzing(false);
        setScanComplete(true);
        setDeepScanActive(true);
      }, 3200);
    }
  };

  const handleGenerateMail = async (index: number) => {
    setSelectedContactIndex(index);
    setIsGenerating(true);
    try {
      const contact = editData.decisionMakers[index];
      const template = mailLanguage === 'sv' ? customTemplateSv : customTemplateEn;
      
      const combinedFocusWords = [
        ...mailFocusWords,
        contact.title,
        editData.ecommercePlatform || '',
        activeCarrier,
        pricingScenario?.productName || '',
        offerRecommendation?.targetPrice ? `${offerRecommendation.targetPrice.toFixed(2)} SEK` : ''
      ].filter(Boolean);
      
      let html = await generateEmailSuggestion(
        'personalized',
        editData,
        combinedFocusWords,
        template,
        activeCarrier,
        mailLanguage,
        contact
      );

      const quoteRecommendationHtml = buildQuoteRecommendationHtml();
      if (quoteRecommendationHtml) {
        html += quoteRecommendationHtml;
      }

      // Append signature and calendar link if they exist
      if (customSignature || calendarUrl) {
        html += '<br><br>';
        if (calendarUrl) {
          const calText = mailLanguage === 'sv' ? 'Boka ett möte här:' : 'Book a meeting here:';
          html += `<p>${calText} <a href="${calendarUrl}" style="color: #D40511; font-weight: bold;">${calendarUrl}</a></p>`;
        }
        if (customSignature) {
          html += `<div style="margin-top: 20px; border-top: 1px solid #eee; pt-4;">${customSignature.replace(/\n/g, '<br>')}</div>`;
        }
      }

      setGeneratedHtml(html);
      setActiveTab('mail');
    } catch (error) {
      console.error("Mail generation error:", error);
      setGeneratedHtml("<p>Ett fel uppstod vid generering av mail.</p>");
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (!status.trim()) return 'bg-white border-slate-100 text-dhl-gray-dark';
    const s = status.toLowerCase();
    // Include user's specific keywords and potential typos
    if (
      s.includes('rekonstruktion') || 
      s.includes('rekonstuktion') || 
      s.includes('likvidation') || 
      s.includes('konkurs') || 
      s.includes('konkursansökan') || 
      s.includes('konkursansäkan')
    ) {
      return 'bg-dhl-gray-light border-red-100 text-red-700';
    }
    return 'bg-emerald-50 border-emerald-100 text-emerald-700';
  };

  const getDebtEquityColor = (ratioStr: string) => {
    const ratio = parseFloat(ratioStr.replace(',', '.'));
    if (isNaN(ratio)) return 'bg-white border-slate-100 text-dhl-gray-dark';
    if (ratio <= 1.0) return 'bg-emerald-50 border-emerald-100 text-emerald-700';
    if (ratio < 2.0) return 'bg-dhl-gray-light border-orange-100 text-orange-700';
    return 'bg-dhl-gray-light border-red-100 text-red-700';
  };

  const displayValue = (value?: string | number | null) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string' && value.trim() === '') return '—';
    return String(value);
  };

  const displayNumber = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('sv-SE');
  };

  const formatVerifiedFieldValue = (field: VerifiedLeadField) => {
    switch (field) {
      case 'activeMarkets':
        return editData.activeMarkets?.length ? editData.activeMarkets.join(', ') : '—';
      case 'storeCount':
        return displayValue(editData.storeCount);
      case 'decisionMakers':
        return editData.decisionMakers?.length
          ? editData.decisionMakers.slice(0, 3).map((contact) => `${contact.name}${contact.title ? ` (${contact.title})` : ''}`).join(', ')
          : '—';
      case 'latestNews':
        return editData.newsItems?.[0]?.title || editData.latestNews || '—';
      case 'checkoutOptions':
        return editData.checkoutOptions?.length
          ? editData.checkoutOptions.map((option) => `${option.inCheckout === false ? '0' : option.position}: ${option.carrier}`).join(', ')
          : '—';
      case 'financialHistory':
        return editData.financialHistory?.length
          ? editData.financialHistory.slice(0, 3).map((year) => `${year.year}: ${year.revenue}`).join(' | ')
          : '—';
      case 'emailPattern':
        return editData.emailPattern || '—';
      default:
        return displayValue((editData as unknown as Record<string, unknown>)[field] as string | number | null | undefined);
    }
  };

  const renderVerifiedFieldsAccordion = (title: string, fields: VerifiedLeadField[]) => {
    const entries = fields
      .map((field) => ({ field, evidence: editData.verifiedFieldEvidence?.[field] }))
      .filter((entry) => entry.evidence?.sourceUrl);

    return (
      <details className="border border-slate-100 bg-white rounded-none">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 p-3 select-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
          <span className="text-[10px] font-black text-dhl-black">{entries.length}</span>
        </summary>
        <div className="border-t border-slate-100 p-3 space-y-2">
          {entries.length > 0 ? entries.map(({ field, evidence }) => (
            <div key={field} className="border border-slate-100 bg-dhl-gray-light p-2 rounded-sm">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold text-dhl-black">{VERIFIED_FIELD_LABELS[field]}</span>
                {evidence?.sourceUrl && (
                  <a
                    href={evidence.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] font-bold text-[#D40511] hover:underline"
                    title={evidence.snippet || evidence.sourceLabel || 'Verifierad källa'}
                  >
                    {evidence.sourceLabel || 'Källa'}
                  </a>
                )}
              </div>
              <div className="text-[10px] font-bold text-dhl-black break-words">{formatVerifiedFieldValue(field)}</div>
              {evidence?.snippet && (
                <div className="text-[9px] text-slate-500 leading-relaxed mt-1 break-words">{evidence.snippet}</div>
              )}
            </div>
          )) : (
            <p className="text-[10px] text-slate-400 italic">Inga verifierade fält i denna kolumn ännu.</p>
          )}
        </div>
      </details>
    );
  };

  const renderRiskFieldSource = (field: 'legalStatus' | 'paymentRemarks' | 'debtBalance' | 'debtEquityRatio') => {
    const evidence = editData.verifiedRegistrySnapshot?.fieldEvidence?.[field];
    if (!evidence?.sourceUrl) return null;

    return (
      <a
        href={evidence.sourceUrl}
        target="_blank"
        rel="noreferrer"
        title={evidence.snippet || evidence.sourceLabel || 'Verifierad källa'}
        className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#D40511]"
      >
        <ExternalLink className="w-2.5 h-2.5" />
        {evidence.sourceLabel || 'Källa'}
      </a>
    );
  };

  const getSegmentBadgeStyle = (segment: string) => {
    const s = segment?.toUpperCase() || '';
    if (s.includes('KAM')) return 'bg-black text-[#FFCC00] border border-black';
    if (s.includes('FS')) return 'bg-[#D40511] text-white';
    if (s.includes('TS')) return 'bg-dhl-red text-white';
    if (s.includes('DM')) return 'bg-emerald-700 text-white';
    return 'bg-dhl-black text-white';
  };

  const handleDownloadPdf = async () => {
    const element = printRef.current || cardRef.current;
    if (!element) return;
    
    try {
      // Temporarily show the print ref if it's the one we're using
      const isPrintRef = !!printRef.current;
      if (isPrintRef) {
        printRef.current!.style.position = 'relative';
        printRef.current!.style.left = '0';
        printRef.current!.style.display = 'block';
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200
      });
      
      if (isPrintRef) {
        printRef.current!.style.position = 'absolute';
        printRef.current!.style.left = '-9999px';
        printRef.current!.style.display = 'none';
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${editData.companyName}_Analysis_Report.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Kunde inte skapa PDF. Försök igen.');
    }
  };

  const getLiquidityStyle = (valStr: string) => {
    if (!valStr || valStr === '-' || valStr === 'N/A') return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: '—' };
    const hasPercent = valStr.includes('%');
    // Strip symbols like < or > before parsing
    let cleanValStr = valStr.replace(/[<>]/g, '').replace(/[−–]/g, '-').replace(',', '.').replace('%', '').trim();
    let val = parseFloat(cleanValStr);
    if (isNaN(val)) return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: '—' };
    
    // If it's a ratio (e.g. 1.5) instead of percentage (e.g. 150)
    if (!hasPercent && val < 10) val = val * 100;

    if (val >= 200) return { className: 'bg-emerald-800 text-white border-emerald-900', label: 'Mycket bra' };
    if (val >= 150) return { className: 'bg-emerald-600 text-white border-emerald-700', label: 'Bra' };
    if (val >= 100) return { className: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Tillfredsställande' };
    if (val >= 50) return { className: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Svag' };
    return { className: 'bg-red-100 text-red-800 border-dhl-gray-medium', label: 'Inte tillfredsställande' };
  };

  const getProfitMarginStyle = (valStr: string) => {
    if (!valStr || valStr === '-' || valStr === 'N/A') return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: '—' };
    let cleanValStr = valStr.replace(/[<>]/g, '').replace(/[−–]/g, '-').replace(',', '.').replace('%', '').trim();
    const val = parseFloat(cleanValStr);
    if (isNaN(val)) return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: '—' };

    if (val >= 15) return { className: 'bg-emerald-800 text-white border-emerald-900', label: 'Mycket bra' };
    if (val >= 10) return { className: 'bg-emerald-600 text-white border-emerald-700', label: 'Bra' };
    if (val >= 6) return { className: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Tillfredsställande' };
    if (val >= 1) return { className: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Svag' };
    return { className: 'bg-red-100 text-red-800 border-dhl-gray-medium', label: 'Inte tillfredsställande' };
  };

  const getSolidityStyle = (valStr: string) => {
    if (!valStr || valStr === '-' || valStr === 'N/A') return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: '—' };
    let cleanValStr = valStr.replace(/[<>]/g, '').replace(/[−–]/g, '-').replace(',', '.').replace('%', '').trim();
    const val = parseFloat(cleanValStr);
    if (isNaN(val)) return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: '—' };

    if (val >= 40) return { className: 'bg-emerald-800 text-white border-emerald-900', label: 'Mycket bra' };
    if (val >= 18) return { className: 'bg-emerald-600 text-white border-emerald-700', label: 'Bra' };
    if (val >= 10) return { className: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Tillfredsställande' };
    if (val >= 3) return { className: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Svag' };
    return { className: 'bg-red-100 text-red-800 border-dhl-gray-medium', label: 'Inte tillfredsställande' };
  };

  return (
    <div ref={cardRef} className="bg-white rounded-none border border-dhl-gray-medium shadow-sm flex flex-col">
      {/* Header Section */}
      <div className="p-1 border-b-2 border-[#D40511] bg-[#FFCC00]">
        {editData.isBankruptOrLiquidated && (
          <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-1 px-3 mb-1 flex items-center justify-center gap-2 animate-pulse">
            <ShieldAlert className="w-3 h-3" /> VARNING: BOLAGET ÄR I KONKURS / LIKVIDATION
          </div>
        )}
        <div className="flex justify-between items-center ml-2">
          <div className="flex gap-2 items-center">
            <div className="w-8 h-8 bg-white rounded-none border border-dhl-gray-medium flex items-center justify-center shadow-sm">
              <Building className="w-4 h-4 text-[#D40511]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-none shadow-sm ${getSegmentBadgeStyle(editData.segment)}`}>
                  {editData.segment}
                </span>
                <h2 className="text-sm font-bold text-black leading-tight">{editData.companyName}</h2>
                {editData.processingStatus && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-none uppercase tracking-wide ${processingStatusBadgeClass}`}>
                    {processingStatusLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[9px] text-black/70">
                <span className="flex items-center gap-1"><Building className="w-2.5 h-2.5" /> {editData.orgNumber}</span>
                <span className="w-0.5 h-0.5 bg-black/30 rounded-none"></span>
                <span className="flex items-center gap-1"><ExternalLink className="w-2.5 h-2.5" /> {editData.websiteUrl.replace('https://', '').replace('http://', '')}</span>
                {editData.sniCode && (
                  <>
                    <span className="w-0.5 h-0.5 bg-black/30 rounded-none"></span>
                    <span className="flex items-center gap-1 font-bold">SNI: {editData.sniCode}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="border border-black/10 bg-white/40 px-2 py-2">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-black/60">Lead Workspace</span>
                <span className="text-[9px] text-black/45">Välj vy för bolag, analys, diagnostik, offert och outreach</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={getTabButtonClass('overview')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide">
                      <Layout className="w-3 h-3" /> Översikt
                    </span>
                    <span className={getTabBadgeClass('overview')}>Bas</span>
                  </div>
                  <div className={`text-[9px] mt-1 ${activeTab === 'overview' ? 'text-white/80' : 'text-slate-500'}`}>Bolagsbild, ekonomi och logistik</div>
                </button>
                <button 
                  onClick={() => setActiveTab('analysis')}
                  className={getTabButtonClass('analysis')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide">
                      <Microscope className="w-3 h-3" /> Analysis
                    </span>
                    <span className={getTabBadgeClass('analysis', scanComplete || editData.analysisDate ? 'accent' : 'neutral')}>
                      {scanComplete || editData.analysisDate ? 'Klar' : 'Scan'}
                    </span>
                  </div>
                  <div className={`text-[9px] mt-1 ${activeTab === 'analysis' ? 'text-white/80' : 'text-slate-500'}`}>Recovery, DMT och friktion</div>
                </button>
                <button 
                  onClick={() => setActiveTab('diagnostics')}
                  className={getTabButtonClass('diagnostics')}
                >
                  {showDiagnosticsWarningDot && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white/70" />}
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide">
                      <AlertCircle className="w-3 h-3" /> Diagnostik
                    </span>
                    <span className={getTabBadgeClass('diagnostics', (editData.analysisWarnings?.length || 0) > 0 ? 'warning' : 'neutral')}>
                      {diagnosticsCount || 0}
                    </span>
                  </div>
                  <div className={`text-[9px] mt-1 ${activeTab === 'diagnostics' ? 'text-white/80' : 'text-slate-500'}`}>Steg, warnings och telemetri</div>
                </button>
                <button 
                  onClick={() => setActiveTab('pricing')}
                  className={getTabButtonClass('pricing')}
                >
                  {showPricingWarningDot && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-yellow-400 ring-2 ring-white/70" />}
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide">
                      <Target className="w-3 h-3" /> Offert
                    </span>
                    <span className={getTabBadgeClass('pricing', hasOfferRecommendation ? 'accent' : 'neutral')}>
                      {hasOfferRecommendation ? pricingMatchesCount : '—'}
                    </span>
                  </div>
                  <div className={`text-[9px] mt-1 ${activeTab === 'pricing' ? 'text-white/80' : 'text-slate-500'}`}>Prisintervall och konkurrentmatch</div>
                </button>
                <button 
                  onClick={() => setActiveTab('mail')}
                  className={getTabButtonClass('mail')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide">
                      <Mail className="w-3 h-3" /> Mail
                    </span>
                    <span className={getTabBadgeClass('mail')}>
                      {mailRecipientsCount}
                    </span>
                  </div>
                  <div className={`text-[9px] mt-1 ${activeTab === 'mail' ? 'text-white/80' : 'text-slate-500'}`}>Outreach och beslutsfattare</div>
                </button>
              </div>
            </div>

            <div className="w-px h-6 bg-black/10"></div>

            <div className="flex gap-1 items-center">
              <button 
                onClick={() => setFeedback('up')}
                className={`p-1 rounded-none transition-all border ${feedback === 'up' ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'text-black/40 hover:text-emerald-600 hover:bg-emerald-50 border-transparent hover:border-emerald-100'}`}
                title="Bra lead"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setFeedback('down')}
                className={`p-1 rounded-none transition-all border ${feedback === 'down' ? 'bg-red-100 border-dhl-gray-medium text-red-600' : 'text-black/40 hover:text-red-600 hover:bg-dhl-gray-light border-transparent hover:border-red-100'}`}
                title="Dålig lead"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-6 bg-black/10 mx-1"></div>
              <button 
                onClick={() => onDownloadSingle && onDownloadSingle(editData)}
                className="p-1 text-black/50 hover:text-black hover:bg-white/20 rounded-none transition-all border border-transparent hover:border-black/10"
                title="Ladda ned CSV"
              >
                <Download className="w-4 h-4" />
              </button>
              <button 
                onClick={handleDownloadPdf}
                className="p-1 text-black/50 hover:text-black hover:bg-white/20 rounded-none transition-all border border-transparent hover:border-black/10"
                title="Ladda ned PDF"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`p-1 rounded-none transition-all border ${isEditing ? 'bg-white text-[#D40511] border-[#D40511]' : 'text-black/50 hover:text-black hover:bg-white/20 border-transparent hover:border-black/10'}`}
                title="Redigera"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onShareLead && onShareLead(editData)}
                className="p-1 text-black/50 hover:text-black hover:bg-white/20 rounded-none transition-all border border-transparent hover:border-black/10"
                title="Dela lead"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1 text-black/50 hover:text-red-600 hover:bg-dhl-gray-light rounded-none transition-all border border-transparent hover:border-red-100"
                title="Radera"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid Removed */}
      </div>

      {/* Tabs Navigation Removed */}

      {/* Content Area */}
      <div className="p-4 bg-white">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Show basic info only if analysis not complete */}
              {!scanComplete && !editData.analysisDate && (
                <div className="bg-dhl-gray-light border-l-4 border-dhl-red p-6 rounded-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-dhl-black mb-2 flex items-center gap-2">
                        <Microscope className="w-5 h-5 text-dhl-red" />
                        Kör analys för att få detaljerat innehål
                      </h3>
                      <p className="text-sm text-dhl-gray-dark mb-4">
                        Denna lead visar grundläggande företagsinformation. Kör "Surgical Analysis" för att få fullständig financial, marknad och opportunity-analyser.
                      </p>
                      <div className="space-y-3 mb-4">
                        <div className="p-3 bg-white border border-dhl-gray-medium rounded-sm">
                          <p className="text-xs font-bold text-dhl-gray-dark uppercase mb-1">Företag</p>
                          <p className="text-sm font-bold text-dhl-black">{editData.companyName}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 bg-white border border-dhl-gray-medium rounded-sm">
                            <p className="text-xs font-bold text-dhl-gray-dark uppercase mb-1">Org Nummer</p>
                            <p className="text-sm font-bold text-dhl-black">{displayValue(editData.orgNumber)}</p>
                          </div>
                          <div className="p-3 bg-white border border-dhl-gray-medium rounded-sm">
                            <p className="text-xs font-bold text-dhl-gray-dark uppercase mb-1">Segment</p>
                            <p className={`text-sm font-bold px-2 py-1 rounded-sm w-fit ${getSegmentBadgeStyle(editData.segment || Segment.UNKNOWN)}`}>{displayValue(editData.segment)}</p>
                          </div>
                          <div className="p-3 bg-white border border-dhl-gray-medium rounded-sm">
                            <p className="text-xs font-bold text-dhl-gray-dark uppercase mb-1">Status</p>
                            <p className="text-sm font-bold text-dhl-black">{displayValue(editData.legalStatus)}</p>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (onRefreshAnalysis) {
                            onRefreshAnalysis(editData.companyName);
                            setActiveTab('analysis');
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-dhl-red text-white font-bold rounded-sm hover:bg-red-800 transition-all"
                      >
                        <Microscope className="w-4 h-4" />
                        Starta Surgical Analysis
                      </button>
                    </div>
                  </div>

                  {renderVerifiedFieldsAccordion('Verifierade fält', [
                    'revenue',
                    'profit',
                    'financialHistory',
                    'solidity',
                    'liquidityRatio',
                    'profitMargin',
                    'legalStatus',
                    'paymentRemarks',
                    'debtBalance',
                    'debtEquityRatio'
                  ])}
                </div>
              )}

              {/* Show detailed analysis data only if analysis is complete */}
              {(scanComplete || editData.analysisDate) && (
                <div className="grid grid-cols-3 gap-6">
                {/* Kolumn 1: Finansiellt */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-dhl-black flex items-center gap-2 border-b border-slate-100 pb-2">
                    <BarChart3 className="w-4 h-4 text-[#D40511]" /> Finansiellt
                    <ConfidenceBadge level={editData.dataConfidence?.financial} />
                  </h3>
                  {editData.hasMonitoredChanges && (editData.changeHighlights?.length || 0) > 0 && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-none">
                      <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-2">
                        Nya förändringar sedan senaste scan
                      </p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {editData.changeHighlights?.slice(0, 6).map((change, idx) => (
                          <div key={`${change.field}-${idx}`} className="text-[10px] bg-white border border-orange-100 p-2 rounded-sm">
                            <div className="font-black text-orange-700">{change.label}</div>
                            <div className="text-slate-600">{change.previous || '-'}{' -> '}{change.current || '-'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {editData.verifiedRegistrySnapshot && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-none">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                            Verifierad Registry Snapshot
                          </p>
                          <ConfidenceBadge level="verified" />
                        </div>
                        {editData.verifiedRegistrySnapshot.sourceUrl && (
                          <a
                            href={editData.verifiedRegistrySnapshot.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-bold text-emerald-700 hover:underline"
                          >
                            {editData.verifiedRegistrySnapshot.sourceLabel || 'Källa'}
                          </a>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-white border border-emerald-100 p-2 rounded-sm">
                          <div className="text-slate-500 uppercase font-bold">Org.nr</div>
                          <div className="font-black text-dhl-black">{editData.verifiedRegistrySnapshot.orgNumber || '-'}</div>
                        </div>
                        <div className="bg-white border border-emerald-100 p-2 rounded-sm">
                          <div className="text-slate-500 uppercase font-bold">Omsättning</div>
                          <div className="font-black text-dhl-black">{editData.verifiedRegistrySnapshot.revenue || '-'}</div>
                        </div>
                        <div className="bg-white border border-emerald-100 p-2 rounded-sm col-span-2">
                          <div className="text-slate-500 uppercase font-bold">Registrerad adress</div>
                          <div className="font-black text-dhl-black">{editData.verifiedRegistrySnapshot.registeredAddress || '-'}</div>
                        </div>
                        <div className="bg-white border border-emerald-100 p-2 rounded-sm">
                          <div className="text-slate-500 uppercase font-bold">Resultat</div>
                          <div className="font-black text-dhl-black">{editData.verifiedRegistrySnapshot.profit || '-'}</div>
                        </div>
                        <div className="bg-white border border-emerald-100 p-2 rounded-sm">
                          <div className="text-slate-500 uppercase font-bold">Kontrollerad</div>
                          <div className="font-black text-dhl-black">{new Date(editData.verifiedRegistrySnapshot.capturedAt).toLocaleDateString('sv-SE')}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-[#FFCC00] rounded-none border border-black/10 shadow-sm">
                        <p className="text-[10px] font-bold text-black/60 uppercase tracking-wider mb-1">Fraktestimat</p>
                        <p className="text-sm font-black text-black">{displayValue(editData.freightBudget)}</p>
                      </div>
                      <div className="p-3 bg-[#FFCC00] rounded-none border border-black/10 shadow-sm">
                        <p className="text-[10px] font-bold text-black/60 uppercase tracking-wider mb-1">Årliga Paket</p>
                        <p className="text-sm font-black text-black">{displayNumber(editData.annualPackages)}</p>
                      </div>
                    </div>

                    <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Omsättning & Resultat (3 år)</p>
                      <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase mb-1 px-1 border-b border-dhl-gray-medium/50 pb-1">
                        <span className="w-12">År</span>
                        <span className="flex-1 text-center">Omsättning</span>
                        <span className="w-16 text-right">Resultat</span>
                      </div>
                      <div className="space-y-2 mt-1">
                        {editData.financialHistory?.slice(0, 3).map((h, i) => (
                          <div key={i} className="flex justify-between items-center text-xs border-b border-dhl-gray-medium/50 pb-1 last:border-0">
                            <span className="text-slate-500 font-medium w-12">{h.year}</span>
                            <span className="text-dhl-black font-bold flex-1 text-center">{h.revenue}</span>
                            <span className={`font-bold w-16 text-right ${(h.profit || '').includes('-') ? 'text-red-500' : 'text-emerald-600'}`}>{h.profit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className={`p-3 rounded-none border ${getSolidityStyle(editData.solidity || '').className}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Soliditet</p>
                        <p className="text-sm font-bold">{displayValue(editData.solidity)}</p>
                        <p className="text-[8px] font-bold uppercase mt-1 opacity-80">{getSolidityStyle(editData.solidity || '').label}</p>
                      </div>
                      <div className={`p-3 rounded-none border ${getLiquidityStyle(editData.liquidityRatio || '').className}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Likviditet</p>
                        <p className="text-sm font-bold">{displayValue(editData.liquidityRatio)}</p>
                        <p className="text-[8px] font-bold uppercase mt-1 opacity-80">{getLiquidityStyle(editData.liquidityRatio || '').label}</p>
                      </div>
                      <div className={`p-3 rounded-none border ${getProfitMarginStyle(editData.profitMargin || '').className}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Vinstmarginal</p>
                        <p className="text-sm font-bold">{displayValue(editData.profitMargin)}</p>
                        <p className="text-[8px] font-bold uppercase mt-1 opacity-80">{getProfitMarginStyle(editData.profitMargin || '').label}</p>
                      </div>
                    </div>

                    <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kreditbetyg</p>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-black px-2 py-0.5 rounded-none ${
                          ['AAA', 'AA', 'A'].includes(editData.creditRatingLabel) ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          ['B'].includes(editData.creditRatingLabel) ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                          'bg-red-100 text-red-700 border border-dhl-gray-medium'
                        }`}>
                          {editData.creditRatingLabel}
                        </span>
                        {editData.riskProfile && (
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            Risk: {editData.riskProfile}
                          </span>
                        )}
                        {editData.financialTrend && (
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            Trend: {editData.financialTrend}
                          </span>
                        )}
                      </div>
                      {editData.creditRatingMotivation && (
                        <p className="text-[10px] text-dhl-gray-dark leading-relaxed italic border-t border-dhl-gray-medium pt-1 mt-1">
                          {editData.creditRatingMotivation}
                        </p>
                      )}
                    </div>

                    {/* Risk Analysis Section */}
                    <div className="p-3 bg-dhl-gray-light rounded-none border border-dhl-gray-medium">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-[#D40511]" /> Risk-analys & Status
                      </p>
                      <div className="space-y-2">
                        {/* Status */}
                        <div className={`flex items-center justify-between gap-3 p-2 border ${getStatusColor(editData.legalStatus || '')}`}>
                          <span className="text-[10px] font-bold uppercase">Status</span>
                          <div className="flex flex-col items-end gap-1 text-right">
                            <span className="text-xs font-black uppercase">{displayValue(editData.legalStatus)}</span>
                            {renderRiskFieldSource('legalStatus')}
                          </div>
                        </div>

                        {/* Betalningsanmärkningar */}
                        <div className={`flex items-center justify-between gap-3 p-2 border ${
                          (!editData.paymentRemarks 
                            ? 'bg-white border-slate-100 text-dhl-gray-dark'
                            : (
                           editData.paymentRemarks.toLowerCase().includes('inga') || 
                           editData.paymentRemarks.toLowerCase().includes('saknas')) 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                            : 'bg-dhl-gray-light border-red-100 text-red-700')
                        }`}>
                          <span className="text-[10px] font-bold uppercase">Betalningsanm.</span>
                          <div className="flex flex-col items-end gap-1 text-right">
                            <span className="text-xs font-black uppercase">{displayValue(editData.paymentRemarks)}</span>
                            {renderRiskFieldSource('paymentRemarks')}
                          </div>
                        </div>

                        {/* Skuldsaldo */}
                        <div className={`flex items-center justify-between gap-3 p-2 border ${
                          (!editData.debtBalance 
                            ? 'bg-white border-slate-100 text-dhl-gray-dark'
                            : (
                           (editData.debtBalance && editData.debtBalance.toLowerCase().includes('saknas')) || 
                           (editData.debtBalance && editData.debtBalance.toLowerCase().includes('inga'))) 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                            : 'bg-dhl-gray-light border-red-100 text-red-700')
                        }`}>
                          <span className="text-[10px] font-bold uppercase">Skuldsaldo (KFM)</span>
                          <div className="flex flex-col items-end gap-1 text-right">
                            <span className="text-xs font-black uppercase">{displayValue(editData.debtBalance)}</span>
                            {renderRiskFieldSource('debtBalance')}
                          </div>
                        </div>

                        {/* Skuldsättningsgrad */}
                        <div className={`flex items-center justify-between gap-3 p-2 border ${getDebtEquityColor(editData.debtEquityRatio || '')}`}>
                          <span className="text-[10px] font-bold uppercase">Skuldsättningsgrad</span>
                          <div className="flex flex-col items-end gap-1 text-right">
                            <span className="text-xs font-black uppercase">{displayValue(editData.debtEquityRatio)}</span>
                            {renderRiskFieldSource('debtEquityRatio')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kolumn 2: Logistik & Infrastruktur */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-dhl-black flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Truck className="w-4 h-4 text-[#D40511]" /> Logistik & Infrastruktur
                    <ConfidenceBadge level={editData.dataConfidence?.checkout} />
                  </h3>

                  <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Huvudadress</p>
                      {!isEditing && <FieldSourceBadge evidence={addressEvidence} />}
                    </div>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editData.address} 
                        onChange={(e) => setEditData({...editData, address: e.target.value})}
                        className="text-xs font-bold text-dhl-black w-full bg-white border border-dhl-gray-medium p-1 outline-none focus:border-[#D40511]"
                      />
                    ) : (
                      <p className="text-xs font-bold text-dhl-black">{editData.address}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Besöksadress</p>
                        {!isEditing && <FieldSourceBadge evidence={visitingAddressEvidence} />}
                      </div>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={editData.visitingAddress || ''} 
                          onChange={(e) => setEditData({...editData, visitingAddress: e.target.value})}
                          className="text-xs font-bold text-dhl-black w-full bg-white border border-dhl-gray-medium p-1 outline-none focus:border-[#D40511]"
                        />
                      ) : (
                        <p className="text-xs font-bold text-dhl-black">{editData.visitingAddress || '-'}</p>
                      )}
                    </div>
                    <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100 relative group">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lageradress</p>
                          {!isEditing && <FieldSourceBadge evidence={warehouseAddressEvidence} />}
                        </div>
                        {!isEditing && editData.warehouseAddress && editData.warehouseAddress !== '-' && (
                          <button 
                            onClick={() => setIs3PLModalOpen(true)}
                            className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 font-bold uppercase hover:bg-red-700 transition-colors flex items-center gap-1"
                            title="Lägg till som 3PL"
                          >
                            <Plus className="w-2.5 h-2.5" /> 3PL
                          </button>
                        )}
                      </div>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={editData.warehouseAddress || ''} 
                          onChange={(e) => setEditData({...editData, warehouseAddress: e.target.value})}
                          className="text-xs font-bold text-dhl-black w-full bg-white border border-dhl-gray-medium p-1 outline-none focus:border-[#D40511]"
                        />
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-dhl-black">{editData.warehouseAddress || '-'}</p>
                          {matched3PL && (
                            <div className="flex items-center gap-1.5 bg-dhl-gray-light border border-red-100 px-2 py-1 rounded-sm">
                              <Package className="w-3 h-3 text-red-600" />
                              <span className="text-[10px] font-black text-red-700 uppercase italic">3PL: {matched3PL.name}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-none border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-1 mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Checkout-positioner</p>
                      <ConfidenceBadge level={editData.dataConfidence?.checkout} />
                      {!isEditing && <FieldSourceBadge evidence={checkoutEvidence} />}
                    </div>
                    <div className="space-y-2">
                      {editData.checkoutOptions?.map((opt, i) => (
                        <div key={i} className={`flex items-center justify-between text-xs ${opt.inCheckout === false ? 'opacity-70' : ''}`}>
                          <span className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-none flex items-center justify-center text-[9px] font-bold ${opt.inCheckout === false ? 'bg-red-100 text-red-600' : 'bg-dhl-gray-light text-dhl-gray-dark'}`}>
                              {opt.inCheckout === false ? '✗' : opt.position}
                            </span>
                            <span className={opt.inCheckout === false ? 'line-through text-red-400' : 'text-dhl-gray-dark'}>{opt.carrier}</span>
                            {opt.inCheckout === false && (
                              <span className="px-1 py-0.5 bg-red-100 text-red-700 text-[7px] font-black uppercase border border-red-200">EJ I CHECKOUT</span>
                            )}
                          </span>
                          <span className={`font-bold ${opt.inCheckout === false ? 'text-red-400' : 'text-dhl-black'}`}>{opt.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Teknisk Stack</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Plattform:</span>
                        <span className="font-bold text-dhl-black">{editData.ecommercePlatform}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">TA-System:</span>
                        <span className="font-bold text-dhl-black">{editData.taSystem}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Betalning:</span>
                        <span className="font-bold text-dhl-black flex items-center gap-1 justify-end">
                          {editData.paymentProvider}
                          <ConfidenceBadge level={editData.dataConfidence?.payment} />
                        </span>
                      </div>
                      {editData.techDetections && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          {editData.techDetections.platforms.length > 0 && (
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Detekterade plattformar</p>
                              <div className="flex flex-wrap gap-1">
                                {editData.techDetections.platforms.map((item) => (
                                  <span key={item} className="px-1.5 py-0.5 bg-white border border-slate-100 rounded-none text-[9px] font-bold text-dhl-gray-dark uppercase">{item}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {editData.techDetections.taSystems.length > 0 && (
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Detekterade TA-system</p>
                              <div className="flex flex-wrap gap-1">
                                {editData.techDetections.taSystems.map((item) => (
                                  <span key={item} className="px-1.5 py-0.5 bg-white border border-slate-100 rounded-none text-[9px] font-bold text-dhl-gray-dark uppercase">{item}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {editData.techDetections.paymentProviders.length > 0 && (
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Detekterade betalningar</p>
                              <div className="flex flex-wrap gap-1">
                                {editData.techDetections.paymentProviders.map((item) => (
                                  <span key={item} className="px-1.5 py-0.5 bg-white border border-slate-100 rounded-none text-[9px] font-bold text-dhl-gray-dark uppercase">{item}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Marknader</p>
                      {!isEditing && <FieldSourceBadge evidence={activeMarketsEvidence} />}
                    </div>
                    {editData.activeMarkets?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {editData.activeMarkets.map((m, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-100 rounded-none text-[9px] font-bold text-dhl-gray-dark uppercase">
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-dhl-black">—</p>
                    )}
                  </div>

                  <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Volymfördelning</p>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-500">B2C</span>
                          <span className="font-bold text-dhl-black">{editData.b2cPercentage !== undefined ? `${editData.b2cPercentage}%` : '—'}</span>
                        </div>
                        <div className="w-full bg-dhl-gray-medium h-1 rounded-none overflow-hidden">
                          <div className="bg-[#D40511] h-full" style={{ width: `${editData.b2cPercentage ?? 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-500">B2B</span>
                          <span className="font-bold text-dhl-black">{editData.b2bPercentage !== undefined ? `${editData.b2bPercentage}%` : '—'}</span>
                        </div>
                        <div className="w-full bg-dhl-gray-medium h-1 rounded-none overflow-hidden">
                          <div className="bg-emerald-600 h-full" style={{ width: `${editData.b2bPercentage ?? 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {renderVerifiedFieldsAccordion('Verifierade fält', [
                    'address',
                    'visitingAddress',
                    'warehouseAddress',
                    'checkoutOptions',
                    'ecommercePlatform',
                    'taSystem',
                    'paymentProvider',
                    'checkoutSolution',
                    'activeMarkets',
                    'storeCount'
                  ])}
                </div>

                {/* Kolumn 3: Beslutsfattare / Pitch / Potential */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-dhl-black flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Layout className="w-4 h-4 text-[#D40511]" /> Beslutsfattare / Pitch / Potential
                    <ConfidenceBadge level={editData.dataConfidence?.contacts} />
                  </h3>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Beslutsfattare</p>
                      <button 
                        onClick={() => {
                          const newDM = { name: "Ny Kontakt", title: "Titel", email: "", linkedin: "#" };
                          setEditData(prev => ({
                            ...prev,
                            decisionMakers: [...prev.decisionMakers, newDM]
                          }));
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold text-[#D40511] hover:underline"
                      >
                        <Plus className="w-3 h-3" /> Lägg till
                      </button>
                    </div>
                    {editData.decisionMakers.map((contact, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-none border border-slate-100 hover:border-red-100 transition-all group relative">
                        <div className="flex justify-between items-start">
                          <div>
                            {isEditing ? (
                              <div className="space-y-1 mb-2">
                                <input 
                                  type="text" 
                                  value={contact.name} 
                                  onChange={(e) => {
                                    const newDMs = [...editData.decisionMakers];
                                    newDMs[idx].name = e.target.value;
                                    setEditData(prev => ({ ...prev, decisionMakers: newDMs }));
                                  }}
                                  className="text-xs font-bold text-dhl-black w-full border-b border-dhl-gray-medium focus:border-[#D40511] outline-none"
                                />
                                <input 
                                  type="text" 
                                  value={contact.title} 
                                  onChange={(e) => {
                                    const newDMs = [...editData.decisionMakers];
                                    newDMs[idx].title = e.target.value;
                                    setEditData(prev => ({ ...prev, decisionMakers: newDMs }));
                                  }}
                                  className="text-[10px] text-slate-500 w-full border-b border-dhl-gray-medium focus:border-[#D40511] outline-none"
                                />
                                <input 
                                  type="text" 
                                  placeholder="Email"
                                  value={contact.email} 
                                  onChange={(e) => {
                                    const newDMs = [...editData.decisionMakers];
                                    newDMs[idx].email = e.target.value;
                                    setEditData(prev => ({ ...prev, decisionMakers: newDMs }));
                                  }}
                                  className="text-[10px] text-slate-500 w-full border-b border-dhl-gray-medium focus:border-[#D40511] outline-none"
                                />
                                <input 
                                  type="text" 
                                  placeholder="LinkedIn URL"
                                  value={contact.linkedin} 
                                  onChange={(e) => {
                                    const newDMs = [...editData.decisionMakers];
                                    newDMs[idx].linkedin = e.target.value;
                                    setEditData(prev => ({ ...prev, decisionMakers: newDMs }));
                                  }}
                                  className="text-[10px] text-slate-500 w-full border-b border-dhl-gray-medium focus:border-[#D40511] outline-none"
                                />
                              </div>
                            ) : (
                              <div className="mb-2">
                                <p className="text-xs font-bold text-dhl-black">{contact.name}</p>
                                <p className="text-[10px] text-slate-500">{contact.title}</p>
                                {contact.directPhone && (
                                  <p className="text-[10px] text-emerald-700 font-bold mt-0.5">📞 {contact.directPhone}</p>
                                )}
                                {contact.verificationNote && (
                                  <p className="text-[9px] text-slate-400 italic mt-0.5">{contact.verificationNote}</p>
                                )}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <a 
                                href={contact.linkedin} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-1.5 bg-dhl-gray-light border border-dhl-gray-medium rounded-none text-slate-400 hover:text-[#D40511] hover:border-dhl-gray-medium transition-all"
                                title="LinkedIn"
                              >
                                <Linkedin className="w-3.5 h-3.5" />
                              </a>
                              <a 
                                href={`mailto:${contact.email}`}
                                className="p-1.5 bg-dhl-gray-light border border-dhl-gray-medium rounded-none text-slate-400 hover:text-[#D40511] hover:border-dhl-gray-medium transition-all"
                                title="Mail"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button 
                              onClick={() => handleGenerateMail(idx)}
                              className="p-2 bg-[#D40511] text-white rounded-none hover:bg-red-700 transition-all shadow-sm shadow-red-100"
                              title="Generera Mail"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                const newDMs = editData.decisionMakers.filter((_, i) => i !== idx);
                                setEditData(prev => ({ ...prev, decisionMakers: newDMs }));
                              }}
                              className="p-2 bg-dhl-gray-light text-slate-400 rounded-none hover:bg-dhl-gray-light hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                              title="Ta bort kontakt"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {editData.emailPattern && (
                    <div className="p-2 bg-blue-50 border border-blue-100 rounded-none">
                      <div className="flex items-center gap-1 mb-0.5">
                        <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">E-postmönster</p>
                        <ConfidenceBadge level={editData.dataConfidence?.emailPattern} />
                      </div>
                      <p className="text-[10px] font-mono text-blue-800 font-bold">{editData.emailPattern}</p>
                    </div>
                  )}

                  <div className="p-3 bg-yellow-50 rounded-none border border-yellow-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Strategisk Pitch</p>
                    <p className="text-xs text-dhl-gray-dark leading-relaxed italic">
                      {editData.strategicPitch ? `"${editData.strategicPitch}"` : ''}
                    </p>
                  </div>

                  <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nyheter & Källor</p>
                      <ConfidenceBadge level={editData.dataConfidence?.news} />
                    </div>
                    {editData.newsItems && editData.newsItems.length > 0 ? (
                      <div className="space-y-2">
                        {editData.newsItems.slice(0, 5).map((item, idx) => (
                          <div key={`${item.url}-${idx}`} className="p-2 bg-white border border-slate-100 rounded-none">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{item.source || 'Källa'}</span>
                              <span className="text-[9px] text-slate-400">{item.date || '-'}</span>
                            </div>
                            <a href={item.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-dhl-black hover:text-[#D40511] hover:underline break-words">
                              {item.title}
                            </a>
                          </div>
                        ))}
                        {editData.latestNews && (
                          <p className="text-[10px] text-slate-500 leading-relaxed break-words border-t border-slate-100 pt-2">
                            {editData.latestNews}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-dhl-gray-dark leading-relaxed break-words">
                        {editData.latestNews || '—'}
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-white rounded-none border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Source Coverage</p>
                    {editData.sourceCoverage && editData.sourceCoverage.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {editData.sourceCoverage.slice(0, 20).map((entry, idx) => (
                          <div key={`${entry.category}-${entry.field}-${entry.source}-${idx}`} className="text-[10px] border border-slate-100 p-1.5 rounded-sm bg-dhl-gray-light">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-dhl-black">{entry.field}</span>
                              <div className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 rounded-sm text-[8px] font-black uppercase ${entry.isPreferred ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {entry.isPreferred ? 'Preferred' : 'External'}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-sm text-[8px] font-black uppercase bg-slate-100 text-slate-700">
                                  {Math.round((entry.confidenceScore || 0) * 100)}%
                                </span>
                              </div>
                            </div>
                            <div className="text-slate-600">{entry.category} · {entry.source}</div>
                            <div className="text-slate-500 uppercase tracking-wide">{sourceCoverageMethodLabelMap[entry.extractionMethod] || entry.extractionMethod}</div>
                            {entry.url && (
                              <a href={entry.url} target="_blank" rel="noreferrer" className="text-red-600 hover:underline break-all">
                                {entry.url}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Ingen source coverage tillgänglig ännu.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Affärsmodell</p>
                      <p className="text-xs font-bold text-dhl-black">{editData.businessModel}</p>
                    </div>
                    <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Antal Butiker</p>
                        {!isEditing && <FieldSourceBadge evidence={storeCountEvidence} />}
                      </div>
                      <p className="text-xs font-bold text-dhl-black">{displayValue(editData.storeCount)}</p>
                    </div>
                    <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100 col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bransch & Beskrivning</p>
                      <p className="text-xs font-bold text-dhl-black mb-1">{displayValue(editData.industry)}</p>
                      {editData.industryDescription && (
                        <p className="text-[10px] text-dhl-gray-dark leading-relaxed">{editData.industryDescription}</p>
                      )}
                    </div>
                  </div>

                  {renderVerifiedFieldsAccordion('Verifierade fält', [
                    'decisionMakers',
                    'emailPattern',
                    'latestNews'
                  ])}
                </div>
              </div>
              )}
            </motion.div>
          )}

          {activeTab === 'mail' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col"
            >
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="col-span-1 border-r border-slate-100 pr-4 space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Välj Mottagare</p>
                  <div className="space-y-2">
                    {editData.decisionMakers.map((contact, idx) => (
                      <div key={idx} className="space-y-1">
                        <button 
                          onClick={() => setSelectedContactIndex(idx)}
                          className={`w-full p-2.5 text-left rounded-none border transition-all ${
                            selectedContactIndex === idx 
                              ? 'bg-dhl-gray-light border-dhl-gray-medium ring-1 ring-red-200' 
                              : 'bg-white border-slate-100 hover:border-dhl-gray-medium'
                          }`}
                        >
                          <p className={`text-xs font-bold ${selectedContactIndex === idx ? 'text-[#D40511]' : 'text-dhl-black'}`}>{contact.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{contact.title}</p>
                        </button>
                        <div className="flex gap-1 px-1">
                          <a 
                            href={contact.linkedin} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-[#0077b5] transition-colors"
                          >
                            <Linkedin className="w-3 h-3" />
                          </a>
                          <a 
                            href={`mailto:${contact.email}`}
                            className="p-1 text-slate-400 hover:text-[#D40511] transition-colors"
                          >
                            <Mail className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Språk</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setMailLanguage('sv')}
                        className={`flex-1 py-1.5 text-[10px] font-bold border transition-all ${mailLanguage === 'sv' ? 'bg-dhl-black text-white border-slate-900' : 'bg-white text-slate-500 border-dhl-gray-medium hover:border-dhl-gray-medium'}`}
                      >
                        Svenska
                      </button>
                      <button 
                        onClick={() => setMailLanguage('en')}
                        className={`flex-1 py-1.5 text-[10px] font-bold border transition-all ${mailLanguage === 'en' ? 'bg-dhl-black text-white border-slate-900' : 'bg-white text-slate-500 border-dhl-gray-medium hover:border-dhl-gray-medium'}`}
                      >
                        Engelska
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aktiv Mall</p>
                      <button 
                        onClick={onOpenMailSettings}
                        className="text-[10px] font-bold text-[#D40511] hover:underline"
                      >
                        Redigera Mall
                      </button>
                    </div>
                    <div className="p-3 bg-dhl-gray-light border border-dhl-gray-medium rounded-none">
                      <div 
                        className="text-[10px] text-dhl-gray-dark leading-relaxed"
                        dangerouslySetInnerHTML={{ 
                          __html: (mailLanguage === 'sv' ? customTemplateSv : customTemplateEn) || 
                                  (mailLanguage === 'sv' ? 'Ingen anpassad mall sparad.' : 'No custom template saved.') 
                        }}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={() => handleGenerateMail(selectedContactIndex)}
                    disabled={isGenerating}
                    className="w-full py-2 bg-[#D40511] text-white rounded-none text-xs font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Generera med Mall
                  </button>
                </div>

                <div className="col-span-3 flex flex-col">
                  <div className="mb-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-none flex items-center justify-center">
                        <Mail className="w-5 h-5 text-[#D40511]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-dhl-black">Mail-förslag till {editData.decisionMakers[selectedContactIndex]?.name}</h3>
                        <p className="text-xs text-slate-500">Baserat på Surgical Analysis v25.1</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 bg-white border border-dhl-gray-medium rounded-none text-xs font-bold text-dhl-gray-dark hover:bg-dhl-gray-light transition-all">
                        Redigera
                      </button>
                      <button className="px-3 py-1.5 bg-[#D40511] text-white rounded-none text-xs font-bold hover:bg-red-700 transition-all shadow-sm shadow-red-100 flex items-center gap-1.5">
                        <Save className="w-3.5 h-3.5" /> Kopiera & Skicka
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 bg-dhl-gray-light rounded-none border border-dhl-gray-medium p-8 min-h-[400px]">
                    {isGenerating ? (
                      <div className="h-full flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="w-8 h-8 text-[#D40511] animate-spin" />
                        <p className="text-sm font-medium text-slate-500 italic">Genererar högkonverterande copy...</p>
                      </div>
                    ) : generatedHtml ? (
                      <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: generatedHtml }} />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 bg-white rounded-none border border-slate-100 flex items-center justify-center shadow-sm">
                          <Zap className="w-8 h-8 text-slate-300" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-dhl-black">Ingen mail genererad än</p>
                          <p className="text-xs text-slate-500 max-w-[240px] mx-auto mt-1">
                            Välj en beslutsfattare till vänster och klicka på "Generera Förslag".
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'diagnostics' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              {diagnosticsTabContent}
            </motion.div>
          )}

          {activeTab === 'pricing' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              {offerRecommendationTabContent}
            </motion.div>
          )}

          {activeTab === 'analysis' && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full"
            >
              {!deepScanActive ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-yellow-50 rounded-none flex items-center justify-center relative">
                    <Microscope className="w-10 h-10 text-[#D40511]" />
                    {isAnalyzing && (
                      <motion.div 
                        className="absolute inset-0 border-4 border-[#D40511] rounded-none"
                        animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>
                  
                  <div className="max-w-xs">
                    <h3 className="text-lg font-bold text-dhl-black mb-2">Surgical QuickScan AI</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Kör en djupanalys av bolagets logistikflöden, DMT-påslag och potentiella Revenue Recovery.
                    </p>
                  </div>

                  <button 
                    onClick={handleQuickScan}
                    disabled={isAnalyzing}
                    className={`px-8 py-3 bg-[#D40511] text-white font-bold rounded-none shadow-lg shadow-red-200 transition-all flex items-center gap-2 ${
                      isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700 hover:scale-105 active:scale-95'
                    }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {analysisText}
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" /> Starta QuickScan
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-emerald-50 rounded-none border border-emerald-100">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Revenue Recovery Potential</h4>
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-3xl font-black text-emerald-700 mb-2">{displayValue(editData.recoveryPotentialSek)}</p>
                      <p className="text-xs text-emerald-600 leading-relaxed">
                        Beräknad årlig besparing genom optimerad carrier-mix och sänkta returkostnader.
                      </p>
                    </div>
                    <div className="p-6 bg-yellow-50 rounded-none border border-red-100">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-bold text-red-800 uppercase tracking-wider">Conversion Impact</h4>
                        <CheckCircle2 className="w-5 h-5 text-[#D40511]" />
                      </div>
                      <p className="text-3xl font-black text-red-700 mb-2">{editData.conversionScore !== undefined ? `+${editData.conversionScore}%` : '—'}</p>
                      <p className="text-xs text-red-600 leading-relaxed">
                        Estimerad ökning i checkout-konvertering vid implementering av {activeCarrier} Express.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {editData.dmtMatrix && editData.dmtMatrix.length > 0 ? (
                      <div className="p-6 bg-dhl-gray-light rounded-none border border-dhl-gray-medium">
                        <h4 className="text-sm font-bold text-dhl-black mb-4 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-[#D40511]" /> DMT Matrix
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-400 uppercase tracking-wider border-b border-dhl-gray-medium">
                                <th className="text-left py-2">Segment</th>
                                <th className="text-right py-2">Nuvarande</th>
                                <th className="text-right py-2">Mål</th>
                                <th className="text-right py-2">Besparing</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {editData.dmtMatrix.map((row, i) => (
                                <tr key={i}>
                                  <td className="py-2 text-dhl-gray-dark">{row.segment}</td>
                                  <td className="py-2 text-right text-dhl-black font-medium">{row.currentCost}%</td>
                                  <td className="py-2 text-right text-emerald-600 font-bold">{row.targetCost}%</td>
                                  <td className="py-2 text-right text-[#D40511] font-bold">-{row.savingPercentage}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 bg-dhl-gray-light rounded-none border border-dhl-gray-medium">
                        <h4 className="text-sm font-bold text-dhl-black mb-4 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-[#D40511]" /> DMT & Bränsleanalys
                        </h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <span className="text-xs text-slate-500">Nuvarande snittpåslag (est):</span>
                            <span className="text-sm font-bold text-dhl-black">21.8%</span>
                          </div>
                          <div className="w-full bg-dhl-gray-medium h-2 rounded-none overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }} animate={{ width: '70%' }}
                              className="bg-[#D40511] h-full"
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 italic">
                            * Baserat på historisk data för {editData.ecommercePlatform}-användare inom {editData.segment}.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="p-6 bg-dhl-gray-light rounded-none border border-dhl-gray-medium">
                      <h4 className="text-sm font-bold text-dhl-black mb-4 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-500" /> Friktionsanalys
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Antal klick till köp:</span>
                          <span className="font-bold text-dhl-black">{displayValue(editData.frictionAnalysis?.companyClicks)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Benchmark:</span>
                          <span className="font-bold text-emerald-600">{displayValue(editData.frictionAnalysis?.benchmarkClicks)}</span>
                        </div>
                        <p className="text-xs text-dhl-gray-dark mt-2 bg-white p-2 rounded-none border border-slate-100">
                          {displayValue(editData.frictionAnalysis?.frictionNote)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-100 bg-dhl-gray-light/50 flex justify-between items-center">
        <div className="flex gap-2">
          <button 
            onClick={() => onRefreshAnalysis && onRefreshAnalysis(editData.companyName)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-dhl-gray-medium rounded-none text-xs font-bold text-dhl-gray-dark hover:bg-dhl-gray-light transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Uppdatera Data
          </button>
          <button 
            onClick={() => onDownloadSingle && onDownloadSingle(editData)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-dhl-gray-medium rounded-none text-xs font-bold text-dhl-gray-dark hover:bg-dhl-gray-light transition-all"
          >
            <ArrowDownRight className="w-3.5 h-3.5" /> Exportera PDF
          </button>
        </div>
        
        <div className="flex gap-2">
          <a 
            href={editData.websiteUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-dhl-gray-medium rounded-none text-xs font-bold text-dhl-gray-dark hover:bg-dhl-gray-light transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Besök Webbplats
          </a>
          {isEditing && (
            <button 
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-none text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100"
            >
              <Check className="w-3.5 h-3.5" /> Spara Ändringar
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-dhl-black/60 backdrop-blur-sm z-modal flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-none border-2 border-[#D40511] shadow-2xl max-w-md w-full p-8"
            >
              <div className="flex items-center gap-3 text-[#D40511] mb-4">
                <Trash2 className="w-6 h-6" />
                <h3 className="text-xl font-bold uppercase tracking-tight">Radera Lead?</h3>
              </div>
              
              <p className="text-sm text-dhl-gray-dark mb-6 leading-relaxed">
                Är du säker på att du vill radera <strong>{editData.companyName}</strong>? 
                Detta går inte att ångra. Vänligen ange anledning nedan för vår statistik.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anledning till radering</label>
                  <select 
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    className="w-full px-4 py-2.5 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all text-sm"
                  >
                    <option value="">Välj anledning...</option>
                    <option value="NOT_RELEVANT">Ej relevant bransch</option>
                    <option value="EXISTING_CUSTOMER">Befintlig kund</option>
                    <option value="INCORRECT_DATA">Felaktig data</option>
                    <option value="DUPLICATE">Dubblett</option>
                    <option value="OTHER">Övrigt</option>
                  </select>
                </div>

                {deleteReason === 'OTHER' && (
                  <textarea 
                    placeholder="Beskriv anledningen..."
                    className="w-full px-4 py-2.5 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all text-sm h-24 resize-none"
                  />
                )}

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-3 bg-dhl-gray-light text-dhl-gray-dark font-bold rounded-none hover:bg-dhl-gray-medium transition-all text-sm"
                  >
                    Avbryt
                  </button>
                  <button 
                    onClick={() => {
                      if (onDeleteLead) onDeleteLead(editData.id, deleteReason);
                      setShowDeleteConfirm(false);
                    }}
                    disabled={!deleteReason}
                    className="flex-1 py-3 bg-[#D40511] text-white font-bold rounded-none hover:bg-red-700 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Radera Permanent
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Overlay */}
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 p-8"
          >
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-dhl-black">Redigera Lead</h2>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-dhl-gray-light rounded-none transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bolagsnamn</label>
                  <input 
                    type="text" 
                    value={editData.companyName} 
                    onChange={e => setEditData({...editData, companyName: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Org. Nummer</label>
                  <input 
                    type="text" 
                    value={editData.orgNumber} 
                    onChange={e => setEditData({...editData, orgNumber: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Adress</label>
                  <input 
                    type="text" 
                    value={editData.address} 
                    onChange={e => setEditData({...editData, address: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Omsättning</label>
                  <input 
                    type="text" 
                    value={editData.revenue} 
                    onChange={e => setEditData({...editData, revenue: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fraktestimat</label>
                  <input 
                    type="text" 
                    value={editData.freightBudget} 
                    onChange={e => setEditData({...editData, freightBudget: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Årliga Paket</label>
                  <input 
                    type="number" 
                    value={editData.annualPackages} 
                    onChange={e => setEditData({...editData, annualPackages: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-plattform</label>
                  <input 
                    type="text" 
                    value={editData.ecommercePlatform} 
                    onChange={e => setEditData({...editData, ecommercePlatform: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">TA-System</label>
                  <input 
                    type="text" 
                    value={editData.taSystem} 
                    onChange={e => setEditData({...editData, taSystem: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Affärsmodell</label>
                  <input 
                    type="text" 
                    value={editData.businessModel} 
                    onChange={e => setEditData({...editData, businessModel: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Antal Butiker</label>
                  <input 
                    type="number" 
                    value={editData.storeCount} 
                    onChange={e => setEditData({...editData, storeCount: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telefon</label>
                  <input 
                    type="text" 
                    value={editData.phoneNumber || ''} 
                    onChange={e => setEditData({...editData, phoneNumber: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bransch</label>
                  <input 
                    type="text" 
                    value={editData.industry || ''} 
                    onChange={e => setEditData({...editData, industry: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lageradress</label>
                  <input 
                    type="text" 
                    value={editData.warehouseAddress || ''} 
                    onChange={e => setEditData({...editData, warehouseAddress: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hemsida URL</label>
                  <input 
                    type="text" 
                    value={editData.websiteUrl || ''} 
                    onChange={e => setEditData({...editData, websiteUrl: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Soliditet</label>
                  <input 
                    type="text" 
                    value={editData.solidity || ''} 
                    onChange={e => setEditData({...editData, solidity: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Likviditet</label>
                  <input 
                    type="text" 
                    value={editData.liquidityRatio || ''} 
                    onChange={e => setEditData({...editData, liquidityRatio: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vinstmarginal</label>
                  <input 
                    type="text" 
                    value={editData.profitMargin || ''} 
                    onChange={e => setEditData({...editData, profitMargin: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skuldsättningsgrad</label>
                  <input 
                    type="text" 
                    value={editData.debtEquityRatio || ''} 
                    onChange={e => setEditData({...editData, debtEquityRatio: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skuldsaldo</label>
                  <input 
                    type="text" 
                    value={editData.debtBalance || ''} 
                    onChange={e => setEditData({...editData, debtBalance: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Betalningsanm.</label>
                  <input 
                    type="text" 
                    value={editData.paymentRemarks || ''} 
                    onChange={e => setEditData({...editData, paymentRemarks: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">B2C %</label>
                  <input 
                    type="number" 
                    value={editData.b2cPercentage ?? ''} 
                    onChange={e => setEditData({...editData, b2cPercentage: e.target.value === '' ? undefined : parseInt(e.target.value, 10)})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">B2B %</label>
                  <input 
                    type="number" 
                    value={editData.b2bPercentage ?? ''} 
                    onChange={e => setEditData({...editData, b2bPercentage: e.target.value === '' ? undefined : parseInt(e.target.value, 10)})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Omsättningsår</label>
                  <input 
                    type="text" 
                    value={editData.revenueYear || ''} 
                    onChange={e => setEditData({...editData, revenueYear: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vinst</label>
                  <input 
                    type="text" 
                    value={editData.profit || ''} 
                    onChange={e => setEditData({...editData, profit: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Anställda</label>
                  <input 
                    type="number" 
                    value={editData.employeesCount || 0} 
                    onChange={e => setEditData({...editData, employeesCount: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Est. AOV (kr)</label>
                  <input 
                    type="number" 
                    value={editData.estimatedAOV || 0} 
                    onChange={e => setEditData({...editData, estimatedAOV: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Potential (SEK)</label>
                  <input 
                    type="number" 
                    value={editData.potentialSek || 0} 
                    onChange={e => setEditData({...editData, potentialSek: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aktiva Marknader</label>
                  <input 
                    type="text" 
                    value={Array.isArray(editData.activeMarkets) ? editData.activeMarkets.join(', ') : ''} 
                    onChange={e => setEditData({...editData, activeMarkets: e.target.value.split(',').map(value => value.trim()).filter(Boolean)})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recovery Potential</label>
                  <input 
                    type="text" 
                    value={editData.recoveryPotentialSek || ''} 
                    onChange={e => setEditData({...editData, recoveryPotentialSek: e.target.value})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conversion Score (%)</label>
                  <input 
                    type="number" 
                    value={editData.conversionScore || 0} 
                    onChange={e => setEditData({...editData, conversionScore: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Strategisk Pitch</label>
                <textarea 
                  rows={4}
                  value={editData.strategicPitch} 
                  onChange={e => setEditData({...editData, strategicPitch: e.target.value})}
                  className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-6 flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2.5 bg-dhl-gray-light text-dhl-gray-dark font-bold rounded-none hover:bg-dhl-gray-medium transition-all"
                >
                  Avbryt
                </button>
                <button 
                  onClick={handleSave}
                  className="px-8 py-2.5 bg-[#D40511] text-white font-bold rounded-none hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Spara Lead
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Print-Ready Container */}
      <div 
        ref={printRef} 
        style={{ position: 'absolute', left: '-9999px', top: 0, width: '1000px', display: 'none' }}
        className="bg-white p-8 space-y-8"
      >
        {/* Header */}
        <div className="border-b-4 border-[#D40511] pb-4 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-sm font-black px-2 py-0.5 rounded-none ${getSegmentBadgeStyle(editData.segment)}`}>{editData.segment}</span>
              <h1 className="text-3xl font-black text-dhl-black">{editData.companyName}</h1>
            </div>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Surgical Analysis Report | {activeCarrier}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Analysdatum: {displayValue(editData.analysisDate)}</p>
            <p className="text-xs text-slate-400">Org.nr: {editData.orgNumber}</p>
          </div>
        </div>

        {/* Overview Section */}
        <div className="grid grid-cols-2 gap-8">
          {/* Financials & Risk */}
          <div className="space-y-6">
            <h2 className="text-lg font-black uppercase tracking-wider text-[#D40511] border-b border-slate-100 pb-2">Finansiell Status & Risk</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-dhl-gray-light border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Omsättning</p>
                <p className="text-sm font-black">{editData.revenue}</p>
              </div>
              <div className="p-4 bg-dhl-gray-light border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Resultat</p>
                <p className="text-sm font-black">{editData.profit}</p>
              </div>
              <div className="p-4 bg-dhl-gray-light border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Soliditet</p>
                <p className="text-sm font-black">{editData.solidity}</p>
              </div>
              <div className="p-4 bg-dhl-gray-light border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Likviditet</p>
                <p className="text-sm font-black">{editData.liquidityRatio}</p>
              </div>
            </div>
            <div className="p-4 bg-dhl-gray-light border border-red-100">
              <p className="text-[10px] font-bold text-red-400 uppercase">Kreditvärdighet</p>
              <p className="text-sm font-black text-red-700">{editData.creditRatingLabel}</p>
            </div>
          </div>

          {/* Logistics & Potential */}
          <div className="space-y-6">
            <h2 className="text-lg font-black uppercase tracking-wider text-[#D40511] border-b border-slate-100 pb-2">Logistik & Potential</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-dhl-gray-light border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Segment</p>
                <p className="text-sm font-black">{editData.segment}</p>
              </div>
              <div className="p-4 bg-dhl-gray-light border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Fraktpotential</p>
                <p className="text-sm font-black">{editData.freightBudget}</p>
              </div>
              <div className="p-4 bg-dhl-gray-light border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Årliga Paket</p>
                <p className="text-sm font-black">{editData.annualPackages}</p>
              </div>
              <div className="p-4 bg-dhl-gray-light border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">B2C %</p>
                <p className="text-sm font-black">{editData.b2cPercentage}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="space-y-4">
          <h2 className="text-lg font-black uppercase tracking-wider text-[#D40511] border-b border-slate-100 pb-2">Teknisk Stack</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Plattform</p>
              <p className="text-xs font-bold">{editData.ecommercePlatform}</p>
            </div>
            <div className="p-3 border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Checkout</p>
              <p className="text-xs font-bold">{displayValue(editData.checkoutSolution)}</p>
            </div>
            <div className="p-3 border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase">TA-System</p>
              <p className="text-xs font-bold">{editData.taSystem}</p>
            </div>
            <div className="p-3 border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Transportörer</p>
              <p className="text-xs font-bold">{editData.carriers}</p>
            </div>
          </div>
        </div>

        {/* Surgical Analysis */}
        <div className="space-y-6 pt-4">
          <h2 className="text-lg font-black uppercase tracking-wider text-[#D40511] border-b border-slate-100 pb-2">Surgical Analysis Insights</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 bg-emerald-50 border border-emerald-100">
              <p className="text-xs font-bold text-emerald-800 uppercase mb-2">Revenue Recovery Potential</p>
              <p className="text-3xl font-black text-emerald-700">{displayValue(editData.recoveryPotentialSek)}</p>
            </div>
            <div className="p-6 bg-dhl-gray-light border border-red-100">
              <p className="text-xs font-bold text-red-800 uppercase mb-2">Conversion Impact</p>
              <p className="text-3xl font-black text-red-700">{editData.conversionScore !== undefined ? `+${editData.conversionScore}%` : '—'}</p>
            </div>
          </div>
          <div className="p-6 bg-dhl-gray-light border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Strategisk Pitch</p>
            <p className="text-sm text-dhl-gray-dark leading-relaxed italic">"{editData.strategicPitch}"</p>
          </div>
        </div>

        {/* Decision Makers */}
        <div className="space-y-4">
          <h2 className="text-lg font-black uppercase tracking-wider text-[#D40511] border-b border-slate-100 pb-2">Beslutsfattare</h2>
          <div className="grid grid-cols-2 gap-4">
            {editData.decisionMakers.map((dm, i) => (
              <div key={i} className="p-4 border border-slate-100">
                <p className="text-sm font-black">{dm.name}</p>
                <p className="text-xs text-slate-500">{dm.title}</p>
                <p className="text-xs text-slate-400 mt-1">{dm.email}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3PL Modal */}
      <AnimatePresence>
        {is3PLModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-modal flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm shadow-2xl border-t-4 border-red-600 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-[#ffcc00]">
                <h3 className="text-xs font-black italic uppercase flex items-center gap-2 text-black">
                  <Package className="w-4 h-4 text-red-600" />
                  Registrera 3PL Partner
                </h3>
                <button onClick={() => setIs3PLModalOpen(false)} className="text-black hover:bg-black/10 p-1 rounded-full"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">3PL Företagsnamn</label>
                  <input 
                    type="text" 
                    value={new3PLName}
                    onChange={e => setNew3PLName(e.target.value)}
                    placeholder="t.ex. Shelfless, PostNord TPL..."
                    className="w-full text-xs font-bold border-dhl-gray-medium p-2 focus:border-red-600 outline-none"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Adress (Lager)</label>
                  <div className="text-xs font-bold text-dhl-black bg-dhl-gray-light p-2 border border-slate-100 flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {editData.warehouseAddress}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic leading-relaxed">
                  Genom att spara denna adress i 3PL-biblioteket kommer framtida leads med samma lageradress automatiskt flaggas som 3PL-kunder.
                </p>
              </div>
              <div className="p-4 bg-dhl-gray-light border-t flex gap-2">
                <button 
                  onClick={() => setIs3PLModalOpen(false)}
                  className="flex-1 px-4 py-2 text-[10px] font-black uppercase text-dhl-gray-dark hover:bg-dhl-gray-light transition-colors"
                >
                  Avbryt
                </button>
                <button 
                  onClick={() => {
                    if (!new3PLName.trim()) return;
                    const newProvider: ThreePLProvider = {
                      id: crypto.randomUUID(),
                      name: new3PLName.trim(),
                      address: editData.warehouseAddress?.trim() || ''
                    };
                    if (onSaveThreePL) {
                      onSaveThreePL([...threePLProviders, newProvider]);
                    }
                    setIs3PLModalOpen(false);
                    setNew3PLName('');
                  }}
                  className="flex-1 bg-red-600 text-white px-4 py-2 text-[10px] font-black uppercase hover:bg-red-700 transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <Save className="w-3 h-3" /> Spara 3PL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeadCard;


