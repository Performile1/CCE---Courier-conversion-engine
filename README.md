# CCE: Carrier Conversion Engine

**Production-ready AI-powered lead prospecting and CRM integration platform**

## What is CCE?

CCE is an intelligent lead analysis and outreach automation system that:

- **Analyzes** company prospects with AI (OpenRouter - 5 models)
- **Verifies** information using Tavily fact-checking (hallucinationScore: 0-100%)
- **Manages** leads in PostgreSQL with multi-user support
- **Syncs** leads to HubSpot, Pipedrive, or Salesforce
- **Campaigns** email outreach with tracking (open/click rates)
- **Notifies** team via Slack webhooks
- **Tracks** costs per model, user, and campaign

## Features

### Phases 1-4: AI Analysis & Verification ✅
- 5 AI models via OpenRouter (Llama 3.1, GPT-4, Gemini, GPT-3.5, Mistral)
- Dynamic pricing (up to 30% cheaper than direct Gemini)
- Hallucination detection (Tavily 4-layer verification)
- Real-time cost tracking
- Model performance comparison

### Phase 5: Backend Security & Multi-user ✅
- Vercel Functions for API key protection
- Supabase PostgreSQL database (9 tables)
- Email/password authentication with Supabase Auth
- Row-Level Security (RLS) for data isolation
- Session management with JWT tokens
- Complete async encryption for sensitive data

### Phase 7: Premium Features ✅
- **CRM Integration:** HubSpot, Pipedrive, Salesforce
- **Email Campaigns:** Templates, recipient selection, send scheduling
- **Campaign Analytics:** Open rate, click rate, engagement breakdown
- **Slack Notifications:** Real-time alerts for leads, campaigns, syncs

## Quick Start

### Prerequisites
- Node.js 16+
- Supabase account (free tier OK)
- OpenRouter account + API key
- Tavily account + API key (optional)
- SendGrid/Mailgun account for email (optional)

### Local Development (5 minutes)

1. **Clone & Install:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys (see ENV_SETUP_GUIDE.md)
   ```

3. **Create Supabase Database:**
   - Create free project at https://supabase.com
   - Copy project URL + ANON_KEY to .env.local
   - Run SQL schema: `db/supabase-schema.sql` in Supabase SQL editor

4. **Start Development Server:**
   ```bash
   npm run dev
   # Open http://localhost:5173
   # Sign up with test email
   # Start analyzing leads
   ```

### Production Deployment (10 minutes)

See [PHASE_5_7_INTEGRATION_GUIDE.md](PHASE_5_7_INTEGRATION_GUIDE.md) for complete step-by-step guide.

**Quick deployment:**
```bash
vercel deploy --prod
# Add environment secrets in Vercel dashboard
```

## Architecture

```
Frontend (React/Vite)
├── Components: LoginPage, CRMManager, EmailCampaignBuilder, CampaignAnalytics, SlackManager
├── Services: supabaseClient, crmIntegration, emailCampaign, slackIntegration
└── Context: AuthContext for session management

Backend (Vercel Functions)
├── api/openrouter.ts - Secure AI calls (keys protected)
├── api/tavily.ts - Fact-checking verification
└── api/send-email.ts - Email delivery with tracking

