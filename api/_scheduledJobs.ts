import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CronJob } from '../services/cronJobService';

export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

export function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function requireAuthenticatedUser(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    throw new Error('Missing bearer token');
  }

  const token = authHeader.slice(7);
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Invalid authentication token');
  }

  return { adminClient, user: data.user };
}

export function jobToRow(userId: string, job: CronJob) {
  return {
    id: job.id,
    user_id: userId,
    name: job.name,
    type: job.type,
    cron_expression: job.cronExpression,
    enabled: job.enabled,
    schedule_mode: job.scheduleMode || null,
    payload: job.payload || {},
    last_run_at: job.lastRunAt || null,
    next_run_at: job.nextRunAt || null,
    last_status: job.lastStatus || null,
    last_error: job.lastError || null,
    last_result_summary: job.lastResultSummary || null,
    created_at: job.createdAt,
    updated_at: job.updatedAt
  };
}

export function rowToJob(row: any): CronJob {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    cronExpression: row.cron_expression,
    enabled: Boolean(row.enabled),
    scheduleMode: row.schedule_mode || undefined,
    payload: row.payload || {},
    lastRunAt: row.last_run_at || undefined,
    nextRunAt: row.next_run_at || undefined,
    lastStatus: row.last_status || undefined,
    lastError: row.last_error || undefined,
    lastResultSummary: row.last_result_summary || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Dual-mode auth guard: accepts a Supabase user JWT or the CRON_SECRET.
 * Use on all internal API endpoints that must not be publicly invocable.
 */
export async function requireApiAuth(req: VercelRequest): Promise<void> {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('Missing authorization header');
  }

  // Server-to-server bypass (cron-runner and other trusted callers)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && token === cronSecret) return;

  // Validate as Supabase user JWT
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Invalid authentication token');
  }
}