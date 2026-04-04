import { CronJob } from './cronJobService';
import { supabase } from './supabaseClient';

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Missing authenticated session');
  return token;
}

export async function loadRemoteCronJobs(): Promise<CronJob[]> {
  const token = await getAccessToken();
  const response = await fetch('/api/cron-jobs', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load scheduled jobs');
  }

  const body = await response.json();
  return Array.isArray(body.jobs) ? body.jobs : [];
}

export async function saveRemoteCronJobs(jobs: CronJob[]): Promise<CronJob[]> {
  const token = await getAccessToken();
  const response = await fetch('/api/cron-jobs', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ jobs })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to save scheduled jobs');
  }

  const body = await response.json();
  return Array.isArray(body.jobs) ? body.jobs : jobs;
}