Database (Supabase PostgreSQL)
├── users - Authentication + profile
├── leads - Company prospects
├── decision_makers - Contacts per lead
├── campaigns - Email campaigns
├── campaign_recipients - Email tracking
├── crm_integrations - CRM credentials (encrypted)
├── slack_integrations - Slack webhooks (encrypted)
└── cost_tracking - Usage analytics
```

## Key Files

### Setup & Documentation
- **[ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md)** - Environment variables
- **[PHASE_5_7_INTEGRATION_GUIDE.md](PHASE_5_7_INTEGRATION_GUIDE.md)** - Step-by-step setup
- **[PHASE_5_7_COMPLETION_REPORT.md](PHASE_5_7_COMPLETION_REPORT.md)** - Full feature details

### Backend
- **[api/openrouter.ts](api/openrouter.ts)** - Secure AI API (286 lines)
- **[api/tavily.ts](api/tavily.ts)** - Fact-checking API (180+ lines)
- **[db/supabase-schema.sql](db/supabase-schema.sql)** - Database schema (350+ lines)

### Services
- **[services/supabaseClient.ts](services/supabaseClient.ts)** - Auth provider
- **[services/crmIntegration.ts](services/crmIntegration.ts)** - HubSpot/Pipedrive/Salesforce
- **[services/emailCampaign.ts](services/emailCampaign.ts)** - Campaign management
- **[services/slackIntegration.ts](services/slackIntegration.ts)** - Slack notifications

### React Components
- **[components/LoginPage.tsx](components/LoginPage.tsx)** - Authentication UI (248 lines)
- **[components/CRMManager.tsx](components/CRMManager.tsx)** - CRM setup (150+ lines)
- **[components/EmailCampaignBuilder.tsx](components/EmailCampaignBuilder.tsx)** - Campaign creation (250+ lines)
- **[components/CampaignAnalytics.tsx](components/CampaignAnalytics.tsx)** - Analytics dashboard (200+ lines)
- **[components/SlackManager.tsx](components/SlackManager.tsx)** - Slack setup (220+ lines)

## Cost Structure

**Per 1,000 Leads:**
- OpenRouter (Llama 3.1): $0.30
- Tavily verification: $0.05
- Email send (SendGrid): $0.10
- Total: **~$0.50 per lead** (including overhead)

**Monthly Estimate (1,000 leads/day):**
- API costs: ~$15
- Supabase: ~$10 (free tier up to 1M rows)
- Vercel: ~$20 (hobby plan $5, scaling ~$15)
- **Total: ~$45/month**

## Security

✅ **API Keys Protected**
- Stored in Vercel Secrets (not in code)
- Only backend can call third-party APIs
- Frontend communicates via HTTP → backend → external API

✅ **Data Isolation**
- Row-Level Security (RLS) policies
- Users can only see own data
- Encrypted API tokens in database

✅ **Authentication**
- Supabase Auth with email verification
- JWT tokens on protected routes
- Session persists across refresh
- Auto-logout on token expiration

✅ **Encryption**
- Sensitive fields encrypted in Supabase
- HTTPS enforced on all connections
- Password stored securely via Supabase Auth

## API Endpoints

### Public (No Auth Required)
- `POST /api/auth/signup` - Create account
- `POST /api/auth/signin` - Login

### Protected (JWT Required)
- `POST /api/openrouter` - AI analysis call
- `POST /api/tavily` - Fact-checking call
- `POST /api/send-email` - Send campaign email
- All database queries via Supabase SDK

## Environment Variables

**Frontend (.env.local):**
```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
REACT_APP_API_BASE_URL=http://localhost:3001
```

**Backend (Vercel Secrets):**
```
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENROUTER_API_KEY=sk_live_...
TAVILY_API_KEY=...
SENDGRID_API_KEY=SG...
```

See [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md) for complete setup.

## Troubleshooting

**"Supabase connection failed"**
- Check REACT_APP_SUPABASE_URL format
- Verify ANON_KEY not empty
- See ENV_SETUP_GUIDE.md

**"Cannot POST /api/openrouter"**
- Ensure backend functions deployed
- Check Vercel environment variables set
- Verify CORS origin configured

**"Email not sending"**
- Test SendGrid API key
- Check sender domain verified in SendGrid
- Review email service provider logs

See [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md) troubleshooting section.

## Documentation

Complete documentation available:

1. **[QUICK_START_PHASE_3_4.md](QUICK_START_PHASE_3_4.md)** - AI analysis features
2. **[ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md)** - Environment configuration
3. **[PHASE_5_7_INTEGRATION_GUIDE.md](PHASE_5_7_INTEGRATION_GUIDE.md)** - Backend setup
4. **[PHASE_5_7_COMPLETION_REPORT.md](PHASE_5_7_COMPLETION_REPORT.md)** - Feature details
5. **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - Code walkthrough
6. **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design

## Support

- **Issues?** Check troubleshooting in ENV_SETUP_GUIDE.md
- **API Docs:** 
  - Supabase: https://supabase.com/docs
  - OpenRouter: https://openrouter.ai/docs
  - Tavily: https://tavily.com/api
  - Vercel: https://vercel.com/docs
- **Community:** (Your support channel)

## Roadmap

- ✅ Phase 1-4: AI analysis & verification
- ✅ Phase 5: Backend & authentication
- ✅ Phase 7: Premium features (CRM, email, Slack)
- 🔄 Phase 6: Advanced analytics dashboard
- 🔄 Phase 8: Mobile app
- 🔄 Phase 9: Custom integrations

## License

Proprietary - CCE Development Team

## Status

**🚀 PRODUCTION READY**

All phases optimized and tested. Deploy with confidence.

---

**Latest Update:** Phase 5 & 7 Complete - 3,000+ lines of new code
**Version:** 2.0 (Multi-user, Backend-secure, Premium features)
**Maintainer:** CCE Development Team
