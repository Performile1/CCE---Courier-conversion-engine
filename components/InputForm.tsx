
import React, { useState, useEffect, useRef } from 'react';
import { SearchFormData } from '../types';
import { Search, Building2, MapPin, DollarSign, Users, Briefcase, Zap, X, UserSearch, HelpCircle, Activity, ChevronDown, Check } from 'lucide-react';

interface InputFormProps {
  onSubmit: (data: SearchFormData) => void;
  isLoading: boolean;
  protocolMode: 'quick' | 'deep' | 'batch_prospecting' | 'deep_pro';
  setProtocolMode: (mode: 'quick' | 'deep' | 'batch_prospecting' | 'deep_pro') => void;
  onOpenTour?: () => void; // Added onOpenTour prop
  demoDataTrigger?: { type: 'single' | 'batch', timestamp: number } | null;
  resetTrigger?: number; // Added resetTrigger prop
  apiCallCount?: number;
}

const SNI_DATABASE = [
  { code: "10-33", label: "Tillverkning & Industri" },
  { code: "46", label: "Partihandel (Grossister)" },
  { code: "47", label: "Detaljhandel (Butik)" },
  { code: "47.91", label: "E-handel / Postorder" },
  { code: "41-43", label: "Byggverksamhet" },
  { code: "45", label: "Bilhandel & Verkstad" },
  { code: "49.41", label: "Åkeri & Vägtransport" },
  { code: "52", label: "Magasinering & Lager" },
  { code: "01-03", label: "Jordbruk, Skogsbruk & Fiske" },
  { code: "55-56", label: "Hotell & Restaurang" },
  { code: "62", label: "IT-tjänster & Data" },
  { code: "68", label: "Fastighetsverksamhet" },
  { code: "78", label: "Bemanning & Arbetsförmedling" },
  { code: "86-88", label: "Vård & Omsorg" }
];

