

import React, { useState, useRef } from 'react';
import { Folder, Save, Trash2, RotateCcw, Download, Upload, X, FileJson, Clock, HardDrive, AlertTriangle } from 'lucide-react';

interface BackupItem {
  id: string;
  name: string;
  timestamp: string;
  leadCount: number;
  data: any;
}

interface BackupManagerProps {
  isOpen: boolean;
  onClose: () => void;
  backups: BackupItem[];
  onCreateBackup: (name: string) => void;
  onRestoreBackup: (backup: BackupItem) => void;
  onDeleteBackup: (id: string) => void;
  onImportBackup: (file: File) => void;
  onDownloadCurrent: () => void; // New prop for direct download
}

export const BackupManager: React.FC<BackupManagerProps> = ({
  isOpen,
  onClose,
  backups,
  onCreateBackup,
  onRestoreBackup,
  onDeleteBackup,
  onImportBackup,
  onDownloadCurrent
}) => {
  const [newBackupName, setNewBackupName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBackupName.trim()) return;
    onCreateBackup(newBackupName);
    setNewBackupName('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onImportBackup(e.target.files[0]);
    }
    // Fix for the UI bug: reset input value so the same file can be uploaded again if needed
    if (e.target) {
      e.target.value = '';
    }
  };

  const downloadBackup = (backup: BackupItem) => {
    const jsonString = JSON.stringify(backup.data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Invenio_Backup_${backup.name.replace(/\s+/g, '_')}_${new Date(backup.timestamp).toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-modal flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl shadow-2xl border-t-4 border-red-600 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-dhl-black p-4 flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-dhl-gray-dark p-2 rounded-sm">
               <Folder className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-lg font-black italic uppercase text-white">System Backups</h2>
              <p className="text-xs text-slate-400">
                Lokal mapp för sparade systemtillstånd.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/10 rounded-sm transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-full overflow-hidden bg-dhl-gray-light">
          
          {/* LEFT: Create New & Direct Download */}
          <div className="w-full md:w-1/3 bg-white border-r border-dhl-gray-medium p-6 flex flex-col gap-6 overflow-y-auto">
            
            {/* 1. Create Internal Backup */}
            <div>
              <h3 className="text-sm font-bold text-dhl-black uppercase mb-4 flex items-center gap-2">
                <Save className="w-4 h-4 text-red-600" />
                Skapa ny backup
              </h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Namn på backup</label>
                  <input 
                    type="text" 
                    value={newBackupName}
                    onChange={(e) => setNewBackupName(e.target.value)}
                    placeholder="t.ex. 'Efter Göteborg Batch'"
                    className="w-full text-sm border-dhl-gray-medium rounded-sm focus:border-red-600 focus:ring-red-600"
                    maxLength={30}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!newBackupName.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-dhl-red text-white py-2 px-4 text-xs font-bold uppercase tracking-wider hover:bg-red-800 transition-colors shadow-sm rounded-sm disabled:opacity-50"
                >
                  <HardDrive className="w-4 h-4" />
                  Spara till Mapp
                </button>
              </form>
            </div>

            {/* 2. Direct File Download (Fallback) */}
            <div className="border-t border-dhl-gray-medium pt-6">
                 <h3 className="text-xs font-bold text-dhl-black uppercase mb-3 flex items-center gap-2">
                     <Download className="w-3 h-3 text-red-600" />
                     Säkerhetskopiera (Fil)
                 </h3>
                 <button
                     onClick={onDownloadCurrent}
                     className="w-full flex items-center justify-center gap-2 bg-dhl-gray-light text-dhl-black border border-dhl-gray-medium py-2 px-4 text-xs font-bold uppercase tracking-wider hover:bg-dhl-gray-medium transition-colors shadow-sm rounded-sm"
                 >
                     <FileJson className="w-4 h-4" />
                     Ladda ner Systemstatus
                 </button>
                 <p className="text-[10px] text-slate-400 mt-2 italic leading-tight">
                     Laddar ner nuvarande vy och inställningar direkt till din dator. Används om webblagringen är full.
                 </p>
            </div>

            {/* 3. External Import */}
            <div className="border-t border-dhl-gray-medium pt-6 mt-auto">
               <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                 <Upload className="w-3 h-3" />
                 Extern Import
               </h3>
               <input 
                 type="file" 
                 accept=".json" 
                 ref={fileInputRef} 
                 onChange={handleFileChange} 
                 className="hidden" 
               />
               <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-dhl-gray-medium text-dhl-gray-dark py-2 px-4 text-xs font-bold uppercase tracking-wider hover:bg-dhl-gray-light hover:text-black transition-colors rounded-sm"
               >
                 <FileJson className="w-4 h-4" />
                 Ladda upp .JSON-fil
               </button>
               <p className="text-[10px] text-slate-400 mt-2 italic leading-tight">
                 Importerar en tidigare nedladdad systemfil från din dator.
               </p>
            </div>
          </div>

          {/* RIGHT: List */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-sm font-bold text-dhl-black uppercase mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-slate-500" />
                Sparade Backups ({backups.length})
              </span>
              <span className="text-[10px] text-slate-400 font-normal normal-case italic">
                Sparas lokalt i webbläsaren
              </span>
            </h3>

            {backups.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-dhl-gray-dark border-2 border-dashed border-dhl-gray-medium rounded-sm">
                <Folder className="w-12 h-12 opacity-20 mb-2" />
                <p className="text-sm italic">Mappen är tom.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {backups.map((backup) => (
                  <div key={backup.id} className="bg-white border border-dhl-gray-medium p-4 rounded-sm shadow-sm hover:shadow-md transition-shadow group relative">
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center gap-2">
                          <div className="bg-dhl-gray-light p-1.5 rounded-sm">
                            <FileJson className="w-4 h-4 text-black" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-dhl-black">{backup.name}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-3">
                               <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(backup.timestamp).toLocaleString()}</span>
                               <span className="font-bold text-dhl-gray-dark">{backup.leadCount} bolag</span>
                            </div>
                          </div>
                       </div>
                       <button 
                         onClick={() => onDeleteBackup(backup.id)}
                         className="text-dhl-gray-medium hover:text-dhl-red transition-colors p-1"
                         title="Radera backup permanent"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>

                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-50">
                       <button 
                         onClick={() => {
                             onRestoreBackup(backup);
                             onClose();
                         }}
                         className="flex-1 bg-dhl-gray-light hover:bg-dhl-gray-light text-dhl-black hover:text-dhl-yellow border border-dhl-gray-medium hover:border-green-200 py-1.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded-sm transition-colors"
                       >
                         <RotateCcw className="w-3 h-3" />
                         Återställ
                       </button>
                       <button 
                         onClick={() => downloadBackup(backup)}
                         className="flex-1 bg-white hover:bg-dhl-gray-light text-slate-500 border border-dhl-gray-medium py-1.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded-sm transition-colors"
                       >
                         <Download className="w-3 h-3" />
                         Exportera
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {backups.length > 5 && (
              <div className="mt-4 p-3 bg-dhl-gray-light border border-dhl-gray-medium rounded-sm flex items-start gap-2 text-xs text-dhl-gray-dark">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Tips:</strong> För många backups kan göra webbläsaren långsam. Ladda ner gamla backups till datorn och radera dem härifrån för att frigöra utrymme.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

