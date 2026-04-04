import React, { useState } from 'react';
import { Cpu, Plus, Save, Search, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react';
import { TechSolutionCategory, TechSolutionConfig, TechSolutionDefinition } from '../types';
import { createTechSolution, normalizeTechSolutionConfig, TECH_SOLUTION_CATEGORY_LABELS } from '../services/techSolutionConfig';

interface TechSolutionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  config: TechSolutionConfig;
  onSave: (config: TechSolutionConfig) => void;
}

const CATEGORY_OPTIONS = Object.entries(TECH_SOLUTION_CATEGORY_LABELS) as Array<[TechSolutionCategory, string]>;

export const TechSolutionManager: React.FC<TechSolutionManagerProps> = ({ isOpen, onClose, config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<TechSolutionConfig>(normalizeTechSolutionConfig(config));
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<TechSolutionCategory>('ecommercePlatforms');
  const [keywords, setKeywords] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setLocalConfig(normalizeTechSolutionConfig(config));
      setLabel('');
      setCategory('ecommercePlatforms');
      setKeywords('');
      setSearchTerm('');
    }
  }, [config, isOpen]);

  if (!isOpen) return null;

  const upsertSolution = () => {
    const normalizedLabel = label.trim();
    const normalizedKeywords = Array.from(new Set(keywords.split(',').map((value) => value.trim()).filter(Boolean)));
    if (!normalizedLabel || !normalizedKeywords.length) return;

    setLocalConfig((prev) => {
      const nextSolutions = [...prev.solutions];
      const existingIndex = nextSolutions.findIndex(
        (solution) => solution.category === category && solution.label.toLowerCase() === normalizedLabel.toLowerCase()
      );

      const nextSolution: TechSolutionDefinition = createTechSolution(normalizedLabel, category, normalizedKeywords);
      if (existingIndex >= 0) {
        nextSolutions[existingIndex] = {
          ...nextSolutions[existingIndex],
          label: normalizedLabel,
          keywords: normalizedKeywords,
          enabled: true
        };
      } else {
        nextSolutions.push(nextSolution);
      }

      return { solutions: nextSolutions };
    });

    setLabel('');
    setKeywords('');
  };

  const toggleSolution = (id: string) => {
    setLocalConfig((prev) => ({
      solutions: prev.solutions.map((solution) => solution.id === id ? { ...solution, enabled: !solution.enabled } : solution)
    }));
  };

  const removeSolution = (id: string) => {
    setLocalConfig((prev) => ({
      solutions: prev.solutions.filter((solution) => solution.id !== id)
    }));
  };

  const filteredSolutions = localConfig.solutions.filter((solution) => {
    const haystack = `${solution.label} ${solution.category} ${solution.keywords.join(' ')}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  const handleSave = () => {
    onSave(normalizeTechSolutionConfig(localConfig));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl shadow-2xl border-t-4 border-red-600 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-dhl-gray-medium flex justify-between items-center bg-[#ffcc00]">
          <h2 className="text-sm font-black italic uppercase flex items-center gap-2 text-black">
            <Cpu className="w-5 h-5 text-red-600" />
            Tech Solution Manager
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors"><X className="w-5 h-5 text-black" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="bg-dhl-gray-light p-4 border border-dhl-gray-medium space-y-3 rounded-sm shadow-inner">
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Lagg till eller uppdatera tech-losning</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Namn, t.ex. Norce"
                className="w-full text-xs border-dhl-gray-medium rounded-sm p-2"
              />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as TechSolutionCategory)}
                className="w-full text-xs border-dhl-gray-medium rounded-sm p-2 bg-white"
              >
                {CATEGORY_OPTIONS.map(([value, categoryLabel]) => (
                  <option key={value} value={value}>{categoryLabel}</option>
                ))}
              </select>
              <input
                type="text"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="Nyckelord, separerade med komma"
                className="w-full text-xs border-dhl-gray-medium rounded-sm p-2"
              />
            </div>
            <button
              onClick={upsertSolution}
              className="w-full bg-dhl-black text-white py-2 text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-red-600 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Uppdatera Tech-losning
            </button>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2 w-3 h-3 text-slate-400" />
              <input
                type="text"
                placeholder="Sok losning eller nyckelord..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-[10px] border border-dhl-gray-medium rounded-sm"
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto space-y-2">
              {filteredSolutions.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-[10px] italic">Ingen tech-losning matchar filtret.</div>
              ) : (
                filteredSolutions.map((solution) => (
                  <div key={solution.id} className="p-3 bg-white border border-dhl-gray-medium rounded-sm hover:shadow-sm transition-shadow flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-dhl-black uppercase truncate">{solution.label}</span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 text-[9px] font-black rounded-sm uppercase">{TECH_SOLUTION_CATEGORY_LABELS[solution.category]}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 break-words">{solution.keywords.join(', ')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleSolution(solution.id)} className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 hover:text-dhl-black">
                        {solution.enabled ? <ToggleRight className="w-5 h-5 text-dhl-yellow" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                        {solution.enabled ? 'Pa' : 'Av'}
                      </button>
                      <button onClick={() => removeSolution(solution.id)} className="text-slate-300 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 bg-dhl-gray-light border-t flex justify-end">
          <button onClick={handleSave} className="bg-red-600 text-white px-6 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 transition-all shadow-md">
            <Save className="w-4 h-4" /> Spara losningar
          </button>
        </div>
      </div>
    </div>
  );
};