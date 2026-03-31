import React, { useState, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { COUNTRIES, CountryConfig } from '../config/countries';

interface CountrySelectorProps {
  selectedCountry: string;
  onCountryChange: (countryCode: string) => void;
  showFlags?: boolean;
}

const FLAG_EMOJIS: Record<string, string> = {
  SE: '🇸🇪',
  DK: '🇩🇰',
  NO: '🇳🇴',
  FI: '🇫🇮',
  GB: '🇬🇧',
  DE: '🇩🇪',
  FR: '🇫🇷',
  NL: '🇳🇱',
  BE: '🇧🇪',
  AT: '🇦🇹',
  CH: '🇨🇭',
  US: '🇺🇸'
};

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  selectedCountry,
  onCountryChange,
  showFlags = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const countryList = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));
  const currentCountry = COUNTRIES[selectedCountry];

  return (
    <div className="relative w-full md:w-64">
      {/* Selected Country Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 flex items-center justify-between gap-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
      >
        <div className="flex items-center gap-2">
          {showFlags && (
            <span className="text-xl">{FLAG_EMOJIS[selectedCountry] || '🌍'}</span>
          )}
          <div className="text-left">
            <div className="text-xs text-slate-600">Country</div>
            <div className="font-semibold text-slate-900">{currentCountry?.name}</div>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-600 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {/* Search input */}
          <div className="sticky top-0 p-2 bg-slate-50 border-b border-slate-200">
            <input
              type="text"
              placeholder="Search countries..."
              className="w-full px-3 py-1 border border-slate-300 rounded text-sm"
              onChange={(e) => e.stopPropagation()}
            />
          </div>

          {/* Country list */}
          <div className="divide-y divide-slate-200">
            {countryList.map((country) => (
              <button
                key={country.code}
                onClick={() => {
                  onCountryChange(country.code);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3 flex-1">
                  {showFlags && (
                    <span className="text-xl">{FLAG_EMOJIS[country.code] || '🌍'}</span>
                  )}
                  <div>
                    <div className="font-medium text-slate-900 group-hover:text-blue-700">
                      {country.name}
                    </div>
                    <div className="text-xs text-slate-600">
                      {country.registryType}
                    </div>
                  </div>
                </div>

                {selectedCountry === country.code && (
                  <Check className="w-5 h-5 text-green-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info about selected country */}
      {currentCountry && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
          <p className="font-medium mb-1">Official Registry: {currentCountry.registryType}</p>
          <p className="text-blue-700 truncate">
            <a href={currentCountry.registryUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {currentCountry.registryUrl}
            </a>
          </p>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

/**
 * Mini Country Selector (compact version)
 */
export const CountrySelectorMini: React.FC<CountrySelectorProps> = ({
  selectedCountry,
  onCountryChange,
  showFlags = true
}) => {
  return (
    <select
      value={selectedCountry}
      onChange={(e) => onCountryChange(e.target.value)}
      className="px-2 py-1 text-sm border border-slate-300 rounded bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {Object.values(COUNTRIES)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((country) => (
          <option key={country.code} value={country.code}>
            {showFlags ? `${FLAG_EMOJIS[country.code] || ''} ` : ''}
            {country.name}
          </option>
        ))}
    </select>
  );
};

export default CountrySelector;
