
import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Package, MapPin, Search } from 'lucide-react';
import { ThreePLProvider } from '../types';

interface ThreePLManagerProps {
  isOpen: boolean;
  onClose: () => void;
  providers: ThreePLProvider[];
  onSave: (providers: ThreePLProvider[]) => void;
}

export const ThreePLManager: React.FC<ThreePLManagerProps> = ({ isOpen, onClose, providers, onSave }) => {
  const [localProviders, setLocalProviders] = useState<ThreePLProvider[]>(providers);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Sync local state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalProviders(providers);
    }
  }, [isOpen, providers]);

  if (!isOpen) return null;

  const addProvider = () => {
    if (!newName.trim() || !newAddress.trim()) return;
    const newProvider: ThreePLProvider = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      address: newAddress.trim()
    };
    setLocalProviders([...localProviders, newProvider]);
    setNewName('');
    setNewAddress('');
  };

  const removeProvider = (id: string) => {
    setLocalProviders(localProviders.filter(p => p.id !== id));
  };

  const handleSave = () => {
    onSave(localProviders);
    onClose();
  };

  const filtered = localProviders.filter(p => 
    p && p.name && (
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.address.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md shadow-2xl border-t-4 border-red-600 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-dhl-gray-medium flex justify-between items-center bg-[#ffcc00]">
          <h2 className="text-sm font-black italic uppercase flex items-center gap-2 text-black">
            <Package className="w-5 h-5 text-red-600" />
            3PL Adress-Bibliotek
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors"><X className="w-5 h-5 text-black" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="bg-dhl-gray-light p-4 border border-dhl-gray-medium space-y-3 rounded-sm">
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Lägg till ny 3PL Partner</p>
            <div className="space-y-2">
                <input 
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Namn (t.ex. Shelfless)"
                  className="w-full text-xs border-dhl-gray-medium rounded-sm p-2"
                />
                <input 
                  type="text" 
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  placeholder="Gatuadress (t.ex. Lagergatan 1)"
                  className="w-full text-xs border-dhl-gray-medium rounded-sm p-2"
                />
            </div>
            <button 
              onClick={addProvider}
              className="w-full bg-red-600 text-white py-2 text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-red-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Lägg till i listan
            </button>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
             <div className="relative mb-2">
                <Search className="absolute left-2 top-2 w-3 h-3 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Sök i bibliotek..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-[10px] border border-dhl-gray-medium rounded-sm"
                />
             </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-[10px] italic">Biblioteket är tomt. Lägg till adresser för att aktivera intern 3PL-igenkänning.</div>
              ) : (
                filtered.map(p => (
                  <div key={p.id} className="p-3 bg-white border border-dhl-gray-medium rounded-sm hover:shadow-sm transition-shadow flex justify-between items-center group">
                    <div className="min-w-0 pr-4">
                       <div className="text-xs font-black text-dhl-black uppercase truncate">{p.name}</div>
                       <div className="text-[10px] text-slate-500 flex items-center gap-1">
                         <MapPin className="w-2.5 h-2.5" /> {p.address}
                       </div>
                    </div>
                    <button onClick={() => removeProvider(p.id)} className="text-slate-300 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <Save className="w-4 h-4" /> Spara bibliotek
          </button>
        </div>
      </div>
    </div>
  );
};

