import { SearchFormData, Segment } from '../types';

export type CronJobType = 'deep_dive' | 'batch_search' | 'lead_reanalysis';

export type CronScheduleMode = 'custom' | 'daily' | 'interval';

export interface CronJobPayload extends Partial<SearchFormData> {
  targetSegments?: Segment[];
  reanalysisScope?: 'active' | 'cache' | 'both';
  reanalysisLimit?: number;
}

export interface CronJob {
  id: string;
  name: string;
  type: CronJobType;
  cronExpression: string;
  enabled: boolean;
  scheduleMode?: CronScheduleMode;
  payload: CronJobPayload;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'dhl_cron_jobs';

function parseField(field: string, min: number, max: number): number[] | null {
  const normalized = String(field || '').trim();
  if (!normalized || normalized === '*') return null;

  const values = new Set<number>();
  const parts = normalized.split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (/^\*\/\d+$/.test(part)) {
      const step = Number(part.split('/')[1]);
      if (!step || step < 1) return [];
      for (let i = min; i <= max; i += step) values.add(i);
      continue;
    }

    if (/^\d+$/.test(part)) {
      const num = Number(part);
      if (num < min || num > max) return [];
      values.add(num);
      continue;
    }

    if (/^\d+-\d+$/.test(part)) {
      const [start, end] = part.split('-').map(Number);
      if (start < min || end > max || end < start) return [];
      for (let i = start; i <= end; i++) values.add(i);
      continue;
    }

    return [];
  }

  return Array.from(values);
}

export function isValidCronExpression(expression: string): boolean {
  const fields = String(expression || '').trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  return (
    parseField(minute, 0, 59) !== undefined &&
    parseField(hour, 0, 23) !== undefined &&
    parseField(dayOfMonth, 1, 31) !== undefined &&
    parseField(month, 1, 12) !== undefined &&
    parseField(dayOfWeek, 0, 6) !== undefined
  );
}

export function matchesCronExpression(expression: string, date: Date): boolean {
  const fields = String(expression || '').trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const minuteSet = parseField(minute, 0, 59);
  const hourSet = parseField(hour, 0, 23);
  const domSet = parseField(dayOfMonth, 1, 31);
  const monthSet = parseField(month, 1, 12);
  const dowSet = parseField(dayOfWeek, 0, 6);

  if (minuteSet && !minuteSet.includes(date.getMinutes())) return false;
  if (hourSet && !hourSet.includes(date.getHours())) return false;
  if (domSet && !domSet.includes(date.getDate())) return false;
  if (monthSet && !monthSet.includes(date.getMonth() + 1)) return false;
  if (dowSet && !dowSet.includes(date.getDay())) return false;

  return true;
}

export function computeNextRun(expression: string, from: Date = new Date()): string {
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  for (let i = 0; i < 60 * 24 * 365; i++) {
    if (matchesCronExpression(expression, cursor)) {
      return cursor.toISOString();
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return new Date(from.getTime() + 60 * 60 * 1000).toISOString();
}

export function loadCronJobs(): CronJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCronJobs(jobs: CronJob[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export function createCronJob(input: Omit<CronJob, 'id' | 'createdAt' | 'updatedAt' | 'nextRunAt'>): CronJob {
  const now = new Date().toISOString();
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    nextRunAt: computeNextRun(input.cronExpression)
  };
}

export function markCronJobExecuted(job: CronJob, at: Date = new Date()): CronJob {
  return {
    ...job,
    lastRunAt: at.toISOString(),
    updatedAt: at.toISOString(),
    nextRunAt: computeNextRun(job.cronExpression, at)
  };
}

export function getDueCronJobs(jobs: CronJob[], now: Date = new Date()): CronJob[] {
  const nowTs = now.getTime();
  return jobs.filter((job) => {
    if (!job.enabled) return false;
    if (!job.nextRunAt) return false;
    return new Date(job.nextRunAt).getTime() <= nowTs;
  });
}

export function buildDailyCronExpression(hour: number, minute: number, weekdaysOnly = false): string {
  const safeHour = Math.min(23, Math.max(0, Math.floor(hour || 0)));
  const safeMinute = Math.min(59, Math.max(0, Math.floor(minute || 0)));
  return `${safeMinute} ${safeHour} * * ${weekdaysOnly ? '1-5' : '*'}`;
}

export function buildIntervalCronExpression(intervalMinutes: number): string {
  const safeInterval = Math.max(15, Math.floor(intervalMinutes || 60));
  if (60 % safeInterval === 0 && safeInterval < 60) {
    return `*/${safeInterval} * * * *`;
  }

  if (safeInterval % 60 === 0) {
    const hours = Math.max(1, Math.floor(safeInterval / 60));
    return `0 */${hours} * * *`;
  }

  return `*/${safeInterval} * * * *`;
}
