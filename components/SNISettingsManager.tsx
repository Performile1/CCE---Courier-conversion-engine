
import React, { useState } from 'react';
import { Settings2, X, Plus, Trash2, Save, Percent, Search } from 'lucide-react';
import { SNIPercentage } from '../types';

interface SNISettingsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SNIPercentage[];
  onSave: (settings: SNIPercentage[]) => void;
}

export const SNISettingsManager: React.FC<SNISettingsManagerProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<SNIPercentage[]>(settings);
  const [newSni, setNewSni] = useState('');
  const [newPct, setNewPct] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const addSetting = () => {
    if (!newSni.trim()) return;
    const existing = localSettings.find(s => s.sniPrefix === newSni.trim());
    if (existing) {
      setLocalSettings(localSettings.map(s => s.sniPrefix === newSni.trim() ? { ...s, percentage: newPct } : s));
    } else {
      setLocalSettings([...localSettings, { sniPrefix: newSni.trim(), percentage: newPct }]);
    }
    setNewSni('');
    setNewPct(5);
  };

  const removeSetting = (prefix: string) => {
    setLocalSettings(localSettings.filter(s => s.sniPrefix !== prefix));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const filteredSettings = localSettings.filter(s => 
    s.sniPrefix.includes(searchTerm)
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md shadow-2xl border-t-4 border-red-600 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-dhl-gray-medium flex justify-between items-center bg-[#ffcc00]">
          <h2 className="text-sm font-black italic uppercase flex items-center gap-2 text-black">
            <Percent className="w-5 h-5 text-red-600" />
            Fraktomsättning per SNI
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors"><X className="w-5 h-5 text-black" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="bg-dhl-gray-light p-4 border border-dhl-gray-medium space-y-3 rounded-sm shadow-inner">
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Lägg till/Ändra Inställning</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">SNI Prefix (t.ex. 47)</label>
                <input 
                  type="text" 
                  value={newSni}
                  onChange={e => setNewSni(e.target.value)}
                  placeholder="SNI-kod..."
                  className="w-full text-xs border-dhl-gray-medium rounded-sm p-2"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Procent (%)</label>
                <input 
                  type="number" 
                  value={newPct}
                  onChange={e => setNewPct(parseFloat(e.target.value))}
                  className="w-full text-xs border-dhl-gray-medium rounded-sm p-2"
                />
              </div>
            </div>
            <button 
              onClick={addSetting}
              className="w-full bg-dhl-black text-white py-2 text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-red-600 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Uppdatera Inställning
            </button>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
             <div className="relative mb-2">
                <Search className="absolute left-2 top-2 w-3 h-3 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filtrera listan..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-[10px] border border-dhl-gray-medium rounded-sm"
                />
             </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {filteredSettings.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-[10px] italic">Inga specifika inställningar sparade. Alla andra körs på 5%.</div>
              ) : (
                filteredSettings.map(s => (
                  <div key={s.sniPrefix} className="flex items-center justify-between p-2.5 bg-white border border-dhl-gray-medium rounded-sm hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3">
                       <span className="bg-red-600 text-white px-2 py-0.5 text-[10px] font-black rounded-sm">SNI {s.sniPrefix}</span>
                       <span className="text-xs font-black text-dhl-gray-dark">{s.percentage}%</span>
                    </div>
                    <button onClick={() => removeSetting(s.sniPrefix)} className="text-slate-300 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 bg-dhl-gray-light border-t flex justify-end">
          <button onClick={handleSave} className="bg-red-600 text-white px-6 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 transition-all shadow-md">
            <Save className="w-4 h-4" /> Spara inställningar
          </button>
        </div>
      </div>
    </div>
  );
};


