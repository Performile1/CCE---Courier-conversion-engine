# Phase 5 & 7 Integration & Deployment Guide

## Overview
This guide walks through integrating all Phase 5 & 7 components into your existing CCE application, then deploying to production.

## Phase 5 & 7 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Vite)                    │
├─────────────────────────────────────────────────────────────┤
│ Components:                                                 │
│ ├── LoginPage (Authentication)                             │
│ ├── CRMManager (HubSpot/Pipedrive)                          │
│ ├── EmailCampaignBuilder (Campaign creation & sending)      │
│ ├── CampaignAnalytics (Open/click tracking)                │
│ ├── SlackManager (Notification webhooks)                    │
│ │                                                           │
│ Services:                                                   │
│ ├── AuthContext (Session state management)                 │
│ ├── ProtectedRoute (Route guarding)                         │
│                                                              │
│ Existing Features:                                          │
│ ├── Phase 3: OpenRouter (5 AI models)                       │
│ ├── Phase 4: Tavily (Hallucination detection)               │
│ └── Cost tracking & analytics                              │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│               Backend (Vercel Functions/Node.js)            │
├─────────────────────────────────────────────────────────────┤
│ Secure API Endpoints:                                       │
│ ├── /api/openrouter (OpenRouter calls with protected key)  │
│ ├── /api/tavily (Fact-checking with protected key)         │
│ ├── /api/send-email (Email delivery with tracking)         │
│ └── Session/Auth validation (JWT verification)            │
│                                                              │
│ Environment Variables (Secrets):                            │
│ ├── OPENROUTER_API_KEY                                      │
│ ├── TAVILY_API_KEY                                          │
│ ├── SENDGRID_API_KEY or MAILGUN_API_KEY                     │
│ ├── SUPABASE_SERVICE_ROLE_KEY                              │
│ └── CORS_ORIGIN (frontend URL)                             │
└─────────────────────────────────────────────────────────────┘
                           ↓ SQL/Real-time
┌─────────────────────────────────────────────────────────────┐
│                 Supabase (PostgreSQL)                       │
├─────────────────────────────────────────────────────────────┤
│ Tables:                                                     │
│ ├── users (Auth + profile data)                           │
│ ├── leads (Company prospects)                             │
│ ├── decision_makers (Contacts per lead)                   │
│ ├── campaigns (Email campaigns)                           │
│ ├── campaign_recipients (Lead tracking)                   │
│ ├── crm_integrations (API tokens)                         │
│ ├── slack_integrations (Webhook URLs)                     │
│ └── cost_tracking (Usage analytics)                       │
│                                                              │
│ Security:                                                   │
│ ├── Row-Level Security (Users see only own data)          │
│ ├── Encrypted fields for API tokens                       │
│ └── Audit trails on modifications                        │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Update package.json

The dependencies have already been updated with:
```json
{
  "@supabase/auth-helpers-react": "^0.4.0",
  "@supabase/supabase-js": "^2.38.0",
  "react-router-dom": "^6.14.0"
}
```

Verify they exist:
```bash
npm list @supabase/supabase-js react-router-dom
```

## Step 2: Update index.tsx (Entry Point)

Change from:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

Change to:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import RouterApp from './RouterApp.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterApp />
  </React.StrictMode>,
)
```

This enables:
- Authentication flows
- Route protection
- Session management

## Step 3: Add Phase 7 Components to Main App

In your `App.tsx`, add imports for Phase 7 components:

```tsx
import { CRMManager } from './components/CRMManager';
import { EmailCampaignBuilder } from './components/EmailCampaignBuilder';
import { CampaignAnalytics } from './components/CampaignAnalytics';
import { SlackManager } from './components/SlackManager';
import { useAuth } from './context/AuthContext';
```

Add them to your UI (in a Premium Features section):
```tsx
const { user } = useAuth();

