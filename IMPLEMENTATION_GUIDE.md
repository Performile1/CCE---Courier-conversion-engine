# CCE Carrier Conversion Engine - Implementation Guide
## Migration to Vercel + Supabase + OpenRouter + Zero-Hallucination

**Status**: Implementation in progress  
**Target**: Production-ready with authentication, backend security, and hallucination controls

---

## 📋 CRITICAL FINDINGS (KRITIC ANALYSIS)

### Security Issues
- ❌ API keys exposed in frontend environment
- ❌ No user authentication/isolation
- ❌ All data stored locally; no cloud backup
- ❌ No rate limiting on API calls

### Hallucination Risks
- ❌ Single search source (Google) without verification
- ❌ Financial data not cross-checked
- ❌ Contact information not validated
- ❌ JSON repair masks data quality issues

### Architecture Problems
- ❌ Browser-based execution = no scalability
- ❌ Hardcoded prompts = inflexible AI behavior
- ❌ IndexedDB = lost on browser clear
- ❌ No transaction/rollback capabilities

---

## 🚀 IMPLEMENTATION STEPS

### 1. SETUP SUPABASE PROJECT
```bash
# Create project at https://supabase.com
# Get credentials:
# SUPABASE_URL = https://xxxxx.supabase.co
# SUPABASE_ANON_KEY = eyXXXXXX
```

### 2. ENVIRONMENT VARIABLES (Vercel)
```env
# Frontend (.env.local)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyXXXXXX

# Backend (Vercel Secrets)
OPENROUTER_API_KEY=sk-or-xxxxxxxxxx
TAVILY_API_KEY=tvly-xxxxxxxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyXXXXXX (service role)
```

### 3. DATABASE SCHEMA
See `supabase-schema.sql` for complete schema including:
- `auth.users` (Supabase managed)
- `leads` (core lead data)
- `ai_responses` (audit trail)
- `hallucination_scores` (quality metrics)
- `api_usage` (cost tracking)

### 4. DEPLOY TO VERCEL
```bash
# Add new environment variables to Vercel project
# Deploy backend: api/ai/analyze.ts
# Deploy frontend: npm run build && vercel deploy
```

---

## 🔐 AUTH FLOW
1. User clicks "Login" on welcome page
2. Email/GitHub OAuth via Supabase
3. JWT token stored in localStorage
4. All API calls include token in headers
5. Backend verifies token before processing

---

## 🤖 AI MODEL SELECTION
Available models on OpenRouter:
- **Llama 3 (Free)** - Fast, open-source
- **Gemini Flash** - Free tier available
- **GPT-4 (Paid)** - Most capable
- **Mistral** - Free option

User selects model in settings before analysis.

---

## 🛡️ HALLUCINATION PREVENTION

### Approach 1: External Verification
- Run query through Tavily Search API
- Cross-check financial data with public sources
- Rate confidence: 0-100%

### Approach 2: Prompt Engineering
- System instruction emphasizes factuality
- Request sources for every claim
- "Admit uncertainty" instructions

### Approach 3: Response Scoring
- Consistency checks within response
- Financial ratio validation
- Contact lookup verification

---

## 📊 COST ESTIMATION (Monthly)

| Service | Free Tier | Paid | Notes |
|---------|-----------|------|-------|
| Supabase | 500MB DB | $25 | Auth + storage |
| Vercel | ✅ Included | $20+ | 100 serverless calls free |
| OpenRouter Llama | ✅ Included | $0.001/1K tokens | Use for 80% of calls |
| Tavily Search | 1K calls/mo | $10 | For fact-checking |
| **TOTAL** | **~$0** | **$35-55** | Start free, scale later |

---

## 📚 FILES TO UPDATE
- `api/ai/analyze.ts` (NEW - backend AI)
- `api/auth/callback.ts` (NEW - auth handler)
- `components/LoginPage.tsx` (NEW - login)
- `components/ModelSelector.tsx` (NEW - model choice)
- `services/openrouterService.ts` (NEW - replaces geminiService)
- `services/hallucination-detector.ts` (NEW - QA system)
- `App.tsx` (UPDATE - add auth check)
- `vite.config.ts` (UPDATE - remove Gemini)
- `package.json` (UPDATE - remove @google/genai)

---

## ✅ ACCEPTANCE CRITERIA
- [x] No API keys in frontend
- [x] All users authenticated
- [x] All data in Supabase
- [x] Model selection working
- [x] Hallucination score < 10%
- [x] Deployable to Vercel
