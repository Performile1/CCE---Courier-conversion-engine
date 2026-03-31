/**
 * INTEGRATION EXAMPLE: OpenRouter + Tavily
 * Shows how to replace Gemini with OpenRouter and add hallucination checking
 * 
 * This is a reference file - copy patterns to your existing components
 */

// ============================================================================
// EXAMPLE 1: In App.tsx or main analysis component
// ============================================================================

import React, { useState } from 'react';
import ModelSelector from './components/ModelSelector';
import HallucinationIndicator from './components/HallucinationIndicator';
import {
  generateDeepDiveSequential,
  setSelectedModel,
  getSelectedModel,
  getCostTracker,
  ModelName
} from './services/openrouterService';
import { analyzeForHallucinations } from './services/tavilyService';
import { LeadData } from './types';

export const AnalysisExample = () => {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedModel, setLocalModel] = useState<ModelName>('llama-3.1-70b');
  const [costs, setCosts] = useState(getCostTracker());

  // Handle model change
  const handleModelChange = (model: ModelName) => {
    setLocalModel(model);
    setSelectedModel(model);
    console.log(`Switched to ${model}`);
  };

  // Main analysis function
  const handleAnalyze = async (formData: any) => {
    setIsAnalyzing(true);
    try {
      // Use currently selected model
      const lead = await generateDeepDiveSequential(
        formData,
        (partial, status) => {
          console.log('Status:', status);
          // Update UI with partial results
        },
        (seconds, type) => {
          console.log(`Rate limited: wait ${seconds}s`);
        },
        [], // newsSourceMappings
        [], // sniPercentages
        [], // integrations
        'DHL', // activeCarrier
        [], // threePLProviders
        selectedModel // pass selected model
      );

      // Add hallucination check
      console.log('Running hallucination analysis...');
      const analysis = await analyzeForHallucinations(lead);
      
      // Add analysis to lead
      lead.halluccinationScore = analysis.halluccinationScore;
      lead.halluccinationAnalysis = {
        verifiedFields: analysis.verifiedFields,
        unverifiedFields: analysis.unverifiedFields,
        overallTrust: analysis.overallTrust,
        recommendations: analysis.recommendations
      };

      setLeads([...leads, lead]);

      // Update cost tracker
      setCosts(getCostTracker());

      // Alert if high hallucination score
      if (analysis.halluccinationScore > 70) {
        alert(`⚠️ High hallucination score (${analysis.halluccinationScore}%). Manual review recommended.`);
      }

    } catch (error) {
      console.error('Analysis failed:', error);
      alert(`Error: ${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Model Selector - NEW */}
      <ModelSelector 
        onModelChange={handleModelChange}
        showCostTracker={true}
      />

      {/* Analysis Results */}
      <div className="space-y-3">
        {leads.map(lead => (
          <div key={lead.id} className="p-4 border rounded-lg bg-white space-y-3">
            {/* Show hallucination indicator - NEW */}
            <HallucinationIndicator lead={lead} />

            {/* Rest of lead info */}
            <h3 className="font-bold">{lead.companyName}</h3>
            <p className="text-sm text-gray-600">
              Model: {lead.aiModel} | Score: {lead.halluccinationScore}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// EXAMPLE 2: In a batch processing component
// ============================================================================

import { generateLeads, ModelName, setSelectedModel } from './services/openrouterService';
import { quickHallucinationCheck } from './services/tavilyService';

export const BatchProcessingExample = async (
  formData: any,
  batchSize: number = 10
) => {
  // Use Llama 3 for fast batch processing
  setSelectedModel('llama-3.1-70b');

  const results: LeadData[] = [];

  for (let i = 0; i < batchSize; i++) {
    try {
      const leads = await generateLeads(
        formData,
        () => {}, // handleWait
        [], // sniPercentages
        [], // exclusionList
        'DHL', // activeCarrier
        [], // threePLProviders
        'llama-3.1-70b' // explicitly use Llama for batch
      );

      // Queue hallucination checks in background (don't block)
      leads.forEach(lead => {
        quickHallucinationCheck(lead, (analysis) => {
          // Update lead with analysis when ready
          lead.halluccinationScore = analysis.halluccinationScore;
          lead.halluccinationAnalysis = analysis;
        });
      });

      results.push(...leads);
    } catch (error) {
      console.error(`Batch ${i} failed:`, error);
    }
  }

  return results;
};

// ============================================================================
// EXAMPLE 3: Cost-optimized strategy function
// ============================================================================

import { ModelName, setSelectedModel, getCostTracker } from './services/openrouterService';

export const smartModelSelection = (lead: LeadData): ModelName => {
  // Determine best model based on lead value
  const revenueTKR = parseInt(lead.revenue.replace(/[^\d]/g, '')) || 0;

  if (revenueTKR > 5000) {
    // High-value leads: use GPT-4 for maximum accuracy
    return 'gpt-4-turbo';
  } else if (revenueTKR > 1000) {
    // Medium-value: use Llama 3 (good balance)
    return 'llama-3.1-70b';
  } else {
    // Low-value: use free tier for cost savings
    return 'google-gemini-free';
  }
};

export const analyzeWithSmartModel = async (lead: LeadData) => {
  const smartModel = smartModelSelection(lead);
  setSelectedModel(smartModel);
  
  // Continue with analysis using smart model
  console.log(`Using ${smartModel} for ${lead.companyName}`);
};

// ============================================================================
// EXAMPLE 4: Advanced hallucination checking in ResultsTable
// ============================================================================

import { LeadData } from './types';

interface ResultsTableRowProps {
  lead: LeadData;
  showHallucinationScore?: boolean;
}

export const ResultsTableRow: React.FC<ResultsTableRowProps> = ({
  lead,
  showHallucinationScore = true
}) => {
  const getScoreColor = (score: number) => {
    if (score > 70) return 'bg-red-100 text-red-900';
    if (score > 40) return 'bg-amber-100 text-amber-900';
    if (score > 0) return 'bg-blue-100 text-blue-900';
    return 'bg-green-100 text-green-900';
  };

  const getScoreLabel = (score: number) => {
    if (score > 70) return 'HIGH HALLUCINATION';
    if (score > 40) return 'MEDIUM HALLUCINATION';
    if (score > 0) return 'MINOR UNVERIFIED';
    return 'VERIFIED';
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="p-3">{lead.companyName}</td>
      <td className="p-3">{lead.revenue}</td>
      <td className="p-3">{lead.aiModel}</td>
      {showHallucinationScore && (
        <td className="p-3">
          <span className={`px-2 py-1 rounded text-xs font-bold ${
            getScoreColor(lead.halluccinationScore || 0)
          }`}>
            {getScoreLabel(lead.halluccinationScore || 0)}: {lead.halluccinationScore || 0}%
          </span>
        </td>
      )}
    </tr>
  );
};

// ============================================================================
// EXAMPLE 5: Cost monitoring utility
// ============================================================================

import { getCostTracker, resetCostTracker } from './services/openrouterService';

export const CostMonitor = () => {
  const [costs, setCosts] = React.useState(getCostTracker());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCosts(getCostTracker());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 bg-blue-50 rounded-lg border border-blue-300">
      <h4 className="font-bold mb-2">Cost Monitor</h4>
      <p className="text-sm">Current Model: {costs.model}</p>
      <p className="text-sm font-bold">Total Spent: ${costs.totalCost.toFixed(4)}</p>
      <button
        onClick={() => {
          resetCostTracker();
          setCosts(getCostTracker());
        }}
        className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Reset Costs
      </button>
    </div>
  );
};

// ============================================================================
// MIGRATION CHECKLIST
// ============================================================================

/**
 * To migrate from Gemini to OpenRouter:
 * 
 * 1. ✅ Add environment variables:
 *    OPENROUTER_API_KEY=sk-or-xxxxx
 *    TAVILY_API_KEY=tvly-xxxxx
 * 
 * 2. ✅ Install dependencies:
 *    npm install axios
 * 
 * 3. ✅ Update imports in components:
 *    FROM: import { ... } from '../services/geminiService'
 *    TO:   import { ... } from '../services/openrouterService'
 * 
 * 4. ✅ Add ModelSelector component:
 *    <ModelSelector onModelChange={handleModelChange} />
 * 
 * 5. ✅ Add HallucinationIndicator component to results:
 *    <HallucinationIndicator lead={lead} />
 * 
 * 6. ✅ Enable hallucination checks:
 *    const analysis = await analyzeForHallucinations(lead);
 *    lead.halluccinationScore = analysis.halluccinationScore;
 * 
 * 7. ✅ Monitor costs:
 *    const costs = getCostTracker();
 *    console.log(`Total spent: $${costs.totalCost}`);
 * 
 * 8. ✅ Test with all 5 models to ensure compatibility
 * 
 * 9. ✅ Deploy to Vercel (add env vars to Vercel dashboard)
 * 
 * 10. ✅ Monitor in production for costs and hallucination scores
 */
