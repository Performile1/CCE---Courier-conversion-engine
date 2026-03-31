/**
 * SALESFORCE INTEGRATION SERVICE
 * Handles OAuth authentication and CRUD operations with Salesforce
 */

import { supabase } from './supabaseClient';

const SALESFORCE_CLIENT_ID = process.env.REACT_APP_SALESFORCE_CLIENT_ID || '';
const SALESFORCE_CLIENT_SECRET = process.env.REACT_APP_SALESFORCE_CLIENT_SECRET || '';
const SALESFORCE_LOGIN_URL = 'https://login.salesforce.com';

interface SalesforceAuthToken {
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

interface SalesforceAccount {
  Name: string;
  BillingCity: string;
  BillingCountry: string;
  Website: string;
  Industry: string;
  NumberOfEmployees?: number;
}

interface SalesforceContact {
  FirstName: string;
  LastName: string;
  Email: string;
  Phone?: string;
  MobilePhone?: string;
  Title?: string;
  AccountId?: string;
}

/**
 * Generate Salesforce OAuth URL
 */
export function getSalesforceAuthUrl(state: string): string {
  const redirectUri = `${window.location.origin}/auth/salesforce/callback`;
  
  const params = new URLSearchParams({
    client_id: SALESFORCE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'openid profile email api refresh_token'
  });

  return `${SALESFORCE_LOGIN_URL}/services/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeSalesforceCode(code: string): Promise<SalesforceAuthToken> {
  const redirectUri = `${window.location.origin}/auth/salesforce/callback`;

  const response = await fetch(`${SALESFORCE_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: SALESFORCE_CLIENT_ID,
      client_secret: SALESFORCE_CLIENT_SECRET,
      redirect_uri: redirectUri,
    })
  });

  if (!response.ok) {
    throw new Error(`Salesforce OAuth error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Store Salesforce credentials
 */
export async function storeSalesforceCredentials(
  userId: string,
  accessToken: string,
  instanceUrl: string
) {
  const { data, error } = await supabase
    .from('integrations')
    .upsert(
      {
        user_id: userId,
        integration_type: 'salesforce',
        status: 'active',
        config: {
          access_token: accessToken,
          instance_url: instanceUrl,
          connected_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get Salesforce credentials
 */
export async function getSalesforceCredentials(userId: string) {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('integration_type', 'salesforce')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.config || null;
}

/**
 * Create Salesforce Account
 */
export async function createSalesforceAccount(
  userId: string,
  account: SalesforceAccount
): Promise<{ id: string }> {
  const creds = await getSalesforceCredentials(userId);
  if (!creds) throw new Error('Salesforce not connected');

  const response = await fetch(
    `${creds.instance_url}/services/data/v58.0/sobjects/Account`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(account)
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create Salesforce Account: ${response.statusText}`);
  }

  const result = await response.json();
  
  // Update user profile with Salesforce account ID
  await supabase
    .from('users')
    .update({ salesforce_account_id: result.id })
    .eq('id', userId);

  return result;
}

/**
 * Create Salesforce Contact
 */
export async function createSalesforceContact(
  userId: string,
  contact: SalesforceContact
): Promise<{ id: string }> {
  const creds = await getSalesforceCredentials(userId);
  if (!creds) throw new Error('Salesforce not connected');

  const response = await fetch(
    `${creds.instance_url}/services/data/v58.0/sobjects/Contact`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contact)
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create Salesforce Contact: ${response.statusText}`);
  }

  const result = await response.json();

  // Update user profile with Salesforce contact ID
  await supabase
    .from('users')
    .update({ salesforce_contact_id: result.id })
    .eq('id', userId);

  return result;
}

/**
 * Query Salesforce data
 */
export async function querySalesforce<T>(
  userId: string,
  query: string
): Promise<T[]> {
  const creds = await getSalesforceCredentials(userId);
  if (!creds) throw new Error('Salesforce not connected');

  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `${creds.instance_url}/services/data/v58.0/query?q=${encodedQuery}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${creds.access_token}`,
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Salesforce query failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.records;
}

/**
 * Disconnect Salesforce
 */
export async function disconnectSalesforce(userId: string) {
  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('user_id', userId)
    .eq('integration_type', 'salesforce');

  if (error) throw error;

  // Clear Salesforce fields from user profile
  await supabase
    .from('users')
    .update({
      salesforce_account_id: null,
      salesforce_contact_id: null
    })
    .eq('id', userId);
}
