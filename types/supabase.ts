// This file contains TypeScript definitions for all Supabase tables
// Generate from Supabase CLI: supabase gen types typescript --project-id your-project-id

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          subscription_tier: 'free' | 'pro' | 'enterprise';
          credits_balance: number;
          monthly_openrouter_cost: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          subscription_tier?: 'free' | 'pro' | 'enterprise';
          credits_balance?: number;
          monthly_openrouter_cost?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };

      leads: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          industry: string;
          revenue: string;
          employees: number;
          website_url: string;
          status: 'prospect' | 'contacted' | 'qualified' | 'disqualified';
          analysis_model: string;
          hallucination_score: number;
          hallucination_details: Record<string, any> | null;
          decision_making_efficiency: number;
          competitive_positioning: number;
          market_opportunity: number;
          notes: string | null;
          next_action: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name: string;
          industry: string;
          revenue: string;
          employees: number;
          website_url: string;
          status?: 'prospect' | 'contacted' | 'qualified' | 'disqualified';
          analysis_model?: string;
          hallucination_score?: number;
          hallucination_details?: Record<string, any> | null;
          decision_making_efficiency?: number;
          competitive_positioning?: number;
          market_opportunity?: number;
          notes?: string | null;
          next_action?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['leads']['Insert']>;
      };

      decision_makers: {
        Row: {
          id: string;
          lead_id: string;
          first_name: string;
          last_name: string;
          title: string;
          email: string;
          phone: string | null;
          linkedin_url: string | null;
          verified: boolean;
          verification_method: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          first_name: string;
          last_name: string;
          title: string;
          email: string;
          phone?: string | null;
          linkedin_url?: string | null;
          verified?: boolean;
          verification_method?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['decision_makers']['Insert']>;
      };

      analysis_history: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string;
          analysis_type: 'quick_scan' | 'deep_dive' | 'batch_prospecting';
          model_used: string;
          prompt_tokens: number;
          completion_tokens: number;
          total_cost_usd: number;
          result_summary: string;
          raw_analysis: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lead_id: string;
          analysis_type: 'quick_scan' | 'deep_dive' | 'batch_prospecting';
          model_used: string;
          prompt_tokens: number;
          completion_tokens: number;
          total_cost_usd: number;
          result_summary: string;
          raw_analysis: Record<string, any>;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['analysis_history']['Insert']>;
      };

      campaigns: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          subject: string;
          body: string;
          status: 'draft' | 'scheduled' | 'sent';
          total_recipients: number;
          total_opened: number;
          total_clicked: number;
          open_rate: number;
          click_rate: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          subject: string;
          body: string;
          status?: 'draft' | 'scheduled' | 'sent';
          total_recipients?: number;
          total_opened?: number;
          total_clicked?: number;
          open_rate?: number;
          click_rate?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['campaigns']['Insert']>;
      };

      campaign_recipients: {
        Row: {
          id: string;
          campaign_id: string;
          lead_id: string;
          email: string;
          status: 'pending' | 'sent' | 'opened' | 'clicked' | 'bounced';
          opened_at: string | null;
          clicked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          lead_id: string;
          email: string;
          status?: 'pending' | 'sent' | 'opened' | 'clicked' | 'bounced';
          opened_at?: string | null;
          clicked_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['campaign_recipients']['Insert']>;
      };

      crm_integrations: {
        Row: {
          id: string;
          user_id: string;
          crm_type: 'hubspot' | 'pipedrive' | 'salesforce';
          api_token: string; // Encrypted in database
          enabled: boolean;
          last_sync: string | null;
          synced_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          crm_type: 'hubspot' | 'pipedrive' | 'salesforce';
          api_token: string;
          enabled?: boolean;
          last_sync?: string | null;
          synced_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['crm_integrations']['Insert']>;
      };

      slack_integrations: {
        Row: {
          id: string;
          user_id: string;
          webhook_url: string; // Encrypted in database
          enabled: boolean;
          notifications: {
            leadCreated: boolean;
            hallucinationAlert: boolean;
            campaignStarted: boolean;
            campaignCompleted: boolean;
            crmSynced: boolean;
          };
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          webhook_url: string;
          enabled?: boolean;
          notifications?: {
            leadCreated: boolean;
            hallucinationAlert: boolean;
            campaignStarted: boolean;
            campaignCompleted: boolean;
            crmSynced: boolean;
          };
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['slack_integrations']['Insert']>;
      };

      cost_tracking: {
        Row: {
          id: string;
          user_id: string;
          service: 'openrouter' | 'tavily' | 'email' | 'crm_sync';
          model_or_action: string;
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          service: 'openrouter' | 'tavily' | 'email' | 'crm_sync';
          model_or_action: string;
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cost_tracking']['Insert']>;
      };
    };
  };
}

// Helper types for common queries
export type User = Database['public']['Tables']['users']['Row'];
export type Lead = Database['public']['Tables']['leads']['Row'];
export type DecisionMaker = Database['public']['Tables']['decision_makers']['Row'];
export type Campaign = Database['public']['Tables']['campaigns']['Row'];
export type CRMIntegration = Database['public']['Tables']['crm_integrations']['Row'];
export type SlackIntegration = Database['public']['Tables']['slack_integrations']['Row'];
export type CostRecord = Database['public']['Tables']['cost_tracking']['Row'];
