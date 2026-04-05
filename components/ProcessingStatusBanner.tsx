
import React from 'react';
import { Loader2, Star, ArrowRight, X, Ban, Timer, ShieldAlert, CheckCircle2, AlertTriangle, RotateCw, SkipForward } from 'lucide-react';
import { AnalysisStep, LeadData } from '../types';

interface ProcessingStatusBannerProps {
  loading: boolean;
  deepDiveLoading: boolean;
  analyzingCompany?: string | null;
  subStatus?: string | null;
  analysisSteps?: AnalysisStep[];
  analysisResult?: LeadData | null;
  onOpenResult?: () => void;
  onDismiss?: () => void;
  onCancel?: () => void;
}

export const ProcessingStatusBanner: React.FC<ProcessingStatusBannerProps> = ({
  loading,
  deepDiveLoading,
  analyzingCompany,
  subStatus,
  analysisSteps,
  analysisResult,
  onOpenResult,
  onDismiss,
  onCancel
}) => {
  const isWaiting = subStatus?.includes('Väntar') || subStatus?.includes('paus') || subStatus?.includes('Kyler ned');

  const renderStepIcon = (status: AnalysisStep['status']) => {
    if (status === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (status === 'failed') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
    if (status === 'fallback_used' || status === 'partial') return <AlertTriangle className="w-3.5 h-3.5 text-yellow-300" />;
    if (status === 'skipped') return <SkipForward className="w-3.5 h-3.5 text-slate-300" />;
    return <RotateCw className="w-3.5 h-3.5 text-[#FFCC00] animate-spin" />;
  };
  
  if (analysisResult) {
    return (
      <div className="bg-green-700 text-white shadow-2xl border-b-4 border-green-900 sticky top-0 z-banner animate-slideDown cursor-pointer ring-4 ring-green-400/30" onClick={onOpenResult}>
        <div className="max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="bg-white p-2 rounded-full shadow-inner animate-bounce">
              <Star className="w-6 h-6 text-green-700 fill-green-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black uppercase tracking-tighter truncate flex items-center gap-2">
                Analys Slutförd: {analysisResult.companyName}
              </h3>
              <p className="text-sm font-semibold opacity-90 truncate">Insikter och mailförslag redo att granskas.</p>
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onOpenResult?.(); }}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-sm text-xs font-bold uppercase flex items-center gap-2"
            >
              Öppna Resultat <ArrowRight className="w-3 h-3" />
            </button>
            {onDismiss && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                className="p-2 rounded-full hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading || deepDiveLoading) {
    return (
      <div className="bg-dhl-black text-white shadow-2xl border-b-4 border-red-600 sticky top-0 z-banner animate-slideDown">
        <div className="max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
            <div>
              <h3 className="text-lg font-black uppercase tracking-tighter">
                {deepDiveLoading ? `Analyserar: ${analyzingCompany}` : 'Söker Leads...'}
              </h3>
              {subStatus && (
                <p className="text-sm font-semibold text-[#FFCC00] flex items-center gap-2">
                  {isWaiting && <Timer className="w-4 h-4 animate-pulse" />} {subStatus}
                </p>
              )}
              {!!analysisSteps?.length && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {analysisSteps.map((step) => (
                    <div key={step.step} className="bg-white/5 border border-white/10 rounded-sm px-3 py-2 min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-white">
                        {renderStepIcon(step.status)}
                        <span className="truncate">{step.step.replace('_', ' ')}</span>
                      </div>
                      <div className="text-[10px] text-slate-200 mt-1 truncate">{step.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {onCancel && (
            <button 
              onClick={onCancel}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-sm text-xs font-bold uppercase flex items-center gap-2"
            >
              <Ban className="w-4 h-4" /> Avbryt
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

