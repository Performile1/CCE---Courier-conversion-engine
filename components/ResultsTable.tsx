
import React, { useState, useMemo, useEffect } from 'react';
import { LeadData, Segment, ThreePLProvider } from '../types';
import { Search, MapPin, Truck, Hash, LayoutList, Microscope, RefreshCw, Building, Download, ArrowUp, ArrowDown, ArrowUpDown, Trash2, Copy, Tag, Eraser, FileText, AlertCircle, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { RemovalAnalysisModal } from './RemovalAnalysisModal'; 
import { RemovalReason } from '../types'; 

interface ResultsTableProps {
  data: LeadData[];
  onDeepDive: (companyName: string, forceRefresh?: boolean) => void;
  onSelectLead?: (lead: LeadData) => void;
  onCleanDuplicates?: () => void;
  initialFilterScope?: string; 
  allExclusions?: string[]; 
  downloadedLeads?: string[]; 
  onDownloadSingle?: (lead: LeadData) => void;
  onDownloadSelected?: (leads: LeadData[]) => void;
  onRemoveWithReason?: (leads: LeadData[], reason: RemovalReason) => void;
  initialSearchGeo?: string; 
  threePLProviders?: ThreePLProvider[];
}

const parseFinancialValue = (raw: any): number => {
  if (!raw) return 0;
  const cleaned = String(raw).toLowerCase().replace(/tkr/g, '').replace(/kr/g, '').replace(/\s/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
};

const extractCity = (address: string | undefined) => {
  if (!address || address === "-") return "—";
    const parts = String(address).split(',');
    const lastPart = parts[parts.length - 1].trim();
    const cityMatch = lastPart.match(/(?:\d{3}\s?\d{2})\s?(.+)/);
    return cityMatch ? cityMatch[1].trim() : lastPart.replace(/\d+/g, '').trim();
};

const formatFinancialCompact = (raw: string | any) => {
    if (!raw || raw === '0' || raw === '0 tkr' || raw === 'Ej tillgänglig') return "Ej tillgänglig";
    const rawStr = String(raw);
    const match = rawStr.match(/^([\d\s.,]+)(?:tkr|kr)?/i);
    if (match) {
        let numStr = match[1].replace(/\s/g, '').replace(/\u00A0/g, '').replace(',', '.');
        const valTkr = parseFloat(numStr);
        if (isNaN(valTkr)) return rawStr;
        const valSEK = valTkr * 1000;
        if (valSEK >= 1000000000) return (valSEK / 1000000000).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + " mdSEK";
        if (valSEK >= 1000000) return (valSEK / 1000000).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + " MSEK";
        return valTkr.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + " tkr";
    }
    return rawStr;
};

type SortKey = 'companyName' | 'revenue' | 'segment' | 'city';
type SortDirection = 'asc' | 'desc';

export const ResultsTable: React.FC<ResultsTableProps> = ({ 
  data, 
  onDeepDive, 
  onSelectLead,
  onCleanDuplicates,
  initialFilterScope, 
  allExclusions = [],
  onDownloadSingle,
  onDownloadSelected,
  onRemoveWithReason,
  initialSearchGeo,
  threePLProviders = []
}) => {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [filters, setFilters] = useState({ global: '', segment: 'ALL', city: '' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const [isRemovalModalOpen, setIsRemovalModalOpen] = useState(false);
  const [leadsToRemove, setLeadsToRemove] = useState<LeadData[]>([]);

  useEffect(() => {
    setFilters(prev => ({
        ...prev,
        segment: (initialFilterScope && ['TS', 'FS', 'KAM', 'DM'].includes(initialFilterScope)) ? initialFilterScope : 'ALL',
        city: initialSearchGeo || ''
    }));
  }, [initialFilterScope, initialSearchGeo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortConfig]);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 140);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
      if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
      return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-black" /> : <ArrowDown className="w-3 h-3 text-black" />;
  };

  const filteredAndSortedData = useMemo(() => {
    let processed = data.filter(item => item && item.companyName);

    if (allExclusions.length > 0) {
      const exSet = new Set(allExclusions.map(ex => ex.toLowerCase().trim()));
      processed = processed.filter(item => {
        const name = item.companyName.toLowerCase().trim();
        const org = (item.orgNumber || "").toLowerCase().trim();
        return !exSet.has(name) && !exSet.has(org);
      });
    }

    if (filters.global) {
      const term = filters.global.toLowerCase();
      processed = processed.filter(item => 
        (String(item.companyName) || "").toLowerCase().includes(term) ||
        (String(item.orgNumber) || "").toLowerCase().trim().includes(term) ||
        (String(item.address) || "").toLowerCase().includes(term) ||
        (String(item.sniCode) || "").toLowerCase().includes(term)
      );
    }

    if (filters.segment !== 'ALL') {
        processed = processed.filter(item => item.segment === filters.segment);
    }

    if (sortConfig) {
      processed.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';
        switch (sortConfig.key) {
            case 'revenue':
                valA = parseFinancialValue(a.revenue);
                valB = parseFinancialValue(b.revenue);
                break;
            case 'companyName':
                valA = (String(a.companyName) || "").toLowerCase();
                valB = (String(b.companyName) || "").toLowerCase();
                break;
            case 'segment':
                const rank = { 'KAM': 4, 'FS': 3, 'TS': 2, 'DM': 1, 'UNKNOWN': 0 };
                valA = rank[a.segment as keyof typeof rank] || 0;
                valB = rank[b.segment as keyof typeof rank] || 0;
                break;
            case 'city':
                valA = extractCity(a.address).toLowerCase();
                valB = extractCity(b.address).toLowerCase();
                break;
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return processed;
  }, [data, sortConfig, filters, allExclusions]);

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(start, start + pageSize);
  }, [filteredAndSortedData, currentPage, pageSize]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const initiateRemoval = (leads: LeadData[]) => {
    setLeadsToRemove(leads);
    setIsRemovalModalOpen(true);
  };

  const handleConfirmRemoval = (reason: RemovalReason) => {
    onRemoveWithReason?.(leadsToRemove, reason);
    setSelectedIds(new Set());
    setIsRemovalModalOpen(false);
    setLeadsToRemove([]);
  };

  return (
    <div className="w-full relative isolate">
      <div className={`bg-dhl-gray-light border-t-4 border-red-600 border-b border-dhl-gray-medium sticky z-sticky transition-all duration-200 ${isScrolled ? 'top-2 shadow-lg rounded-sm p-2 mx-1' : 'top-0 p-1'}`}>
        <div className="md:hidden flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(prev => !prev)}
            className="flex-1 text-left bg-white border border-dhl-gray-medium rounded-sm px-3 py-2 text-[10px] font-black uppercase tracking-wide"
          >
            {isMobileSearchOpen ? 'Dolj Sokruta' : 'Visa Sokruta'}
          </button>
          <div className="text-[10px] font-black text-slate-500 uppercase bg-white border px-2 py-2 rounded-sm shadow-sm">
            {filteredAndSortedData.length}
          </div>
        </div>

        <div className={`${isMobileSearchOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row items-center justify-between gap-4 mt-2 md:mt-0`}>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrera lista..."
                value={filters.global}
                onChange={(e) => setFilters({...filters, global: e.target.value})}
                className="pl-9 pr-3 py-2 w-full md:w-64 text-xs border border-dhl-gray-medium rounded-sm focus:ring-red-600 focus:border-red-600 shadow-sm"
              />
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onDownloadSelected?.(data.filter(l => selectedIds.has(l.id)))}
                  className="flex items-center gap-1.5 bg-dhl-yellow text-white px-3 py-2 text-[10px] font-bold uppercase hover:bg-dhl-yellow transition-colors shadow-sm rounded-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportera ({selectedIds.size})
                </button>
                <button 
                  onClick={() => initiateRemoval(data.filter(l => selectedIds.has(l.id)))} 
                  className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-2 text-[10px] font-bold uppercase hover:bg-red-700 transition-colors shadow-sm rounded-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Ta bort
                </button>
              </div>
            )}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="text-[10px] font-black text-slate-400 uppercase bg-white border px-3 py-2 rounded-sm shadow-sm flex items-center gap-2">
                <LayoutList className="w-3 h-3" /> Antal i vyn: {filteredAndSortedData.length}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-xl w-full overflow-x-auto relative z-0">
        <div className="min-w-[1000px]">
            <div className="grid grid-cols-[50px_120px_100px_minmax(220px,3fr)_minmax(120px,1fr)_130px_70px_minmax(160px,2fr)_170px] bg-yellow-400 border-b-2 border-red-600 text-[10px] font-black uppercase tracking-widest py-1 gap-2 px-2 text-red-900 sticky top-0 z-10">
                <div className="flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    onChange={(e) => setSelectedIds(e.target.checked ? new Set(filteredAndSortedData.map(l => l.id)) : new Set())}
                    checked={selectedIds.size > 0 && selectedIds.size === filteredAndSortedData.length}
                    className="rounded-sm border-red-700 text-red-600 focus:ring-red-600 cursor-pointer w-4 h-4" 
                  />
                </div>
                <div className="pl-4 text-left">Org.nr</div>
                <div className="text-left">SNI</div>
                <button onClick={() => handleSort('companyName')} className="text-left hover:text-black flex items-center gap-1">
                    Företagsnamn {getSortIcon('companyName')}
                </button>
                <button onClick={() => handleSort('city')} className="text-left hover:text-black flex items-center gap-1">
                    Ort {getSortIcon('city')}
                </button>
                <button onClick={() => handleSort('revenue')} className="text-left hover:text-black flex items-center gap-1">
                    Omsättning {getSortIcon('revenue')}
                </button>
                <button onClick={() => handleSort('segment')} className="text-left hover:text-black flex items-center gap-1">
                    Seg {getSortIcon('segment')}
                </button>
                <div className="text-left">Kontaktperson</div>
                <div className="text-center">Handlingar</div>
            </div>

            <div className="divide-y divide-dhl-gray-medium">
            {paginatedData.map((lead) => {
                const isAnalyzed = !!lead.analysisDate && lead.analysisDate !== "";
                return (
                    <div 
                        key={lead.id} 
                      className={`relative z-0 grid grid-cols-[50px_120px_100px_minmax(220px,3fr)_minmax(120px,1fr)_130px_70px_minmax(160px,2fr)_170px] hover:bg-dhl-gray-light transition-colors py-3 items-center gap-2 px-2 border-l-4 cursor-pointer ${selectedIds.has(lead.id) ? 'bg-dhl-gray-light border-red-600' : 'border-transparent'}`}
                        onClick={() => onSelectLead?.(lead)}
                    >
                        <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(lead.id)} 
                            onChange={() => toggleSelect(lead.id)}
                            className="rounded-sm border-dhl-gray-medium text-red-600 w-4 h-4" 
                          />
                        </div>
                        <div className="pl-4 text-[10px] font-mono font-bold text-slate-500">{lead.orgNumber || "-"}</div>
                        <div className="text-[10px] font-black text-red-600">{lead.sniCode || "-"}</div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 truncate">
                                <span className="text-xs font-normal text-dhl-black uppercase tracking-tight">{lead.companyName}</span>
                                {threePLProviders.some(p => p.address && lead.warehouseAddress && p.address.toLowerCase().trim() === lead.warehouseAddress.toLowerCase().trim()) && (
                                    <span className="bg-red-600 text-white text-[8px] font-black px-1 rounded-sm flex items-center gap-0.5">
                                        <Package className="w-2 h-2" /> 3PL
                                    </span>
                                )}
                              {lead.hasMonitoredChanges && (
                                <span className="bg-orange-100 text-orange-700 border border-orange-200 text-[8px] font-black px-1 rounded-sm uppercase">
                                  Datadel ändrad
                                </span>
                              )}
                            </div>
                            {!isAnalyzed && <span className="text-[8px] font-black text-dhl-yellow uppercase flex items-center gap-0.5"><AlertCircle className="w-2 h-2"/> DeepScan Required</span>}
                        </div>
                        <div className="text-xs font-bold text-dhl-gray-dark truncate flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-red-600" />
                            {extractCity(lead.address)}
                        </div>
                        <div className="text-xs font-black text-dhl-black font-mono">{formatFinancialCompact(lead.revenue)}</div>
                        <div>
                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-sm border shadow-sm ${
                                lead.segment === 'KAM' ? 'bg-[#D40511] text-white border-[#D40511]' : 
                                lead.segment === 'FS' ? 'bg-[#FFCC00] text-black border-[#FFCC00]' : 
                                lead.segment === 'TS' ? 'bg-dhl-black text-white border-slate-800' :
                                'bg-dhl-gray-light text-dhl-gray-dark border-dhl-gray-medium'
                            }`}>{lead.segment}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-dhl-black truncate">{lead.decisionMakers?.[0]?.name || "Ingen kontakt"}</span>
                            {lead.decisionMakers?.[0]?.title && <span className="text-[9px] text-slate-400 font-black uppercase truncate">{lead.decisionMakers[0].title}</span>}
                        </div>
                        <div className="flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (isAnalyzed) {
                                     onSelectLead?.(lead);
                                  } else {
                                     onDeepDive(lead.companyName); 
                                  }
                                }} 
                                title={isAnalyzed ? "Öppna Analys" : "Kör Djupanalys"}
                                className={`p-2 rounded-sm shadow-sm transition-all flex items-center justify-center ${
                                    isAnalyzed 
                                    ? 'bg-dhl-black text-white hover:bg-black' 
                                    : 'bg-red-600 text-white hover:bg-red-700 ring-2 ring-red-300 animate-pulse'
                                }`}
                            >
                                {isAnalyzed ? <FileText className="w-3.5 h-3.5" /> : <Microscope className="w-3.5 h-3.5" />}
                            </button>
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDownloadSingle?.(lead); }} 
                                className="p-2 bg-white border border-dhl-gray-medium text-dhl-yellow hover:bg-dhl-yellow hover:text-white rounded-sm shadow-sm transition-all"
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); initiateRemoval([lead]); }} 
                                className="p-2 bg-white border border-dhl-gray-medium text-red-600 hover:bg-red-600 hover:text-white rounded-sm shadow-sm transition-all"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="bg-dhl-gray-light border-t border-dhl-gray-medium p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Visa:</span>
            <select 
              value={pageSize} 
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-[10px] font-bold border border-dhl-gray-medium rounded-sm px-2 py-1 focus:ring-red-600 focus:border-red-600 outline-none bg-white"
            >
              {[10, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size} per sida</option>
              ))}
            </select>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase">
            Visar {Math.min(filteredAndSortedData.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredAndSortedData.length, currentPage * pageSize)} av {filteredAndSortedData.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="px-3 py-1.5 border border-dhl-gray-medium rounded-sm text-[10px] font-bold uppercase hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Föregående
          </button>
          
          <div className="flex items-center gap-1 px-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 flex items-center justify-center rounded-sm text-[10px] font-bold transition-all ${
                    currentPage === pageNum 
                      ? 'bg-red-600 text-white shadow-md' 
                      : 'bg-white border border-dhl-gray-medium text-dhl-gray-dark hover:border-red-300'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button 
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="px-3 py-1.5 border border-dhl-gray-medium rounded-sm text-[10px] font-bold uppercase hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Nästa
          </button>
        </div>
      </div>

      <RemovalAnalysisModal 
        isOpen={isRemovalModalOpen} 
        onClose={() => setIsRemovalModalOpen(false)} 
        onConfirm={handleConfirmRemoval} 
        count={leadsToRemove.length}
      />
    </div>
  );
};



