import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Rss, Zap, Check, AlertCircle } from 'lucide-react';
import { getNewsSourcesByCountry, NewsSourceConfig } from '../config/newsSources';

interface NewsPanelProps {
  countryCode: string;
  onSourceSelect?: (source: NewsSourceConfig) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  business: 'bg-sky-100 text-sky-800',
  startup: 'bg-purple-100 text-purple-800',
  logistics: 'bg-amber-100 text-amber-800',
  finance: 'bg-green-100 text-green-800',
  tech: 'bg-blue-100 text-blue-800',
  general: 'bg-slate-100 text-slate-800',
  industry: 'bg-indigo-100 text-indigo-800'
};

const FEED_TYPE_ICONS: Record<string, string> = {
  rss: '📡',
  api: '🔌',
  web: '🌐',
  manual: '✋'
};

export const NewsPanel: React.FC<NewsPanelProps> = ({
  countryCode,
  onSourceSelect
}) => {
  const newsSources = getNewsSourcesByCountry(countryCode);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  // Group by category
  const groupedByCategory = newsSources.reduce((acc, source) => {
    if (!acc[source.category]) {
      acc[source.category] = [];
    }
    acc[source.category].push(source);
    return acc;
  }, {} as Record<string, NewsSourceConfig[]>);

  const categories = Object.keys(groupedByCategory).sort();

  const getFrequencyLabel = (frequency: string): string => {
    const labels: Record<string, string> = {
      '15min': 'Every 15 min',
      '1hour': 'Every hour',
      hourly: 'Every hour',
      daily: 'Daily',
      '1h': 'Every hour'
    };
    return labels[frequency] || frequency;
  };

  const getCountryName = (): string => {
    const names: Record<string, string> = {
      SE: 'Sweden',
      DK: 'Denmark',
      NO: 'Norway',
      FI: 'Finland',
      GB: 'United Kingdom',
      DE: 'Germany',
      FR: 'France',
      NL: 'Netherlands',
      BE: 'Belgium',
      AT: 'Austria',
      CH: 'Switzerland',
      US: 'United States'
    };
    return names[countryCode] || countryCode;
  };

  return (
    <div className="w-full space-y-4">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <Newspaper className="w-5 h-5 text-orange-600" />
        News Sources - {getCountryName()}
      </h3>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
          <div className="text-xs text-slate-600">Total Sources</div>
          <div className="text-2xl font-bold text-slate-900">{newsSources.length}</div>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
          <div className="text-xs text-slate-600">RSS Feeds</div>
          <div className="text-2xl font-bold text-slate-900">
            {newsSources.filter(s => s.feedType === 'rss').length}
          </div>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
          <div className="text-xs text-slate-600">API Sources</div>
          <div className="text-2xl font-bold text-slate-900">
            {newsSources.filter(s => s.feedType === 'api').length}
          </div>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
          <div className="text-xs text-slate-600">Avg Reliability</div>
          <div className="text-2xl font-bold text-slate-900">
            {Math.round(newsSources.reduce((acc, s) => acc + s.reliability, 0) / newsSources.length)}%
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Categories</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            All ({newsSources.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all capitalize ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {cat} ({groupedByCategory[cat].length})
            </button>
          ))}
        </div>
      </div>

      {/* Sources List */}
      <div className="space-y-2">
        {(selectedCategory ? groupedByCategory[selectedCategory] : newsSources).map(source => (
          <div
            key={source.id}
            className="border border-slate-300 rounded-lg overflow-hidden hover:shadow-md transition-all"
          >
            {/* Header */}
            <button
              onClick={() => {
                setExpandedSource(expandedSource === source.id ? null : source.id);
                onSourceSelect?.(source);
              }}
              className="w-full p-3 flex items-center justify-between gap-2 hover:bg-slate-50 bg-white"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-slate-900">{source.name}</h4>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[source.category]}`}>
                    {source.category}
                  </span>
                  <span className="text-sm">
                    {FEED_TYPE_ICONS[source.feedType]}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{source.domain}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-slate-600">
                    {getFrequencyLabel(source.updateFrequency)}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {source.reliability}% ⭐
                  </div>
                </div>
                <div className={`ml-2 ${expandedSource === source.id ? 'rotate-180' : ''} transition-transform`}>
                  ▼
                </div>
              </div>
            </button>

            {/* Expanded Content */}
            {expandedSource === source.id && (
              <div className="border-t border-slate-200 p-3 bg-slate-50 space-y-3 text-sm">
                {/* Description */}
                <p className="text-slate-700">{source.description}</p>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-slate-600">Language</p>
                    <p className="font-semibold text-slate-900 uppercase">{source.language}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Update Frequency</p>
                    <p className="font-semibold text-slate-900">{getFrequencyLabel(source.updateFrequency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Feed Type</p>
                    <p className="font-semibold text-slate-900 capitalize flex items-center gap-1">
                      {FEED_TYPE_ICONS[source.feedType]} {source.feedType.toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Reliability</p>
                    <p className="font-semibold text-slate-900">{source.reliability}%</p>
                  </div>
                </div>

                {/* Feed URLs */}
                {source.feedUrl && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-2">
                    <p className="text-xs text-blue-600 font-semibold mb-1 flex items-center gap-1">
                      <Rss className="w-3 h-3" />
                      RSS Feed
                    </p>
                    <p className="text-xs text-blue-800 break-all font-mono">{source.feedUrl}</p>
                  </div>
                )}

                {source.apiEndpoint && (
                  <div className="bg-purple-50 border border-purple-200 rounded p-2">
                    <p className="text-xs text-purple-600 font-semibold mb-1 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      API Endpoint
                    </p>
                    <p className="text-xs text-purple-800 break-all font-mono">{source.apiEndpoint}</p>
                    {source.apiKeyRequired && (
                      <p className="text-xs text-purple-700 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        API key required
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-slate-300">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-medium text-xs flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Visit Website
                  </a>
                  {source.feedUrl && (
                    <a
                      href={source.feedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-slate-300 hover:bg-slate-400 text-slate-900 rounded font-medium text-xs flex items-center justify-center gap-1"
                    >
                      <Rss className="w-3 h-3" />
                      Subscribe
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Integration Tips */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Integration Tips
        </h4>
        <ul className="text-sm text-green-900 space-y-1">
          <li>• <strong>RSS Feeds</strong> are easiest to integrate - no API key needed</li>
          <li>• <strong>API sources</strong> provide real-time updates (15 min)</li>
          <li>• For production, implement caching to avoid rate limits</li>
          <li>• Combine multiple sources for cross-verification</li>
          <li>• Parse HTML fallback for sources without RSS/API</li>
        </ul>
      </div>
    </div>
  );
};

export default NewsPanel;
