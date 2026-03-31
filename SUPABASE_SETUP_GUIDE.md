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
- Copy **Project URL** → `REACT_APP_SUPABASE_URL`
- Copy **anon public** key → `REACT_APP_SUPABASE_ANON_KEY`

## Step 3: Set Up Environment Variables

Create `.env.local` in your project root:

```bash
REACT_APP_SUPABASE_URL=https://[project-id].supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...
REACT_APP_OPENROUTER_API_KEY=sk-or-...
REACT_APP_TAVILY_API_KEY=tvly-...
REACT_APP_SALESFORCE_CLIENT_ID=your_salesforce_client_id
REACT_APP_SALESFORCE_CLIENT_SECRET=your_salesforce_client_secret
```

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

## Step 5: Configure Authentication

In Supabase Dashboard, go to **Authentication → Providers**:

### Email/Password (Default - Already Enabled)
- Should be enabled by default
- Go to **Email Templates** to customize email messages

### Configure Redirect URLs
Go to **Authentication → URL Configuration**:
- Site URL: `http://localhost:5173` (development)
- Production: `https://yourdomain.com`

## Step 6: Set Up Salesforce OAuth (Optional)

1. Go to Salesforce Developer Console
2. Create OAuth 2.0 Application:
   - **Callback URL**: `https://[your-supabase-url]/auth/v1/callback`
3. Copy **Client ID** and **Client Secret**
4. Save to `.env.local`

## Step 7: Verify Connection

Run in your terminal:
```bash
npm run dev
```

The app should:
1. Load without errors
2. Show LoginPage if not authenticated
3. Show main dashboard if authenticated

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing environment variables" | Check `.env.local` file exists and variables are set |
| "Cannot connect to Supabase" | Verify URL format and check internet connection |
| "Email already exists" | Use unique email for test account |
| "Redirect URL mismatch" | Update Authentication → URL Configuration in Supabase |

## Next Steps

- [ ] Create test user account
- [ ] Configure email templates for password reset
- [ ] Set up Salesforce integration (optional)
- [ ] Configure Vercel environment variables
- [ ] Enable custom domain (optional)
