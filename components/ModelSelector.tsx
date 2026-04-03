import React, { useState, useEffect } from 'react';
import { Zap, DollarSign, AlertCircle } from 'lucide-react';
import { getSelectedModel, setSelectedModel, getCostTracker, ModelName, resetCostTracker } from '../services/openrouterService';

const MODEL_CONFIG = {
  'llama-3.1-70b': { displayName: 'Llama 3.1 70B (Fast)', costPer1k: 0.0007, speed: '⚡ Very Fast', recommended: true },
  'deepseek-chat-v3-0324': { displayName: 'DeepSeek V3 0324 (Balanced)', costPer1k: 0.0006, speed: '⚡ Fast', recommended: true },
  'qwen-3.6-plus-free': { displayName: 'Qwen 3.6 Plus Free (Workhorse)', costPer1k: 0, speed: '⚡ Fast', recommended: false },
  'google-gemini-free': { displayName: 'Gemini 2.0 Flash (Budget)', costPer1k: 0.0001, speed: '⚡ Very Fast', recommended: false },
  'gemini-3-flash-preview': { displayName: 'Gemini 3 Flash Preview (Modern Google)', costPer1k: 0.0017, speed: '⚡ Fast', recommended: false },
  'claude-3.7-sonnet': { displayName: 'Claude 3.7 Sonnet (Premium)', costPer1k: 0.009, speed: '⏱️ Medium', recommended: false },
  'deepseek-r1': { displayName: 'DeepSeek R1 (Reasoning)', costPer1k: 0.0016, speed: '🧠 Slower', recommended: false },
  'grok-4.20': { displayName: 'Grok 4.20 (2M Context)', costPer1k: 0.0039, speed: '⚡ Fast', recommended: false },
  'gpt-4-turbo': { displayName: 'GPT-4 Turbo (Most Reliable)', costPer1k: 0.01, speed: '⏱️ Medium', recommended: false },
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
    <div className="bg-gradient-to-r from-dhl-gray-light to-dhl-gray-light border-l-4 border-dhl-red p-3 rounded-sm shadow-sm mb-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3 flex-1">
          <Zap className="w-4 h-4 text-dhl-red flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-dhl-black">
              {currentModelConfig.displayName}
            </p>
            <p className="text-xs text-dhl-gray-dark">
              {currentModelConfig.speed} • ${currentModelConfig.costPer1k.toFixed(4)}/1k tokens
            </p>
          </div>
        </div>
        {showCostTracker && (
          <div className="text-right">
            <p className="text-xs font-bold text-dhl-red">
              ${costTracker.totalCost.toFixed(4)}
            </p>
            <p className="text-xs text-dhl-gray-dark">Total spent</p>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-dhl-gray-medium space-y-2">
          <p className="text-xs font-bold text-dhl-black mb-2">Choose AI Model:</p>
          
          {Object.entries(MODEL_CONFIG).map(([modelId, config]) => (
            <button
              key={modelId}
              onClick={() => handleModelChange(modelId as ModelName)}
              className={`w-full p-2 text-left rounded-sm transition-all ${
                selectedModel === modelId
                  ? 'bg-dhl-red text-white shadow-md'
                  : 'bg-white text-dhl-black hover:bg-dhl-gray-light border border-dhl-gray-medium'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-bold">
                    {config.displayName}
                    {config.recommended && <span className="ml-2 text-dhl-yellow text-xs">✓ Recommended</span>}
                  </p>
                  <p className={`text-xs ${selectedModel === modelId ? 'text-white' : 'text-dhl-gray-dark'}`}>
                    {config.speed} • ${config.costPer1k.toFixed(4)}/1k tokens
                  </p>
                </div>
                {selectedModel === modelId && (
                  <div className="ml-2 text-lg">✓</div>
                )}
              </div>
            </button>
          ))}

          <div className="mt-3 pt-3 border-t border-dhl-gray-medium">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <DollarSign className="w-4 h-4 text-dhl-yellow" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-dhl-black">Cost Tracker</p>
                  <p className="text-xs text-dhl-gray-dark">
                    Total: ${costTracker.totalCost.toFixed(4)} spent
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetCosts}
                className="px-2 py-1 text-xs bg-dhl-gray-medium hover:bg-dhl-gray-medium text-dhl-black rounded transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 p-2 bg-dhl-gray-light border border-amber-200 rounded-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-dhl-yellow flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-snug">
              💡 <strong>Tip:</strong> Use DeepSeek V3 or Llama for scanning, Qwen or Gemini 2.0 for budget runs, and Claude or DeepSeek R1 when you need stricter reasoning.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;



