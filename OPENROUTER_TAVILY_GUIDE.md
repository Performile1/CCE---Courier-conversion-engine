# PHASE 3 & 4 IMPLEMENTATION GUIDE
## OpenRouter Integration + Hallucination Prevention

**Date:** March 31, 2026  
**Version:** 2.0 (OpenRouter + Tavily)  
**Status:** ✅ READY FOR INTEGRATION

---

## 📋 WHAT'S NEW

### Phase 3: OpenRouter Integration ✅
- **Replaced:** Google Gemini API
- **Why:** Better reliability, multiple model support, reduced hallucinations
- **Models Available:**
  - 🚀 **Llama 3.1 70B** - Fastest, lowest cost, recommended for batch processing
  - 🧠 **GPT-4 Turbo** - Most reliable, higher cost, recommended for critical decisions
  - 💰 **Gemini Free** - Budget option, lowest cost
  - ⚡ **GPT-3.5 Turbo** - Budget-friendly alternative
  - 🌪️ **Mistral 7B** - Fast, low cost

**Cost Tracking:** Real-time cost monitor shows spending per model  
**Model Selector UI:** New component to switch models on-the-fly

### Phase 4: Hallucination Prevention Engine ✅
- **Integrated:** Tavily Search API for fact-checking
- **Features:**
  - Automatic company verification
  - Revenue/financial data validation
  - Decision maker verification (LinkedIn-based)
  - Tech stack validation
- **Hallucination Score:** 0-100 (0 = verified, 100 = likely hallucinated)
- **Trust Levels:**
  - 🟢 High (0-20% unverified)
  - 🟡 Medium (20-50% unverified)
  - 🔴 Low (50%+ unverified)

---

## 🚀 ENVIRONMENT SETUP

### Required API Keys

Add these to your `.env.local` file:

```bash
# OpenRouter - Replace Google Gemini
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Tavily - Hallucination Prevention (OPTIONAL but recommended)
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxx

# Keep existing for backward compatibility (optional)
GEMINI_API_KEY=xxxxx (can be removed)
```

### Get API Keys:
1. **OpenRouter:** https://openrouter.ai/ (Free tier available)
2. **Tavily:** https://tavily.com/ (Free API key available)

---

## 💻 CODE CHANGES

### New Files Created:

```
services/
  ├── openrouterService.ts          (NEW - Replaces Gemini)
  └── tavilyService.ts              (NEW - Hallucination detection)

components/
  ├── ModelSelector.tsx             (NEW - Model switcher UI)
  └── HallucinationIndicator.tsx    (NEW - Trust score display)

types.ts (UPDATED)
  ├── + aiModel field
  ├── + halluccinationScore field
  └── + halluccinationAnalysis field
```

### Backward Compatibility:
- Old `geminiService.ts` still works
- You can switch between services by changing imports in `App.tsx` or component files
- Gradual migration supported

---

## 🔧 INTEGRATION STEPS

### Step 1: Update Imports
In files that use Gemini service, replace:
```typescript
// OLD
import { generateDeepDiveSequential } from '../services/geminiService';

// NEW
import { generateDeepDiveSequential } from '../services/openrouterService';
```

### Step 2: Add Model Selector to UI
In `App.tsx` or relevant component:
```typescript
import ModelSelector from './components/ModelSelector';
import { getSelectedModel } from '../services/openrouterService';

// In your JSX:
<ModelSelector 
  onModelChange={(model) => console.log('Model changed to:', model)}
  showCostTracker={true}
/>
```

### Step 3: Add Hallucination Indicator
In `LeadCard.tsx` or results display:
```typescript
import HallucinationIndicator from './components/HallucinationIndicator';

// In your JSX:
<HallucinationIndicator lead={lead} isAnalyzing={isChecking} />
```

### Step 4: Enable Hallucination Checks (Optional)
In your analysis function:
```typescript
import { analyzeForHallucinations } from '../services/tavilyService';

// After creating a lead:
const analysis = await analyzeForHallucinations(lead, (msg) => {
  console.log(msg);
});

lead.halluccinationScore = analysis.halluccinationScore;
lead.halluccinationAnalysis = analysis;
```

---

## 📊 USAGE EXAMPLES

### Example 1: Using Model Selector
```typescript
import { setSelectedModel, getSelectedModel } from '../services/openrouterService';

// User selects GPT-4 Turbo for critical analysis
setSelectedModel('gpt-4-turbo');

// All subsequent calls use GPT-4 Turbo
const lead = await generateDeepDiveSequential(...);
console.log(lead.aiModel); // 'gpt-4-turbo'
```

### Example 2: Tracking Costs
```typescript
import { getCostTracker, resetCostTracker } from '../services/openrouterService';

// Check spending
const costs = getCostTracker();
console.log(`Total spent: $${costs.totalCost}`);

// Reset for new session
resetCostTracker();
```

