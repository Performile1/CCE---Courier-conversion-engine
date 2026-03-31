

import React, { useState, useRef } from 'react';
import { Database, Download, ArrowUpRight, Trash2, X, Filter, LayoutGrid, Upload, FileText, CheckCircle2, FileSpreadsheet, FileDown } from 'lucide-react';
import { LeadData, Segment } from '../types';
import * as XLSX from 'xlsx';

interface CacheManagerProps {
  isOpen: boolean;
  onClose: () => void;
  cacheData: LeadData[];
  setCacheData: (data: LeadData[]) => void;
  onMoveToActive: (leads: LeadData[]) => void;
  onDownloadAndExclude?: (lead: LeadData) => void;
  onDownloadAll?: () => void;
  activeLeads: LeadData[]; 
  existingCustomers: string[]; 
  downloadedLeads: string[]; 
}

export const CacheManager: React.FC<CacheManagerProps> = ({
  isOpen,
  onClose,
  cacheData,
  setCacheData,
  onMoveToActive,
  onDownloadAndExclude,
  onDownloadAll,
  activeLeads,
  existingCustomers,
  downloadedLeads
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'import'>('view');
  const [filterSegment, setFilterSegment] = useState<string>('ALL');
  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const filteredData = cacheData.filter(lead => 
    filterSegment === 'ALL' || lead.segment === filterSegment
  );

  const normalizeStr = (s: string) => s.toLowerCase().replace(/ab|as|oy|ltd|inc/g, '').replace(/[^a-z0-9]/g, '');

  const isExcluded = (companyName: string, orgNr: string | undefined) => {
    const allExclusions = [...existingCustomers, ...downloadedLeads];
    const normName = normalizeStr(companyName);
    const normOrg = orgNr ? normalizeStr(orgNr) : '';
    
    return allExclusions.some(ex => {
      const normEx = normalizeStr(ex);
      if (normEx.length < 3) return false; 
      return normName.includes(normEx) || (normOrg && normOrg.includes(normEx));
    });
  };

  const handleClearCache = () => {
    if (window.confirm("Är du säker? Detta tar bort alla sparade leads i reservoaren.")) {
      setCacheData([]);
    }
  };

  const handleMoveAll = () => {
    const leadsToMove = filteredData.filter(c => !activeLeads.some(al => al.companyName === c.companyName));
    if (leadsToMove.length > 0) {
      onMoveToActive(leadsToMove);
    }
    onClose();
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { 
        "Org.nr": "556000-0000", 
        "Företagsnamn": "Exempel Bolag AB", 
        "Omsättning": "100 000 tkr", 
        "Segment": "KAM", 
        "Beslutsfattare": "Anders Andersson (VD)" 
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Importmall");
    XLSX.writeFile(wb, "Invenio_Reservoir_Mall.xlsx");
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n');
    const newLeads: LeadData[] = [];
    lines.forEach(line => {
      const parts = line.split(/,|;|\t/).map(s => s.trim());
      if (parts.length > 0 && parts[0]) {
        const importedLead: LeadData = {
          id: crypto.randomUUID(),
          companyName: parts[0],
          orgNumber: parts[1] || "",
          address: parts[2] || "", 
          segment: Segment.UNKNOWN, 
          revenue: parts[3] || "",
          freightBudget: "",
          legalStatus: "Okänd (Importerad)",
          creditRatingLabel: "",
          decisionMakers: [],
          websiteUrl: "",
          carriers: "",
          source: 'cache',
          analysisDate: "" // Empty analysis date means it needs deep dive
        };
        newLeads.push(importedLead);
      }
    });
    setCacheData([...cacheData, ...newLeads]);
    setImportText('');
    setActiveTab('view');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      const newLeads: LeadData[] = [];
      let textBuffer = ""; 
      
      const headers = jsonData[0]?.map(h => String(h).toLowerCase()) || [];
      const colMap = {
        name: headers.findIndex(h => h.includes('namn') || h.includes('företag') || h.includes('company') || h.includes('bolag')),
        org: headers.findIndex(h => h.includes('org') || h.includes('nummer') || h.includes('identity')),
        revenue: headers.findIndex(h => h.includes('oms') || h.includes('revenue') || h.includes('netto')),
        segment: headers.findIndex(h => h.includes('seg')),
        dm: headers.findIndex(h => h.includes('kontakt') || h.includes('beslut') || h.includes('dm') || h.includes('vd'))
      };

      jsonData.forEach((row, index) => {
        if (row.length === 0 || index === 0) return;
        
        const getVal = (idx: number) => (idx !== -1 && row[idx]) ? String(row[idx]).trim() : "";

        let name = getVal(colMap.name);
        // Om vi inte hittade en namnbaserad kolumn, ta första kolumnen som namn om den ser ut som text
        if (colMap.name === -1 && row[0]) name = String(row[0]).trim();

        let org = getVal(colMap.org);
        let revenue = getVal(colMap.revenue);
        let segmentInput = getVal(colMap.segment).toUpperCase();
        let dmName = getVal(colMap.dm);

        if (!name || isExcluded(name, org)) return;

        let segment = Segment.UNKNOWN;
        if (segmentInput.includes('KAM')) segment = Segment.KAM;
        else if (segmentInput.includes('FS')) segment = Segment.FS;
        else if (segmentInput.includes('TS')) segment = Segment.TS;
        else if (segmentInput.includes('DM')) segment = Segment.DM;

        const importedLead: LeadData = {
            id: crypto.randomUUID(),
            companyName: name,
            orgNumber: org,
            address: "", 
            segment: segment, 
            revenue: revenue,
            freightBudget: "",
            legalStatus: "Excel Import",
            creditRatingLabel: "",
            decisionMakers: dmName ? [{ name: dmName, title: "Importerad", email: "", linkedin: "" }] : [],
            websiteUrl: "",
            carriers: "",
            source: 'cache',
            analysisDate: "" 
        };
        newLeads.push(importedLead);
        textBuffer += `${name}${org ? ' (' + org + ')' : ''}\n`;
      });

      if (newLeads.length > 0) {
          setCacheData([...cacheData, ...newLeads]);
          setImportText(textBuffer); 
          alert(`${newLeads.length} företag importerades.`);
      }
    } catch (error) {
      alert("Kunde inte läsa Excel-filen.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl shadow-2xl border-t-8 border-slate-600 flex flex-col max-h-[90vh]">
        <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700 text-white">
          <div className="flex items-center gap-3">
             <Database className="w-6 h-6" />
             <h2 className="text-lg font-black uppercase">Lead Reservoir (Cache)</h2>
          </div>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <div className="flex border-b border-slate-200 bg-slate-100">
          <button onClick={() => setActiveTab('view')} className={`flex-1 py-3 text-xs font-bold uppercase ${activeTab === 'view' ? 'bg-white border-b-2 border-slate-900' : ''}`}>Hantering</button>
          <button onClick={() => setActiveTab('import')} className={`flex-1 py-3 text-xs font-bold uppercase ${activeTab === 'import' ? 'bg-white border-b-2 border-slate-900' : ''}`}>Importera</button>
        </div>

        {activeTab === 'view' ? (
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            <div className="flex justify-between mb-4">
               <select value={filterSegment} onChange={e => setFilterSegment(e.target.value)} className="text-xs font-bold border rounded p-1">
                 <option value="ALL">Alla Segment</option>
                 <option value="KAM">KAM</option>
                 <option value="FS">FS</option>
               </select>
               <button onClick={handleClearCache} className="text-red-600 text-xs font-bold flex items-center gap-1"><Trash2 className="w-4 h-4"/> Töm</button>
            </div>
            <div className="space-y-2">
              {filteredData.map((lead, i) => (
                <div key={i} className="bg-white p-3 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-bold text-sm">{lead.companyName}</div>
                    <div className="text-[10px] text-slate-500">{lead.orgNumber} | {lead.revenue}</div>
                  </div>
                  <button onClick={() => onMoveToActive([lead])} className="text-red-600"><ArrowUpRight className="w-5 h-5"/></button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 p-6 flex flex-col bg-slate-50">
             <div className="flex gap-2 mb-4">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" id="cache-excel" />
                <label htmlFor="cache-excel" className="bg-green-600 text-white px-4 py-2 text-xs font-bold uppercase cursor-pointer">Ladda upp Excel</label>
                <button onClick={handleDownloadTemplate} className="bg-white border px-4 py-2 text-xs font-bold uppercase">Mall</button>
             </div>
             <p className="text-[10px] text-slate-500 mb-4 italic">Systemet letar automatiskt efter kolumner för Namn, Org.nr och Omsättning.</p>
             <textarea value={importText} readOnly className="flex-1 bg-white border p-3 font-mono text-xs mb-4" placeholder="Förhandsgranskning..." />
             <button onClick={handleImport} className="bg-slate-900 text-white py-3 font-bold uppercase">Spara till Reservoar</button>
          </div>
        )}
      </div>
    </div>
  );
};