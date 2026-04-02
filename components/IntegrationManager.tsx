
import React, { useState, useEffect } from 'react';
import { X, Check, Save, Layers, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface IntegrationManagerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIntegrations: string[];
  setIntegrations: (list: string[]) => void;
}

const DEFAULT_SYSTEMS = [
  { id: 'nshift', name: 'nShift (Unifaun/Pacsoft)', type: 'TA' },
  { id: 'webshipper', name: 'Webshipper', type: 'TA' },
  { id: 'logtrade', name: 'LogTrade', type: 'TA' },
  { id: 'centiro', name: 'Centiro', type: 'TA' },
  { id: 'ingrid', name: 'Ingrid (Delivery Checkout)', type: 'Checkout' },
  { id: 'ongoing', name: 'Ongoing WMS', type: 'WMS' },
  { id: 'bitaddict', name: 'BitAddict', type: 'Custom' },
  { id: 'apport', name: 'Apport WMS', type: 'WMS' },
  { id: 'prime', name: 'Prime Ping', type: 'WMS' }
];

export const IntegrationManager: React.FC<IntegrationManagerProps> = ({
  isOpen, onClose, selectedIntegrations, setIntegrations
}) => {
  const [availableSystems, setAvailableSystems] = useState<{id: string, name: string, type: string}[]>([]);
  const [tempSelected, setTempSelected] = useState<string[]>(selectedIntegrations);
  const [newSystemName, setNewSystemName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('dhl_available_systems');
    if (saved) {
      setAvailableSystems(JSON.parse(saved));
    } else {
      setAvailableSystems(DEFAULT_SYSTEMS);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setTempSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const addCustomSystem = () => {
    if (!newSystemName.trim()) return;
    const id = newSystemName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const newSys = { id, name: newSystemName, type: 'Anpassad' };
    const updated = [...availableSystems, newSys];
    setAvailableSystems(updated);
    localStorage.setItem('dhl_available_systems', JSON.stringify(updated));
    setNewSystemName('');
  };

  const removeSystem = (id: string) => {
    const updated = availableSystems.filter(s => s.id !== id);
    setAvailableSystems(updated);
    setTempSelected(prev => prev.filter(i => i !== id));
    localStorage.setItem('dhl_available_systems', JSON.stringify(updated));
  };

  const handleSave = () => {
    setIntegrations(tempSelected);
    localStorage.setItem('dhl_integrations', JSON.stringify(tempSelected));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md shadow-2xl border-t-4 border-red-600 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-dhl-gray-medium flex justify-between items-center bg-[#ffcc00]">
          <h2 className="text-sm font-black italic uppercase flex items-center gap-2 text-black">
            <Layers className="w-5 h-5 text-red-600" />
            Integrationsmöjligheter
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500">Lägg till nytt system</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newSystemName}
                onChange={(e) => setNewSystemName(e.target.value)}
                placeholder="Systemnamn..."
                className="flex-1 text-xs border-dhl-gray-medium rounded-sm p-2"
              />
              <button onClick={addCustomSystem} className="bg-dhl-black text-white p-2 rounded-sm hover:bg-red-600 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-[10px] font-black uppercase text-slate-500">Tillgängliga system (Ja / Nej)</label>
            <div className="grid grid-cols-1 gap-2">
              {availableSystems.map(sys => {
                const isActive = tempSelected.includes(sys.id);
                return (
                  <div
                    key={sys.id}
                    className={`flex items-center justify-between p-3 border rounded-sm transition-all bg-white ${isActive ? 'border-green-500 ring-1 ring-green-100' : 'border-dhl-gray-medium'}`}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-xs font-black uppercase truncate">{sys.name}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{sys.type}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggle(sys.id)} className="flex items-center gap-2 group">
                        <span className={`text-[10px] font-black uppercase ${isActive ? 'text-dhl-yellow' : 'text-slate-400'}`}>
                          {isActive ? 'Ja' : 'Nej'}
                        </span>
                        {isActive ? (
                          <ToggleRight className="w-6 h-6 text-dhl-yellow" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-300" />
                        )}
                      </button>
                      {!DEFAULT_SYSTEMS.some(ds => ds.id === sys.id) && (
                        <button onClick={() => removeSystem(sys.id)} className="p-1 text-slate-300 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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


