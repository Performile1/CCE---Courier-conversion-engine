import React, { useState } from 'react';
import { Link2, ExternalLink, Star, Globe, TrendingUp } from 'lucide-react';
import { getSourcesByCountry, SourceConfig } from '../config/sources';

interface SourcesListProps {
  countryCode: string;
  onSourceClick?: (source: SourceConfig) => void;
  showReliabilityScore?: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  registry: '📋',
  news: '📰',
  financial: '💰',
  directory: '📑'
};

const TYPE_COLORS: Record<string, string> = {
  registry: 'bg-purple-100 text-purple-800',
  news: 'bg-blue-100 text-blue-800',
  financial: 'bg-green-100 text-green-800',
  directory: 'bg-orange-100 text-orange-800'
};

export const SourcesList: React.FC<SourcesListProps> = ({
  countryCode,
  onSourceClick,
  showReliabilityScore = true
}) => {
  const sources = getSourcesByCountry(countryCode);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  // Group sources by type
  const groupedSources = sources.reduce((acc, source) => {
    if (!acc[source.type]) {
      acc[source.type] = [];
    }
    acc[source.type].push(source);
    return acc;
  }, {} as Record<string, SourceConfig[]>);

  const sourceTypes: Array<'registry' | 'news' | 'financial' | 'directory'> = [
    'registry',
    'news',
    'financial',
    'directory'
  ];

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      registry: 'Official Registries',
      news: 'News & Media',
      financial: 'Financial Data',
      directory: 'Business Directories'
    };
    return labels[type] || type;
  };

  return (
    <div className="w-full space-y-4">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <Globe className="w-5 h-5 text-blue-600" />
        Sources for {
          // Get country name
          ({ SE: 'Sweden', DK: 'Denmark', NO: 'Norway', FI: 'Finland', GB: 'United Kingdom', DE: 'Germany', FR: 'France', NL: 'Netherlands', BE: 'Belgium', AT: 'Austria', CH: 'Switzerland', US: 'United States' } as Record<string, string>)[countryCode] || countryCode
        }
      </h3>

      {/* Group by type */}
      <div className="space-y-4">
        {sourceTypes.map((type) => {
          const typeSources = groupedSources[type];
          if (!typeSources) return null;

          return (
            <div key={type} className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span>{TYPE_ICONS[type]}</span>
                {getTypeLabel(type)} ({typeSources.length})
              </h4>

              <div className="space-y-2 pl-6">
                {typeSources.map((source) => (
                  <div
                    key={source.id}
                    className="border border-slate-300 rounded-lg overflow-hidden hover:shadow-md transition-all"
                  >
                    {/* Source Header */}
                    <button
                      onClick={() => {
                        setExpandedSource(
                          expandedSource === source.id ? null : source.id
                        );
                        onSourceClick?.(source);
                      }}
                      className="w-full p-3 flex items-center justify-between gap-2 hover:bg-slate-50 bg-white"
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-semibold text-slate-900">
                            {source.name}
                          </h5>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              TYPE_COLORS[source.type]
                            }`}
                          >
                            {source.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{source.domain}</p>
                      </div>

                      {showReliabilityScore && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-semibold text-slate-900">
                            {source.reliability}%
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Expanded Content */}
                    {expandedSource === source.id && (
                      <div className="border-t border-slate-200 p-3 bg-slate-50 space-y-2 text-sm">
                        <p className="text-slate-700">{source.description}</p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1">
                          {source.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          <a
                            href={`https://${source.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Visit
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`https://${source.domain}`);
                              alert('URL copied to clipboard');
                            }}
                            className="flex-1 px-3 py-1 bg-slate-300 hover:bg-slate-400 text-slate-900 rounded text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <Link2 className="w-3 h-3" />
                            Copy
                          </button>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-300">
                          <div className="text-xs">
                            <p className="text-slate-600">Reliability</p>
                            <p className="font-bold text-slate-900">
                              {source.reliability}%
                            </p>
                          </div>
                          <div className="text-xs">
                            <p className="text-slate-600">Type</p>
                            <p className="font-bold text-slate-900 capitalize">
                              {source.type}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Summary
        </h4>
        <ul className="text-sm text-blue-900 space-y-1">
          <li>• Total sources: <strong>{sources.length}</strong></li>
          <li>• Official registries: <strong>{groupedSources.registry?.length || 0}</strong></li>
          <li>• Average reliability: <strong>{Math.round(sources.reduce((acc, s) => acc + s.reliability, 0) / sources.length)}%</strong></li>
          <li>• Click a source to view details and visit</li>
        </ul>
      </div>

      {/* Usage Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
        <p className="font-semibold mb-1">💡 How to use these sources:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Primary research: Start with <strong>Official Registries</strong></li>
          <li>Verification: Cross-check with <strong>Financial Data</strong> and <strong>News</strong></li>
          <li>Additional info: Check <strong>Business Directories</strong> for supplementary data</li>
          <li>Always cite your sources in final reports</li>
        </ol>
      </div>
    </div>
  );
};

export default SourcesList;