const SNIDropdown = ({ selected, onSelect }: { selected: string, onSelect: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = SNI_DATABASE.filter(item => 
    item.label.toLowerCase().includes(search.toLowerCase()) || 
    item.code.includes(search)
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedItem = SNI_DATABASE.find(i => i.code === selected);

  return (
    <div className="relative mb-3" ref={dropdownRef}>
      <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
        <Briefcase className="w-3 h-3 text-red-600" />
        Bransch / SNI-kod
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-slate-300 p-2 text-left text-xs rounded-none flex justify-between items-center shadow-sm hover:border-red-600 transition-colors"
      >
        <span className={selectedItem ? "text-slate-900 font-bold" : "text-slate-400 italic"}>
          {selectedItem ? `SNI ${selectedItem.code}: ${selectedItem.label}` : "Sök eller välj bransch..."}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-sm animate-fadeIn overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <input
              type="text"
              autoFocus
              placeholder="Filtrera branscher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-2 text-xs border border-slate-200 focus:ring-1 focus:ring-red-600 outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onSelect(''); setIsOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 flex items-center justify-between group"
            >
              <span className="italic text-slate-500">Ingen specifik (Bred sökning)</span>
              {selected === '' && <Check className="w-3 h-3 text-red-600" />}
            </button>
            {filtered.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => { onSelect(item.code); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-red-50 flex items-center justify-between group border-t border-slate-50 first:border-0 ${selected === item.code ? 'bg-red-50 font-bold' : ''}`}
              >
                <div className="flex flex-col">
                  <span className="text-slate-900 group-hover:text-red-700">SNI {item.code}</span>
                  <span className="text-[10px] text-slate-500">{item.label}</span>
                </div>
                {selected === item.code && <Check className="w-3 h-3 text-red-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ChipInput = ({ 
  label, 
  chips, 
  onAdd, 
  onRemove, 
  placeholder, 
  icon: Icon,
  helperText,
  id
}: {
  label: string;
  chips: string[];
  onAdd: (val: string) => void;
  onRemove: (val: string) => void;
  placeholder: string;
  icon: React.ElementType;
  helperText?: string;
  id: string;
}) => {
  const [inputVal, setInputVal] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputVal.trim();
      if (trimmed && !chips.includes(trimmed)) {
        onAdd(trimmed);
        setInputVal('');
      }
    }
  };

  return (
    <div className="mb-2">
      <label htmlFor={id} className="block text-xs font-bold text-slate-800 mb-1 flex justify-between">
        <span className="flex items-center gap-1">
          <Icon className="w-3 h-3 text-red-600" />
          {label}
        </span>
        <span className="text-[9px] font-normal text-slate-500 italic self-center">Enter för att lägga till</span>
      </label>
      
      <div className="border border-slate-300 p-1.5 bg-white rounded-none focus-within:ring-1 focus-within:ring-red-600 focus-within:border-red-600 shadow-sm">
        <div className="flex flex-wrap gap-1 mb-1">
          {chips.map((chip, index) => (
            <span key={index} className="bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-semibold px-1.5 py-0.5 flex items-center gap-1 rounded-sm shadow-sm">
              {chip}
              <button 
                type="button" 
                onClick={() => onRemove(chip)}
                className="hover:text-red-600 focus:outline-none"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="relative">
          <input
            id={id}
            name={id}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chips.length === 0 ? placeholder : "Lägg till..."}
            className="block w-full border-none focus:ring-0 text-xs p-0.5 placeholder:text-slate-400 placeholder:italic"
          />
        </div>
      </div>
      {helperText && (
        <p className="mt-0.5 text-[9px] text-slate-500 italic leading-tight">
          {helperText}
        </p>
      )}
    </div>
  );
};

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, protocolMode, setProtocolMode, onOpenTour, demoDataTrigger, resetTrigger, apiCallCount }) => {
  const DEFAULT_PRIO_1 = ["Head of Logistics", "Logistics Manager", "Fulfillment Manager", "Last Mile", "Logistikchef", "COO"];
  const DEFAULT_PRIO_2 = ["Head of Ecommerce", "Ecommerce Manager", "Head of Operations", "Supply Chain Manager", "Inköpschef"];
  const DEFAULT_PRIO_3 = ["CEO", "CFO", "VD"];

  const [formData, setFormData] = useState<SearchFormData>({
    companyNameOrOrg: '',
    geoArea: '',
    financialScope: '',
    triggers: '',
    leadCount: 3,
    focusRole1: '',
    focusRole2: '',
    focusRole3: '',
    icebreakerTopic: '',
    specificPerson: '' 
  });

  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [triggerChips, setTriggerChips] = useState<string[]>([]);
  const [selectedSNI, setSelectedSNI] = useState<string>('');
  const [prio1Chips, setPrio1Chips] = useState<string[]>(DEFAULT_PRIO_1);
  const [prio2Chips, setPrio2Chips] = useState<string[]>(DEFAULT_PRIO_2);
  const [prio3Chips, setPrio3Chips] = useState<string[]>(DEFAULT_PRIO_3);

  useEffect(() => {
    const sniPart = selectedSNI ? `Bransch: SNI ${selectedSNI}` : '';
    const combinedTriggers = [sniPart, ...triggerChips].filter(Boolean).join(', ');

    setFormData(prev => ({
      ...prev,
      triggers: combinedTriggers,
      focusRole1: prio1Chips.join(', '),
      focusRole2: prio2Chips.join(', '),
      focusRole3: prio3Chips.join(', ')
    }));
  }, [triggerChips, selectedSNI, prio1Chips, prio2Chips, prio3Chips]);

  useEffect(() => {
    // Reset form when resetTrigger changes
    if (resetTrigger !== undefined && resetTrigger > 0) {
      setFormData({
        companyNameOrOrg: '',
        geoArea: '',
        financialScope: '',
        triggers: '',
        leadCount: 3,
        focusRole1: '',
        focusRole2: '',
        focusRole3: '',
        icebreakerTopic: '',
        specificPerson: ''
      });
      setTriggerChips([]);
      setSelectedSNI('');
      setPrio1Chips(DEFAULT_PRIO_1);
      setPrio2Chips(DEFAULT_PRIO_2);
      setPrio3Chips(DEFAULT_PRIO_3);
      setActiveTab('single'); // Reset to single tab as well
      setProtocolMode('deep'); // Reset protocol mode
    }
  }, [resetTrigger, setProtocolMode]);

  useEffect(() => {
    if (demoDataTrigger) {
      if (demoDataTrigger.type === 'single') {
        setActiveTab('single');
        setFormData(prev => ({ ...prev, companyNameOrOrg: 'RevolutionRace AB' }));
        setProtocolMode('deep');
      } else {
        setActiveTab('batch');
        setFormData(prev => ({ ...prev, geoArea: 'Borås', financialScope: 'KAM', leadCount: 3 }));
        setSelectedSNI('47.91');
        setProtocolMode('batch_prospecting');
      }
    }
  }, [demoDataTrigger, setProtocolMode]);

  const handleTabChange = (tab: 'single' | 'batch') => {
    setActiveTab(tab);
    if (tab === 'single') {
      setFormData(prev => ({ ...prev, geoArea: '', financialScope: '' }));
      setProtocolMode('deep');
    } else {
      setFormData(prev => ({ ...prev, companyNameOrOrg: '', specificPerson: '', financialScope: 'Alla' }));
      setProtocolMode('batch_prospecting');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'leadCount' ? parseInt(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submissionData = { ...formData };
    if (activeTab === 'batch') {
      submissionData.companyNameOrOrg = '';
      submissionData.specificPerson = '';
    } else {
      submissionData.geoArea = '';
      submissionData.financialScope = '';
    }
    onSubmit(submissionData);
  };

  return (
    <div className="bg-white rounded-none shadow-lg border-t-4 border-red-600 overflow-hidden">
      <div className="bg-yellow-100 p-1 text-black flex items-center justify-between border-b border-red-100">
        <h2 className="text-sm font-bold italic flex items-center gap-2 ml-2">
          <Search className="w-4 h-4 text-red-600" />
          Konfigurera Sökning
        </h2>
        
        <div className="flex items-center gap-2">
          {apiCallCount !== undefined && (
            <div className="flex items-center gap-1 bg-white/50 border border-red-100 px-2 py-0.5 rounded-full" title="Antal API-anrop idag">
              <Activity className="w-3 h-3 text-red-600" />
              <span className="text-[10px] font-bold font-mono">{apiCallCount}</span>
            </div>
          )}
          
          {onOpenTour && (
            <button 
              onClick={onOpenTour} // Use onOpenTour prop
              className="p-1 hover:bg-black/10 rounded-full transition-colors"
              title="Starta Guidad Tur"
            >
              <HelpCircle className="w-4 h-4 text-black" />
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          id="tab-single"
          type="button"
          onClick={() => handleTabChange('single')}
          className={`flex-1 py-2 px-3 text-xs font-bold transition-colors uppercase tracking-wide ${
            activeTab === 'single' 
              ? 'bg-white text-red-600 border-b-2 border-red-600' 
              : 'text-slate-500 hover:bg-slate-50 bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Building2 className="w-3 h-3" />
            Enstaka
          </div>
        </button>
        <button
          id="tab-batch"
          type="button"
          onClick={() => handleTabChange('batch')}
          className={`flex-1 py-2 px-3 text-xs font-bold transition-colors uppercase tracking-wide ${
            activeTab === 'batch' 
              ? 'bg-white text-red-600 border-b-2 border-red-600' 
              : 'text-slate-500 hover:bg-slate-50 bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Users className="w-3 h-3" />
            Batch
          </div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-3 space-y-3">
        {activeTab === 'single' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div>
                <label htmlFor="companyNameOrOrg" className="block text-xs font-bold text-slate-800 mb-1">
                  Sök på företagsnamn / Org.nr
                </label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-red-600" />
                  <input
                    id="companyNameOrOrg"
                    name="companyNameOrOrg"
                    type="text"
                    autoComplete="off"
                    value={formData.companyNameOrOrg}
                    onChange={handleChange}
                    placeholder="t.ex. RevolutionRace AB / 556754-5262"
                    className="pl-8 block w-full rounded-none border-slate-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-xs border p-2"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="specificPerson" className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  Sök Specifik Person (Valfritt)
                  <span className="text-[9px] font-normal text-slate-400 italic">- Extra personanalys</span>
                </label>
                <div className="relative">
                  <UserSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="specificPerson"
                    name="specificPerson"
                    type="text"
                    autoComplete="name"
                    value={formData.specificPerson || ''}
                    onChange={handleChange}
                    placeholder="t.ex. Anders Andersson"
                    className="pl-8 block w-full rounded-none border-slate-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-xs border p-2"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label htmlFor="geoArea" className="block text-xs font-bold text-slate-800 mb-1">
                  Geografiskt område
                </label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-red-600" />
                  <input
                    id="geoArea"
                    name="geoArea"
                    type="text"
                    autoComplete="address-level2"
                    value={formData.geoArea}
                    onChange={handleChange}
                    placeholder="Ort/Postnr"
                    className="pl-8 block w-full rounded-none border-slate-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-xs border p-2"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="financialScope" className="block text-xs font-bold text-slate-800 mb-1">
                  Fraktomsättning (Est.)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-red-600" />
                  <select
                    id="financialScope"
                    name="financialScope"
                    value={formData.financialScope}
                    onChange={handleChange}
                    className="pl-8 block w-full rounded-none border-slate-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-xs border p-2 bg-white"
                  >
                    <option value="Alla">Alla (Enklast)</option>
                    <option value="KAM">KAM (≥ 5M)</option>
                    <option value="FS">FS (750k - 5M)</option>
                    <option value="TS">TS (250k - 750k)</option>
                    <option value="DM">DM (&lt; 250k)</option>
                  </select>
                </div>
              </div>
            </div>

            <SNIDropdown selected={selectedSNI} onSelect={setSelectedSNI} />

            <ChipInput
              id="triggers_input"
              label="Ytterligare Triggers"
              icon={Zap}
              chips={triggerChips}
              onAdd={(val) => setTriggerChips([...triggerChips, val])}
              onRemove={(val) => setTriggerChips(triggerChips.filter(c => c !== val))}
              placeholder="Ex. Lagerflytt, Export..."
              helperText={triggerChips.length === 0 ? "Tomt = Auto signaler." : undefined}
            />

            <div>
              <label htmlFor="leadCount" className="block text-xs font-bold text-slate-800 mb-1 flex justify-between">
                <span>Antal leads (Mål)</span>
                {formData.leadCount > 20 && <span className="text-red-600 italic text-[10px]">Batch-loop aktiv</span>}
              </label>
              <div className="flex items-center gap-2">
                 <input
                  id="leadCount"
                  type="number"
                  name="leadCount"
                  min="1"
                  max="100"
                  value={formData.leadCount}
                  onChange={handleChange}
                  className="block w-20 rounded-none border-slate-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-xs border p-2 text-center font-bold"
                />
                <input
                  type="range"
                  name="leadCount_slider"
                  id="leadCount_slider"
                  min="1"
                  max="100"
                  value={formData.leadCount}
                  onChange={(e) => setFormData(p => ({ ...p, leadCount: parseInt(e.target.value) }))}
                  className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 pt-3">
          <h3 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1 uppercase tracking-wide">
            <Briefcase className="w-3 h-3 text-red-600" />
            Fokus-Positioner & Sökord
          </h3>
          
          <ChipInput
            id="prio1_input"
            label="Roll / Sökord Prio 1"
            icon={Users}
            chips={prio1Chips}
            onAdd={(val) => setPrio1Chips([...prio1Chips, val])}
            onRemove={(val) => setPrio1Chips(prio1Chips.filter(c => c !== val))}
            placeholder="Titel eller Funktion..."
          />
          <ChipInput
            id="prio2_input"
            label="Roll / Sökord Prio 2"
            icon={Users}
            chips={prio2Chips}
            onAdd={(val) => setPrio2Chips([...prio2Chips, val])}
            onRemove={(val) => setPrio2Chips(prio2Chips.filter(c => c !== val))}
            placeholder="Titel eller Funktion..."
          />
          <ChipInput
            id="prio3_input"
            label="Roll / Sökord Prio 3"
            icon={Users}
            chips={prio3Chips}
            onAdd={(val) => setPrio3Chips([...prio3Chips, val])}
            onRemove={(val) => setPrio3Chips(prio3Chips.filter(c => c !== val))}
            placeholder="Titel eller Funktion..."
          />

          <div>
            <label htmlFor="icebreakerTopic" className="block text-xs font-bold text-slate-800 mb-1">
              Ice Breaker Ämne
            </label>
            <textarea
              id="icebreakerTopic"
              name="icebreakerTopic"
              value={formData.icebreakerTopic}
              onChange={handleChange}
              rows={2}
              placeholder="Ämne för inledning..."
              className="block w-full rounded-none border-slate-300 shadow-sm focus:border-red-600 focus:ring-red-600 text-xs border p-2"
            />
          </div>
        </div>

        <div className="pt-1">
          <button
            id="submit-form"
            name="submit_search"
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-none shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 transition-all uppercase tracking-wider ${
              isLoading ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Processing...' : 'Kör Protokoll'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InputForm;
