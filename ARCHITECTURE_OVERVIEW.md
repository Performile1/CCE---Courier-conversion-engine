# CCE Architecture & Components Overview

## 🏗️ Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       USER BROWSER (Client)                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Frontend Application                  │  │
│  │                   (React + Vite + Tailwind)             │  │
│  │                                                         │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ PUBLIC ROUTES                                 │   │  │
│  │  ├── /login (LoginPage Component)                │   │  │
│  │  └── /signup (LoginPage Component - signup mode)│   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                         │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ PROTECTED ROUTES (Behind ProtectedRoute)      │   │  │
│  │  ├── / (Main App - existing functionality)       │   │  │
│  │  ├── CRMManager (Lead sync to HubSpot/Pipedrive) │   │  │
│  │  ├── EmailCampaignBuilder (Create & send)        │   │  │
│  │  ├── CampaignAnalytics (View results)            │   │  │
│  │  └── SlackManager (Configure webhooks)           │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                         │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ STATE MANAGEMENT & CONTEXT                    │   │  │
│  │  ├── AuthContext (Session, user, login status)  │   │  │
│  │  ├── useAuth() hook (Access auth anywhere)      │   │  │
│  │  └── localStorage (Session persistence)        │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                         │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ SERVICES (API Calls)                          │   │  │
│  │  ├── supabaseClient (Auth provider)             │   │  │
│  │  ├── crmIntegration (HubSpot/Pipedrive sync)    │   │  │
│  │  ├── emailCampaign (Campaign management)        │   │  │
│  │  └── slackIntegration (Send notifications)      │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                          ↓ HTTPS ↓                             │
│               (JWT token attached to headers)                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│              VERCEL SERVERLESS FUNCTIONS (Backend)                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ API ROUTES (Secure, Keys Protected)                       │  │
│  │                                                             │  │
│  │ POST /api/openrouter                                       │  │
│  │ ├─ Accepts: model, prompt                                 │  │
│  │ ├─ Uses: OPENROUTER_API_KEY (env var)                    │  │
│  │ ├─ Returns: text, model, usage, cost                     │  │
│  │ ├─ Logs: cost_tracking table                             │  │
│  │ └─ Models: Llama3.1, GPT-4, Gemini, GPT-3.5, Mistral     │  │
│  │                                                             │  │
│  │ POST /api/tavily                                           │  │
│  │ ├─ Accepts: query type (company/financials/etc)          │  │
│  │ ├─ Uses: TAVILY_API_KEY (env var)                        │  │
│  │ ├─ Returns: verified, sources, confidence               │  │
│  │ └─ 4-layer verification system                            │  │
│  │                                                             │  │
│  │ POST /api/send-email                                      │  │
│  │ ├─ Accepts: to, subject, html, campaignId               │  │
│  │ ├─ Uses: SENDGRID_API_KEY (env var)                      │  │
│  │ ├─ Adds: Tracking pixel for opens                        │  │
│  │ ├─ Rewrites: Links for click tracking                    │  │
│  │ └─ Returns: messageId                                     │  │
│  │                                                             │  │
│  │ JWT Validation Middleware                                 │  │
│  │ ├─ Verifies JWT token in Authorization header           │  │
│  │ ├─ Decodes user_id from token                           │  │
│  │ └─ All queries filtered by user_id (RLS)               │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                          ↓ HTTPS ↓                                 │
│                (Protected by Vercel Edge Network)                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Database Layer)                        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ PostgreSQL Database                                         │  │
│  │ (9 Tables, RLS Policies, Real-time Subscriptions)        │  │
│  │                                                             │  │
│  │ 1. users                                                   │  │
│  │    ├─ id, email, full_name                               │  │
│  │    ├─ subscription_tier (free/pro/enterprise)            │  │
│  │    ├─ credits_balance                                     │  │
│  │    └─ monthly_openrouter_cost                            │  │
│  │                                                             │  │
│  │ 2. leads                                                   │  │
│  │    ├─ id, user_id, company_name                          │  │
│  │    ├─ industry, revenue, employees                        │  │
│  │    ├─ analysis_model, hallucination_score               │  │
│  │    └─ RLS: users see only own leads                      │  │
│  │                                                             │  │
│  │ 3. decision_makers                                        │  │
│  │    ├─ id, lead_id, first_name, last_name                │  │
│  │    ├─ title, email, linkedin_url                         │  │
│  │    └─ verified, verification_method                      │  │
│  │                                                             │  │
│  │ 4. campaigns                                              │  │
│  │    ├─ id, user_id, name, subject, body                  │  │
│  │    ├─ status (draft/scheduled/sent)                     │  │
│  │    ├─ total_recipients, open_rate, click_rate           │  │
│  │    └─ RLS: users see only own campaigns                 │  │
│  │                                                             │  │
│  │ 5. campaign_recipients                                   │  │
│  │    ├─ id, campaign_id, lead_id, email                  │  │
│  │    ├─ status (pending/sent/opened/clicked/bounced)     │  │
│  │    ├─ opened_at, clicked_at (timestamp)                │  │
│  │    └─ Tracks every open + click event                  │  │
│  │                                                             │  │
│  │ 6. crm_integrations                                      │  │
│  │    ├─ id, user_id, crm_type                             │  │
│  │    ├─ api_token (ENCRYPTED)                             │  │
│  │    ├─ last_sync, synced_count                           │  │
│  │    └─ RLS: users see only own CRM tokens               │  │
│  │                                                             │  │
│  │ 7. slack_integrations                                    │  │
│  │    ├─ id, user_id, webhook_url (ENCRYPTED)             │  │
│  │    ├─ notifications (JSON: which events to notify)      │  │
│  │    ├─ enabled (boolean)                                 │  │
│  │    └─ RLS: users see only own webhooks                 │  │
│  │                                                             │  │
│  │ 8. analysis_history                                      │  │
│  │    ├─ id, user_id, lead_id, analysis_type             │  │
│  │    ├─ model_used, prompt_tokens, completion_tokens    │  │
│  │    ├─ total_cost_usd, raw_analysis (JSON)             │  │
│  │    └─ RLS: users see only own analyses                │  │
│  │                                                             │  │
│  │ 9. cost_tracking                                         │  │
│  │    ├─ id, user_id, service, model_or_action           │  │
│  │    ├─ input_tokens, output_tokens, cost_usd           │  │
│  │    ├─ created_at                                        │  │
│  │    └─ RLS: users see only own costs                   │  │
│  │                                                             │  │
│  ├─────────────────────────────────────────────────────────────│  │
│  │ Authentication Provider                                    │  │
│  │ ├─ Email/password signup & signin                         │  │
│  │ ├─ JWT token generation                                   │  │
│  │ ├─ Session management & refresh                           │  │
│  │ └─ Row-Level Security (RLS) policies                      │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
                    ┌───────────┴───────────┐
                    ↓                       ↓
        ┌─────────────────────┐  ┌─────────────────────┐
        │  THIRD-PARTY APIS   │  │  THIRD-PARTY APIS   │
        │                     │  │                     │
        │  OpenRouter.ai      │  │  SendGrid/Mailgun   │
        │  (5 AI Models)      │  │  (Email Delivery)   │
        │                     │  │                     │
        │  Tavily Search      │  │  Slack Webhooks     │
        │  (Fact-Checking)    │  │  (Notifications)    │
        │                     │  │                     │
        │  HubSpot CRM        │  │  Pipedrive CRM      │
        │  (Contact Sync)     │  │  (Contact Sync)     │
        │                     │  │                     │
        └─────────────────────┘  └─────────────────────┘
