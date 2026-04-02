
import React from 'react';
import { X, Trash2, Copy, UserCheck, Ban, History, AlertTriangle } from 'lucide-react';
import { RemovalReason } from '../types'; // Importera RemovalReason från types.ts

interface RemovalAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: RemovalReason) => void;
  count: number;
}

export const RemovalAnalysisModal: React.FC<RemovalAnalysisModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  count
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-lg shadow-2xl border-t-4 border-red-600 relative rounded-sm">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-dhl-gray-light rounded-full text-slate-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <h2 className="text-lg font-black italic uppercase flex items-center gap-2 text-black mb-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            Ta bort {count} företag
          </h2>
          <p className="text-sm text-dhl-gray-dark mb-6">
            Varför vill du ta bort dessa företag från listan? Ditt val avgör hur systemet hanterar datan framöver.
          </p>

          <div className="space-y-4">
            <button 
              onClick={() => onConfirm('DUPLICATE')}
              className="w-full flex items-center gap-3 p-4 bg-dhl-gray-light border border-dhl-gray-medium text-left hover:bg-dhl-gray-light hover:border-red-300 transition-colors shadow-sm rounded-sm"
            >
              <Copy className="w-5 h-5 text-red-600" />
              <div>
                <span className="block text-sm font-bold text-dhl-black">Duplikat / Flera träffar</span>
                <span className="block text-[10px] text-slate-500">Tar bort från vyn. Blockeras INTE från framtida sökningar.</span>
              </div>
            </button>
            <button 
              onClick={() => onConfirm('EXISTING_CUSTOMER')}
              className="w-full flex items-center gap-3 p-4 bg-dhl-gray-light border border-dhl-gray-medium text-left hover:bg-dhl-gray-light hover:border-red-300 transition-colors shadow-sm rounded-sm"
            >
              <UserCheck className="w-5 h-5 text-dhl-yellow" />
              <div>
                <span className="block text-sm font-bold text-dhl-black">Befintlig kund</span>
                <span className="block text-[10px] text-slate-500">Lägger till i "Befintliga Kunder" listan. Kommer aldrig att dyka upp igen.</span>
              </div>
            </button>
            <button 
              onClick={() => onConfirm('ALREADY_DOWNLOADED')}
              className="w-full flex items-center gap-3 p-4 bg-dhl-gray-light border border-dhl-gray-medium text-left hover:bg-dhl-gray-light hover:border-red-300 transition-colors shadow-sm rounded-sm"
            >
              <History className="w-5 h-5 text-red-600" />
              <div>
                <span className="block text-sm font-bold text-dhl-black">Redan bearbetad / Nedladdad</span>
                <span className="block text-[10px] text-slate-500">Lägger till i "Nedladdad Historik". Kommer inte att visas i framtida sökningar.</span>
              </div>
            </button>
            <button 
              onClick={() => onConfirm('NOT_RELEVANT')}
              className="w-full flex items-center gap-3 p-4 bg-dhl-gray-light border border-dhl-gray-medium text-left hover:bg-dhl-gray-light hover:border-red-300 transition-colors shadow-sm rounded-sm"
            >
              <Ban className="w-5 h-5 text-dhl-yellow" />
              <div>
                <span className="block text-sm font-bold text-dhl-black">Inte relevant (fel bransch/segment)</span>
                <span className="block text-[10px] text-slate-500">Lägger till i "Nedladdad Historik". Används för att finjustera AI:n.</span>
              </div>
            </button>
            <button 
              onClick={() => onConfirm('INCORRECT_DATA')}
              className="w-full flex items-center gap-3 p-4 bg-dhl-gray-light border border-dhl-gray-medium text-left hover:bg-dhl-gray-light hover:border-red-300 transition-colors shadow-sm rounded-sm"
            >
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <span className="block text-sm font-bold text-dhl-black">Felaktig data (AI-hallucination)</span>
                <span className="block text-[10px] text-slate-500">Lägger till i "Nedladdad Historik". Används för att förbättra AI:ns precision.</span>
              </div>
            </button>
          </div>
        </div>

        <div className="p-4 bg-dhl-gray-light border-t border-dhl-gray-medium flex justify-end">
          <button onClick={onClose} className="px-6 py-2 text-xs font-black uppercase text-slate-400 hover:text-dhl-gray-dark transition-colors">Avbryt</button>
        </div>
      </div>
    </div>
  );
};

