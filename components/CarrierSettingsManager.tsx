import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Box, Download, Loader2, Plus, RefreshCw, Ruler, Save, Scale, Target, Trash2, TrendingUp, Upload, X } from 'lucide-react';
import { CarrierPriceRule, CarrierProductMapping, CarrierSettings } from '../types';
import {
  PricingScenario,
  buildScenarioRecommendation,
  createCarrierSettings,
  createCarrierProductMapping,
  createPriceRule,
  exportCarrierSettingsToCsv,
  findScenarioMatches,
  formatSek,
  importCarrierSettingsFromCsv,
  normalizeCarrierSettings
} from '../services/pricingService';
import { fetchCarrierNetworkCoverage } from '../services/carrierNetworkService';

const DEFAULT_SWEDEN_POPULATION = 10605500;

interface CarrierSettingsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: CarrierSettings[]) => void;
  currentSettings: CarrierSettings[];
}

export const DEFAULT_CARRIER_SETTINGS: CarrierSettings[] = normalizeCarrierSettings([
  createCarrierSettings('PostNord', {
    marketShare: 45.0,
    avgPrice: 51,
    dmt: 4.6,
    sulfur: 1.0,
    volumeOmbud: 46170000,
    volumeSkap: 20520000,
    volumeHem: 35910000,
    priceRules: [
      createPriceRule({ productName: 'Parcel Connect', customerAnnualPackagesMin: 0, customerAnnualPackagesMax: 5000, weightMaxKg: 5, priceSek: 52 }),
      createPriceRule({ productName: 'Parcel Connect', customerAnnualPackagesMin: 5001, customerAnnualPackagesMax: 25000, weightMaxKg: 5, priceSek: 48 }),
      createPriceRule({ productName: 'Home Delivery', customerAnnualPackagesMin: 0, customerAnnualPackagesMax: 25000, weightMaxKg: 10, maxLengthCm: 120, maxWidthCm: 60, maxHeightCm: 60, priceSek: 79 })
    ]
  }),
  createCarrierSettings('Instabee', {
    marketShare: 15.0,
    avgPrice: 46,
    dmt: 11.0,
    sulfur: 0,
    volumeOmbud: 0,
    volumeSkap: 23940000,
    volumeHem: 10260000,
    priceRules: [
      createPriceRule({ productName: 'Parcel Connect', customerAnnualPackagesMin: 0, customerAnnualPackagesMax: 5000, weightMaxKg: 5, priceSek: 46 }),
      createPriceRule({ productName: 'Parcel Connect', customerAnnualPackagesMin: 5001, customerAnnualPackagesMax: 25000, weightMaxKg: 5, priceSek: 43 }),
      createPriceRule({ productName: 'Locker Express', customerAnnualPackagesMin: 0, customerAnnualPackagesMax: 25000, weightMaxKg: 10, priceSek: 45 })
    ]
  }),
  createCarrierSettings('DHL Freight', {
    marketShare: 8.0,
    avgPrice: 49,
    dmt: 21.8,
    sulfur: 3.5,
    volumeOmbud: 12768000,
    volumeSkap: 3648000,
    volumeHem: 1824000,
    isFocusCarrier: true,
    priceRules: [
      createPriceRule({ productName: 'Parcel Connect', customerAnnualPackagesMin: 0, customerAnnualPackagesMax: 5000, weightMaxKg: 5, priceSek: 49 }),
      createPriceRule({ productName: 'Parcel Connect', customerAnnualPackagesMin: 5001, customerAnnualPackagesMax: 25000, weightMaxKg: 5, priceSek: 45 }),
      createPriceRule({ productName: 'Home Delivery', customerAnnualPackagesMin: 0, customerAnnualPackagesMax: 25000, weightMaxKg: 10, maxLengthCm: 120, maxWidthCm: 60, maxHeightCm: 60, priceSek: 74 })
    ]
  }),
  createCarrierSettings('Bring', {
    marketShare: 7.0,
    avgPrice: 48,
    dmt: 11.8,
    sulfur: 3.5,
    volumeOmbud: 6384000,
    volumeSkap: 4788000,
    volumeHem: 4788000,
    priceRules: [
      createPriceRule({ productName: 'Parcel Connect', customerAnnualPackagesMin: 0, customerAnnualPackagesMax: 5000, weightMaxKg: 5, priceSek: 50 }),
      createPriceRule({ productName: 'Parcel Connect', customerAnnualPackagesMin: 5001, customerAnnualPackagesMax: 25000, weightMaxKg: 5, priceSek: 46 }),
      createPriceRule({ productName: 'Home Delivery', customerAnnualPackagesMin: 0, customerAnnualPackagesMax: 25000, weightMaxKg: 10, maxLengthCm: 120, maxWidthCm: 60, maxHeightCm: 60, priceSek: 77 })
    ]
  })
]);