```

---

## 🔄 Data Flow: Lead Analysis to Email Campaign

### 1. User Signs In
```
Browser: User enters email + password
  ↓
Supabase Auth: Validates credentials
  ↓
JWT Token Generated: Stored in session
  ↓
AuthContext Updated: Session state reactive
  ↓
Browser: Redirected to main app (ProtectedRoute guard passes)
```

### 2. User Inputs Company
```
Browser: User enters company name + website
  ↓
Frontend: Sends to existing Phase 3 analysis system
  ↓
Backend (/api/openrouter): Secure API call with token attached
  ↓
Vercel: OPENROUTER_API_KEY from environment (never exposed)
  ↓
OpenRouter: Returns analysis + costs
  ↓
Backend: Logs cost to cost_tracking table
  ↓
Frontend: Displays result + hallucination score verification
```

### 3. User Views CRM Manager
```
Browser: Clicks "CRM Manager"
  ↓
Frontend: CRMManager component loads
  ↓
Supabase: Queries crm_integrations table (filtered by user_id via RLS)
  ↓
Supabase: Decrypts api_token if exists
  ↓
Frontend: Shows "Connect to HubSpot" button
```

### 4. User Creates Email Campaign
```
Browser: User selects email template
  ↓
Frontend: EmailCampaignBuilder component loads
  ↓