return (
  <>
    {/* Existing components... */}
    
    {/* New Phase 7 Features */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
      <CRMManager 
        userId={user?.id!} 
        leads={leads}
        onSyncComplete={() => console.log('Synced to CRM')}
      />
      <SlackManager userId={user?.id!} />
    </div>
    
    <EmailCampaignBuilder 
      userId={user?.id!}
      leads={leads}
      onCampaignSent={() => console.log('Campaign sent')}
    />
  </>
);
```

## Step 4: Environment Configuration

Create `.env.local` in your project root:

```env
# ===== FRONTEND (Supabase) =====
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
REACT_APP_API_BASE_URL=http://localhost:3001

# Remove these (moved to backend):
# REACT_APP_OPENROUTER_API_KEY=...
# TAVILY_API_KEY=...
```

Create `.env.local` in `/api` directory:

```env
# ===== BACKEND (Supabase Secrets) =====
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===== API Keys (NOW PROTECTED) =====
OPENROUTER_API_KEY=sk_live_...
TAVILY_API_KEY=...
SENDGRID_API_KEY=SG.xxxxx...
# or MAILGUN_API_KEY=...

# ===== CORS =====
CORS_ORIGIN=http://localhost:5173
```

## Step 5: Database Setup

1. **Create Supabase Project:**
   - Go to https://supabase.com
   - Create new project
   - Copy URL and ANON_KEY

2. **Execute Database Schema:**
   - In Supabase SQL Editor
   - Copy full contents of `db/supabase-schema.sql`
   - Execute
   - Verify 9 tables created + RLS policies

3. **Enable Real-time:**
   - Go to Supabase → Tables
   - For each table, click "Enable Real-time"
   - This allows instant updates across clients

## Step 6: Backend Functions Setup

Verify Vercel Functions exist:
- `api/openrouter.ts` - AI calls (Phase 5.1)
- `api/tavily.ts` - Verification (Phase 5.1)
- `api/send-email.ts` - Email delivery (CREATE BELOW)

Create `api/send-email.ts`:

```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend'; // or SendGrid, Mailgun

const resend = new Resend(process.env.SENDGRID_API_KEY);

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html, campaignId, recipientId } = req.body;

  try {
    // Add tracking pixel
    const trackingPixel = `<img src="${process.env.REACT_APP_API_BASE_URL}/api/track-open?campaignId=${campaignId}&recipientId=${recipientId}" width="1" height="1" alt="" />`;
    const htmlWithPixel = html + trackingPixel;

    const response = await resend.emails.send({
      from: 'noreply@yourdomain.com',
      to,
      subject,
      html: htmlWithPixel,
    });

    return res.status(200).json({ success: true, messageId: response.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
```

## Step 7: Test Integration

```bash
# Start dev server
npm run dev

# In another terminal, test API
curl http://localhost:3001/api/openrouter \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"model": "llama31-70b", "prompt": "Hello"}'

# Expected response:
# { "text": "Hello! How can I assist you?", "estimatedCost": 0.00012 }
```

## Step 8: Test Authentication

1. Navigate to http://localhost:5173/login
2. Click "Sign Up"
3. Enter email + password (min 6 chars)
4. Verify email sent
5. Click verification link
6. Should redirect to main app
7. Verify userData in browser console

## Step 9: Production Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables
# Go to https://vercel.com/dashboard
# Settings → Environment Variables
# Add all Backend section variables
```

### Configure CORS

In `.env.production`:
```env
CORS_ORIGIN=https://your-app.vercel.app
```

In `api/openrouter.ts`:
```typescript
res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
```

### Configure Supabase

1. Update RLS policies for production URLs
2. Enable 2FA for admin account
3. Set backup frequency
4. Enable audit logs

## Step 10: First Deployment Checklist

- [ ] Supabase project created + schema executed
- [ ] Environment variables configured (.env.local)
- [ ] Frontend starts without errors: `npm run dev`
- [ ] Backend functions accessible: `http://localhost:3001/api/openrouter`
- [ ] Login/signup flow works end-to-end
- [ ] CRM manager can connect to HubSpot/Pipedrive
- [ ] Email campaigns can be created and sent
- [ ] Slack webhooks receive test notifications
- [ ] OpenRouter API calls work with new cost tracking
- [ ] Database queries use proper table access
- [ ] Authentication persists across page refresh
- [ ] Deployment to Vercel successful
- [ ] Production app accessible at custom domain

## Troubleshooting

### "Cannot POST /api/openrouter"
- Verify `vite.config.ts` has proxy configured for `/api`
- Check Vercel Functions are deployed
- Verify environment variables are set

### "Supabase connection failed"
- Check `REACT_APP_SUPABASE_URL` format
- Verify ANON_KEY not empty
- Check network request headers

### "JWT Token invalid"
- Verify `SUPABASE_SERVICE_ROLE_KEY` in backend
- Check token not expired
- Verify claim fields in RLS policies

### "Email not sending"
- Test SendGrid API key in dashboard
- Check sender email domain verified
- Review email content for spam triggers
- Check rate limits not exceeded

### "CRM sync failed"
- Verify API token format for CRM
- Check CRM API key has correct scopes
- Test API connection in CRM dashboard
- Verify lead data mapping matches CRM schema

## Files Created (Phase 5 & 7)

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `api/openrouter.ts` | Secure AI calls | 286 | ✅ |
| `api/tavily.ts` | Fact-checking | 180+ | ✅ |
| `services/supabaseClient.ts` | Auth + DB client | 88 | ✅ |
| `db/supabase-schema.sql` | Database schema | 350+ | ✅ |
| `components/LoginPage.tsx` | Auth UI | 248 | ✅ |
| `components/ProtectedRoute.tsx` | Route guard | 30 | ✅ |
| `context/AuthContext.tsx` | Auth state | 60 | ✅ |
| `components/CRMManager.tsx` | CRM integration | 150+ | ✅ |
| `components/EmailCampaignBuilder.tsx` | Email campaigns | 250+ | ✅ |
| `components/CampaignAnalytics.tsx` | Analytics dashboard | 200+ | ✅ |
| `components/SlackManager.tsx` | Slack webhooks | 220+ | ✅ |
| `types/supabase.ts` | TypeScript definitions | 300+ | ✅ |
| `RouterApp.tsx` | Routing setup | 50 | ✅ |
| `ENV_SETUP_GUIDE.md` | Environment setup | 200+ | ✅ |

**Total New Code:** 2,500+ lines

## Next Steps After Deployment

1. **Monitor Performance:**
   - Vercel Analytics
   - Supabase Query Performance
   - Cost tracking per model/user

2. **Enable Advanced Features:**
   - Custom CRM integrations
   - Salesforce adapter (scaffolding ready)
   - SMS notifications
   - Webhook custom events

3. **Scale Infrastructure:**
   - Enable Supabase connection pooling
   - Add Redis for caching
   - Implement rate limiting per user tier

4. **Security Hardening:**
   - Enable 2FA for all users
   - Rotate API keys monthly
   - Enable SAML/SSO
   - Audit log retention

## Support & Resources

- **Supabase Docs:** https://supabase.com/docs
- **Vercel Functions:** https://vercel.com/docs/functions/serverless-functions
- **OpenRouter API:** https://openrouter.ai/docs
- **Tavily Search:** https://tavily.com/api
- **SendGrid Integration:** https://docs.sendgrid.com
- **Community Discord:** (Your support channel)

---

**Version:** 1.0 (Phase 5 & 7 Complete)
**Last Updated:** 2024
**Maintainer:** CCE Development Team
