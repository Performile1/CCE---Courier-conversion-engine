import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthenticatedUser, setCors } from './_scheduledJobs.js';

type CRMType = 'hubspot' | 'pipedrive' | 'salesforce';

interface SyncResult {
  success: boolean;
  leadsCreated: number;
  leadsUpdated: number;
  error?: string;
}

function normalizeLeadPayload(leads: any): any[] {
  return Array.isArray(leads) ? leads : [];
}

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => ({}));
}

class HubSpotIntegration {
  constructor(private apiToken: string) {}

  async createContact(lead: any): Promise<string> {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          firstname: lead.decisionMakers?.[0]?.name?.split(' ')[0] || '',
          lastname: lead.decisionMakers?.[0]?.name?.split(' ').slice(1).join(' ') || '',
          email: lead.decisionMakers?.[0]?.email || '',
          company: lead.companyName,
          phone: lead.decisionMakers?.[0]?.directPhone || lead.decisionMakers?.[0]?.phone || '',
          website: lead.websiteUrl,
          lifecyclestage: 'lead'
        }
      })
    });

    if (!response.ok) {
      const payload = await parseJsonResponse(response);
      throw new Error(payload?.message || payload?.error || `HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async createCompany(lead: any): Promise<string> {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/companies', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
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
      const payload = await parseJsonResponse(response);
      throw new Error(payload?.message || payload?.error || `HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async createDeal(lead: any, contactId: string, companyId: string): Promise<string> {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          dealname: `${lead.companyName} - Freight Optimization`,
          dealstage: 'negotiation',
          amount: parseInt(String(lead.freightBudget || '').replace(/[^0-9]/g, '') || '0', 10),
          hubspot_owner_id: null
        },
        associations: [
          { types: [{ associationType: 'contact_to_deal' }], id: contactId },
          { types: [{ associationType: 'company_to_deal' }], id: companyId }
        ]
      })
    });

    if (!response.ok) {
      const payload = await parseJsonResponse(response);
      throw new Error(payload?.message || payload?.error || `HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }
}

class PipedriveIntegration {
  constructor(private apiToken: string) {}

  private async post(path: string, body: Record<string, any>) {
    const response = await fetch(`https://api.pipedrive.com/v1/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': this.apiToken
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const payload = await parseJsonResponse(response);
      throw new Error(payload?.error || payload?.message || `Pipedrive API error: ${response.statusText}`);
    }

    return response.json();
  }

  async createPerson(lead: any): Promise<number> {
    const data = await this.post('persons', {
      name: lead.decisionMakers?.[0]?.name || '',
      email: [{ value: lead.decisionMakers?.[0]?.email, primary: true }],
      phone: [{ value: lead.decisionMakers?.[0]?.directPhone || lead.decisionMakers?.[0]?.phone || '', primary: true }]
    });
    return data.data.id;
  }

  async createOrganization(lead: any): Promise<number> {
    const data = await this.post('organizations', {
      name: lead.companyName,
      industry: lead.industry
    });
    return data.data.id;
  }

  async createDeal(lead: any, personId: number, orgId: number): Promise<number> {
    const data = await this.post('deals', {
      title: `${lead.companyName} - Freight Optimization`,
      person_id: personId,
      org_id: orgId,
      value: parseInt(String(lead.freightBudget || '').replace(/[^0-9]/g, '') || '0', 10),
      currency: 'SEK',
      stage_id: 1
    });
    return data.data.id;
  }
}

async function syncLeads(adminClient: any, userId: string, crmType: CRMType, apiToken: string, leads: any[]): Promise<SyncResult> {
  const result: SyncResult = { success: false, leadsCreated: 0, leadsUpdated: 0 };

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
      if (crmType === 'hubspot') {
        const hubspot = adapter as HubSpotIntegration;
        const contactId = await hubspot.createContact(lead);
        const companyId = await hubspot.createCompany(lead);
        await hubspot.createDeal(lead, contactId, companyId);
      } else {
        const pipedrive = adapter as PipedriveIntegration;
        const personId = await pipedrive.createPerson(lead);
        const orgId = await pipedrive.createOrganization(lead);
        await pipedrive.createDeal(lead, personId, orgId);
      }

      result.leadsCreated += 1;
    } catch (error: any) {
      result.error = error?.message || 'CRM sync failed';
    }
  }

  await adminClient
    .from('crm_integrations')
    .update({
      last_sync: new Date().toISOString(),
      sync_error: result.error || null,
      synced_count: result.leadsCreated,
      status: result.error ? 'error' : 'active'
    })
    .eq('user_id', userId)
    .eq('crm_type', crmType);

  result.success = result.leadsCreated > 0 && !result.error;
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { adminClient, user } = await requireAuthenticatedUser(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const crmType = String(body.crmType || '').trim() as CRMType;
    const leads = normalizeLeadPayload(body.leads);

    if (!crmType || !['hubspot', 'pipedrive', 'salesforce'].includes(crmType)) {
      res.status(400).json({ error: 'Valid crmType is required' });
      return;
    }

    if (!leads.length) {
      res.status(400).json({ error: 'At least one lead is required for CRM sync' });
      return;
    }

    const { data: integration, error } = await adminClient
      .from('crm_integrations')
      .select('api_token, enabled, status, synced_count')
      .eq('user_id', user.id)
      .eq('crm_type', crmType)
      .single();

    if (error || !integration?.api_token) {
      res.status(404).json({ error: 'CRM integration not configured for current user' });
      return;
    }

    if (integration.enabled === false) {
      res.status(409).json({ error: 'CRM integration is disabled' });
      return;
    }

    const result = await syncLeads(adminClient, user.id, crmType, integration.api_token, leads);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('CRM sync API error:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}