/**
 * INTEGRATION EXAMPLES
 * Compile-safe TypeScript reference snippets for OpenRouter + Tavily integration.
 *
 * This file intentionally avoids JSX so it can remain `.ts` while still serving
 * as a copy-ready reference for implementation patterns.
 */

import { type SearchFormData, type LeadData } from './types';
import {
  generateDeepDiveSequential,
  generateLeads,
  getCostTracker,
  ModelName,
  resetCostTracker,
  setSelectedModel
} from './services/openrouterService';
import { analyzeForHallucinations, quickHallucinationCheck } from './services/tavilyService';

export interface AnalysisExampleState {
  selectedModel: ModelName;
  isAnalyzing: boolean;
  leads: LeadData[];
  totalCost: number;
}

export async function runAnalysisExample(
  formData: SearchFormData,
  state: AnalysisExampleState,
  onStatus?: (message: string) => void
): Promise<AnalysisExampleState> {
  onStatus?.(`Running deep dive with ${state.selectedModel}`);
  setSelectedModel(state.selectedModel);

  const lead = await generateDeepDiveSequential(
    formData,
    (_partial, status) => {
      if (status) onStatus?.(status);
    },
    (seconds, type) => {
      onStatus?.(`Rate limited (${type}), wait ${seconds}s`);
    },
    [],
    [],
    [],
    'DHL',
    [],
    state.selectedModel
  );

  const analysis = await analyzeForHallucinations(lead, onStatus);
  lead.halluccinationScore = analysis.halluccinationScore;
  lead.halluccinationAnalysis = {
    verifiedFields: analysis.verifiedFields,
    unverifiedFields: analysis.unverifiedFields,
    overallTrust: analysis.overallTrust,
    recommendations: analysis.recommendations
  };

  return {
    ...state,
    isAnalyzing: false,
    leads: [...state.leads, lead],
    totalCost: getCostTracker().totalCost
  };
}

export async function runBatchProcessingExample(
  formData: SearchFormData,
  batchSize: number = 10,
  model: ModelName = 'llama-3.1-70b'
): Promise<LeadData[]> {
  setSelectedModel(model);
  const results: LeadData[] = [];

  for (let index = 0; index < batchSize; index += 1) {
    try {
      const leads = await generateLeads(
        formData,
        () => {},
        [],
        [],
        'DHL',
        [],
        model
      );

      leads.forEach((lead) => {
        void quickHallucinationCheck(lead, (analysis) => {
          lead.halluccinationScore = analysis.halluccinationScore;
          lead.halluccinationAnalysis = {
            verifiedFields: analysis.verifiedFields,
            unverifiedFields: analysis.unverifiedFields,
            overallTrust: analysis.overallTrust,
            recommendations: analysis.recommendations
          };
        });
      });

      results.push(...leads);
    } catch (error) {
      console.error(`Batch ${index} failed:`, error);
    }
  }

  return results;
}

export function smartModelSelection(lead: Pick<LeadData, 'revenue'>): ModelName {
  const revenueTkr = parseInt(String(lead.revenue).replace(/[^\d]/g, ''), 10) || 0;

  if (revenueTkr > 5000) return 'gpt-4-turbo';
  if (revenueTkr > 1000) return 'llama-3.1-70b';
  return 'google-gemini-free';
}

export function describeResultsTableRow(
  lead: Pick<LeadData, 'companyName' | 'revenue' | 'aiModel' | 'halluccinationScore'>,
  showHallucinationScore: boolean = true
) {
  const score = lead.halluccinationScore || 0;

  const scoreLabel = score > 70
    ? 'HIGH HALLUCINATION'
    : score > 40
      ? 'MEDIUM HALLUCINATION'
      : score > 0
        ? 'MINOR UNVERIFIED'
        : 'VERIFIED';

  return {
    companyName: lead.companyName,
    revenue: lead.revenue,
    aiModel: lead.aiModel || 'unknown',
    hallucination: showHallucinationScore ? `${scoreLabel}: ${score}%` : null
  };
}

export function getCostMonitorSnapshot() {
  return getCostTracker();
}

export function clearTrackedCosts() {
  resetCostTracker();
  return getCostTracker();
}

export const MIGRATION_CHECKLIST: string[] = [
  'Add OPENROUTER and TAVILY environment variables.',
  'Replace Gemini imports with openrouterService imports.',
  'Add model selection handling in the analysis flow.',
  'Run analyzeForHallucinations after deep-dive results.',
  'Track total model spend with getCostTracker.',
  'Validate generated output with all supported models before deployment.'
];