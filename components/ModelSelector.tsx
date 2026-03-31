import React, { useState, useEffect } from 'react';
import { Zap, DollarSign, AlertCircle } from 'lucide-react';
import { getSelectedModel, setSelectedModel, getCostTracker, ModelName, resetCostTracker } from '../services/openrouterService';

const MODEL_CONFIG = {
  'llama-3.1-70b': { displayName: 'Llama 3.1 70B (Fast)', costPer1k: 0.0007, speed: '⚡ Very Fast', recommended: true },
  'gpt-4-turbo': { displayName: 'GPT-4 Turbo (Most Reliable)', costPer1k: 0.01, speed: '⏱️ Medium', recommended: false },
  'google-gemini-free': { displayName: 'Gemini Free (Budget)', costPer1k: 0.0001, speed: '⚡ Very Fast', recommended: false },
  'gpt-3.5-turbo': { displayName: 'GPT-3.5 Turbo (Budget)', costPer1k: 0.0005, speed: '⚡ Fast', recommended: false },
  'mistral-7b': { displayName: 'Mistral 7B (Fast)', costPer1k: 0.0002, speed: '⚡ Fast', recommended: false }
};

interface ModelSelectorProps {
  onModelChange?: (model: ModelName) => void;
  showCostTracker?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  onModelChange, 
  showCostTracker = true 
}) => {
  const [selectedModel, setLocalModel] = useState<ModelName>(getSelectedModel());
  const [costTracker, setCostTracker] = useState(getCostTracker());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Update cost tracker every 5 seconds
    const interval = setInterval(() => {
      setCostTracker(getCostTracker());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleModelChange = (model: ModelName) => {
    setLocalModel(model);
    setSelectedModel(model);
    if (onModelChange) onModelChange(model);
    setIsExpanded(false);
  };

  const handleResetCosts = () => {
    resetCostTracker();
    setCostTracker(getCostTracker());
  };

  const currentModelConfig = MODEL_CONFIG[selectedModel];

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-indigo-600 p-3 rounded-lg shadow-sm mb-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3 flex-1">
          <Zap className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-900">
              {currentModelConfig.displayName}
            </p>
            <p className="text-xs text-slate-600">
              {currentModelConfig.speed} • ${currentModelConfig.costPer1k.toFixed(4)}/1k tokens
            </p>
          </div>
        </div>
        {showCostTracker && (
          <div className="text-right">
            <p className="text-xs font-bold text-indigo-600">
              ${costTracker.totalCost.toFixed(4)}
            </p>
            <p className="text-xs text-slate-600">Total spent</p>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-indigo-200 space-y-2">
          <p className="text-xs font-bold text-slate-900 mb-2">Choose AI Model:</p>
          
          {Object.entries(MODEL_CONFIG).map(([modelId, config]) => (
            <button
              key={modelId}
              onClick={() => handleModelChange(modelId as ModelName)}
              className={`w-full p-2 text-left rounded-lg transition-all ${
                selectedModel === modelId
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-900 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-bold">
                    {config.displayName}
                    {config.recommended && <span className="ml-2 text-green-600 text-xs">✓ Recommended</span>}
                  </p>
                  <p className={`text-xs ${selectedModel === modelId ? 'text-indigo-100' : 'text-slate-600'}`}>
                    {config.speed} • ${config.costPer1k.toFixed(4)}/1k tokens
                  </p>
                </div>
                {selectedModel === modelId && (
                  <div className="ml-2 text-lg">✓</div>
                )}
              </div>
            </button>
          ))}

          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <DollarSign className="w-4 h-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-900">Cost Tracker</p>
                  <p className="text-xs text-slate-600">
                    Total: ${costTracker.totalCost.toFixed(4)} spent
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetCosts}
                className="px-2 py-1 text-xs bg-slate-200 hover:bg-slate-300 text-slate-900 rounded transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-snug">
              💡 <strong>Tip:</strong> Use Llama 3.1 for fast batch processing, GPT-4 for critical decisions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
