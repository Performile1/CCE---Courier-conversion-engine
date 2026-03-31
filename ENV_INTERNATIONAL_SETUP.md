# Environment Variables for CCE International Expansion

Complete guide for setting up all environment variables for multi-country support.

---

## Quick Setup

### 1. Create .env.local

```bash
cp .env.example .env.local
```

### 2. Add these core variables:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# AI & Search
VITE_OPENROUTER_API_KEY=your-openrouter-key
VITE_TAVILY_API_KEY=your-tavily-key

# Country Settings
VITE_DEFAULT_COUNTRY=SE
VITE_DEFAULT_LANGUAGE=sv

# Features
VITE_ENABLE_INTERNATIONAL=true
VITE_ENABLE_NEWS_INTEGRATION=true
VITE_HALLUCINATION_CHECK_ENABLED=true
```

### 3. Test locally

```bash
npm run dev
```

---

## Complete Variable List

### Core Services (Required)

| Variable | Value | Where to Get |
|----------|-------|-------------|
| VITE_SUPABASE_URL | https://project.supabase.co | Supabase → Settings → API |
| VITE_SUPABASE_ANON_KEY | eyJh... | Supabase → Settings → API |
| VITE_OPENROUTER_API_KEY | sk-or-v1-... | OpenRouter.ai → Dashboard |
| VITE_TAVILY_API_KEY | tvly-... | Tavily.com → Dashboard |

### Settings (Recommended)

| Variable | Value | Options |
|----------|-------|---------|
| VITE_DEFAULT_COUNTRY | SE | SE, DK, NO, FI, GB, DE, FR, NL, BE, AT, CH, US |
| VITE_DEFAULT_LANGUAGE | sv | sv, da, no, fi, de, fr, nl, en |
| VITE_ENABLE_INTERNATIONAL | true | true/false |
| VITE_ENABLE_NEWS_INTEGRATION | true | true/false |
| VITE_HALLUCINATION_CHECK_ENABLED | true | true/false |

### Performance (Optional)

| Variable | Value | Notes |
|----------|-------|-------|
| VITE_CACHE_TTL | 3600 | Seconds (1 hour) |
| VITE_MAX_SEARCH_RESULTS | 50 | Max results per search |
| VITE_REQUEST_TIMEOUT | 30000 | Milliseconds |
| VITE_RATE_LIMIT_PER_MINUTE | 60 | API calls/minute |

### Optional News APIs

| Variable | Value | Optional |
|----------|-------|----------|
| VITE_MYNEWSDESK_API_KEY | ... | Yes (RSS fallback) |
| VITE_NEWSAPI_KEY | ... | Yes (NewsAPI) |
| VITE_GEMINI_API_KEY | AIzaSy... | Yes (direct Gemini) |

---

## Vercel Deployment

### Add to Vercel Project

1. Go to **Project Settings → Environment Variables**
2. Add each variable:

```
Name: VITE_SUPABASE_URL
Value: https://your-project.supabase.co
Environments: All (Development, Preview, Production)
```

3. Add for Production only (sensitive):

```
Name: VITE_SUPABASE_SERVICE_KEY
Value: eyJh...
Environments: Production only
```

### Recommended Vercel Setup

```
Production:
  - VITE_DEFAULT_COUNTRY=SE
  - VITE_CACHE_TTL=7200
  
Staging:
  - VITE_DEFAULT_COUNTRY=SE
  - VITE_CACHE_TTL=3600
  
Development:
  - VITE_DEFAULT_COUNTRY=SE
  - VITE_CACHE_TTL=1800
```

---

## GitHub Actions (CI/CD)

### Add GitHub Secrets

**Settings → Secrets and variables → Actions → New repository secret**

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
OPENROUTER_API_KEY
TAVILY_API_KEY
```

### Example Workflow (.github/workflows/deploy.yml)

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        run: npx vercel --prod
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          VITE_TAVILY_API_KEY: ${{ secrets.TAVILY_API_KEY }}
```

---

## Security Guidelines

### ✅ DO

- Use different keys for each environment
- Rotate keys quarterly
- Use strong, random API keys (30+ chars)
- Store keys in environment variables only
- Use GitHub Secrets for CI/CD
- Add `.env.local` to `.gitignore`

### ❌ DON'T

- Commit `.env.local` to Git
- Share API keys in Slack/Email
- Use placeholder values in production
- Store keys in code
- Use same key for dev/staging/prod
- Expose keys in error messages

---

## Testing Variables

### Test Supabase Connection

```bash
curl https://YOUR_URL.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Test OpenRouter

```bash
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### Test Tavily

```bash
curl -X POST https://api.tavily.com/search \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_KEY",
    "query": "test",
    "max_results": 5
  }'
```

---

## .env.example Template

Create this file in project root:

```bash
# ============ REQUIRED ============

# Supabase (Backend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Services
VITE_OPENROUTER_API_KEY=sk-or-v1-xxxxx...
VITE_TAVILY_API_KEY=tvly-xxxxx...

# ============ OPTIONAL ============

# Gemini (if using direct integration)
VITE_GEMINI_API_KEY=AIzaSyDxxxxx...

# Settings
VITE_DEFAULT_COUNTRY=SE
VITE_DEFAULT_LANGUAGE=sv
VITE_ENABLE_INTERNATIONAL=true
VITE_ENABLE_NEWS_INTEGRATION=true
VITE_HALLUCINATION_CHECK_ENABLED=true

# News Sources (if using APIs)
VITE_MYNEWSDESK_API_KEY=
VITE_NEWSAPI_KEY=

# Performance
VITE_CACHE_TTL=3600
VITE_MAX_SEARCH_RESULTS=50
VITE_REQUEST_TIMEOUT=30000
VITE_RATE_LIMIT_PER_MINUTE=60
```

---

## Troubleshooting

### Issue: "Cannot find module VITE_SUPABASE_URL"

**Solution:**
1. Check `.env.local` exists
2. Verify variable name starts with `VITE_`
3. Stop and restart dev server
4. Check `.gitignore` includes `.env.local`

### Issue: "401 Unauthorized" from API

**Solution:**
1. Verify API key is correct
2. Check for extra spaces in key
3. Ensure key hasn't expired
4. Test key with curl command above

### Issue: CORS errors from Supabase

**Solution:**
1. Go to Supabase → Authentication → URL Configuration
2. Add your domain to allowed origins
3. For Vercel: Add production domain
4. Clear browser cache

### Issue: Environment variables not loading in Vercel

**Solution:**
1. Check variables are set in Vercel dashboard
2. Verify correct environment (dev/preview/prod)
3. Restart deployment
4. Check variable names match exactly
5. No extra spaces or quotes

---

## Next Steps

1. ✅ Get all API keys
2. ✅ Create `.env.local` locally
3. ✅ Test locally with `npm run dev`
4. ✅ Add to Vercel dashboard
5. ✅ Deploy to staging
6. ✅ Deploy to production

---

## Environment Checklist

- [ ] Supabase URL configured
- [ ] Supabase keys added
- [ ] OpenRouter API key added
- [ ] Tavily API key added
- [ ] Default country set
- [ ] Default language set
- [ ] International features enabled
- [ ] News integration enabled
- [ ] Hallucination check enabled
- [ ] Local dev tested
- [ ] Vercel configured
- [ ] GitHub secrets set
- [ ] `.env.local` in `.gitignore`
- [ ] Staging deployed
- [ ] Production deployed