User: Composes subject + body, selects recipients
  ↓
Frontend: createCampaign() called
  ↓
Supabase: Creates row in campaigns table (user_id auto-filled)
  ↓
Supabase: Creates rows in campaign_recipients (one per lead)
  ↓
Frontend: Shows campaign with "Send" button
```

### 5. User Sends Campaign
```
Browser: User clicks "Send Campaign"
  ↓
Frontend: sendCampaign() called
  ↓
Backend (/api/send-email): For each recipient:
  ├─ Tracking pixel added: https://api.example.com/track-open?id=xyz
  ├─ Links rewritten: https://api.example.com/track-click?url=encoded
  └─ Calls SendGrid API
  ↓
SendGrid: Delivers email to recipient
  ↓
Recipient Opens Email
  └─ Pixel loads: /track-open endpoint called
  └─ Supabase: Updates campaign_recipients.opened_at
  └─ Analytics recalculated
  ↓
Recipient Clicks Link
  └─ Click tracking endpoint called
  └─ Supabase: Updates campaign_recipients.clicked_at
  └─ Analytics updated
  ↓
Frontend: CampaignAnalytics shows real-time metrics
```

### 6. User Integrates Slack
```
Browser: User clicks "Add Slack Webhook"
  ↓
Frontend: SlackManager component opens form
  ↓
User: Pastes webhook URL + selects notifications
  ↓
Frontend: saveCRMIntegration() called
  ↓
Supabase: Stores webhook_url (ENCRYPTED)
  ↓
Frontend: sendSlackNotification() tests webhook
  ↓
Slack: Test message appears in channel
  ↓
Now: Every campaign finish → Slack notification
```

### 7. User Syncs to CRM
```
Browser: User clicks "Sync 25 Leads to HubSpot"
  ↓
Frontend: syncLeadsToCRM() called with leads array
  ↓
Backend: HubSpotIntegration class processes batch:
  ├─ For each lead:
  │  ├─ Creates/updates Company in HubSpot
  │  ├─ Creates/updates Contact(s)
  │  └─ Creates Deal associated with company
  └─ Returns: { leadsCreated: 24, leadsUpdated: 1, error: null }
  ↓
Supabase: Updates crm_integrations.last_sync + synced_count
  ↓
Slack: "🔗 CRM Synced: 24 companies, 25 contacts" (if enabled)
  ↓
