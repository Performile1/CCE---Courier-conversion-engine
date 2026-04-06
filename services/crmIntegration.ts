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
 * Sync leads to CRM
 */
export async function syncLeadsToCRM(
  userId: string,
  leads: any[],
  crmType: CRMType,
  onProgress?: (message: string) => void
): Promise<SyncResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('You must be logged in to sync CRM data');
  }

  onProgress?.(`Syncing ${leads.length} leads to ${crmType}...`);

  const response = await fetch('/api/crm-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ userId, leads, crmType })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || 'CRM sync failed');
  }

  return payload as SyncResult;
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
    .upsert({
      user_id: userId,
      crm_type: crmType,
      api_token: apiToken,
      status: 'active'
    }, { onConflict: 'user_id,crm_type' });

  if (error) throw error;
}

/**
 * Get CRM integration
 */
export async function getCRMIntegration(userId: string, crmType: CRMType): Promise<any> {
  const { data, error } = await supabase
    .from('crm_integrations')
    .select('id, crm_type, status, enabled, last_sync, synced_count, sync_error, created_at, updated_at')
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
