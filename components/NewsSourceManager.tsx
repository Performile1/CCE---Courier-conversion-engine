
import React, { useState, useEffect } from 'react';
import { Newspaper, X, Plus, Trash2, Save, Info, Globe } from 'lucide-react';
import { NewsSourceMapping, SourcePolicyConfig, SourcePerformanceEntry } from '../types';

const AVAILABLE_LEADCARD_FIELDS = [
  'companyName',
  'orgNumber',
  'websiteUrl',
  'phoneNumber',
  'industry',
  'industryDescription',
  'sniCode',
  'segment',
  'businessModel',
  'address',
  'visitingAddress',
  'warehouseAddress',
  'revenue',
  'revenueYear',
  'freightBudget',
  'profit',
  'financialHistory',
  'profitMargin',
  'solidity',
  'liquidityRatio',
  'paymentRemarks',
  'debtBalance',
  'debtEquityRatio',
  'legalStatus',
  'creditRatingLabel',
  'creditRatingMotivation',
  'riskProfile',
  'financialTrend',
  'financialSource',
  'decisionMakers',
  'emailPattern',
  'paymentProvider',
  'checkoutOptions',
  'checkoutSolution',
  'ecommercePlatform',
  'taSystem',
  'carriers',
  'storeCount',
  'annualPackages',
  'marketCount',
  'activeMarkets',
  'b2bPercentage',
  'b2cPercentage',
  'techEvidence',
  'strategicPitch',
  'conversionScore',
  'recoveryPotentialSek',
  'frictionAnalysis',
  'dmtMatrix',
  'analysisDate',
  'dataConfidence.financial',
  'dataConfidence.checkout',
  'dataConfidence.contacts',
  'dataConfidence.addresses',
  'dataConfidence.payment',
  'dataConfidence.news',
  'dataConfidence.emailPattern',
  'changeHighlights',
  'hasMonitoredChanges',
  'lastMonitoredCheckAt',
  'sourceCoverage',
  'latestNews'
];

const LEADCARD_DATA_PARTS: Array<{ id: string; label: string; headline: string; fields: string[] }> = [
  { id: 'orginfo', label: 'Bolagsidentitet', headline: 'Bolagsoversikt', fields: ['companyName', 'orgNumber', 'websiteUrl', 'phoneNumber', 'segment', 'legalStatus'] },
  { id: 'omsattning', label: 'Omsattning', headline: 'Finansiellt', fields: ['revenue', 'revenueYear', 'financialHistory'] },
  { id: 'resultat', label: 'Resultat', headline: 'Finansiellt', fields: ['profit', 'profitMargin', 'financialHistory'] },
  { id: 'soliditet', label: 'Soliditet', headline: 'Finansiellt', fields: ['solidity'] },
  { id: 'likviditet', label: 'Likviditet', headline: 'Finansiellt', fields: ['liquidityRatio'] },
  { id: 'risk', label: 'Risk och kredit', headline: 'Finansiellt', fields: ['creditRatingLabel', 'creditRatingMotivation', 'riskProfile', 'financialTrend', 'paymentRemarks', 'debtBalance', 'debtEquityRatio', 'financialSource'] },
  { id: 'riskstatus', label: 'Risk-analys och status', headline: 'Finansiellt', fields: ['legalStatus', 'paymentRemarks', 'debtBalance', 'debtEquityRatio', 'riskProfile', 'creditRatingLabel'] },
  { id: 'status', label: 'Status', headline: 'Finansiellt', fields: ['legalStatus'] },
  { id: 'betalningsanmarkning', label: 'Betalningsanm.', headline: 'Finansiellt', fields: ['paymentRemarks'] },
  { id: 'skuldsaldo', label: 'Skuldsaldo (KFM)', headline: 'Finansiellt', fields: ['debtBalance'] },
  { id: 'skuldsattningsgrad', label: 'Skuldsattningsgrad', headline: 'Finansiellt', fields: ['debtEquityRatio'] },
  { id: 'adresser', label: 'Adresser', headline: 'Logistik och infrastruktur', fields: ['address', 'visitingAddress', 'warehouseAddress'] },
  { id: 'plattform', label: 'Plattform', headline: 'Logistik och infrastruktur', fields: ['ecommercePlatform', 'techEvidence'] },
  { id: 'tasystem', label: 'TA-system', headline: 'Logistik och infrastruktur', fields: ['taSystem', 'techEvidence'] },
  { id: 'betalning', label: 'Betalning', headline: 'Logistik och infrastruktur', fields: ['paymentProvider', 'checkoutSolution', 'dataConfidence.payment'] },
  { id: 'checkout', label: 'Checkout-positioner', headline: 'Logistik och infrastruktur', fields: ['checkoutOptions', 'carriers', 'conversionScore', 'frictionAnalysis', 'dmtMatrix', 'recoveryPotentialSek', 'dataConfidence.checkout'] },
  { id: 'marknader', label: 'Marknader och volym', headline: 'Logistik och infrastruktur', fields: ['activeMarkets', 'marketCount', 'b2bPercentage', 'b2cPercentage', 'annualPackages', 'storeCount'] },
  { id: 'beslutsfattare', label: 'Beslutsfattare', headline: 'Beslutsfattare / pitch / potential', fields: ['decisionMakers', 'dataConfidence.contacts'] },
  { id: 'epostmonster', label: 'E-postmonster', headline: 'Beslutsfattare / pitch / potential', fields: ['emailPattern', 'dataConfidence.emailPattern'] },
  { id: 'pitch', label: 'Pitch och potential', headline: 'Beslutsfattare / pitch / potential', fields: ['strategicPitch', 'freightBudget'] },
  { id: 'nyheter', label: 'Nyheter och kallor', headline: 'Beslutsfattare / pitch / potential', fields: ['latestNews', 'sourceCoverage', 'analysisDate', 'dataConfidence.news'] }
];