Frontend: Shows success + sync count
```

---

## 🎯 Component Interaction Map

```
App.tsx (Main Application)
├── Header (Existing - unchanged)
├── InputForm (Existing - unchanged)
│
├── Phase 7 NEW COMPONENTS:
│   ├── CRMManager
│   │   ├── Uses: crmIntegration service
│   │   ├── Calls: Supabase crm_integrations table
│   │   └── Triggers: Slack "CRM Synced" notification
│   │
│   ├── EmailCampaignBuilder
│   │   ├── Uses: emailCampaign service
│   │   ├── Calls: Supabase campaigns + campaign_recipients tables
│   │   └── Triggers: Slack "Campaign Launched" notification
│   │
│   ├── CampaignAnalytics
│   │   ├── Uses: emailCampaign service (getCampaignAnalytics)
│   │   ├── Reads: Supabase campaign_recipients table
│   │   └── Displays: Open rate (18%), Click rate (6%), etc.
│   │
│   └── SlackManager
│       ├── Uses: slackIntegration service
│       ├── Calls: Supabase slack_integrations table
│       └── Tests: Webhook connectivity
│
├── LoginPage (Phase 5 NEW)
│   ├── Uses: supabaseClient (signUp, signIn)
│   ├── Creates: User record in Supabase
│   ├── Generates: JWT token
│   └── Stores: Session in localStorage
│
├── ProtectedRoute (Phase 5 NEW)
│   ├── Checks: useAuth().isAuthenticated
│   ├── Guards: All routes except /login
│   └── Redirects: To /login if not authenticated
│
├── AuthContext (Phase 5 NEW)
│   ├── Provides: user, session, logout function
│   ├── Listens: onAuthStateChange from Supabase
│   └── Persists: Session across browser refresh
│
└── Existing Components (Unchanged)
    ├── LeadCard (Phase 1-4)
    ├── ResultsTable (Phase 1-4)
    ├── ExclusionManager (Existing)
    ├── InclusionManager (Existing)
    └── ... (all other managers)
```

---

## 🔑 Key Technologies

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Router v6** - Client routing
- **Lucide Icons** - UI icons
- **@supabase/auth-helpers-react** - Auth UI
- **@supabase/supabase-js** - Database client

### Backend
- **Vercel Functions** - Serverless compute
- **Node.js** - Runtime
- **TypeScript** - Type safety
- **CORS** - Cross-origin requests
- **Environment variables** - Secret management

### Database
- **Supabase** - PostgreSQL + Auth + Real-time
- **PostgreSQL** - Relational database
- **Row-Level Security** - Multi-user isolation
- **Encryption** - Sensitive field protection
- **Indexes** - Query optimization
- **Audit triggers** - Change tracking

### APIs & Integrations
- **OpenRouter** - AI model access
- **Tavily** - Fact-checking
- **HubSpot** - CRM sync
- **Pipedrive** - CRM sync
- **SendGrid** - Email delivery
- **Slack** - Webhooks
- **Supabase Auth** - Authentication

---

## 📊 File Organization

```
CCE Project Root
│
├── components/
│   ├── App.tsx (Main page)
│   │
│   ├── Phase 5 & 7 NEW:
│   ├── LoginPage.tsx (Sign up/sign in UI)
│   ├── ProtectedRoute.tsx (Route guard)
│   ├── CRMManager.tsx (CRM integration UI)
│   ├── EmailCampaignBuilder.tsx (Campaign creation)
│   ├── CampaignAnalytics.tsx (Analytics dashboard)
│   ├── SlackManager.tsx (Slack webhook setup)
│   │
│   └── Existing: Header, InputForm, LeadCard, etc.
│
├── services/
│   ├── Phase 3-4 Existing:
│   ├── geminiService.ts (Google Gemini)
│   ├── openrouterService.ts (OpenRouter)
│   ├── tavilyService.ts (Tavily)
│   │
│   ├── Phase 5 & 7 NEW:
│   ├── supabaseClient.ts (Auth provider)
│   ├── crmIntegration.ts (HubSpot/Pipedrive)
│   ├── emailCampaign.ts (Campaign management)
│   └── slackIntegration.ts (Slack webhooks)
│
├── context/
│   └── AuthContext.tsx (Phase 5 NEW - Session state)
│
├── api/
│   ├── openrouter.ts (Phase 5.1 - Secure AI calls)
│   ├── tavily.ts (Phase 5.1 - Secure verification)
│   └── send-email.ts (Phase 7 - Email delivery)
│
├── db/
│   ├── schema.ts (Existing - Phase 1-4)
│   └── supabase-schema.sql (Phase 5 NEW - Database schema)
│
├── types/
│   ├── types.ts (Existing)
│   └── supabase.ts (Phase 5 NEW - Type definitions)
│
├── utils/
│   └── Existing utilities
│
├── RouterApp.tsx (Phase 5 NEW - Routing wrapper)
├── App.tsx (Entry point)
├── index.tsx (React root)
│
├── Configuration:
├── package.json (Dependencies)
├── tsconfig.json (TypeScript)
├── vite.config.ts (Vite)
│
└── Documentation:
    ├── README.md (UPDATED - Full overview)
    ├── ENV_SETUP_GUIDE.md (Phase 5 & 7 NEW)
    ├── PHASE_5_7_INTEGRATION_GUIDE.md (Phase 5 & 7 NEW)
    ├── PHASE_5_7_COMPLETION_REPORT.md (Phase 5 & 7 NEW)
    ├── PHASE_5_7_SUMMARY.md (Phase 5 & 7 NEW)
    ├── ARCHITECTURE.md (Existing)
    ├── QUICK_REFERENCE.md (Existing)
    └── IMPLEMENTATION_GUIDE.md (Existing)
