
import React from 'react';
import { Terminal, ShieldCheck, Activity, X } from 'lucide-react';

interface DailyBriefingProps {
  isOpen: boolean;
  onClose: () => void;
  cacheCount: number;
}

export const DailyBriefing: React.FC<DailyBriefingProps> = ({ isOpen, onClose, cacheCount }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-modal flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dhl-black w-full max-w-lg shadow-2xl border-t-4 border-red-600 relative text-slate-300 font-mono">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-dhl-black rounded-sm text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
             <Terminal className="w-6 h-6 text-yellow-300" />
             <div>
               <h2 className="text-xl font-bold text-white uppercase tracking-wider">Systemstatus</h2>
               <div className="text-[10px] text-slate-500">STRATEGIC ANALYSIS v5.8 // SESSION START</div>
             </div>
          </div>

          <div className="space-y-4 mb-6">
             <div className="flex justify-between items-center p-3 bg-dhl-black/50 border border-slate-700 rounded-sm">
                <span className="text-xs uppercase font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-500" />
                  API Uppkoppling
                </span>
                <span className="text-xs text-green-400 font-bold">ONLINE</span>
             </div>

             <div className="flex justify-between items-center p-3 bg-dhl-black/50 border border-slate-700 rounded-sm">
                <span className="text-xs uppercase font-bold flex items-center gap-2">
                   <ShieldCheck className="w-4 h-4 text-red-500" />
                   Säkerhetsprotokoll
                </span>
                <span className="text-xs text-red-400 font-bold">AKTIV (v8.2)</span>
             </div>

             <div className="flex justify-between items-center p-3 bg-dhl-black/50 border border-slate-700 rounded-sm">
                <span className="text-xs uppercase font-bold text-slate-400">
                   Lead Reservoir (Cache)
                </span>
                <span className="text-xs text-white font-bold">{cacheCount} Bolag sparade</span>
             </div>
          </div>

          <div className="bg-red-600/10 border border-red-600/30 p-4 text-xs leading-relaxed text-slate-200 italic mb-6">
             "Välkommen tillbaka. Systemet är redo för dagens jakt. Kom ihåg att kontrollera exkluderingslistan innan du startar större batch-körningar."
          </div>

          <button
            onClick={onClose}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-6 text-sm font-bold uppercase tracking-wider shadow-lg transition-colors"
          >
            Starta Session
          </button>
        </div>
      </div>
    </div>
  );
};

