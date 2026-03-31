# Environment Setup Guide (Phase 5 & 7)

## Overview
This guide walks you through setting up all required environment variables for CCE Carrier Conversion Engine with Phase 5 (Backend & Authentication) and Phase 7 (Premium Features).

## Required Environment Variables

### 1. Frontend (.env.local)
Create `c:\Users\A\Documents\Develop\cce---carrier-conversion-enginde\.env.local`:

```
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenRouter (No longer needed here - moved to backend in Phase 5)
# OPENROUTER_API_KEY=sk_live_...  ← DELETE THIS

# Tavily (No longer needed here - moved to backend in Phase 5)
# TAVILY_API_KEY=...  ← DELETE THIS

# API Base URL (for Vercel Functions)
REACT_APP_API_BASE_URL=http://localhost:3001  # Local development
# REACT_APP_API_BASE_URL=https://your-domain.vercel.app  # Production
```

### 2. Backend / Vercel Functions (.env.local in `/api`)
Create `.env.local` in your `/api` directory:

```
# Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenRouter API (Moved to backend for security)
OPENROUTER_API_KEY=sk_live_...
OPENROUTER_BUDGET_LIMIT=100  # Monthly budget in USD

# Tavily API (Moved to backend for security)
TAVILY_API_KEY=...
TAVILY_SEARCH_DEPTH=advanced  # Options: basic, advanced

# Email Service (for Phase 7)
SENDGRID_API_KEY=SG.xxxxx_yyyyy_...
# OR
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=mg.yourdomain.com

# CRM Integrations (Optional - users will input during setup)
# HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-...
# PIPEDRIVE_API_TOKEN=...
# SALESFORCE_OAUTH_TOKEN=...
```

### 3. Production Deployment (Vercel Console)
In your Vercel project dashboard, add these secrets:

1. Go to Settings → Environment Variables
2. Add each variable from Backend section above
3. Select which environments: Production, Preview, Development

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
TAVILY_API_KEY
SENDGRID_API_KEY
MAILGUN_API_KEY
(CRM tokens added by users at runtime)
```

## Step-by-Step Setup

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Click "New Project" or use existing project
3. Copy project URL and anon key
4. Add to `.env.local`:
   ```
   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Step 2: Execute Database Schema
1. In Supabase dashboard, go to SQL Editor
2. Click "New Query"
3. Copy contents of `db/supabase-schema.sql`
4. Paste into editor and run
5. Verify all 9 tables created:
   - users
   - leads
   - decision_makers
   - analysis_history
   - campaigns
   - campaign_recipients
   - crm_integrations
   - slack_integrations
   - cost_tracking

### Step 3: Get OpenRouter API Key
1. Go to https://openrouter.ai
2. Sign up / Log in
3. Go to Account → API Keys
4. Generate new key
5. Add to backend `.env.local`:
   ```
   OPENROUTER_API_KEY=sk_live_...
   ```

### Step 4: Get Tavily API Key
1. Go to https://tavily.com (or use search verification)
2. Sign up / Log in
3. Go to API section
4. Copy API key
5. Add to backend `.env.local`:
   ```
   TAVILY_API_KEY=...
   ```

### Step 5: Setup Email Service (SendGrid or Mailgun)
#### Option A: SendGrid
1. Go to https://sendgrid.com
2. Sign up and create API key
3. Add to `.env.local`:
   ```
   SENDGRID_API_KEY=SG.xxxxx_yyyyy_...
   ```

#### Option B: Mailgun
1. Go to https://mailgun.com
2. Sign up and create API key
3. Add to `.env.local`:
   ```
   MAILGUN_API_KEY=...
   MAILGUN_DOMAIN=mg.yourdomain.com
   ```

### Step 6: Generate TypeScript Types
```bash
# Install Supabase CLI
npm install -g supabase

# Generate types
supabase gen types typescript --project-id your-project-id > src/types/supabase.ts
```

### Step 7: Test Configuration
```bash
# Start development server
npm run dev

# Test Supabase connection
# Navigate to app and try signup/login

# Test API endpoints
curl http://localhost:3001/api/openrouter \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"model": "llama31-70b", "prompt": "Hello"}'
```

## Migration Guide: Removing Frontend API Keys

### Before (Phase 3-4)
```typescript
// src/services/openrouterService.ts
const API_KEY = process.env.REACT_APP_OPENROUTER_API_KEY; // ❌ Exposed in browser
```

### After (Phase 5+)
```typescript
// Frontend calls backend
const response = await fetch('/api/openrouter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, prompt }),
});
// Backend keeps API key secure via Vercel Functions
```

## Vercel Deployment Checklist

- [ ] Push code to Git (GitHub, GitLab, or Bitbucket)
- [ ] Connect Vercel to your Git repo
- [ ] Add all environment variables in Vercel dashboard
- [ ] Deploy: `vercel deploy --prod`
- [ ] Test: Verify login, API calls, database operations
- [ ] Monitor: Check Vercel logs at https://vercel.com/dashboard

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-react
```

### "Supabase URL not found"
- Verify `.env.local` exists in root directory
- Check REACT_APP_ prefix (frontend) vs no prefix (backend)
- Restart dev server: `npm run dev`

### "API Key Invalid"
- Double-check key format (should start with `sk_live_` for OpenRouter)
- Verify key is for correct API (OpenRouter ≠ Tavily)
- Check API key not expired in service dashboard

### "Slack webhook failed"
- Verify webhook URL format: `https://hooks.slack.com/services/...`
- Test webhook: POST request with JSON body
- Check Slack channel still exists and bot has permissions

### "Email not sending"
- Verify SendGrid/Mailgun API key in `.env`
- Check email domain verified in SendGrid dashboard
- Review email service provider rate limits

## Security Best Practices

✅ **DO:**
- Store API keys in `.env.local` (never commit to Git)
- Add `.env.local` to `.gitignore`
- Use Vercel Secrets for production environment variables
- Rotate API keys regularly
- Use service role key only in backend (never in frontend)

❌ **DON'T:**
- Commit `.env.local` to Git
- Share API keys in screenshots or forums
- Use same key for multiple environments
- Store credentials in database (use encrypted tokens field)
- Log API responses containing sensitive data

## Next Steps

1. ✅ Setup Supabase project
2. ✅ Execute database schema
3. ✅ Obtain API keys (OpenRouter, Tavily, Email)
4. ✅ Update .env.local files
5. ✅ Test login and API endpoints
6. ✅ Deploy to Vercel
7. ✅ Configure CRM integrations (HubSpot/Pipedrive)
8. ✅ Setup Slack webhooks for notifications
9. ✅ Create email campaigns
10. ✅ Monitor costs and performance

## Useful Resources

- Supabase Docs: https://supabase.com/docs
- Vercel Environment Variables: https://vercel.com/docs/concepts/projects/environment-variables
- OpenRouter Pricing: https://openrouter.ai/pricing
- Tavily API Docs: https://tavily.com/api
- SendGrid Integration: https://docs.sendgrid.com
- Mailgun Integration: https://documentation.mailgun.com

---

**Version:** 1.0 (Phase 5 & 7)
**Last Updated:** 2024
**Maintainer:** CCE Development Team
