import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Plus, Trash2, Linkedin, Mail, ChevronRight, 
  MapPin, Building, Package, DollarSign, Microscope, 
  TrendingUp, CheckCircle2, ShieldAlert, Layout, Truck, ThumbsUp, ThumbsDown, Edit, Download,
  ArrowDownRight, RefreshCw, UserCheck, Calendar as CalendarIcon,
  MessageSquare, ExternalLink, Save, Loader2, Check, X, Zap, Target, BarChart3, FileText, Share2
} from 'lucide-react';
import { LeadData, Segment, ThreePLProvider } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { generateEmailSuggestion } from '../services/openrouterService';
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
  threePLProviders?: ThreePLProvider[];
  onSaveThreePL?: (providers: ThreePLProvider[]) => void;
}

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
  const activeCarrier = activeCarrierProp || "PostNord";
  const calendarUrl = calendarUrlProp || "https://calendly.com/ditt-namn";

  // Initial data
  const [editData, setEditData] = useState<LeadData>({
    id: data?.id ?? crypto.randomUUID(),
    companyName: data?.companyName ?? "Exempelbolaget AB",
    orgNumber: data?.orgNumber ?? "556000-0000",
    revenue: data?.revenue ?? "45 000 tkr",
    revenueYear: data?.revenueYear ?? "2023",
    profit: data?.profit ?? "2 400 tkr",
    segment: data?.segment ?? Segment.FS,
    address: data?.address ?? "Storgatan 1, 111 22 Stockholm",
    visitingAddress: data?.visitingAddress ?? "Storgatan 1, 111 22 Stockholm",
    warehouseAddress: data?.warehouseAddress ?? "Logistikvägen 10, 504 62 Borås",
    annualPackages: data?.annualPackages ?? 12500,
    pos1Volume: data?.pos1Volume ?? 7500,
    pos2Volume: data?.pos2Volume ?? 2750,
    freightBudget: data?.freightBudget ?? "1 250 tkr",
    ecommercePlatform: data?.ecommercePlatform ?? "Shopify",
    paymentProvider: data?.paymentProvider ?? "Klarna",
    taSystem: data?.taSystem ?? "nShift",
    techEvidence: data?.techEvidence ?? "Detekterade Shopify-scripts och Klarna Checkout v3.",
    marketCount: data?.marketCount ?? 3,
    activeMarkets: data?.activeMarkets ?? ["Sverige", "Norge", "Finland"],
    b2bPercentage: data?.b2bPercentage ?? 15,
    b2cPercentage: data?.b2cPercentage ?? 85,
    strategicPitch: data?.strategicPitch ?? "Bolaget har en hög returgrad inom mode-segmentet. Genom att implementera DHL Retur-portal kan vi sänka hanteringskostnaden med 22%.",
    phoneNumber: data?.phoneNumber ?? "",
    decisionMakers: data?.decisionMakers ?? [
      { name: "Anders Andersson", title: "E-handelschef", email: "anders@bolaget.se", linkedin: "#" },
      { name: "Beata Bengtsson", title: "Logistikansvarig", email: "beata@bolaget.se", linkedin: "#" }
    ],
    businessModel: data?.businessModel ?? "Pure Player",
    storeCount: data?.storeCount ?? 0,
    debtEquityRatio: data?.debtEquityRatio ?? "1.2",
    debtBalance: data?.debtBalance ?? "500 tkr",
    solidity: data?.solidity ?? "35%",
    liquidityRatio: data?.liquidityRatio ?? "1.5",
    profitMargin: data?.profitMargin ?? "5.3%",
    legalStatus: data?.legalStatus ?? "Aktiv",
    creditRatingLabel: data?.creditRatingLabel ?? "A (God kreditvärdighet)",
    creditRatingMotivation: data?.creditRatingMotivation ?? "",
    riskProfile: data?.riskProfile ?? "",
    financialTrend: data?.financialTrend ?? "",
    websiteUrl: data?.websiteUrl ?? "https://bolaget.se",
    carriers: data?.carriers ?? "PostNord, Budbee",
    checkoutOptions: data?.checkoutOptions ?? [
      { position: 1, carrier: "PostNord", service: "Mypack Collect", price: "49 kr" },
      { position: 2, carrier: "Budbee", service: "Home Delivery", price: "79 kr" }
    ],
    financialHistory: data?.financialHistory?.length ? data.financialHistory : [
      { year: "2023", revenue: "45 000 tkr", profit: "2 400 tkr" },
      { year: "2022", revenue: "42 500 tkr", profit: "1 800 tkr" },
      { year: "2021", revenue: "38 200 tkr", profit: "1 200 tkr" }
    ],
    paymentRemarks: data?.paymentRemarks ?? "",
    recoveryPotentialSek: data?.recoveryPotentialSek ?? "",
    conversionScore: data?.conversionScore ?? 0,
    frictionAnalysis: data?.frictionAnalysis ?? { companyClicks: 0, benchmarkClicks: 0, frictionNote: "" },
    dmtMatrix: data?.dmtMatrix ?? [],
    estimatedAOV: data?.estimatedAOV ?? 0,
    employeesCount: data?.employeesCount ?? 0,
  });

  const [is3PLModalOpen, setIs3PLModalOpen] = useState(false);
  const [new3PLName, setNew3PLName] = useState('');

  const matched3PL = threePLProviders.find(p => 
    p.address && editData.warehouseAddress && 
    p.address.toLowerCase().trim() === editData.warehouseAddress.toLowerCase().trim()
  );

  // Sync state when data prop changes
  useEffect(() => {
    if (data) {
      setEditData(prev => ({
        ...prev,
        ...data
      }));
      if (data.analysisDate) {
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
        activeCarrier
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
    if (!valStr || valStr === '-' || valStr === 'N/A') return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: 'N/A' };
    const hasPercent = valStr.includes('%');
    // Strip symbols like < or > before parsing
    let cleanValStr = valStr.replace(/[<>]/g, '').replace(',', '.').replace('%', '').trim();
    let val = parseFloat(cleanValStr);
    if (isNaN(val)) return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: 'N/A' };
    
    // If it's a ratio (e.g. 1.5) instead of percentage (e.g. 150)
    if (!hasPercent && val < 10) val = val * 100;

    if (val >= 200) return { className: 'bg-emerald-800 text-white border-emerald-900', label: 'Mycket bra' };
    if (val >= 150) return { className: 'bg-emerald-600 text-white border-emerald-700', label: 'Bra' };
    if (val >= 100) return { className: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Tillfredsställande' };
    if (val >= 50) return { className: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Svag' };
    return { className: 'bg-red-100 text-red-800 border-dhl-gray-medium', label: 'Inte tillfredsställande' };
  };

  const getProfitMarginStyle = (valStr: string) => {
    if (!valStr || valStr === '-' || valStr === 'N/A') return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: 'N/A' };
    let cleanValStr = valStr.replace(/[<>]/g, '').replace(',', '.').replace('%', '').trim();
    const val = parseFloat(cleanValStr);
    if (isNaN(val)) return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: 'N/A' };

    if (val >= 15) return { className: 'bg-emerald-800 text-white border-emerald-900', label: 'Mycket bra' };
    if (val >= 10) return { className: 'bg-emerald-600 text-white border-emerald-700', label: 'Bra' };
    if (val >= 6) return { className: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Tillfredsställande' };
    if (val >= 1) return { className: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Svag' };
    return { className: 'bg-red-100 text-red-800 border-dhl-gray-medium', label: 'Inte tillfredsställande' };
  };

  const getSolidityStyle = (valStr: string) => {
    if (!valStr || valStr === '-' || valStr === 'N/A') return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: 'N/A' };
    let cleanValStr = valStr.replace(/[<>]/g, '').replace(',', '.').replace('%', '').trim();
    const val = parseFloat(cleanValStr);
    if (isNaN(val)) return { className: 'bg-dhl-gray-light border-slate-100 text-dhl-gray-dark', label: 'N/A' };

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
            <div className="flex gap-1">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`px-2 py-1 border rounded-none text-[10px] font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'overview' 
                    ? 'bg-[#D40511] text-white border-[#D40511]' 
                    : 'bg-white text-dhl-gray-dark border-dhl-gray-medium hover:bg-dhl-gray-light'
                }`}
              >
                <Layout className="w-3 h-3" /> Översikt
              </button>
              <button 
                onClick={() => setActiveTab('analysis')}
                className={`px-2 py-1 border rounded-none text-[10px] font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'analysis' 
                    ? 'bg-[#D40511] text-white border-[#D40511]' 
                    : 'bg-white text-dhl-gray-dark border-dhl-gray-medium hover:bg-dhl-gray-light'
                }`}
              >
                <Microscope className="w-3 h-3" /> Surgical Analysis
              </button>
              <button 
                onClick={() => setActiveTab('mail')}
                className={`px-2 py-1 border rounded-none text-[10px] font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'mail' 
                    ? 'bg-[#D40511] text-white border-[#D40511]' 
                    : 'bg-white text-dhl-gray-dark border-dhl-gray-medium hover:bg-dhl-gray-light'
                }`}
              >
                <Mail className="w-3 h-3" /> Mail Engine
              </button>
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
                            <p className="text-sm font-bold text-dhl-black">{editData.orgNumber || 'N/A'}</p>
                          </div>
                          <div className="p-3 bg-white border border-dhl-gray-medium rounded-sm">
                            <p className="text-xs font-bold text-dhl-gray-dark uppercase mb-1">Segment</p>
                            <p className={`text-sm font-bold px-2 py-1 rounded-sm w-fit ${getSegmentBadgeStyle(editData.segment || 'FS')}`}>{editData.segment}</p>
                          </div>
                          <div className="p-3 bg-white border border-dhl-gray-medium rounded-sm">
                            <p className="text-xs font-bold text-dhl-gray-dark uppercase mb-1">Status</p>
                            <p className="text-sm font-bold text-dhl-black">{editData.legalStatus || 'Okänd'}</p>
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
                </div>
              )}

              {/* Show detailed analysis data only if analysis is complete */}
              {(scanComplete || editData.analysisDate) && (
                <div className="grid grid-cols-3 gap-6">
                {/* Kolumn 1: Finansiellt */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-dhl-black flex items-center gap-2 border-b border-slate-100 pb-2">
                    <BarChart3 className="w-4 h-4 text-[#D40511]" /> Finansiellt
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-[#FFCC00] rounded-none border border-black/10 shadow-sm">
                        <p className="text-[10px] font-bold text-black/60 uppercase tracking-wider mb-1">Fraktestimat</p>
                        <p className="text-sm font-black text-black">{editData.freightBudget}</p>
                      </div>
                      <div className="p-3 bg-[#FFCC00] rounded-none border border-black/10 shadow-sm">
                        <p className="text-[10px] font-bold text-black/60 uppercase tracking-wider mb-1">Årliga Paket</p>
                        <p className="text-sm font-black text-black">{editData.annualPackages.toLocaleString()}</p>
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
                      <div className={`p-3 rounded-none border ${getSolidityStyle(editData.solidity || '0').className}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Soliditet</p>
                        <p className="text-sm font-bold">{(!editData.solidity || editData.solidity === '-') ? 'N/A' : editData.solidity}</p>
                        <p className="text-[8px] font-bold uppercase mt-1 opacity-80">{getSolidityStyle(editData.solidity || '0').label}</p>
                      </div>
                      <div className={`p-3 rounded-none border ${getLiquidityStyle(editData.liquidityRatio || '0').className}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Likviditet</p>
                        <p className="text-sm font-bold">{(!editData.liquidityRatio || editData.liquidityRatio === '-') ? 'N/A' : editData.liquidityRatio}</p>
                        <p className="text-[8px] font-bold uppercase mt-1 opacity-80">{getLiquidityStyle(editData.liquidityRatio || '0').label}</p>
                      </div>
                      <div className={`p-3 rounded-none border ${getProfitMarginStyle(editData.profitMargin || '0').className}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Vinstmarginal</p>
                        <p className="text-sm font-bold">{(!editData.profitMargin || editData.profitMargin === '-') ? 'N/A' : editData.profitMargin}</p>
                        <p className="text-[8px] font-bold uppercase mt-1 opacity-80">{getProfitMarginStyle(editData.profitMargin || '0').label}</p>
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
                        <div className={`flex items-center justify-between p-2 border ${getStatusColor(editData.legalStatus || 'Aktiv')}`}>
                          <span className="text-[10px] font-bold uppercase">Status</span>
                          <span className="text-xs font-black uppercase">{editData.legalStatus || 'Aktiv'}</span>
                        </div>

                        {/* Betalningsanmärkningar */}
                        <div className={`flex items-center justify-between p-2 border ${
                          (!editData.paymentRemarks || 
                           editData.paymentRemarks.toLowerCase().includes('inga') || 
                           editData.paymentRemarks.toLowerCase().includes('saknas')) 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                            : 'bg-dhl-gray-light border-red-100 text-red-700'
                        }`}>
                          <span className="text-[10px] font-bold uppercase">Betalningsanm.</span>
                          <span className="text-xs font-black uppercase">{editData.paymentRemarks || 'Inga'}</span>
                        </div>

                        {/* Skuldsaldo */}
                        <div className={`flex items-center justify-between p-2 border ${
                          (!editData.debtBalance || 
                           editData.debtBalance === '0 kr' || 
                           editData.debtBalance === '0' || 
                           (editData.debtBalance && editData.debtBalance.toLowerCase().includes('saknas')) || 
                           (editData.debtBalance && editData.debtBalance.toLowerCase().includes('inga'))) 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                            : 'bg-dhl-gray-light border-red-100 text-red-700'
                        }`}>
                          <span className="text-[10px] font-bold uppercase">Skuldsaldo (KFM)</span>
                          <span className="text-xs font-black uppercase">{editData.debtBalance || '0 kr'}</span>
                        </div>

                        {/* Skuldsättningsgrad */}
                        <div className={`flex items-center justify-between p-2 border ${getDebtEquityColor(editData.debtEquityRatio || '0')}`}>
                          <span className="text-[10px] font-bold uppercase">Skuldsättningsgrad</span>
                          <span className="text-xs font-black uppercase">{editData.debtEquityRatio || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kolumn 2: Logistik & Infrastruktur */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-dhl-black flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Truck className="w-4 h-4 text-[#D40511]" /> Logistik & Infrastruktur
                  </h3>
                  
                  <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Huvudadress</p>
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
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Besöksadress</p>
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
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lageradress</p>
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Checkout-positioner</p>
                    <div className="space-y-2">
                      {editData.checkoutOptions?.map((opt, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 text-dhl-gray-dark">
                            <span className="w-4 h-4 bg-dhl-gray-light rounded-none flex items-center justify-center text-[9px] font-bold">{opt.position}</span>
                            {opt.carrier}
                          </span>
                          <span className="font-bold text-dhl-black">{opt.price}</span>
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
                        <span className="font-bold text-dhl-black">{editData.paymentProvider}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Marknader</p>
                    <div className="flex flex-wrap gap-1">
                      {editData.activeMarkets?.map((m, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-100 rounded-none text-[9px] font-bold text-dhl-gray-dark uppercase">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Volymfördelning</p>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-500">B2C</span>
                          <span className="font-bold text-dhl-black">{editData.b2cPercentage}%</span>
                        </div>
                        <div className="w-full bg-dhl-gray-medium h-1 rounded-none overflow-hidden">
                          <div className="bg-[#D40511] h-full" style={{ width: `${editData.b2cPercentage}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-500">B2B</span>
                          <span className="font-bold text-dhl-black">{editData.b2bPercentage}%</span>
                        </div>
                        <div className="w-full bg-dhl-gray-medium h-1 rounded-none overflow-hidden">
                          <div className="bg-emerald-600 h-full" style={{ width: `${editData.b2bPercentage}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kolumn 3: Beslutsfattare / Pitch / Potential */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-dhl-black flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Layout className="w-4 h-4 text-[#D40511]" /> Beslutsfattare / Pitch / Potential
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
                              <>
                                <p className="text-xs font-bold text-dhl-black">{contact.name}</p>
                                <p className="text-[10px] text-slate-500 mb-2">{contact.title}</p>
                              </>
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

                  <div className="p-3 bg-yellow-50/30 rounded-none border border-yellow-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Strategisk Pitch</p>
                    <p className="text-xs text-dhl-gray-dark leading-relaxed italic">"{editData.strategicPitch}"</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Affärsmodell</p>
                      <p className="text-xs font-bold text-dhl-black">{editData.businessModel}</p>
                    </div>
                    <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Antal Butiker</p>
                      <p className="text-xs font-bold text-dhl-black">{editData.storeCount || 0}</p>
                    </div>
                    <div className="p-3 bg-dhl-gray-light rounded-none border border-slate-100 col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bransch & Beskrivning</p>
                      <p className="text-xs font-bold text-dhl-black mb-1">{editData.industry || 'N/A'}</p>
                      {editData.industryDescription && (
                        <p className="text-[10px] text-dhl-gray-dark leading-relaxed">{editData.industryDescription}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
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
              )}
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
                      <p className="text-3xl font-black text-emerald-700 mb-2">{editData.recoveryPotentialSek || '245 000 kr'}</p>
                      <p className="text-xs text-emerald-600 leading-relaxed">
                        Beräknad årlig besparing genom optimerad carrier-mix och sänkta returkostnader.
                      </p>
                    </div>
                    <div className="p-6 bg-yellow-50 rounded-none border border-red-100">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-bold text-red-800 uppercase tracking-wider">Conversion Impact</h4>
                        <CheckCircle2 className="w-5 h-5 text-[#D40511]" />
                      </div>
                      <p className="text-3xl font-black text-red-700 mb-2">+{editData.conversionScore || '4.2'}%</p>
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
                          <span className="font-bold text-dhl-black">{editData.frictionAnalysis?.companyClicks || 5}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Benchmark:</span>
                          <span className="font-bold text-emerald-600">{editData.frictionAnalysis?.benchmarkClicks || 3}</span>
                        </div>
                        <p className="text-xs text-dhl-gray-dark mt-2 bg-white p-2 rounded-none border border-slate-100">
                          {editData.frictionAnalysis?.frictionNote || 'Hög friktion vid val av utlämningsställe.'}
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
            className="fixed inset-0 bg-dhl-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
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
                    value={editData.b2cPercentage || 0} 
                    onChange={e => setEditData({...editData, b2cPercentage: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-dhl-gray-light border border-dhl-gray-medium rounded-none focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">B2B %</label>
                  <input 
                    type="number" 
                    value={editData.b2bPercentage || 0} 
                    onChange={e => setEditData({...editData, b2bPercentage: parseInt(e.target.value) || 0})}
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
                    value={editData.activeMarkets || ''} 
                    onChange={e => setEditData({...editData, activeMarkets: e.target.value})}
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
            <p className="text-xs text-slate-400">Analysdatum: {editData.analysisDate || new Date().toLocaleDateString()}</p>
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
              <p className="text-xs font-bold">{editData.checkoutSolution || 'N/A'}</p>
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
              <p className="text-3xl font-black text-emerald-700">{editData.recoveryPotentialSek || 'N/A'}</p>
            </div>
            <div className="p-6 bg-dhl-gray-light border border-red-100">
              <p className="text-xs font-bold text-red-800 uppercase mb-2">Conversion Impact</p>
              <p className="text-3xl font-black text-red-700">+{editData.conversionScore || '0'}%</p>
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
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
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