const DEFAULT_DATAPART_SOURCES: Record<string, string[]> = {
  omsattning: ['allabolag.se', 'ratsit.se', 'kreditrapporten.se'],
  resultat: ['allabolag.se', 'ratsit.se', 'kreditrapporten.se'],
  soliditet: ['allabolag.se', 'ratsit.se', 'bolagsverket.se'],
  likviditet: ['allabolag.se', 'ratsit.se', 'bolagsverket.se'],
  riskstatus: ['allabolag.se', 'ratsit.se', 'kronofogden.se', 'bolagsverket.se'],
  status: ['allabolag.se', 'bolagsverket.se', 'ratsit.se'],
  betalningsanmarkning: ['ratsit.se', 'allabolag.se', 'kronofogden.se'],
  skuldsaldo: ['kronofogden.se', 'ratsit.se', 'allabolag.se'],
  skuldsattningsgrad: ['allabolag.se', 'ratsit.se'],
  adresser: ['allabolag.se', 'hitta.se', 'eniro.se'],
  plattform: ['shopify.com', 'woocommerce.com', 'norce.io', 'centra.com'],
  tasystem: ['nshift.com', 'unifaun.com', 'centiro.com', 'ingrid.com'],
  betalning: ['klarna.com', 'stripe.com', 'adyen.com', 'checkout.com'],
  checkout: ['klarna.com', 'stripe.com', 'adyen.com', 'checkout.com'],
  beslutsfattare: ['linkedin.com', 'allabolag.se', 'ratsit.se'],
  epostmonster: ['company website', 'linkedin.com'],
  nyheter: ['ehandel.se', 'market.se', 'breakit.se', 'bolagsverket.se']
};

const DEFAULT_DATAPART_FIELD_MAPPINGS: Record<string, string[]> = Object.fromEntries(
  LEADCARD_DATA_PARTS.map((part) => [part.id, part.fields])
);

interface NewsSourceManagerProps {
  isOpen: boolean;
  onClose: () => void;
  mappings: NewsSourceMapping[];
  onSave: (mappings: NewsSourceMapping[]) => void;
  sourcePolicies?: SourcePolicyConfig;
  onSaveSourcePolicies?: (policies: SourcePolicyConfig) => void;
  selectedCountry?: string;
  onSelectCountry?: (country: string) => void;
}

