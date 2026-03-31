/**
 * PHASE 7: CRM INTEGRATION SERVICE
 * Support for HubSpot, Pipedrive, Salesforce
 */

import { supabase } from './supabaseClient';

export type CRMType = 'hubspot' | 'pipedrive' | 'salesforce';

interface CRMConfig {
  crmType: CRMType;
  apiToken: string;
  baseUrl?: string;
}

interface SyncResult {
  success: boolean;
  leadsCreated: number;
  leadsUpdated: number;
  error?: string;
}

/**
 * HubSpot CRM Integration
 */
class HubSpotIntegration {
  private apiToken: string;
  private baseUrl = 'https://api.hubapi.com';

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  async createContact(lead: any): Promise<string> {
    const response = await fetch(`${this.baseUrl}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          firstname: lead.decisionMakers?.[0]?.name?.split(' ')[0] || '',
          lastname: lead.decisionMakers?.[0]?.name?.split(' ').slice(1).join(' ') || '',
          email: lead.decisionMakers?.[0]?.email || '',
          company: lead.companyName,
          phone: lead.decisionMakers?.[0]?.phone || '',
          website: lead.websiteUrl,
          lifecyclestage: 'lead'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async createCompany(lead: any): Promise<string> {
    const response = await fetch(`${this.baseUrl}/crm/v3/objects/companies`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          name: lead.companyName,
          industry: lead.industry || '',
          revenue: lead.revenue || '',
          website: lead.websiteUrl,
          lifecyclestage: 'subscriber'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async createDeal(lead: any, contactId: string, companyId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/crm/v3/objects/deals`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          dealname: `${lead.companyName} - Freight Optimization`,
          dealstage: 'negotiation',
          amount: parseInt(lead.freightBudget?.replace(/[^0-9]/g, '') || '0'),
          hubspot_owner_id: null
        },
        associations: [
          { types: [{ associationType: 'contact_to_deal' }], id: contactId },
          { types: [{ associationType: 'company_to_deal' }], id: companyId }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }
}

/**
 * Pipedrive CRM Integration
 */
class PipedriveIntegration {
  private apiToken: string;
  private baseUrl = 'https://api.pipedrive.com/v1';

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  async createPerson(lead: any): Promise<number> {
    const response = await fetch(`${this.baseUrl}/persons?api_token=${this.apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.decisionMakers?.[0]?.name || '',
        email: [{ value: lead.decisionMakers?.[0]?.email, primary: true }],
        phone: [{ value: lead.decisionMakers?.[0]?.phone, primary: true }]
      })
    });

    if (!response.ok) {
      throw new Error(`Pipedrive API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.id;
  }

  async createOrganization(lead: any): Promise<number> {
    const response = await fetch(`${this.baseUrl}/organizations?api_token=${this.apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.companyName,
        industry: lead.industry
      })
    });

    if (!response.ok) {
      throw new Error(`Pipedrive API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.id;
  }

  async createDeal(lead: any, personId: number, orgId: number): Promise<number> {
    const response = await fetch(`${this.baseUrl}/deals?api_token=${this.apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${lead.companyName} - Freight Optimization`,
        person_id: personId,
        org_id: orgId,
        value: parseInt(lead.freightBudget?.replace(/[^0-9]/g, '') || '0'),
        currency: 'SEK',
        stage_id: 1
      })
    });

    if (!response.ok) {
      throw new Error(`Pipedrive API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.id;
  }
}

/**
 * Sync leads to CRM
 */
export async function syncLeadsToCRM(
  userId: string,
  leads: any[],
  crmType: CRMType,
  apiToken: string,
  onProgress?: (message: string) => void
): Promise<SyncResult> {
  const result: SyncResult = { success: false, leadsCreated: 0, leadsUpdated: 0 };

  try {
    let adapter: HubSpotIntegration | PipedriveIntegration;

    if (crmType === 'hubspot') {
      adapter = new HubSpotIntegration(apiToken);
    } else if (crmType === 'pipedrive') {
      adapter = new PipedriveIntegration(apiToken);
    } else {
      throw new Error(`CRM type ${crmType} not yet supported`);
    }

    for (const lead of leads) {
      try {
        onProgress?.(`Syncing ${lead.companyName}...`);

        if (crmType === 'hubspot') {
          const hubspot = adapter as HubSpotIntegration;
          const contactId = await hubspot.createContact(lead);
          const companyId = await hubspot.createCompany(lead);
          await hubspot.createDeal(lead, contactId, companyId);
        } else if (crmType === 'pipedrive') {
          const pipedrive = adapter as PipedriveIntegration;
          const personId = await pipedrive.createPerson(lead);
          const orgId = await pipedrive.createOrganization(lead);
          await pipedrive.createDeal(lead, personId, orgId);
        }

        result.leadsCreated++;

        // Update sync status in Supabase
        await supabase
          .from('crm_integrations')
          .update({ last_sync: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('crm_type', crmType);

      } catch (error: any) {
        console.error(`Error syncing lead ${lead.companyName}:`, error);
        result.error = error.message;
      }
    }

    result.success = result.leadsCreated > 0;
    return result;

  } catch (error: any) {
    result.error = error.message;
    return result;
  }
}

/**
 * Save CRM integration to database
 */
export async function saveCRMIntegration(
  userId: string,
  crmType: CRMType,
  apiToken: string
): Promise<void> {
  const { error } = await supabase
    .from('crm_integrations')
    .insert({
      user_id: userId,
      crm_type: crmType,
      api_token: apiToken,
      status: 'active'
    });

  if (error) throw error;
}

/**
 * Get CRM integration
 */
export async function getCRMIntegration(userId: string, crmType: CRMType): Promise<any> {
  const { data, error } = await supabase
    .from('crm_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('crm_type', crmType)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete CRM integration
 */
export async function deleteCRMIntegration(userId: string, crmType: CRMType): Promise<void> {
  const { error } = await supabase
    .from('crm_integrations')
    .delete()
    .eq('user_id', userId)
    .eq('crm_type', crmType);

  if (error) throw error;
}
