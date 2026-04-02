
import React, { useState, useEffect } from 'react';
import { Newspaper, X, Plus, Trash2, Save, Info, Globe } from 'lucide-react';
import { NewsSourceMapping, SourcePolicyConfig } from '../types';

interface NewsSourceManagerProps {
  isOpen: boolean;
  onClose: () => void;
  mappings: NewsSourceMapping[];
  onSave: (mappings: NewsSourceMapping[]) => void;
  sourcePolicies?: SourcePolicyConfig;
  onSaveSourcePolicies?: (policies: SourcePolicyConfig) => void;
}

export const NewsSourceManager: React.FC<NewsSourceManagerProps> = ({ isOpen, onClose, mappings, onSave, sourcePolicies, onSaveSourcePolicies }) => {
  const [localMappings, setLocalMappings] = useState<NewsSourceMapping[]>(mappings);
  const [newSni, setNewSni] = useState('');
  const [newSources, setNewSources] = useState('');
  const [inlineInputs, setInlineInputs] = useState<Record<string, string>>({});
  const [policyText, setPolicyText] = useState({
    financial: '',
    addresses: '',
    decisionMakers: '',
    payment: '',
    webSoftware: '',
    news: ''
  });

  useEffect(() => {
    if (isOpen) {
      setLocalMappings(mappings);
      setPolicyText({
        financial: (sourcePolicies?.financial || []).join(', '),
        addresses: (sourcePolicies?.addresses || []).join(', '),
        decisionMakers: (sourcePolicies?.decisionMakers || []).join(', '),
        payment: (sourcePolicies?.payment || []).join(', '),
        webSoftware: (sourcePolicies?.webSoftware || []).join(', '),
        news: (sourcePolicies?.news || []).join(', ')
      });
    }
  }, [mappings, isOpen, sourcePolicies]);

  if (!isOpen) return null;

  const addMapping = () => {
    if (!newSni.trim() || !newSources.trim()) return;
    const sourcesArray = newSources.split(',').map(s => s.trim()).filter(s => s);
    const existing = localMappings.find(m => m.sniPrefix === newSni.trim());

    if (existing) {
      // Merge sources if SNI prefix already exists
      const mergedSources = Array.from(new Set([...existing.sources, ...sourcesArray]));
      setLocalMappings(localMappings.map(m => 
        m.id === existing.id ? { ...m, sources: mergedSources } : m
      ));
    } else {
      const newMapping: NewsSourceMapping = {
        id: crypto.randomUUID(),
        sniPrefix: newSni.trim(),
        sources: sourcesArray
      };
      setLocalMappings([...localMappings, newMapping]);
    }
    setNewSni('');
    setNewSources('');
  };

  const removeMapping = (id: string) => {
    setLocalMappings(localMappings.filter(m => m.id !== id));
  };

  const removeSource = (mappingId: string, sourceToRemove: string) => {
    setLocalMappings(localMappings.map(m => {
      if (m.id === mappingId) {
        return { ...m, sources: m.sources.filter(s => s !== sourceToRemove) };
      }
      return m;
    }));
  };

  const addInlineSource = (mappingId: string) => {
    const val = inlineInputs[mappingId];
    if (!val || !val.trim()) return;

    setLocalMappings(localMappings.map(m => {
      if (m.id === mappingId) {
        const newSources = val.split(',').map(s => s.trim()).filter(s => s);
        return { ...m, sources: Array.from(new Set([...m.sources, ...newSources])) };
      }
      return m;
    }));

    setInlineInputs({ ...inlineInputs, [mappingId]: '' });
  };

  const handleSave = () => {
    onSave(localMappings);
    if (onSaveSourcePolicies) {
      const parse = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);
      onSaveSourcePolicies({
        financial: parse(policyText.financial),
        addresses: parse(policyText.addresses),
        decisionMakers: parse(policyText.decisionMakers),
        payment: parse(policyText.payment),
        webSoftware: parse(policyText.webSoftware),
        news: parse(policyText.news)
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-lg shadow-2xl border-t-4 border-red-600 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-dhl-gray-medium flex justify-between items-center bg-[#ffcc00]">
          <h2 className="text-sm font-black italic uppercase flex items-center gap-2 text-black">
            <Newspaper className="w-5 h-5 text-red-600" />
            Nyhetskällor per SNI
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors"><X className="w-5 h-5 text-black" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="bg-dhl-gray-light p-3 border-l-4 border-dhl-red text-[10px] text-red-800 leading-relaxed flex items-start gap-2 shadow-sm">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              Koppla specifika nyhetssajter till SNI-koder. Vid analys av ett bolag kommer AI:n att prioritera sökningar på dessa domäner.
              <br/><strong>Exempel:</strong> SNI 47 → ehandel.se, market.se
            </div>
          </div>

          <div className="bg-dhl-gray-light p-4 border border-dhl-gray-medium space-y-3 rounded-sm">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">SNI Prefix (t.ex. 47)</label>
                <input 
                  type="text" 
                  value={newSni}
                  onChange={e => setNewSni(e.target.value)}
                  placeholder="SNI-kod..."
                  className="w-full text-xs border-dhl-gray-medium rounded-sm p-2"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Domäner (kommaseparerade)</label>
                <input 
                  type="text" 
                  value={newSources}
                  onChange={e => setNewSources(e.target.value)}
                  placeholder="ehandel.se, market.se..."
                  className="w-full text-xs border-dhl-gray-medium rounded-sm p-2"
                />
              </div>
            </div>
            <button 
              onClick={addMapping}
              className="w-full bg-dhl-black text-white py-2 text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-red-600 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Lägg till koppling
            </button>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-100">
            <label className="text-[10px] font-black uppercase text-slate-500">Aktiva kopplingar</label>
            {localMappings.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-[10px] italic">Inga källor konfigurerade.</div>
            ) : (
              <div className="space-y-3">
                {localMappings.map(m => (
                  <div key={m.id} className="p-3 bg-white border border-dhl-gray-medium rounded-sm group shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="bg-red-600 text-white px-2 py-0.5 text-[9px] font-black rounded-sm uppercase tracking-wider">SNI {m.sniPrefix}</span>
                      <button onClick={() => removeMapping(m.id)} className="text-slate-300 hover:text-red-600 p-1 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {m.sources.map((s, idx) => (
                        <span key={idx} className="bg-dhl-gray-light border border-dhl-gray-medium text-[9px] font-bold text-dhl-gray-dark px-1.5 py-0.5 rounded-sm flex items-center gap-1 group/chip">
                          <Globe className="w-2.5 h-2.5 text-red-500" /> 
                          {s}
                          <button onClick={() => removeSource(m.id, s)} className="hover:text-red-600 ml-0.5">
                            <X className="w-2 h-2" />
                          </button>
                        </span>
                      ))}
                      {m.sources.length === 0 && <span className="text-[9px] text-slate-400 italic">Inga källor tillagda...</span>}
                    </div>

                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={inlineInputs[m.id] || ''}
                        onChange={e => setInlineInputs({ ...inlineInputs, [m.id]: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && addInlineSource(m.id)}
                        placeholder="Lägg till källa..."
                        className="flex-1 text-[9px] border-dhl-gray-medium rounded-sm p-1.5 focus:border-red-600 focus:ring-0"
                      />
                      <button 
                        onClick={() => addInlineSource(m.id)}
                        className="bg-dhl-gray-light hover:bg-dhl-gray-medium text-dhl-gray-dark p-1.5 rounded-sm transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="text-[10px] font-black uppercase text-slate-500">Källor per datadel</label>
            <div className="grid grid-cols-1 gap-2">
              <input type="text" value={policyText.financial} onChange={e => setPolicyText({ ...policyText, financial: e.target.value })} placeholder="Finansiell data: allabolag.se, ratsit.se" className="w-full text-[10px] border-dhl-gray-medium rounded-sm p-2" />
              <input type="text" value={policyText.addresses} onChange={e => setPolicyText({ ...policyText, addresses: e.target.value })} placeholder="Adresser: hitta.se, eniro.se" className="w-full text-[10px] border-dhl-gray-medium rounded-sm p-2" />
              <input type="text" value={policyText.decisionMakers} onChange={e => setPolicyText({ ...policyText, decisionMakers: e.target.value })} placeholder="Beslutsfattare: linkedin.com, allabolag.se" className="w-full text-[10px] border-dhl-gray-medium rounded-sm p-2" />
              <input type="text" value={policyText.payment} onChange={e => setPolicyText({ ...policyText, payment: e.target.value })} placeholder="Payment: klarna.com, stripe.com, adyen.com" className="w-full text-[10px] border-dhl-gray-medium rounded-sm p-2" />
              <input type="text" value={policyText.webSoftware} onChange={e => setPolicyText({ ...policyText, webSoftware: e.target.value })} placeholder="Websoftware: shopify.com, norce.io, woocommerce.com" className="w-full text-[10px] border-dhl-gray-medium rounded-sm p-2" />
              <input type="text" value={policyText.news} onChange={e => setPolicyText({ ...policyText, news: e.target.value })} placeholder="Nyheter: ehandel.se, market.se, breakit.se" className="w-full text-[10px] border-dhl-gray-medium rounded-sm p-2" />
            </div>
          </div>
        </div>

        <div className="p-4 bg-dhl-gray-light border-t flex justify-end">
          <button onClick={handleSave} className="bg-red-600 text-white px-6 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 transition-all shadow-md">
            <Save className="w-4 h-4" /> Spara källor
          </button>
        </div>
      </div>
    </div>
  );
};