export const NewsSourceManager: React.FC<NewsSourceManagerProps> = ({
  isOpen,
  onClose,
  mappings,
  onSave,
  sourcePolicies,
  onSaveSourcePolicies,
  selectedCountry = 'global',
  onSelectCountry
}) => {
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
  const [customCategoryInputs, setCustomCategoryInputs] = useState<Record<string, string>>({});
  const [categoryFieldSelections, setCategoryFieldSelections] = useState<Record<string, string[]>>({});
  const [newCustomCategoryName, setNewCustomCategoryName] = useState('');
  const [newCustomCategorySources, setNewCustomCategorySources] = useState('');
  const [suggestionTargetCategory, setSuggestionTargetCategory] = useState('news');
  const [sourceSuggestions, setSourceSuggestions] = useState<SourcePerformanceEntry[]>([]);
  const [strictCompanyMatch, setStrictCompanyMatch] = useState(true);
  const [earliestNewsYear, setEarliestNewsYear] = useState(String(new Date().getFullYear() - 1));

  const baseCategories = ['financial', 'addresses', 'decisionMakers', 'payment', 'webSoftware', 'news'];
  const countryOptions = ['global', 'se', 'no', 'dk', 'fi', ...Object.keys(sourcePolicies?.countrySourcePolicies || {})]
    .map(c => c.toLowerCase())
    .filter((value, index, arr) => arr.indexOf(value) === index);

  const getActivePolicyScope = () => {
    const countryKey = (selectedCountry || 'global').toLowerCase();
    if (countryKey === 'global') {
      return {
        financial: sourcePolicies?.financial || [],
        addresses: sourcePolicies?.addresses || [],
        decisionMakers: sourcePolicies?.decisionMakers || [],
        payment: sourcePolicies?.payment || [],
        webSoftware: sourcePolicies?.webSoftware || [],
        news: sourcePolicies?.news || [],
        strictCompanyMatch: sourcePolicies?.strictCompanyMatch !== false,
        earliestNewsYear: sourcePolicies?.earliestNewsYear || (new Date().getFullYear() - 1),
        customCategories: sourcePolicies?.customCategories || {},
        categoryFieldMappings: sourcePolicies?.categoryFieldMappings || {}
      };
    }

    const overrides = sourcePolicies?.countrySourcePolicies?.[countryKey] || {};
    return {
      financial: overrides.financial || sourcePolicies?.financial || [],
      addresses: overrides.addresses || sourcePolicies?.addresses || [],
      decisionMakers: overrides.decisionMakers || sourcePolicies?.decisionMakers || [],
      payment: overrides.payment || sourcePolicies?.payment || [],
      webSoftware: overrides.webSoftware || sourcePolicies?.webSoftware || [],
      news: overrides.news || sourcePolicies?.news || [],
      strictCompanyMatch: overrides.strictCompanyMatch ?? sourcePolicies?.strictCompanyMatch ?? true,
      earliestNewsYear: overrides.earliestNewsYear || sourcePolicies?.earliestNewsYear || (new Date().getFullYear() - 1),
      customCategories: overrides.customCategories || sourcePolicies?.customCategories || {},
      categoryFieldMappings: overrides.categoryFieldMappings || sourcePolicies?.categoryFieldMappings || {}
    };
  };

  useEffect(() => {
    if (isOpen) {
      setLocalMappings(mappings);
      const activePolicies = getActivePolicyScope();
      setPolicyText({
        financial: (activePolicies.financial || []).join(', '),
        addresses: (activePolicies.addresses || []).join(', '),
        decisionMakers: (activePolicies.decisionMakers || []).join(', '),
        payment: (activePolicies.payment || []).join(', '),
        webSoftware: (activePolicies.webSoftware || []).join(', '),
        news: (activePolicies.news || []).join(', ')
      });
      setStrictCompanyMatch(activePolicies.strictCompanyMatch !== false);
      setEarliestNewsYear(String(activePolicies.earliestNewsYear || (new Date().getFullYear() - 1)));
      const custom = {
        ...DEFAULT_DATAPART_SOURCES,
        ...(activePolicies.customCategories || {})
      };
      const mapped: Record<string, string> = {};
      Object.entries(custom).forEach(([name, sources]) => {
        mapped[name] = (sources || []).join(', ');
      });
      setCustomCategoryInputs(mapped);

      const configuredFieldMappings = {
        ...DEFAULT_DATAPART_FIELD_MAPPINGS,
        ...(activePolicies.categoryFieldMappings || {})
      };
      const allCategories = [...baseCategories, ...Object.keys(custom)];
      const mappingInputs: Record<string, string[]> = {};
      allCategories.forEach((category) => {
        mappingInputs[category] = configuredFieldMappings[category] || [];
      });
      setCategoryFieldSelections(mappingInputs);

      try {
        const performanceRaw = localStorage.getItem('dhl_source_performance') || '{}';
        const performanceMap: Record<string, SourcePerformanceEntry> = JSON.parse(performanceRaw);
        const allConfiguredSources = new Set(
          [
            ...Object.values(custom).flat(),
            ...(activePolicies.financial || []),
            ...(activePolicies.addresses || []),
            ...(activePolicies.decisionMakers || []),
            ...(activePolicies.payment || []),
            ...(activePolicies.webSoftware || []),
            ...(activePolicies.news || [])
          ].map(s => s.toLowerCase().trim())
        );

        const suggestions = Object.values(performanceMap)
          .filter(entry => entry.goodHits >= 2)
          .filter(entry => !allConfiguredSources.has(entry.domain.toLowerCase().trim()))
          .sort((a, b) => b.goodHits - a.goodHits)
          .slice(0, 20);

        setSourceSuggestions(suggestions);
      } catch {
        setSourceSuggestions([]);
      }
    }
  }, [mappings, isOpen, sourcePolicies, selectedCountry]);

  const addCustomCategory = () => {
    const name = newCustomCategoryName.trim();
    if (!name) return;
    if (customCategoryInputs[name] !== undefined) return;

    setCustomCategoryInputs({
      ...customCategoryInputs,
      [name]: newCustomCategorySources.trim()
    });
    setCategoryFieldSelections({
      ...categoryFieldSelections,
      [name]: []
    });
    setNewCustomCategoryName('');
    setNewCustomCategorySources('');
  };

  const removeCustomCategory = (name: string) => {
    const next = { ...customCategoryInputs };
    delete next[name];
    setCustomCategoryInputs(next);

    const nextFieldMappings = { ...categoryFieldSelections };
    delete nextFieldMappings[name];
    setCategoryFieldSelections(nextFieldMappings);
  };

  const toggleDataPartForCategory = (category: string, fields: string[]) => {
    const current = categoryFieldSelections[category] || [];
    const isSelected = fields.every((field) => current.includes(field));
    const next = isSelected
      ? current.filter((field) => !fields.includes(field))
      : Array.from(new Set([...current, ...fields]));

    setCategoryFieldSelections({
      ...categoryFieldSelections,
      [category]: next
    });
  };

  const toggleFieldForCategory = (category: string, field: string) => {
    const selected = categoryFieldSelections[category] || [];
    const next = selected.includes(field)
      ? selected.filter((f) => f !== field)
      : [...selected, field];

    setCategoryFieldSelections({
      ...categoryFieldSelections,
      [category]: next
    });
  };

  const addSuggestionToCategory = (domain: string) => {
    const normalized = domain.trim();
    if (!normalized) return;

    if (baseCategories.includes(suggestionTargetCategory)) {
      const key = suggestionTargetCategory as keyof typeof policyText;
      const existing = (policyText[key] || '').split(',').map(s => s.trim()).filter(Boolean);
      if (!existing.includes(normalized)) {
        setPolicyText({
          ...policyText,
          [key]: [...existing, normalized].join(', ')
        });
      }
    } else {
      const existing = (customCategoryInputs[suggestionTargetCategory] || '').split(',').map(s => s.trim()).filter(Boolean);
      if (!existing.includes(normalized)) {
        setCustomCategoryInputs({
          ...customCategoryInputs,
          [suggestionTargetCategory]: [...existing, normalized].join(', ')
        });
      }
    }

    setSourceSuggestions(prev => prev.filter(s => s.domain !== domain));
  };

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
      const customCategories = Object.fromEntries(
        Object.entries(customCategoryInputs)
          .map(([name, value]) => [name.trim(), parse(value)])
          .filter(([name]) => Boolean(name))
      );
      const categoryFieldMappings = Object.fromEntries(
        Object.entries(categoryFieldSelections)
          .map(([name, value]) => [name.trim(), (value || []).filter(Boolean)])
          .filter(([name]) => Boolean(name))
      );

      const parsedScope = {
        financial: parse(policyText.financial),
        addresses: parse(policyText.addresses),
        decisionMakers: parse(policyText.decisionMakers),
        payment: parse(policyText.payment),
        webSoftware: parse(policyText.webSoftware),
        news: parse(policyText.news),
        strictCompanyMatch,
        earliestNewsYear: Math.max(2000, Number(earliestNewsYear) || (new Date().getFullYear() - 1)),
        customCategories,
        categoryFieldMappings
      };

      const countryKey = (selectedCountry || 'global').toLowerCase();
      if (countryKey === 'global') {
        onSaveSourcePolicies({
          ...sourcePolicies,
          ...parsedScope,
          countrySourcePolicies: sourcePolicies?.countrySourcePolicies || {}
        });
      } else {
        onSaveSourcePolicies({
          ...sourcePolicies,
          countrySourcePolicies: {
            ...(sourcePolicies?.countrySourcePolicies || {}),
            [countryKey]: parsedScope
          }
        });
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
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

          <div className="bg-blue-50 p-3 border border-blue-100 rounded-sm text-[10px] text-blue-900 leading-relaxed">
            SourceManager kan nu spegla LeadCardens datadelar. Styr källor per datadel som <strong>Omsattning</strong>, <strong>Likviditet</strong>, <strong>Plattform</strong>, <strong>Betalning</strong>, <strong>Checkout-positioner</strong> och <strong>Nyheter och kallor</strong>.
            <br/><strong>Google/Tavily-fallback används alltid som dubbelkoll</strong> utanför de prioriterade domänerna.
          </div>

          <div className="bg-dhl-gray-light p-3 border border-dhl-gray-medium rounded-sm">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Aktiv källa-profil (land)</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => onSelectCountry?.(e.target.value)}
                  className="w-full text-[10px] border-dhl-gray-medium rounded-sm p-2 bg-white"
                >
                  {countryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country === 'global' ? 'Global standard' : country.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-[9px] text-slate-500">
                {selectedCountry === 'global' ? 'Redigerar globala standardkällor' : `Redigerar override för ${selectedCountry.toUpperCase()}`}
              </div>
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

            <div className="pt-1">
              <label className="inline-flex items-center gap-2 text-[10px] font-black uppercase text-slate-600">
                <input
                  type="checkbox"
                  checked={strictCompanyMatch}
                  onChange={(e) => setStrictCompanyMatch(e.target.checked)}
                  className="rounded border-dhl-gray-medium"
                />
                Strict Company Match (org.nr + exakt bolagsnamn)
              </label>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Tidigaste nyhetsår</label>
              <input
                type="number"
                min="2000"
                max="2100"
                value={earliestNewsYear}
                onChange={e => setEarliestNewsYear(e.target.value)}
                className="w-full text-[10px] border-dhl-gray-medium rounded-sm p-2"
                placeholder="2025"
              />
              <div className="text-[9px] text-slate-500 mt-1">Nyheter äldre än detta år ignoreras. Google/Tavily-fallback används alltid.</div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500">Egna kategorier</label>
              {Object.keys(customCategoryInputs).length === 0 && (
                <div className="text-[10px] italic text-slate-400">Inga egna kategorier ännu.</div>
              )}
              {Object.entries(customCategoryInputs).map(([name, value]) => (
                <div key={name} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={name}
                    readOnly
                    className="text-[10px] border-dhl-gray-medium rounded-sm p-2 bg-dhl-gray-light"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={e => setCustomCategoryInputs({ ...customCategoryInputs, [name]: e.target.value })}
                    placeholder="domain1.se, domain2.se"
                    className="text-[10px] border-dhl-gray-medium rounded-sm p-2"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomCategory(name)}
                    className="p-2 text-slate-400 hover:text-red-600"
                    title="Ta bort kategori"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                <input
                  type="text"
                  value={newCustomCategoryName}
                  onChange={e => setNewCustomCategoryName(e.target.value)}
                  placeholder="Ny kategori"
                  className="text-[10px] border-dhl-gray-medium rounded-sm p-2"
                />
                <input
                  type="text"
                  value={newCustomCategorySources}
                  onChange={e => setNewCustomCategorySources(e.target.value)}
                  placeholder="källor..."
                  className="text-[10px] border-dhl-gray-medium rounded-sm p-2"
                />
                <button
                  type="button"
                  onClick={addCustomCategory}
                  className="p-2 bg-dhl-gray-light hover:bg-dhl-gray-medium rounded-sm"
                  title="Lägg till kategori"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1">
                <div className="text-[10px] font-black uppercase text-slate-500">Aktivera LeadCard-datadelar</div>
                <div className="flex flex-wrap gap-1.5">
                  {LEADCARD_DATA_PARTS.map((part) => {
                    const exists = customCategoryInputs[part.id] !== undefined;
                    return (
                      <button
                        key={`preset-${part.id}`}
                        type="button"
                        onClick={() => {
                          if (exists) return;
                          setCustomCategoryInputs({
                            ...customCategoryInputs,
                            [part.id]: (DEFAULT_DATAPART_SOURCES[part.id] || []).join(', ')
                          });
                          setCategoryFieldSelections({
                            ...categoryFieldSelections,
                            [part.id]: DEFAULT_DATAPART_FIELD_MAPPINGS[part.id] || part.fields
                          });
                        }}
                        className={`px-2 py-1 text-[9px] rounded-sm border font-bold ${exists ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-dhl-gray-light text-dhl-gray-dark border-dhl-gray-medium hover:border-red-300'}`}
                      >
                        {part.headline} · {part.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500">Kategori till LeadCard-fält</label>
              <p className="text-[10px] text-slate-500">Välj datadelar från LeadCard per kategori. Råfält finns kvar för finjustering.</p>

              {[...baseCategories, ...Object.keys(customCategoryInputs)].map((category) => (
                <div key={`map-${category}`} className="border border-dhl-gray-medium rounded-sm p-2 bg-white">
                  <div className="text-[10px] font-black uppercase text-slate-600 mb-2">{category}</div>
                  <div className="mb-2 space-y-1">
                    <div className="text-[9px] font-black uppercase text-slate-400">Snabbval fran LeadCard</div>
                    <div className="flex flex-wrap gap-1.5">
                      {LEADCARD_DATA_PARTS.map((part) => {
                        const selected = part.fields.every((field) => (categoryFieldSelections[category] || []).includes(field));
                        return (
                          <button
                            key={`${category}-preset-${part.id}`}
                            type="button"
                            onClick={() => toggleDataPartForCategory(category, part.fields)}
                            className={`px-2 py-1 text-[9px] rounded-sm border font-bold transition-colors ${selected ? 'bg-black text-white border-black' : 'bg-blue-50 text-blue-900 border-blue-100 hover:border-blue-300'}`}
                          >
                            {part.headline} · {part.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_LEADCARD_FIELDS.map((field) => {
                      const selected = (categoryFieldSelections[category] || []).includes(field);
                      return (
                        <button
                          key={`${category}-${field}`}
                          type="button"
                          onClick={() => toggleFieldForCategory(category, field)}
                          className={`px-2 py-1 text-[9px] rounded-sm border font-bold transition-colors ${selected ? 'bg-red-600 text-white border-red-600' : 'bg-dhl-gray-light text-dhl-gray-dark border-dhl-gray-medium hover:border-red-300'}`}
                        >
                          {field}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500">Föreslagna källor (bra träffar)</label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">Lägg till i kategori:</span>
                <select
                  value={suggestionTargetCategory}
                  onChange={e => setSuggestionTargetCategory(e.target.value)}
                  className="text-[10px] border border-dhl-gray-medium rounded-sm p-1"
                >
                  {[...baseCategories, ...Object.keys(customCategoryInputs)].map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {sourceSuggestions.length === 0 ? (
                <div className="text-[10px] italic text-slate-400">Inga nya källförslag ännu.</div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto border border-dhl-gray-medium rounded-sm p-2 bg-dhl-gray-light">
                  {sourceSuggestions.map(suggestion => (
                    <div key={suggestion.domain} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-sm">
                      <div className="text-[10px]">
                        <div className="font-bold text-dhl-black">{suggestion.domain}</div>
                        <div className="text-slate-500">Hits: {suggestion.goodHits}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addSuggestionToCategory(suggestion.domain)}
                        className="px-2 py-1 text-[9px] font-bold bg-dhl-black text-white rounded-sm hover:bg-red-600"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
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


