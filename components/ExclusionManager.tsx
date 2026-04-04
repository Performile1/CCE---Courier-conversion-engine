

import React, { useState, useEffect, useRef } from 'react';
import { ShieldBan, Download, Trash2, Save, X, History, FileSpreadsheet, Upload, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExclusionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  existingCustomers: string[];
  setExistingCustomers: (list: string[]) => void;
  downloadedLeads: string[];
  setDownloadedLeads: (list: string[]) => void;
}

export const ExclusionManager: React.FC<ExclusionManagerProps> = ({
  isOpen,
  onClose,
  existingCustomers,
  setExistingCustomers,
  downloadedLeads,
  setDownloadedLeads
}) => {
  const [activeTab, setActiveTab] = useState<'existing' | 'history'>('existing');
  const [textInput, setTextInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'existing') {
      setTextInput(existingCustomers.join('\n'));
    }
  }, [activeTab, existingCustomers, isOpen]);

  if (!isOpen) return null;

  const handleSaveExisting = () => {
    const list = textInput
      .split(/[\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    const uniqueList = Array.from(new Set(list));
    setExistingCustomers(uniqueList);
    onClose();
  };

  const clearHistory = () => {
    if (window.confirm("Är du säker på att du vill rensa ALL historik över nedladdade leads? Detta kan inte ångras.")) {
      setDownloadedLeads([]);
    }
  };

  const removeSingleHistoryItem = (itemToRemove: string) => {
    const updated = downloadedLeads.filter(item => item !== itemToRemove);
    setDownloadedLeads(updated);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { "Org.nr": "556000-0000", "Företagsnamn": "Exempel Bolag AB" },
      { "Org.nr": "SE556123456701", "Företagsnamn": "Testbolaget HB" }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exkludering");
    XLSX.writeFile(wb, "Invenio_Exkludering_Mall.xlsx");
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
      let textBuffer = "";
      jsonData.forEach((row, index) => {
        if (row.length === 0) return;
        const col0 = row[0] ? String(row[0]).trim() : "";
        const col1 = row[1] ? String(row[1]).trim() : "";
        if (index === 0 && (col0.toLowerCase().includes('org') || col1.toLowerCase().includes('namn'))) return;
        if (col0) textBuffer += `${col0}\n`;
        if (col1) textBuffer += `${col1}\n`;
      });
      setTextInput(prev => prev + (prev ? "\n" : "") + textBuffer);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      alert("Kunde inte läsa Excel-filen.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl shadow-2xl border-t-4 border-red-600 flex flex-col max-h-[90vh]">
        
        <div className="bg-white p-4 flex justify-between items-center border-b border-dhl-gray-medium">
          <h2 className="text-lg font-black italic uppercase flex items-center gap-2 text-black">
            <ShieldBan className="w-5 h-5 text-red-600" />
            Hantera Exkluderingar
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        <div className="flex border-b border-dhl-gray-medium">
          <button
            onClick={() => setActiveTab('existing')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${
              activeTab === 'existing' ? 'bg-white text-red-600 border-b-2 border-red-600' : 'bg-dhl-gray-light text-slate-500'
            }`}
          >
            Befintliga Kunder ({existingCustomers.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${
              activeTab === 'history' ? 'bg-white text-red-600 border-b-2 border-red-600' : 'bg-dhl-gray-light text-slate-500'
            }`}
          >
            Nedladdad Historik ({downloadedLeads.length})
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'existing' ? (
            <div className="space-y-4">
              <div className="bg-dhl-gray-light p-3 border-l-4 border-dhl-red">
                <p className="text-xs text-red-800">
                  Lägg till Org.nr eller Företagsnamn (ett per rad) för att blockera dem.
                </p>
              </div>
              <div className="flex gap-2">
                <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" id="ex-upload" />
                <label htmlFor="ex-upload" className="flex items-center gap-2 bg-dhl-yellow text-white px-4 py-2 text-xs font-bold uppercase cursor-pointer hover:bg-dhl-yellow shadow-sm rounded-sm">
                  <FileSpreadsheet className="w-4 h-4" /> Ladda upp Excel
                </label>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 bg-white border border-dhl-gray-medium text-dhl-gray-dark px-3 py-2 text-xs font-bold uppercase hover:bg-dhl-gray-light shadow-sm rounded-sm">
                  <FileDown className="w-4 h-4" /> Mall
                </button>
              </div>
              <textarea
                className="w-full h-64 p-3 text-xs border border-dhl-gray-medium focus:border-red-600 focus:ring-red-600 rounded-none font-mono"
                placeholder="Exempel:&#10;556000-0000&#10;Volvo Cars"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              ></textarea>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-dhl-gray-light border-l-4 border-green-500 p-3 flex justify-between items-center">
                <p className="text-xs text-green-800">
                  Företag som bearbetats exkluderas automatiskt från framtida sökningar.
                </p>
                <button 
                  onClick={clearHistory}
                  disabled={downloadedLeads.length === 0}
                  className="bg-red-600 text-white px-3 py-1 text-[10px] font-black uppercase hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Rensa allt
                </button>
              </div>
              <div className="border border-dhl-gray-medium bg-dhl-gray-light h-80 overflow-y-auto rounded-sm shadow-inner">
                {downloadedLeads.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs italic uppercase font-bold">Historiken är tom</div>
                ) : (
                  <div className="divide-y divide-dhl-gray-medium">
                    {downloadedLeads.map((lead, idx) => (
                      <div key={idx} className="p-3 bg-white flex justify-between items-center group hover:bg-dhl-gray-light transition-colors">
                        <span className="text-xs font-mono font-bold text-dhl-gray-dark">{lead}</span>
                        <button 
                          onClick={() => removeSingleHistoryItem(lead)}
                          className="text-slate-300 hover:text-red-600 transition-colors p-1"
                          title="Ta bort från exkludering"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-dhl-gray-light border-t border-dhl-gray-medium flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-xs font-black uppercase text-slate-400 hover:text-dhl-gray-dark transition-colors">Avbryt</button>
          {activeTab === 'existing' && (
            <button
              onClick={handleSaveExisting}
              className="flex items-center gap-2 bg-red-600 text-white px-8 py-2 text-xs font-black uppercase tracking-wider hover:bg-red-700 transition-all shadow-md"
            >
              <Save className="w-4 h-4" /> Spara Lista
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


