

import React, { useState } from 'react';
import { X, PlusCircle, Building2, MapPin, Hash, DollarSign } from 'lucide-react';
import { LeadData, Segment } from '../types';

interface ManualAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (lead: LeadData) => void;
}

export const ManualAddModal: React.FC<ManualAddModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    orgNumber: '',
    city: '',
    segment: 'UNKNOWN',
    revenue: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName.trim()) {
        alert("Företagsnamn krävs.");
        return;
    }

    // Fix: Removed creditRatingDescription, liquidity, trendRisk, trigger, emailStructure, icebreaker, usesDhl, shippingTermsLink, revenueSource, hasFtax, logisticsProfile, multiBrands, parentCompany, rating, and searchLog as they are not defined in LeadData interface in types.ts.
    const newLead: LeadData = {
      id: crypto.randomUUID(),
      companyName: formData.companyName,
      orgNumber: formData.orgNumber,
      address: formData.city ? `${formData.city} (Manuell)` : '',
      segment: formData.segment as Segment,
      revenue: formData.revenue ? `${formData.revenue} tkr` : '',
      freightBudget: '',
      legalStatus: 'Manuellt inlagd',
      creditRatingLabel: '',
      decisionMakers: [],
      websiteUrl: '',
      carriers: '',
      source: 'manual' as const,
      // Add empty defaults for strict typing
      visitingAddress: '',
      warehouseAddress: '',
      returnAddress: '',
      phoneNumber: '',
      ecommercePlatform: '',
      latestNews: '',
      analysisDate: new Date().toISOString() // Marked as analyzed upon creation
    };

    onAdd(newLead);
    setFormData({
        companyName: '',
        orgNumber: '',
        city: '',
        segment: 'UNKNOWN',
        revenue: ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-md shadow-2xl border-t-4 border-red-600 relative">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="bg-yellow-100 p-4 border-b border-red-100">
          <h2 className="text-lg font-black italic uppercase flex items-center gap-2 text-black">
            <PlusCircle className="w-5 h-5 text-red-600" />
            Lägg till Företag Manuellt
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-red-600" />
              Företagsnamn (Krav)
            </label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({...formData, companyName: e.target.value})}
              placeholder="T.ex. Nya Bolaget AB"
              className="w-full text-sm border-slate-300 rounded-sm focus:border-red-600 focus:ring-red-600"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3 text-slate-400" />
                Org.nr (Valfritt)
                </label>
                <input
                type="text"
                value={formData.orgNumber}
                onChange={(e) => setFormData({...formData, orgNumber: e.target.value})}
                placeholder="556XXX-XXXX"
                className="w-full text-sm border-slate-300 rounded-sm focus:border-red-600 focus:ring-red-600"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                Ort (Valfritt)
                </label>
                <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                placeholder="T.ex. Örebro"
                className="w-full text-sm border-slate-300 rounded-sm focus:border-red-600 focus:ring-red-600"
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-slate-400" />
                Omsättning (tkr)
                </label>
                <input
                type="number"
                value={formData.revenue}
                onChange={(e) => setFormData({...formData, revenue: e.target.value})}
                placeholder="T.ex. 10000"
                className="w-full text-sm border-slate-300 rounded-sm focus:border-red-600 focus:ring-red-600"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                Segment
                </label>
                <select
                value={formData.segment}
                onChange={(e) => setFormData({...formData, segment: e.target.value})}
                className="w-full text-sm border-slate-300 rounded-sm focus:border-red-600 focus:ring-red-600"
                >
                    <option value="UNKNOWN">Välj...</option>
                    <option value="TS">TS</option>
                    <option value="FS">FS</option>
                    <option value="KAM">KAM</option>
                    <option value="DM">DM</option>
                </select>
            </div>
          </div>

          <div className="pt-2">
             <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 text-sm font-bold uppercase tracking-wider shadow-sm transition-colors rounded-sm"
             >
                Lägg till i Listan
             </button>
             <p className="text-[10px] text-slate-500 text-center mt-2 italic">
                Tips: Efter att du lagt till bolaget kan du klicka på "Starta Analys" i listan för att hämta data automatiskt.
             </p>
          </div>

        </form>
      </div>
    </div>
  );
};