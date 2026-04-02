/**
 * VERCEL FUNCTION - OpenRouter API Handler
 * Secure backend endpoint for AI model calls
 * API keys hidden from frontend
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Secure API key from environment variables (support both VITE_ and non-VITE_ names)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

interface OpenRouterRequest {
  model: string;
  prompt?: string;
  userMessage?: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS for frontend
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: 'OPENROUTER_API_KEY not configured in Vercel environment variables'
      });
    }

    const { model, prompt, userMessage, systemInstruction, temperature = 0.1, maxTokens = 2048, responseMimeType } = req.body as OpenRouterRequest;

    // Support both 'prompt' and 'userMessage' field names
    const userContent = userMessage || prompt;
    
    // Validate request
    if (!model || !userContent) {
      return res.status(400).json({ error: 'Missing required fields: model, prompt' });
    }

    // Map model names to OpenRouter IDs
    const modelMap: Record<string, string> = {
      'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct',
      'gpt-4-turbo': 'openai/gpt-4-turbo-preview',
      'google-gemini-free': 'google/gemini-flash-1.5',
      'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
      'mistral-7b': 'mistralai/mistral-7b-instruct'
    };

    const modelId = modelMap[model] || model;

    // Call OpenRouter API from backend (secure)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost',
        'X-Title': 'PerformileLeads',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: systemInstruction || 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
      })
    });

    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        res.setHeader('Retry-After', retryAfter);
      }
      const upstream = await response.json().catch(() => ({ error: 'Unknown error' }));
      const upstreamMessage = typeof upstream?.error === 'string' ? upstream.error : (upstream?.error?.message || upstream?.message || 'OpenRouter API error');
      return res.status(response.status).json({ error: upstreamMessage, retryAfter: retryAfter || undefined });
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';
    const usage = data.usage || {};

    // Return response compatible with both frontend services
    return res.status(200).json({
      // For openRouterInternationalService
      content: text,
      tokensUsed: {
        prompt: usage.prompt_tokens || 0,
        completion: usage.completion_tokens || 0,
        total: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
      },
      // For openrouterService
      text,
      model: modelId,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
      },
      choices: [{
        message: { content: text }
      }]
    });

  } catch (error: any) {
    console.error('OpenRouter API Handler Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// Calculate cost based on model and tokens
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costMap: Record<string, number> = {
    'llama-3.1-70b': 0.0007,
    'gpt-4-turbo': 0.01,
    'google-gemini-free': 0.0001,
    'gpt-3.5-turbo': 0.0005,
    'mistral-7b': 0.0002
  };

  const costPer1k = costMap[model] || 0.001;
  return ((inputTokens + outputTokens) * costPer1k) / 1000;
}