```

---

## 🚀 Deployment Architecture

```
Development Local
├── npm run dev
├── http://localhost:5173
├── Backend: http://localhost:3001
└── Database: Supabase free tier cloud

Production (Vercel)
├── Frontend: https://your-app.vercel.app
├── Backend Functions: https://your-app.vercel.app/api/*
├── Database: Supabase production tier
└── Auto-scaling: Vercel handles scale

Data Flow in Production:
Browser → Vercel CDN (Static assets)
Browser → Vercel Functions (Dynamic requests)
Vercel → Supabase (Database queries)
Vercel → External APIs (OpenRouter, Tavily, HubSpot, Slack)
```

---

## ✅ Complete Feature Matrix

| Feature | Phase | Status | Component | Backend |
|---------|-------|--------|-----------|---------|
| AI Analysis | 3 | ✅ | Form → OpenRouter | `/api/openrouter` |
| Hallucination Detection | 4 | ✅ | Indicator → Tavily | `/api/tavily` |
| User Account | 5 | ✅ | LoginPage | Supabase Auth |
| Multi-user Support | 5 | ✅ | AuthContext | RLS Policies |
| Session Management | 5 | ✅ | Protected Routes | JWT Tokens |
| CRM Integration | 7 | ✅ | CRMManager | `crmIntegration.ts` |
| Email Campaigns | 7 | ✅ | EmailCampaignBuilder | `emailCampaign.ts` |
| Campaign Analytics | 7 | ✅ | CampaignAnalytics | cost_tracking table |
| Slack Notifications | 7 | ✅ | SlackManager | `slackIntegration.ts` |
| Cost Tracking | 3-7 | ✅ | Dashboard | cost_tracking table |

---

## 🎯 Production Checklist

- [x] All components built and tested
- [x] All APIs secured (keys in backend)
- [x] All database tables optimized
- [x] All integrations implemented
- [x] All documentation complete
- [x] TypeScript strict mode enabled
- [x] Error handling comprehensive
- [x] CORS configured
- [x] Tests pass locally
- [ ] Deploy to Vercel (user's next step)
- [ ] Configure secrets in Vercel
- [ ] Execute database schema in Supabase
- [ ] Test all features in production
- [ ] Monitor performance and costs

---

**Architecture Version:** 2.0 (Backend + Premium)
**Status:** Production Ready
**Last Updated:** 2024

