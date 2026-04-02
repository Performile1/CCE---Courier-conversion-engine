import {
  generateInternationalSystemPrompt,
  generateUserMessage,
  generateSystemMessage
} from '../prompts/internationalSystemPrompt';
import { getTavilyIncludeDomains } from '../config/sources';
import { getCountryConfig } from '../config/countries';

export interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  contextLength: number;
}

export interface InternationalLLMRequest {
  country: string;
  company: string;
  query: string;
  model?: string;
  includeHallucinationCheck?: boolean;
  temperature?: number;
  maxTokens?: number;
  searchResults?: any[];
}

export interface InternationalLLMResponse {
  country: string;
  company: string;
  response: string;
  model: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  confidence: string;
  sources: string[];
  halluccinationRisks: string[];
  executionTimeMs: number;
  error?: string;
}

class EnhancedOpenRouterService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.io/api/v1';
  private availableModels: OpenRouterModel[] = [
    {
      id: 'openai/gpt-4-turbo-preview',
      name: 'GPT-4 Turbo',
      pricing: { prompt: '$0.01', completion: '$0.03' },
      contextLength: 128000
    },
    {
      id: 'openai/gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      pricing: { prompt: '$0.0005', completion: '$0.0015' },
      contextLength: 4096
    },
    {
      id: 'anthropic/claude-3-opus',
      name: 'Claude 3 Opus',
      pricing: { prompt: '$0.015', completion: '$0.075' },
      contextLength: 200000
    },
    {
      id: 'meta-llama/llama-2-70b-chat',
      name: 'Llama 2 70B Chat',
      pricing: { prompt: '$0.0007', completion: '$0.001' },
      contextLength: 4096
    },
    {
      id: 'mistralai/mistral-medium',
      name: 'Mistral Medium',
      pricing: { prompt: '$0.002', completion: '$0.006' },
      contextLength: 8000
    }
  ];

  constructor(apiKey: string = import.meta.env.VITE_OPENROUTER_API_KEY || '') {
    this.apiKey = apiKey;
  }

  /**
   * Query with international context (country + company specific)
   */
  async queryInternational(
    request: InternationalLLMRequest
  ): Promise<InternationalLLMResponse> {
    const startTime = Date.now();
    const defaults = {
      model: 'openai/gpt-3.5-turbo',
      includeHallucinationCheck: true,
      temperature: 0.3, // Lower temperature for factual accuracy
      maxTokens: 1024,
      ...request
    };

    try {
      // Validate country
      const countryConfig = getCountryConfig(request.country);
      if (!countryConfig) {
        throw new Error(`Unsupported country: ${request.country}`);
      }

      // Generate system prompt
      const systemPrompt = generateInternationalSystemPrompt({
        country: request.country,
        company: request.company,
        language: countryConfig.language,
        includeNews: true,
        includeFinancial: true,
        halluccinationCheck: defaults.includeHallucinationCheck
      });

      // Build user message with context
      const userMessage = this.buildContextualUserMessage(
        request.country,
        request.company,
        request.query,
        request.searchResults
      );

      // Get registry domains for confidence assessment
      const registryDomains = getTavilyIncludeDomains(request.country);

      // Call OpenRouter API
      const openRouterResponse = await this.callOpenRouterAPI({
        model: defaults.model,
        systemPrompt,
        userMessage,
        temperature: defaults.temperature,
        maxTokens: defaults.maxTokens
      });

      if (openRouterResponse.error) {
        throw new Error(openRouterResponse.error);
      }

      // Extract confidence and risks from response
      const { confidence, halluccinationRisks } = this.analyzeResponse(
        openRouterResponse.content,
        registryDomains
      );

      const executionTime = Date.now() - startTime;

      return {
        country: request.country,
        company: request.company,
        response: openRouterResponse.content,
        model: defaults.model,
        tokensUsed: {
          prompt: openRouterResponse.promptTokens,
          completion: openRouterResponse.completionTokens,
          total: openRouterResponse.totalTokens
        },
        confidence,
        sources: registryDomains,
        halluccinationRisks,
        executionTimeMs: executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        country: request.country,
        company: request.company,
        response: '',
        model: defaults.model,
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        confidence: 'Low',
        sources: [],
        halluccinationRisks: [error instanceof Error ? error.message : 'Unknown error'],
        executionTimeMs: executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Registry lookup specifically optimized for company registration data
   */
  async registryLookup(
    country: string,
    companyName: string,
    knownRegistrationNumber?: string
  ): Promise<InternationalLLMResponse> {
    const query = knownRegistrationNumber
      ? `Find detailed information about company registration ${knownRegistrationNumber}`
      : `Find company registration information for: ${companyName}`;

    return this.queryInternational({
      country,
      company: companyName,
      query,
      model: 'openai/gpt-4-turbo-preview', // Use better model for accuracy
      includeHallucinationCheck: true,
      temperature: 0.1, // Minimal temperature for factual accuracy
      maxTokens: 2048
    });
  }

  /**
   * Company verification across multiple sources
   */
  async verifyCompanyInformation(
    country: string,
    companyName: string,
    providedData: Record<string, any>
  ): Promise<InternationalLLMResponse> {
    const providedInfo = Object.entries(providedData)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');

    const query = `Verify and validate the following company information:
${providedInfo}

Cross-reference with official registries and reliable sources. Mark any discrepancies or unverified claims.`;

    return this.queryInternational({
      country,
      company: companyName,
      query,
      model: 'openai/gpt-4-turbo-preview',
      includeHallucinationCheck: true,
      temperature: 0.2,
      maxTokens: 2048
    });
  }

  /**
   * Extract structured data from company information
   */
  async extractStructuredData(
    country: string,
    companyName: string,
    rawText: string
  ): Promise<IInternationalLLMResponse> {
    const query = `Extract and structure the following company information into a standardized format:

${rawText}

Return as JSON with fields: name, registryId, foundedYear, industry, status, address, employees, revenue, website`;

    return this.queryInternational({
      country,
      company: companyName,
      query,
      model: 'openai/gpt-3.5-turbo',
      temperature: 0.1,
      maxTokens: 1024
    });
  }

  /**
   * Multi-language support - translate content
   */
  async translateContent(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      const response = await this.callOpenRouterAPI({
        model: 'openai/gpt-3.5-turbo',
        systemPrompt: `You are a professional translator. Translate from ${sourceLanguage} to ${targetLanguage}. Preserve all technical terms and company names.`,
        userMessage: `Translate this text:\n\n${text}`,
        temperature: 0.3,
        maxTokens: 2048
      });

      return response.content;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text on error
    }
  }

  /**
   * Get available models with pricing
   */
  getAvailableModels(): OpenRouterModel[] {
    return this.availableModels;
  }

  /**
   * Estimate cost for a query
   */
  estimateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): { promptCost: string; completionCost: string; totalCost: string } {
    const modelConfig = this.availableModels.find(m => m.id === model);
    if (!modelConfig) {
      return { promptCost: 'Unknown', completionCost: 'Unknown', totalCost: 'Unknown' };
    }

    // Parse pricing string (e.g., "$0.01" to 0.01)
    const promptPrice = parseFloat(modelConfig.pricing.prompt.replace('$', ''));
    const completionPrice = parseFloat(modelConfig.pricing.completion.replace('$', ''));

    const promptCost = (promptTokens / 1000 * promptPrice).toFixed(6);
    const completionCost = (completionTokens / 1000 * completionPrice).toFixed(6);
    const totalCost = (parseFloat(promptCost) + parseFloat(completionCost)).toFixed(6);

    return {
      promptCost: `$${promptCost}`,
      completionCost: `$${completionCost}`,
      totalCost: `$${totalCost}`
    };
  }

  /**
   * Direct OpenRouter API call
   */
  private async callOpenRouterAPI(params: {
    model: string;
    systemPrompt: string;
    userMessage: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    content: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    error?: string;
  }> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://cce-carrier-conversion.com',
          'X-Title': 'Carrier Conversion Engine'
        },
        body: JSON.stringify({
          model: params.model,
          messages: [
            {
              role: 'system',
              content: params.systemPrompt
            },
            {
              role: 'user',
              content: params.userMessage
            }
          ],
          temperature: params.temperature ?? 0.3,
          max_tokens: params.maxTokens ?? 1024,
          top_p: 0.95,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();

      return {
        content: data.choices[0]?.message?.content || '',
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      };
    } catch (error) {
      console.error('OpenRouter API call failed:', error);
      return {
        content: '',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build contextual user message with registry info
   */
  private buildContextualUserMessage(
    country: string,
    company: string,
    query: string,
    searchResults?: any[]
  ): string {
    const countryConfig = getCountryConfig(country);

    let message = `Country: ${countryConfig?.name}\nCompany: ${company}\n\nQuery: ${query}`;

    if (searchResults && searchResults.length > 0) {
      message += '\n\nRelevant search results:\n';
      searchResults.slice(0, 5).forEach((result, i) => {
        message += `${i + 1}. ${result.title}\n   Source: ${result.url}\n   Content: ${result.content?.substring(0, 200)}...\n\n`;
      });
    }

    if (countryConfig?.registryDomain) {
      message += `\nPrimary source: ${countryConfig.registryUrl || countryConfig.registryDomain}`;
    }

    return message;
  }

  /**
   * Analyze response for confidence and hallucination risks
   */
  private analyzeResponse(
    response: string,
    registryDomains: string[]
  ): {
    confidence: string;
    halluccinationRisks: string[];
  } {
    const risks: string[] = [];

    // Check for typical hallucination indicators
    const halluccinationPatterns = [
      /i (don't|do not|cannot) (have|provide|find|access|recall)/i,
      /i (am not|is not|was not) (aware|certain|sure)/i,
      /no (reliable|verified|official) (information|data|source)/i,
      /(possibly|likely|probably|might|could) be/i,
      /unclear|ambiguous|uncertain|speculative/i
    ];

    halluccinationPatterns.forEach(pattern => {
      if (pattern.test(response)) {
        risks.push(`Found uncertainty indicator: "${pattern}"`);
      }
    });

    // Check for registry source mentions
    const mentionsRegistry = registryDomains.some(domain =>
      response.toLowerCase().includes(domain.toLowerCase())
    );

    // Estimate confidence
    let confidence = 'Medium';
    if (risks.length > 0) {
      confidence = 'Low';
    } else if (mentionsRegistry) {
      confidence = 'High';
    } else if (response.length > 500) {
      confidence = 'High';
    }

    return { confidence, halluccinationRisks: risks };
  }
}

export type IInternationalLLMResponse = InternationalLLMResponse;

export const enhancedOpenRouterService = new EnhancedOpenRouterService();
export default enhancedOpenRouterService;
