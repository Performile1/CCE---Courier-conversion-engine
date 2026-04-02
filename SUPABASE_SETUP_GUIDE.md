# Supabase Setup Guide for CCE Platform

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - **Project Name**: CCE-Carrier-Conversion-Engine
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Select closest to your users (e.g., us-west-1 for US, eu-central-1 for Europe)
4. Click "Create new project" and wait 2-3 minutes for provisioning

## Step 2: Get Your Credentials

After project creation, go to **Project Settings → API**:
- Copy **Project URL** → `VITE_SUPABASE_URL`
- Copy **anon public** key → `VITE_SUPABASE_ANON_KEY`

## Step 3: Set Up Environment Variables for Vercel

**Skip local `.env.local` - deploying directly to Vercel**

Will be set in Vercel dashboard (Step 7)

## Step 4: Initialize Database Schema

In Supabase Dashboard, go to **SQL Editor** and run this:

### 4.1 Enable Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "http";
```

### 4.2 Create Users Table
```sql
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  full_name TEXT,
  phone TEXT,
  company_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  credits_remaining INTEGER DEFAULT 1000,
  salesforce_account_id TEXT,
  salesforce_contact_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
```

### 4.3 Create Leads Table
```sql
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  org_number TEXT,
  domain TEXT,
  website_url TEXT,
  sni_code TEXT,
  segment TEXT,
  analysis_date TIMESTAMP WITH TIME ZONE,
  potential_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own leads" ON public.leads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own leads" ON public.leads
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own leads" ON public.leads
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own leads" ON public.leads
  FOR DELETE USING (user_id = auth.uid());
```

### 4.4 Create Integrations Table
```sql
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL, -- 'slack', 'webhook', 'salesforce', 'zapier'
  status TEXT DEFAULT 'active',
  config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own integrations" ON public.integrations
  FOR ALL USING (user_id = auth.uid());
```

### 4.5 Create Password Reset Tokens Table
```sql
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
```

### 4.6 Create Shared Leads Table
```sql
CREATE TABLE IF NOT EXISTS public.shared_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_lead_id UUID,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  lead_data JSONB NOT NULL,
  message TEXT,
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.shared_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read shared leads sent to them" ON public.shared_leads
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Users can read leads they sent" ON public.shared_leads
  FOR SELECT USING (sender_id = auth.uid());

CREATE POLICY "Users can create shared leads" ON public.shared_leads
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Recipients can delete shared leads" ON public.shared_leads
  FOR DELETE USING (recipient_id = auth.uid());
```

## Step 5: Configure Authentication

In Supabase Dashboard, go to **Authentication → Providers**:

### Email/Password (Default - Already Enabled)
- Should be enabled by default
- Go to **Email Templates** to customize email messages

### Configure Redirect URLs
Go to **Authentication → URL Configuration**:
- Site URL: `https://cce-carrier-conversion-engine.vercel.app` (production)

## Step 6: Set Up Salesforce OAuth (Optional)

1. Go to Salesforce Developer Console
2. Create OAuth 2.0 Application:
   - **Callback URL**: `https://[your-supabase-url]/auth/v1/callback`
3. Copy **Client ID** and **Client Secret**
4. Save to `.env.local`

## Step 7: Deploy to Vercel

### Add Environment Variables to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Import this project or go to project settings
3. Go to **Settings → Environment Variables**
4. Add these variables:
   ```
   VITE_SUPABASE_URL=https://[project-id].supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   VITE_OPENROUTER_API_KEY=sk-or-...
   VITE_TAVILY_API_KEY=tvly-...
   VITE_SALESFORCE_CLIENT_ID=your_salesforce_client_id
   VITE_SALESFORCE_CLIENT_SECRET=your_salesforce_client_secret
   VITE_BASE_URL=https://cce-carrier-conversion-engine.vercel.app
   ```
5. Click **Save**
6. Vercel will automatically rebuild and deploy

### Verify Deployment

Once deployed, your app should:
1. Load without errors at `https://cce-carrier-conversion-engine.vercel.app`
2. Show LoginPage if not authenticated
3. Show main dashboard if authenticated

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing environment variables" | Check Vercel project settings → Environment Variables |
| "Cannot connect to Supabase" | Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly in Vercel |
| "Email already exists" | Use unique email for test account |
| "Redirect URL mismatch" | Update Authentication → URL Configuration in Supabase to include Vercel URL |
| "Build failed" | Check Vercel build logs - may be missing packages (run `npm install` locally to test) |

## Next Steps

- [x] Set up Supabase project
- [x] Run SQL schema setup in Supabase
- [ ] Set environment variables in Vercel
- [ ] Deploy to Vercel
- [ ] Create test user account
- [ ] Configure email templates for password reset (in Supabase)
- [ ] Set up Salesforce integration (optional)