const DEFAULT_SCENARIO: PricingScenario = {
  productName: 'Parcel Connect',
  annualPackages: 10000,
  weightKg: 2,
  lengthCm: 35,
  widthCm: 25,
  heightCm: 12
};

const toNumber = (value: string | number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const CarrierSettingsManager: React.FC<CarrierSettingsManagerProps> = ({ isOpen, onClose, onSave, currentSettings }) => {
  const [settings, setSettings] = useState<CarrierSettings[]>(normalizeCarrierSettings(currentSettings.length ? currentSettings : DEFAULT_CARRIER_SETTINGS));
  const [newCarrierName, setNewCarrierName] = useState('');
  const [scenario, setScenario] = useState<PricingScenario>(DEFAULT_SCENARIO);
  const [populationBase, setPopulationBase] = useState(DEFAULT_SWEDEN_POPULATION);
  const [isSyncingCoverage, setIsSyncingCoverage] = useState(false);
  const [coverageSyncError, setCoverageSyncError] = useState('');
  const [coverageSyncMessage, setCoverageSyncMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const normalized = normalizeCarrierSettings(currentSettings.length ? currentSettings : DEFAULT_CARRIER_SETTINGS);
      setSettings(normalized);
      const firstProduct = normalized.flatMap((carrier) => carrier.priceRules || []).map((rule) => rule.productName.trim()).find(Boolean);
      setScenario((previous) => ({ ...previous, productName: firstProduct || previous.productName }));
    }
  }, [currentSettings, isOpen]);

  const productOptions = useMemo(() => {
    const values = settings.flatMap((carrier) => carrier.priceRules || []).map((rule) => rule.productName.trim()).filter(Boolean);
    return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
  }, [settings]);

  const scenarioMatches = useMemo(() => findScenarioMatches(settings, scenario).sort((left, right) => left.effectivePrice - right.effectivePrice), [scenario, settings]);
  const focusMatch = scenarioMatches.find((entry) => entry.carrier.isFocusCarrier);
  const recommendation = useMemo(() => buildScenarioRecommendation(settings, scenario), [scenario, settings]);
  const carrierCoverageRows = useMemo(() => normalizeCarrierSettings(settings)
    .map((carrier) => ({
      carrier,
      homeReachPercent: populationBase > 0 ? ((carrier.homeDeliveryReachPeople || 0) / populationBase) * 100 : 0
    }))
    .sort((left, right) => right.homeReachPercent - left.homeReachPercent), [populationBase, settings]);

  const handleCarrierFieldChange = (carrierIndex: number, field: keyof CarrierSettings, value: string | number | boolean) => {
    setSettings((previous) => previous.map((carrier, index) => {
      if (index !== carrierIndex) return carrier;
      if (field === 'name') return { ...carrier, name: String(value) };
      if (field === 'isFocusCarrier') return { ...carrier, isFocusCarrier: Boolean(value) };
      return { ...carrier, [field]: toNumber(value as string | number) };
    }));
  };

  const handleSetFocusCarrier = (carrierIndex: number) => {
    setSettings((previous) => previous.map((carrier, index) => ({ ...carrier, isFocusCarrier: index === carrierIndex })));
  };

  const handleRuleFieldChange = (carrierIndex: number, ruleIndex: number, field: keyof CarrierPriceRule, value: string | number) => {
    setSettings((previous) => previous.map((carrier, index) => {
      if (index !== carrierIndex) return carrier;
      const nextRules = (carrier.priceRules || []).map((rule, currentRuleIndex) => {
        if (currentRuleIndex !== ruleIndex) return rule;
        if (field === 'productName' || field === 'notes' || field === 'id') {
          return { ...rule, [field]: String(value) };
        }
        return { ...rule, [field]: toNumber(value) };
      });
      return { ...carrier, priceRules: nextRules };
    }));
  };

  const handleMappingFieldChange = (carrierIndex: number, mappingIndex: number, field: keyof CarrierProductMapping, value: string) => {
    setSettings((previous) => previous.map((carrier, index) => {
      if (index !== carrierIndex) return carrier;
      const nextMappings = (carrier.productMappings || []).map((mapping, currentIndex) => {
        if (currentIndex !== mappingIndex) return mapping;
        return { ...mapping, [field]: value };
      });
      return { ...carrier, productMappings: nextMappings };
    }));
  };

  const handleAddCarrier = () => {
    const trimmedName = newCarrierName.trim();
    if (!trimmedName) return;
    setSettings((previous) => [...previous, createCarrierSettings(trimmedName)]);
    setNewCarrierName('');
  };

  const handleRemoveCarrier = (carrierIndex: number) => {
    setSettings((previous) => {
      const next = previous.filter((_, index) => index !== carrierIndex);
      if (!next.some((carrier) => carrier.isFocusCarrier) && next[0]) {
        next[0] = { ...next[0], isFocusCarrier: true };
      }
      return next;
    });
  };

  const handleAddRule = (carrierIndex: number) => {
    setSettings((previous) => previous.map((carrier, index) => {
      if (index !== carrierIndex) return carrier;
      return {
        ...carrier,
        priceRules: [...(carrier.priceRules || []), createPriceRule({ productName: scenario.productName || 'Parcel Connect', priceSek: carrier.avgPrice || 0 })]
      };
    }));
  };

  const handleRemoveRule = (carrierIndex: number, ruleIndex: number) => {
    setSettings((previous) => previous.map((carrier, index) => {
      if (index !== carrierIndex) return carrier;
      const nextRules = (carrier.priceRules || []).filter((_, currentRuleIndex) => currentRuleIndex !== ruleIndex);
      return {
        ...carrier,
        priceRules: nextRules.length ? nextRules : [createPriceRule({ productName: scenario.productName || 'Parcel Connect', priceSek: carrier.avgPrice || 0 })]
      };
    }));
  };

  const handleAddMapping = (carrierIndex: number) => {
    setSettings((previous) => previous.map((carrier, index) => {
      if (index !== carrierIndex) return carrier;
      return {
        ...carrier,
        productMappings: [...(carrier.productMappings || []), createCarrierProductMapping({ mappedProductName: scenario.productName || 'Parcel Connect' })]
      };
    }));
  };

  const handleRemoveMapping = (carrierIndex: number, mappingIndex: number) => {
    setSettings((previous) => previous.map((carrier, index) => {
      if (index !== carrierIndex) return carrier;
      return {
        ...carrier,
        productMappings: (carrier.productMappings || []).filter((_, currentIndex) => currentIndex !== mappingIndex)
      };
    }));
  };

  const handleExport = () => {
    const payload = JSON.stringify(normalizeCarrierSettings(settings), null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'carrier-pricing-rules.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const payload = exportCarrierSettingsToCsv(settings);
    const blob = new Blob([payload], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'carrier-pricing-rules.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportCsvClick = () => {
    csvFileInputRef.current?.click();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error('Prislistfilen maste innehalla en array av transportorer.');
      }
      setSettings(normalizeCarrierSettings(parsed as CarrierSettings[]));
    } catch (error) {
      console.error('Could not import carrier pricing rules:', error);
      window.alert('Kunde inte importera prislistan. Kontrollera att filen ar giltig JSON exporterat fran systemet.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = importCarrierSettingsFromCsv(text);
      if (!imported.length) {
        throw new Error('CSV-filen gav inga giltiga prisrader.');
      }
      setSettings(imported);
    } catch (error) {
      console.error('Could not import carrier pricing CSV:', error);
      window.alert('Kunde inte importera CSV-prislistan. Kontrollera att kolumnerna matchar exportformatet.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSave = () => {
    onSave(normalizeCarrierSettings(settings));
    onClose();
  };

  const handleSyncCarrierCoverage = async () => {
    setIsSyncingCoverage(true);
    setCoverageSyncError('');
    setCoverageSyncMessage('');

    try {
      const snapshots = await fetchCarrierNetworkCoverage(settings, populationBase);
      const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.carrierName.toLowerCase(), snapshot]));

      setSettings((previous) => previous.map((carrier) => {
        const snapshot = snapshotMap.get(carrier.name.toLowerCase());
        if (!snapshot) return carrier;

        return {
          ...carrier,
          agentLocationCount: snapshot.agentLocationCount ?? carrier.agentLocationCount,
          lockerLocationCount: snapshot.lockerLocationCount ?? carrier.lockerLocationCount,
          homeDeliveryReachPeople: snapshot.homeDeliveryReachPeople ?? carrier.homeDeliveryReachPeople,
          networkCoverageSourceUrl: snapshot.sourceUrl || carrier.networkCoverageSourceUrl,
          networkCoverageSourceLabel: snapshot.sourceLabel || carrier.networkCoverageSourceLabel,
          networkCoverageCapturedAt: snapshot.capturedAt || carrier.networkCoverageCapturedAt,
          networkCoverageConfidence: snapshot.confidence,
          networkCoverageSnippet: snapshot.snippet || carrier.networkCoverageSnippet
        };
      }));

      const verifiedCount = snapshots.filter((snapshot) => snapshot.confidence === 'verified').length;
      setCoverageSyncMessage(verifiedCount
        ? `Verifierade nätverkskällor hittades för ${verifiedCount} transportörer.`
        : 'Inga verifierade nätverkskällor hittades den här gången.');
    } catch (error) {
      console.error('Could not sync carrier coverage:', error);
      setCoverageSyncError('Kunde inte hämta transportörernas nätverksdata från officiella källor just nu.');
    } finally {
      setIsSyncingCoverage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-modal flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-[96rem] shadow-2xl border-t-8 border-red-600 flex flex-col max-h-[94vh] overflow-hidden">
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImport} className="hidden" />
        <input ref={csvFileInputRef} type="file" accept=".csv,text/csv" onChange={handleImportCsv} className="hidden" />
        <div className="bg-[#ffcc00] p-4 flex justify-between items-center border-b border-red-600">
          <h2 className="text-xl font-black italic uppercase flex items-center gap-3 text-black">
            <TrendingUp className="w-6 h-6 text-red-600" />
            Market Intelligence Center
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 bg-[linear-gradient(180deg,#fffdf8_0%,#f8fafc_100%)]">
          <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.95fr] gap-6">
            <div className="bg-white border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-red-600" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Scenarioanalys</h3>
                  <p className="text-xs text-slate-500">Jamfor fokuscarrier mot konkurrenter per produkt, vikt, matt och kundvolym.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Produkt</span><select value={scenario.productName} onChange={(event) => setScenario((previous) => ({ ...previous, productName: event.target.value }))} className="w-full border border-slate-300 rounded-sm p-2 text-xs bg-white">{productOptions.map((product) => <option key={product} value={product}>{product}</option>)}</select></label>
                <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Arspaket</span><input type="number" value={scenario.annualPackages} onChange={(event) => setScenario((previous) => ({ ...previous, annualPackages: toNumber(event.target.value) }))} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Vikt (kg)</span><input type="number" step="0.1" value={scenario.weightKg} onChange={(event) => setScenario((previous) => ({ ...previous, weightKg: toNumber(event.target.value) }))} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Langd (cm)</span><input type="number" value={scenario.lengthCm} onChange={(event) => setScenario((previous) => ({ ...previous, lengthCm: toNumber(event.target.value) }))} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Bredd (cm)</span><input type="number" value={scenario.widthCm} onChange={(event) => setScenario((previous) => ({ ...previous, widthCm: toNumber(event.target.value) }))} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Hojd (cm)</span><input type="number" value={scenario.heightCm} onChange={(event) => setScenario((previous) => ({ ...previous, heightCm: toNumber(event.target.value) }))} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase text-slate-500 mb-1">Fokuscarrier</p><p className="text-lg font-black text-slate-900">{focusMatch?.carrier.name || 'Ingen match'}</p><p className="text-xs text-slate-500 mt-1">{focusMatch ? formatSek(focusMatch.effectivePrice) : 'Lagg in en prisrad som matchar scenariot.'}</p></div>
                <div className="border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase text-slate-500 mb-1">Konkurrentspann</p><p className="text-lg font-black text-slate-900">{recommendation.competitorMatches.length ? `${formatSek(recommendation.recommendedPriceFloor)} - ${formatSek(recommendation.recommendedPriceCeiling)}` : 'Ingen match'}</p><p className="text-xs text-slate-500 mt-1">Baserat pa samtliga matchande konkurrentrader.</p></div>
                <div className="border border-red-200 bg-red-50 p-4"><p className="text-[10px] font-black uppercase text-red-600 mb-1">Rekommenderad malprisniva</p><p className="text-lg font-black text-slate-900">{recommendation.targetPrice ? formatSek(recommendation.targetPrice) : 'Ingen rekommendation'}</p><p className={`text-xs mt-1 ${recommendation.priceDelta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{focusMatch && recommendation.targetPrice ? `${recommendation.priceDelta >= 0 ? '+' : ''}${recommendation.priceDelta.toFixed(2)} SEK mot fokuscarrier idag` : recommendation.positioning}</p></div>
              </div>

              <div className="border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wide text-slate-500">Prisjamforelse per matchande transportor</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="bg-white border-b border-slate-200 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Transportor</th><th className="p-3">Produkt</th><th className="p-3">Volymintervall</th><th className="p-3">Viktintervall</th><th className="p-3">Baspris</th><th className="p-3">Effektiv prisniva</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{scenarioMatches.length ? scenarioMatches.map((entry) => <tr key={`${entry.carrier.name}-${entry.matchedRule.id}`} className={entry.carrier.isFocusCarrier ? 'bg-yellow-50' : 'bg-white'}><td className="p-3 font-black text-slate-900">{entry.carrier.name}{entry.carrier.isFocusCarrier ? ' (fokus)' : ''}</td><td className="p-3">{entry.matchedRule.productName}</td><td className="p-3">{entry.matchedRule.customerAnnualPackagesMin.toLocaleString('sv-SE')} - {entry.matchedRule.customerAnnualPackagesMax.toLocaleString('sv-SE')}</td><td className="p-3">{entry.matchedRule.weightMinKg} - {entry.matchedRule.weightMaxKg} kg</td><td className="p-3">{formatSek(entry.matchedRule.priceSek)}</td><td className="p-3 font-black text-slate-900">{formatSek(entry.effectivePrice)}</td></tr>) : <tr><td colSpan={6} className="p-4 text-slate-500">Inga transportorer matchar valt scenario. Lagg till prisrader for vald produkt, volym, vikt och dimension.</td></tr>}</tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 text-white p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-3"><Box className="w-5 h-5 text-[#ffcc00]" /><div><h3 className="text-sm font-black uppercase tracking-wide">Prisbibliotek</h3><p className="text-xs text-slate-300">Importera eller exportera transportorernas prisregler.</p></div></div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleImportClick} className="bg-white text-slate-900 px-4 py-3 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> Importera JSON</button>
                <button onClick={handleExport} className="bg-[#ffcc00] text-slate-900 px-4 py-3 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Exportera JSON</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleImportCsvClick} className="bg-white text-slate-900 px-4 py-3 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 border border-white/20"><Upload className="w-4 h-4" /> Importera CSV</button>
                <button onClick={handleExportCsv} className="bg-[#ffcc00] text-slate-900 px-4 py-3 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Exportera CSV</button>
              </div>
              <div className="border border-white/10 bg-white/5 p-4 space-y-2"><p className="text-[10px] uppercase text-slate-400 font-black">Positionering</p><p className="text-sm leading-relaxed text-slate-100">{recommendation.positioning}</p></div>
              <div className="border border-white/10 bg-white/5 p-4 space-y-2"><p className="text-[10px] uppercase text-slate-400 font-black">Scenariofilter</p><div className="text-xs text-slate-200 space-y-1"><div>Produkt: <span className="font-black">{scenario.productName}</span></div><div>Arspaket: <span className="font-black">{scenario.annualPackages.toLocaleString('sv-SE')}</span></div><div>Vikt / matt: <span className="font-black">{scenario.weightKg} kg, {scenario.lengthCm}x{scenario.widthCm}x{scenario.heightCm} cm</span></div></div></div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Natracksanalys</h3>
                <p className="text-xs text-slate-500">Jamfor antal ombud, antal paketskap och hur stor andel av befolkningen som respektive transportor nar i hemleverans.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="border border-slate-200 bg-slate-50 px-3 py-2 min-w-[280px]">
                  <p className="text-[10px] font-black uppercase text-slate-500">Sveriges befolkning</p>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="number" value={populationBase} onChange={(event) => setPopulationBase(toNumber(event.target.value))} className="w-full border border-slate-300 rounded-sm p-2 text-xs bg-white" />
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">personer</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Default satt fran soksvar: 10 605 500 personer i Sverige.</p>
                </div>
                <div className="space-y-2">
                  <button onClick={handleSyncCarrierCoverage} disabled={isSyncingCoverage} className="bg-slate-900 text-white px-4 py-3 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {isSyncingCoverage ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Hamta riktiga kallor
                  </button>
                  <p className="text-[10px] text-slate-500 max-w-[280px]">Soker fram officiella carrier-sidor via Tavily och crawlar sedan siffror for ombud, paketskap och hemrackvidd.</p>
                </div>
              </div>
            </div>

            {coverageSyncError && (
              <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {coverageSyncError}
              </div>
            )}

            {coverageSyncMessage && !coverageSyncError && (
              <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {coverageSyncMessage}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Transportor</th>
                    <th className="p-3">Ombud</th>
                    <th className="p-3">Paketskap</th>
                    <th className="p-3">Hemleverans</th>
                    <th className="p-3">% av befolkning</th>
                    <th className="p-3">Kalla</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {carrierCoverageRows.map(({ carrier, homeReachPercent }) => (
                    <tr key={`coverage-${carrier.name}`} className={carrier.isFocusCarrier ? 'bg-yellow-50' : 'bg-white'}>
                      <td className="p-3 font-black text-slate-900">{carrier.name}{carrier.isFocusCarrier ? ' (fokus)' : ''}</td>
                      <td className="p-3">{(carrier.agentLocationCount || 0).toLocaleString('sv-SE')}</td>
                      <td className="p-3">{(carrier.lockerLocationCount || 0).toLocaleString('sv-SE')}</td>
                      <td className="p-3">{(carrier.homeDeliveryReachPeople || 0).toLocaleString('sv-SE')}</td>
                      <td className="p-3 font-black text-slate-900">{homeReachPercent.toFixed(1)}%</td>
                      <td className="p-3">
                        {carrier.networkCoverageSourceUrl ? (
                          <a href={carrier.networkCoverageSourceUrl} target="_blank" rel="noreferrer" title={carrier.networkCoverageSnippet || carrier.networkCoverageSourceLabel || 'Verifierad källa'} className={`inline-flex items-center gap-1 border px-2 py-1 text-[10px] font-black uppercase ${carrier.networkCoverageConfidence === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                            {carrier.networkCoverageSourceLabel || 'Källa'}
                          </a>
                        ) : (
                          <span className="text-[10px] font-black uppercase text-red-600">Saknas</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-[10px] font-black uppercase rounded-sm border ${
                          homeReachPercent >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : homeReachPercent >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {homeReachPercent >= 90 ? 'Nationell' : homeReachPercent >= 70 ? 'Bred' : 'Begransad'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 shadow-sm p-5 space-y-5">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div><h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Transportorer och prisintervall</h3><p className="text-xs text-slate-500">Lagg in egna produkter, konkurrentpriser, viktspann, dimensionstak och volymtrappor per transportor.</p></div>
              <div className="flex gap-2"><input type="text" value={newCarrierName} onChange={(event) => setNewCarrierName(event.target.value)} placeholder="Ny konkurrent eller fokuscarrier" className="border border-slate-300 rounded-sm px-3 py-2 text-xs w-64" /><button onClick={handleAddCarrier} className="bg-slate-900 text-white px-4 py-2 text-xs font-black uppercase tracking-wide flex items-center gap-2"><Plus className="w-4 h-4" /> Lagg till</button></div>
            </div>

            <div className="space-y-5">
              {settings.map((carrier, carrierIndex) => (
                <div key={`${carrier.name}-${carrierIndex}`} className="border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex items-center gap-3"><button onClick={() => handleSetFocusCarrier(carrierIndex)} className={`px-3 py-1 text-[10px] font-black uppercase tracking-wide border ${carrier.isFocusCarrier ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300'}`}>{carrier.isFocusCarrier ? 'Fokuscarrier' : 'Satt som fokus'}</button><input type="text" value={carrier.name} onChange={(event) => handleCarrierFieldChange(carrierIndex, 'name', event.target.value)} className="border border-slate-300 rounded-sm px-3 py-2 text-sm font-black text-slate-900 bg-white" /></div>
                    <button onClick={() => handleRemoveCarrier(carrierIndex)} className="text-red-600 text-xs font-black uppercase tracking-wide flex items-center gap-2 self-start lg:self-auto"><Trash2 className="w-4 h-4" /> Ta bort transportor</button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                      <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Marknadsandel</span><input type="number" step="0.1" value={carrier.marketShare} onChange={(event) => handleCarrierFieldChange(carrierIndex, 'marketShare', event.target.value)} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                      <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Snittpris</span><input type="number" step="0.01" value={carrier.avgPrice} onChange={(event) => handleCarrierFieldChange(carrierIndex, 'avgPrice', event.target.value)} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                      <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>DMT %</span><input type="number" step="0.1" value={carrier.dmt} onChange={(event) => handleCarrierFieldChange(carrierIndex, 'dmt', event.target.value)} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                      <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Ovriga tillagg %</span><input type="number" step="0.1" value={carrier.sulfur} onChange={(event) => handleCarrierFieldChange(carrierIndex, 'sulfur', event.target.value)} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                      <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Volym ombud</span><input type="number" value={carrier.volumeOmbud} onChange={(event) => handleCarrierFieldChange(carrierIndex, 'volumeOmbud', event.target.value)} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                      <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Volym skap</span><input type="number" value={carrier.volumeSkap} onChange={(event) => handleCarrierFieldChange(carrierIndex, 'volumeSkap', event.target.value)} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                      <label className="text-[10px] font-black uppercase text-slate-500 space-y-1 block"><span>Volym hem</span><input type="number" value={carrier.volumeHem} onChange={(event) => handleCarrierFieldChange(carrierIndex, 'volumeHem', event.target.value)} className="w-full border border-slate-300 rounded-sm p-2 text-xs" /></label>
                      <div className="border border-slate-200 rounded-sm p-3 bg-slate-50"><p className="text-[10px] font-black uppercase text-slate-500">Aktiv prisniva</p><p className="text-sm font-black text-slate-900 mt-1">{carrier.avgPrice ? formatSek(carrier.avgPrice) : '0.00 SEK'}</p></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="border border-slate-200 rounded-sm p-3 bg-slate-50"><p className="text-[10px] font-black uppercase text-slate-500">Antal ombud</p><p className="text-sm font-black text-slate-900 mt-1">{(carrier.agentLocationCount || 0).toLocaleString('sv-SE')}</p></div>
                      <div className="border border-slate-200 rounded-sm p-3 bg-slate-50"><p className="text-[10px] font-black uppercase text-slate-500">Antal paketskap</p><p className="text-sm font-black text-slate-900 mt-1">{(carrier.lockerLocationCount || 0).toLocaleString('sv-SE')}</p></div>
                      <div className="border border-slate-200 rounded-sm p-3 bg-slate-50"><p className="text-[10px] font-black uppercase text-slate-500">Hemleverans personer</p><p className="text-sm font-black text-slate-900 mt-1">{(carrier.homeDeliveryReachPeople || 0).toLocaleString('sv-SE')}</p></div>
                      <div className="border border-slate-200 rounded-sm p-3 bg-slate-50"><p className="text-[10px] font-black uppercase text-slate-500">Natkalla</p>{carrier.networkCoverageSourceUrl ? <a href={carrier.networkCoverageSourceUrl} target="_blank" rel="noreferrer" title={carrier.networkCoverageSnippet || carrier.networkCoverageSourceLabel || 'Verifierad källa'} className="mt-1 inline-flex items-center gap-1 text-xs font-black text-red-600 hover:underline">{carrier.networkCoverageSourceLabel || 'Källa'}</a> : <p className="text-xs font-black text-slate-900 mt-1">Inte synkad</p>}{carrier.networkCoverageCapturedAt && <p className="text-[10px] text-slate-500 mt-1">{new Date(carrier.networkCoverageCapturedAt).toLocaleDateString('sv-SE')}</p>}</div>
                    </div>

                    <div className="flex items-center justify-between gap-3"><div><h4 className="text-xs font-black uppercase tracking-wide text-slate-700">Prisrader</h4><p className="text-[11px] text-slate-500">En rad representerar en produkt med volymintervall, viktklass och dimensionstak.</p></div><button onClick={() => handleAddRule(carrierIndex)} className="text-xs font-black uppercase tracking-wide text-red-600 flex items-center gap-2"><Plus className="w-4 h-4" /> Ny prisrad</button></div>

                    <div className="overflow-x-auto border border-slate-200">
                      <table className="w-full min-w-[1400px] text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Produkt</th><th className="p-3">Arspaket fran</th><th className="p-3">Arspaket till</th><th className="p-3"><span className="inline-flex items-center gap-1"><Scale className="w-3 h-3" /> Vikt fran</span></th><th className="p-3">Vikt till</th><th className="p-3"><span className="inline-flex items-center gap-1"><Ruler className="w-3 h-3" /> Max L</span></th><th className="p-3">Max B</th><th className="p-3">Max H</th><th className="p-3">Pris / produkt</th><th className="p-3">Anteckning</th><th className="p-3"></th></tr></thead>
                        <tbody className="divide-y divide-slate-100 bg-white">{(carrier.priceRules || []).map((rule, ruleIndex) => <tr key={rule.id}><td className="p-2"><input type="text" value={rule.productName} onChange={(event) => handleRuleFieldChange(carrierIndex, ruleIndex, 'productName', event.target.value)} className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" /></td><td className="p-2"><input type="number" value={rule.customerAnnualPackagesMin} onChange={(event) => handleRuleFieldChange(carrierIndex, ruleIndex, 'customerAnnualPackagesMin', event.target.value)} className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" /></td><td className="p-2"><input type="number" value={rule.customerAnnualPackagesMax} onChange={(event) => handleRuleFieldChange(carrierIndex, ruleIndex, 'customerAnnualPackagesMax', event.target.value)} className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" /></td><td className="p-2"><input type="number" step="0.1" value={rule.weightMinKg} onChange={(event) => handleRuleFieldChange(carrierIndex, ruleIndex, 'weightMinKg', event.target.value)} className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" /></td><td className="p-2"><input type="number" step="0.1" value={rule.weightMaxKg} onChange={(event) => handleRuleFieldChange(carrierIndex, ruleIndex, 'weightMaxKg', event.target.value)} className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" /></td><td className="p-2"><input type="number" value={rule.maxLengthCm} onChange={(event) => handleRuleFieldChange(carrierIndex, ruleIndex, 'maxLengthCm', event.target.value)} className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" /></td><td className="p-2"><input type="number" value={rule.maxWidthCm} onChange={(event) => handleRuleFieldChange(carrierIndex, ruleIndex, 'maxWidthCm', event.target.value)} className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" /></td><td className="p-2"><input type="number" value={rule.maxHeightCm} onChange={(event) => handleRuleFieldChange(carrierIndex, ruleIndex, 'maxHeightCm', event.target.value)} className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" /></td><td className="p-2"><input type="number" step="0.01" value={rule.priceSek} onChange={(event) => handleRuleFieldChange(carrierIndex, ruleIndex, 'priceSek', event.target.value)} className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs font-black text-slate-900" /></td><td className="p-2"><input type="text" value={rule.notes || ''} onChange={(event) => handleRuleFieldChange(carrierIndex, ruleIndex, 'notes', event.target.value)} className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" placeholder="Valfri kommentar" /></td><td className="p-2"><button onClick={() => handleRemoveRule(carrierIndex, ruleIndex)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr>)}</tbody>
                      </table>
                    </div>

                    <div className="border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wide text-slate-700">Produktmappning</h4>
                          <p className="text-[11px] text-slate-500">Mappar checkouttyp eller leveranssignal till rätt produktnamn i prisbiblioteket.</p>
                        </div>
                        <button onClick={() => handleAddMapping(carrierIndex)} className="text-xs font-black uppercase tracking-wide text-red-600 flex items-center gap-2"><Plus className="w-4 h-4" /> Ny mappning</button>
                      </div>

                      {(carrier.productMappings || []).length === 0 ? (
                        <div className="text-[11px] text-slate-500">Inga produktmappningar ännu. Lagg till en mapping for checkouttyp, till exempel "home delivery" eller "locker".</div>
                      ) : (
                        <div className="space-y-2">
                          {(carrier.productMappings || []).map((mapping, mappingIndex) => (
                            <div key={mapping.id} className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-white border border-slate-200 p-2">
                              <input type="text" value={mapping.checkoutKeyword} onChange={(event) => handleMappingFieldChange(carrierIndex, mappingIndex, 'checkoutKeyword', event.target.value)} placeholder="Checkout keyword, t.ex. home delivery" className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" />
                              <input type="text" value={mapping.deliveryMethodKeyword || ''} onChange={(event) => handleMappingFieldChange(carrierIndex, mappingIndex, 'deliveryMethodKeyword', event.target.value)} placeholder="Leveranssignal, t.ex. paketskåp" className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" />
                              <input type="text" value={mapping.mappedProductName} onChange={(event) => handleMappingFieldChange(carrierIndex, mappingIndex, 'mappedProductName', event.target.value)} placeholder="Mapped product" className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs font-black" />
                              <input type="text" value={mapping.notes || ''} onChange={(event) => handleMappingFieldChange(carrierIndex, mappingIndex, 'notes', event.target.value)} placeholder="Kommentar" className="w-full border border-slate-300 rounded-sm px-2 py-2 text-xs" />
                              <button onClick={() => handleRemoveMapping(carrierIndex, mappingIndex)} className="text-red-600 justify-self-end"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-4 bg-dhl-gray-light border-t flex justify-end gap-3"><button onClick={onClose} className="px-6 py-2 text-xs font-black uppercase text-slate-500">Avbryt</button><button onClick={handleSave} className="bg-red-600 text-white px-8 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 shadow-xl transition-all"><Save className="w-4 h-4" /> Spara marknadsdata</button></div>
      </div>
    </div>
  );
};