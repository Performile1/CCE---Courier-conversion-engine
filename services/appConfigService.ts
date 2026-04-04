import { supabase } from './supabaseClient';

export const USER_SETTING_KEYS = {
  mailSettings: 'mail_settings',
  selectedIntegrations: 'selected_integrations'
} as const;

export const SHARED_SETTING_KEYS = {
  sourceConfiguration: 'source_configuration',
  toolAccessConfig: 'tool_access_config',
  availableSystems: 'available_systems',
  sniPercentages: 'sni_percentages',
  threePLProviders: 'three_pl_providers',
  marketSettings: 'market_settings',
  activeCarrier: 'active_carrier',
  techSolutions: 'tech_solutions'
} as const;

export interface BackupRecord {
  id: string;
  name: string;
  timestamp: string;
  leadCount: number;
  data: any;
  storagePath: string;
}

type UserSettingKey = (typeof USER_SETTING_KEYS)[keyof typeof USER_SETTING_KEYS];
type SharedSettingKey = (typeof SHARED_SETTING_KEYS)[keyof typeof SHARED_SETTING_KEYS];

export async function loadUserSettings(userId: string, keys: UserSettingKey[]) {
  const { data, error } = await supabase
    .from('app_user_settings')
    .select('setting_key, value')
    .eq('user_id', userId)
    .in('setting_key', keys);

  if (error) throw error;

  return Object.fromEntries((data || []).map((row: any) => [row.setting_key, row.value]));
}

export async function saveUserSetting(userId: string, key: UserSettingKey, value: any) {
  const { error } = await supabase.from('app_user_settings').upsert({
    user_id: userId,
    setting_key: key,
    value,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,setting_key' });

  if (error) throw error;
}

export async function loadSharedSettings(keys: SharedSettingKey[]) {
  const { data, error } = await supabase
    .from('app_shared_settings')
    .select('setting_key, value')
    .in('setting_key', keys);

  if (error) throw error;

  return Object.fromEntries((data || []).map((row: any) => [row.setting_key, row.value]));
}

export async function saveSharedSetting(key: SharedSettingKey, value: any, userId?: string) {
  const { error } = await supabase.from('app_shared_settings').upsert({
    setting_key: key,
    value,
    updated_by: userId || null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'setting_key' });

  if (error) throw error;
}

export async function loadBackupRecords(userId: string): Promise<BackupRecord[]> {
  const { data, error } = await supabase
    .from('backup_records')
    .select('id, name, lead_count, payload_snapshot, storage_path, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    timestamp: row.created_at,
    leadCount: row.lead_count || 0,
    data: row.payload_snapshot || null,
    storagePath: row.storage_path
  }));
}

export async function createBackupRecord(userId: string, name: string, data: any, leadCount: number): Promise<BackupRecord> {
  const backupId = crypto.randomUUID();
  const storagePath = `${userId}/${backupId}.json`;
  const payload = JSON.stringify(data, null, 2);

  const upload = await supabase.storage.from('system-backups').upload(storagePath, payload, {
    contentType: 'application/json',
    upsert: true
  });
  if (upload.error) throw upload.error;

  const { data: record, error } = await supabase
    .from('backup_records')
    .insert({
      id: backupId,
      user_id: userId,
      name,
      lead_count: leadCount,
      storage_path: storagePath,
      payload_snapshot: data,
      metadata: {
        fileSize: payload.length
      },
      updated_at: new Date().toISOString()
    })
    .select('id, name, lead_count, payload_snapshot, storage_path, created_at')
    .single();

  if (error) throw error;

  return {
    id: record.id,
    name: record.name,
    timestamp: record.created_at,
    leadCount: record.lead_count || 0,
    data: record.payload_snapshot || null,
    storagePath: record.storage_path
  };
}

export async function deleteBackupRecord(backupId: string, storagePath: string) {
  const storageResult = await supabase.storage.from('system-backups').remove([storagePath]);
  if (storageResult.error) throw storageResult.error;

  const { error } = await supabase.from('backup_records').delete().eq('id', backupId);
  if (error) throw error;
}

export async function downloadBackupPayload(storagePath: string): Promise<any> {
  const { data, error } = await supabase.storage.from('system-backups').download(storagePath);
  if (error) throw error;
  const text = await data.text();
  return JSON.parse(text);
}