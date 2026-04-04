import { supabase } from './supabaseClient';

export async function loadWebhooks(userId: string) {
  const { data, error } = await supabase
    .from('webhooks')
    .select('id, url, events, active, last_triggered, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    url: row.url,
    events: row.events || [],
    active: !!row.active,
    lastTriggered: row.last_triggered,
    createdAt: row.created_at
  }));
}

export async function createWebhook(userId: string, url: string, events: string[]) {
  const { data, error } = await supabase
    .from('webhooks')
    .insert({ user_id: userId, url, events, active: true })
    .select('id, url, events, active, last_triggered, created_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    url: data.url,
    events: data.events || [],
    active: !!data.active,
    lastTriggered: data.last_triggered,
    createdAt: data.created_at
  };
}

export async function deleteWebhook(userId: string, id: string) {
  const { error } = await supabase.from('webhooks').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export async function loadEventTriggers(userId: string) {
  const { data, error } = await supabase
    .from('event_triggers')
    .select('id, event, webhook_ids, custom_logic, active, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    event: row.event,
    webhook_ids: row.webhook_ids || [],
    custom_logic: row.custom_logic,
    active: !!row.active,
    createdAt: row.created_at
  }));
}

export async function createEventTrigger(userId: string, trigger: { event: string; webhook_ids: string[]; custom_logic: string | null; active?: boolean; }) {
  const { data, error } = await supabase
    .from('event_triggers')
    .insert({
      user_id: userId,
      event: trigger.event,
      webhook_ids: trigger.webhook_ids,
      custom_logic: trigger.custom_logic,
      active: trigger.active ?? true
    })
    .select('id, event, webhook_ids, custom_logic, active, created_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    event: data.event,
    webhook_ids: data.webhook_ids || [],
    custom_logic: data.custom_logic,
    active: !!data.active,
    createdAt: data.created_at
  };
}

export async function deleteEventTrigger(userId: string, id: string) {
  const { error } = await supabase.from('event_triggers').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export async function loadCustomConnectors(userId: string) {
  const { data, error } = await supabase
    .from('custom_connectors')
    .select('id, name, base_url, auth_type, auth_config, endpoints, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    authType: row.auth_type,
    authConfig: row.auth_config || {},
    endpoints: row.endpoints || [],
    description: row.description || '',
    createdAt: row.created_at
  }));
}

export async function createCustomConnector(userId: string, connector: { name: string; baseUrl: string; authType: string; authConfig: Record<string, any>; endpoints: any[]; description: string; }) {
  const { data, error } = await supabase
    .from('custom_connectors')
    .insert({
      user_id: userId,
      name: connector.name,
      base_url: connector.baseUrl,
      auth_type: connector.authType,
      auth_config: connector.authConfig,
      endpoints: connector.endpoints,
      description: connector.description || null,
      status: 'active'
    })
    .select('id, name, base_url, auth_type, auth_config, endpoints, description, created_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    baseUrl: data.base_url,
    authType: data.auth_type,
    authConfig: data.auth_config || {},
    endpoints: data.endpoints || [],
    description: data.description || '',
    createdAt: data.created_at
  };
}

export async function deleteCustomConnector(userId: string, id: string) {
  const { error } = await supabase.from('custom_connectors').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export async function loadCustomAdapters(userId: string) {
  const { data, error } = await supabase
    .from('integrations')
    .select('id, integration_type, status, config, created_at')
    .eq('user_id', userId)
    .eq('integration_type', 'custom_adapter')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.config?.name || 'Adapter',
    description: row.config?.description || '',
    type: row.config?.type || 'http',
    config: row.config?.config || {},
    active: row.status === 'active',
    createdAt: row.created_at
  }));
}

export async function createCustomAdapter(userId: string, adapter: { name: string; description: string; type: string; config: Record<string, any>; active?: boolean; }) {
  const payload = {
    name: adapter.name,
    description: adapter.description,
    type: adapter.type,
    config: adapter.config,
    createdAt: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('integrations')
    .insert({
      user_id: userId,
      integration_type: 'custom_adapter',
      status: adapter.active === false ? 'inactive' : 'active',
      config: payload
    })
    .select('id, integration_type, status, config, created_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.config?.name || adapter.name,
    description: data.config?.description || adapter.description,
    type: data.config?.type || adapter.type,
    config: data.config?.config || adapter.config,
    active: data.status === 'active',
    createdAt: data.created_at
  };
}

export async function deleteCustomAdapter(userId: string, id: string) {
  const { error } = await supabase.from('integrations').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}