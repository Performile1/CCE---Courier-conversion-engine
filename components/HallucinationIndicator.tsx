import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, Info, ChevronDown } from 'lucide-react';
import { LeadData } from '../types';

interface HallucinationIndicatorProps {
  lead: LeadData;
  isAnalyzing?: boolean;
}

export const HallucinationIndicator: React.FC<HallucinationIndicatorProps> = ({
  lead,
  isAnalyzing = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!lead.halluccinationScore && !isAnalyzing) {
    return null;
  }

  const score = lead.halluccinationScore || 0;
  const analysis = lead.halluccinationAnalysis;

  // Determine color and icon based on score
  let icon = CheckCircle;
  let bgColor = 'bg-dhl-gray-light';
  let borderColor = 'border-green-300';
  let textColor = 'text-green-900';
  let badgeColor = 'bg-green-200';
  let statusLabel = '✓ Highly Verified';

  if (score > 70) {
    icon = AlertTriangle;
    bgColor = 'bg-dhl-gray-light';
    borderColor = 'border-red-300';
    textColor = 'text-red-900';
    badgeColor = 'bg-dhl-gray-light';
    statusLabel = '🔴 Likely Hallucinated';
  } else if (score > 40) {
    icon = AlertCircle;
    bgColor = 'bg-dhl-gray-light';
    borderColor = 'border-amber-300';
    textColor = 'text-amber-900';
    badgeColor = 'bg-amber-200';
    statusLabel = '⚠️ Partially Verified';
  } else if (score > 0) {
    icon = AlertCircle;
    bgColor = 'bg-dhl-gray-light';
    borderColor = 'border-blue-300';
    textColor = 'text-blue-900';
    badgeColor = 'bg-blue-200';
    statusLabel = 'ℹ️ Minor Unverified Claims';
  }

  const IconComponent = icon;

  return (
    <div
      className={`border rounded-sm p-3 ${bgColor} ${borderColor} border-2 cursor-pointer transition-all`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconComponent className={`w-5 h-5 flex-shrink-0 ${textColor}`} />
          <div>
            <p className={`text-sm font-bold ${textColor}`}>
              {isAnalyzing ? 'Analyzing for hallucinations...' : statusLabel}
            </p>
            {!isAnalyzing && (
              <p className={`text-xs ${textColor} opacity-75`}>
                {score}% unverified • Trust: {analysis?.overallTrust || 'unknown'}
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 ${textColor} transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      {isExpanded && analysis && (
        <div className="mt-3 pt-3 border-t-2 border-current border-opacity-20 space-y-2">
          {/* Verified Fields */}
          {analysis.verifiedFields && analysis.verifiedFields.length > 0 && (
            <div>
              <p className={`text-xs font-bold ${textColor} mb-1`}>
                ✓ Verified Fields ({analysis.verifiedFields.length}):
              </p>
              <div className="flex flex-wrap gap-1">
                {analysis.verifiedFields.map((field, idx) => (
                  <span
                    key={idx}
                    className={`text-xs px-2 py-1 rounded-full bg-green-200 text-green-900`}
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Unverified Fields */}
          {analysis.unverifiedFields && analysis.unverifiedFields.length > 0 && (
            <div>
              <p className={`text-xs font-bold ${textColor} mb-1`}>
                ⚠️ Unverified Fields ({analysis.unverifiedFields.length}):
              </p>
              <div className="flex flex-wrap gap-1">
                {analysis.unverifiedFields.map((field, idx) => (
                  <span
                    key={idx}
                    className={`text-xs px-2 py-1 rounded-full bg-amber-200 text-amber-900`}
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="mt-2 pt-2 border-t border-current border-opacity-10">
              <p className={`text-xs font-bold ${textColor} mb-1`}>Recommendations:</p>
              <ul className="space-y-1">
                {analysis.recommendations.map((rec, idx) => (
                  <li key={idx} className={`text-xs ${textColor} flex gap-2`}>
                    <span className="flex-shrink-0">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Trust Level Details */}
          <div className="mt-2 pt-2 border-t border-current border-opacity-10">
            <div className="flex items-center justify-between">
              <p className={`text-xs font-bold ${textColor}`}>Overall Trust:</p>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full
                  ${
                    analysis.overallTrust === 'high'
                      ? 'bg-green-300 text-green-900'
                      : analysis.overallTrust === 'medium'
                      ? 'bg-amber-300 text-amber-900'
                      : 'bg-red-300 text-red-900'
                  }
                `}
              >
                {analysis.overallTrust?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HallucinationIndicator;