### Example 3: Checking for Hallucinations
```typescript
import { quickHallucinationCheck } from '../services/tavilyService';

// Run hallucination check in background
quickHallucinationCheck(lead, (analysis) => {
  console.log('Hallucination score:', analysis.halluccinationScore);
  
  if (analysis.overallTrust === 'low') {
    // Alert user to manually verify critical fields
    console.warn('Manual verification recommended!');
  }
});
```

---

## ⚙️ MODEL SELECTION GUIDE

### Quick Decision Matrix:

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| Batch prospecting (10+ leads) | Llama 3.1 70B | Fast, cheap, reliable for lists |
| Single lead deep analysis | GPT-4 Turbo | Most accurate, worth the cost |
| Revenue/financial verification | Gemini Free | Good balance, lowest cost |
| Quick company lookup | Mistral 7B | Fast, budget-friendly |
| Emergency (API quota exceeded) | Google Gemini Free | Free tier, instant backup |

### Cost Estimates (per 1000 tokens):
- Llama 3.1 70B: **$0.0007**
- Mistral 7B: **$0.0002**
- GPT-3.5 Turbo: **$0.0005**
- Gemini Free: **$0.0001**
- GPT-4 Turbo: **$0.01**

---

## 🛡️ HALLUCINATION PREVENTION CHECKLIST

### ✅ Enable These:
- [x] Tavily API fact-checking enabled
- [x] Company verification against Allabolag/Bolagsverket
- [x] Revenue data cross-checked
- [x] Decision maker LinkedIn verification
- [x] Tech stack validation

### ⚠️ Monitor These:
- Hallucination score > 50%
- Conflicting data sources
- Unverified decision makers
- Missing company registry info

### 🔴 Manual Review When:
- Hallucination score > 70%
- "Low" trust rating
- Financial data conflicts
- Decision maker not found on LinkedIn

---

## 🔍 INTERPRETING RESULTS

### Hallucination Score Examples:

**✓ Lead A: Score 15% (HIGH TRUST)**
- Company name verified on Allabolag
- Revenue confirmed
- Decision makers found on LinkedIn
- ✅ Safe to outreach

**⚠️ Lead B: Score 45% (MEDIUM TRUST)**
- Company verified
- Revenue unconfirmed (needs check)
- 1 of 3 decision makers found
- ⚠️ Recommend manual verification before outreach

**🔴 Lead C: Score 78% (LOW TRUST)**
- Company name not found
- Revenue figures conflicting
- No decision makers verified
- 🔴 BLOCK - Manual research required

---

## 🚨 TROUBLESHOOTING

### Issue: "OPENROUTER_API_KEY not configured"
**Solution:** Add API key to `.env.local`:
```bash
OPENROUTER_API_KEY=sk-or-xxxxx
```

### Issue: "Tavily search failed"
**Solution:** 
- Check TAVILY_API_KEY in `.env.local`
- Tavily is optional; hallucination checks will skip if unavailable
- System will still work without Tavily (just no verification)

### Issue: Model returns empty response
**Solution:**
- Check model availability in OpenRouter dashboard
- Ensure API key has sufficient quota
- Try switching to different model via ModelSelector

### Issue: High costs when batch processing
**Solution:**
- Use Llama 3.1 70B (10x cheaper than GPT-4)
- Set batches to 5-10 leads at a time
- Monitor cost tracker in real-time

---

## 📈 BEST PRACTICES

### 1. Model Strategy
```typescript
// For batch prospecting: Use Llama 3
setSelectedModel('llama-3.1-70b');

// For critical decisions: Use GPT-4
setSelectedModel('gpt-4-turbo');
```

### 2. Cost Optimization
- Batch 5-10 leads with Llama 3
- Save GPT-4 for decisions > 500k SEK revenue
- Use Gemini Free for quick company lookups

### 3. Hallucination Management
- Always check hallucination score > 50%
- Flag team for manual verification if score > 70%
- Require LinkedIn verification for decision makers

### 4. Error Handling
```typescript
try {
  const lead = await generateDeepDiveSequential(...);
  const analysis = await analyzeForHallucinations(lead);
  
  if (analysis.halluccinationScore > 70) {
    // Alert: Manual review required
  }
} catch (error) {
  // Fallback to Gemini Free if available
  setSelectedModel('google-gemini-free');
}
```

---

## 📞 SUPPORT & DOCUMENTATION

**OpenRouter Docs:** https://openrouter.ai/docs  
**Tavily API Docs:** https://docs.tavily.com  
**Implementation Guide:** See `IMPLEMENTATION_GUIDE.md`

---

## ✨ NEXT STEPS (Phase 5+)

Planned future enhancements:
- [ ] Backend Vercel Functions for API key security
- [ ] Supabase integration for data persistence
- [ ] Login page + user authentication
- [ ] Real-time sync across devices
- [ ] Advanced hallucination scoring algorithm
- [ ] Multi-language support for verification

---

**Status:** ✅ Ready for production  
**Last Updated:** March 31, 2026  
**Tested Models:** All models verified with sample data
