
import React, { useState, useEffect } from 'react';
import { Truck, X, Save, Percent, ShieldAlert, BarChart3, Database, TrendingUp } from 'lucide-react';
import { CarrierSettings } from '../types';

interface CarrierSettingsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: CarrierSettings[]) => void;
  currentSettings: CarrierSettings[];
}

const DEFAULT_SETTINGS: CarrierSettings[] = [
  { name: 'PostNord', marketShare: 45.0, avgPrice: 51, dmt: 4.6, sulfur: 1.0, volumeOmbud: 46170000, volumeSkap: 20520000, volumeHem: 35910000 },
  { name: 'Instabee', marketShare: 15.0, avgPrice: 46, dmt: 11.0, sulfur: 0, volumeOmbud: 0, volumeSkap: 23940000, volumeHem: 10260000 },
  { name: 'DHL Freight', marketShare: 8.0, avgPrice: 49, dmt: 21.8, sulfur: 3.5, volumeOmbud: 12768000, volumeSkap: 3648000, volumeHem: 1824000 },
  { name: 'Bring', marketShare: 7.0, avgPrice: 48, dmt: 11.8, sulfur: 3.5, volumeOmbud: 6384000, volumeSkap: 4788000, volumeHem: 4788000 }
];

export const CarrierSettingsManager: React.FC<CarrierSettingsManagerProps> = ({ isOpen, onClose, onSave, currentSettings }) => {
  const [settings, setSettings] = useState<CarrierSettings[]>(currentSettings.length ? currentSettings : DEFAULT_SETTINGS);

  const handleChange = (index: number, field: keyof CarrierSettings, value: string | number) => {
    const updated = [...settings];
    updated[index] = { ...updated[index], [field]: typeof value === 'string' ? parseFloat(value) || 0 : value };
    setSettings(updated);
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-6xl shadow-2xl border-t-8 border-red-600 flex flex-col max-h-[90vh]">
        <div className="bg-[#ffcc00] p-4 flex justify-between items-center border-b border-red-600">
          <h2 className="text-xl font-black italic uppercase flex items-center gap-3 text-black">
            <TrendingUp className="w-6 h-6 text-red-600" />
            Market Intelligence Center (v24.7)
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6 overflow-x-auto overflow-y-auto">
          <div className="bg-dhl-gray-light p-4 border-l-4 border-red-600 mb-6 text-xs text-red-900 leading-relaxed shadow-sm">
            Här justerar du de parametrar som styr Performile-motorns beräkningar för 2026. 
            Dessa värden påverkar <strong>Revenue Recovery Plan</strong> och marginaljämförelser i LeadCard.
          </div>

          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="text-[10px] font-black uppercase text-slate-400 bg-dhl-gray-light border-b border-dhl-gray-medium">
                <th className="p-3">Transportör</th>
                <th className="p-3">Marknadsandel (%)</th>
                <th className="p-3">Snittpris (SEK)</th>
                <th className="p-3">DMT (%)</th>
                <th className="p-3">Övriga Tillägg (%)</th>
                <th className="p-3">Volym Ombud (st)</th>
                <th className="p-3">Volym Skåp (st)</th>
                <th className="p-3">Volym Hem (st)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settings.filter(s => s && s.name).map((s, idx) => (
                <tr key={idx} className="hover:bg-dhl-gray-light transition-colors">
                  <td className="p-3 font-black text-dhl-black text-xs">{s.name}</td>
                  <td className="p-3"><input type="number" step="0.1" value={s.marketShare} onChange={e => handleChange(idx, 'marketShare', e.target.value)} className="w-20 p-1 border rounded text-xs font-bold" /></td>
                  <td className="p-3"><input type="number" value={s.avgPrice} onChange={e => handleChange(idx, 'avgPrice', e.target.value)} className="w-20 p-1 border rounded text-xs font-bold" /></td>
                  <td className="p-3"><input type="number" step="0.1" value={s.dmt} onChange={e => handleChange(idx, 'dmt', e.target.value)} className="w-20 p-1 border rounded text-xs font-bold text-red-600" /></td>
                  <td className="p-3"><input type="number" step="0.1" value={s.sulfur} onChange={e => handleChange(idx, 'sulfur', e.target.value)} className="w-20 p-1 border rounded text-xs font-bold" /></td>
                  <td className="p-3"><input type="number" value={s.volumeOmbud} onChange={e => handleChange(idx, 'volumeOmbud', e.target.value)} className="w-32 p-1 border rounded text-xs font-bold" /></td>
                  <td className="p-3"><input type="number" value={s.volumeSkap} onChange={e => handleChange(idx, 'volumeSkap', e.target.value)} className="w-32 p-1 border rounded text-xs font-bold" /></td>
                  <td className="p-3"><input type="number" value={s.volumeHem} onChange={e => handleChange(idx, 'volumeHem', e.target.value)} className="w-32 p-1 border rounded text-xs font-bold" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-dhl-gray-light border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-xs font-black uppercase text-slate-400">Avbryt</button>
          <button onClick={handleSave} className="bg-red-600 text-white px-8 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 shadow-xl transition-all">
            <Save className="w-4 h-4" /> Spara Marknadsdata
          </button>
        </div>
      </div>
    </div>
  );
};


