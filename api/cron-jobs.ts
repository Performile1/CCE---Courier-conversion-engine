import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthenticatedUser, rowToJob, setCors, jobToRow } from './_scheduledJobs.js';
import type { CronJob } from '../services/cronJobService.js';

function isMissingScheduledJobsTable(error: any): boolean {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || (message.includes('scheduled_jobs') && message.includes('does not exist'));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!['GET', 'PUT'].includes(req.method || '')) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { adminClient, user } = await requireAuthenticatedUser(req);

    if (req.method === 'GET') {
      const { data, error } = await adminClient
        .from('scheduled_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (isMissingScheduledJobsTable(error)) {
          res.status(200).json({ jobs: [] });
          return;
        }
        throw error;
      }
      res.status(200).json({ jobs: (data || []).map(rowToJob) });
      return;
    }

    const jobs = Array.isArray((req.body as any)?.jobs) ? ((req.body as any).jobs as CronJob[]) : [];
    const jobIds = jobs.map((job) => job.id);

    if (jobIds.length > 0) {
      const { error: upsertError } = await adminClient
        .from('scheduled_jobs')
        .upsert(jobs.map((job) => jobToRow(user.id, job)), { onConflict: 'id' });
      if (upsertError) {
        if (isMissingScheduledJobsTable(upsertError)) {
          res.status(200).json({ jobs });
          return;
        }
        throw upsertError;
      }
    }

    const { data: existingRows, error: existingError } = await adminClient
      .from('scheduled_jobs')
      .select('id')
      .eq('user_id', user.id);
    if (existingError) {
      if (isMissingScheduledJobsTable(existingError)) {
        res.status(200).json({ jobs });
        return;
      }
      throw existingError;
    }

    const existingIds = (existingRows || []).map((row: any) => row.id);
    const idsToDelete = existingIds.filter((id: string) => !jobIds.includes(id));
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await adminClient
        .from('scheduled_jobs')
        .delete()
        .eq('user_id', user.id)
        .in('id', idsToDelete);
      if (deleteError) throw deleteError;
    }

    const { data, error } = await adminClient
      .from('scheduled_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingScheduledJobsTable(error)) {
        res.status(200).json({ jobs });
        return;
      }
      throw error;
    }

    res.status(200).json({ jobs: (data || []).map(rowToJob) });
  } catch (error: any) {
    const message = error?.message || 'Internal server error';
    const status = /token|bearer/i.test(message) ? 401 : 500;
    res.status(status).json({ error: message });
  }
}