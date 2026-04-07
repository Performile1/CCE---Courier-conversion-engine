/**
 * useCronFormState
 *
 * Headless hook that owns all cron-job *creation form* state and pure utilities.
 * Responsibilities:
 *   - 16 form field states (name, type, schedule, payload params)
 *   - resolvedCronExpression / isCronFormValid derived values
 *   - buildJobFromForm() — constructs a CronJob ready to be appended to cronJobs
 *   - toggleCronSegment() — multi-select helper for target segments
 *   - describeCronJobType() / parseCronLastError() — display utilities
 *
 * What does NOT live here:
 *   - cronJobs list (needs to stay where execution deps are wired)
 *   - useRemoteCronExecution / cronSyncError (depend on auth user)
 *   - Cron execution loop (depends on leads, handlers, etc.)
 */

import { useState } from 'react';
import {
  CronJob,
  CronScheduleMode,
  createCronJob,
  isValidCronExpression,
  buildDailyCronExpression,
  buildIntervalCronExpression,
} from '../services/cronJobService';
import { SearchFormData, Segment } from '../types';

export interface CronFormState {
  // Form fields
  cronName: string;
  setCronName: (v: string) => void;

  cronType: 'deep_dive' | 'batch_search' | 'lead_reanalysis';
  setCronType: (v: 'deep_dive' | 'batch_search' | 'lead_reanalysis') => void;

  cronScheduleMode: CronScheduleMode;
  setCronScheduleMode: (v: CronScheduleMode) => void;

  cronExpression: string;
  setCronExpression: (v: string) => void;

  cronRunHour: number;
  setCronRunHour: (v: number) => void;

  cronRunMinute: number;
  setCronRunMinute: (v: number) => void;

  cronWeekdaysOnly: boolean;
  setCronWeekdaysOnly: (v: boolean) => void;

  cronIntervalMinutes: number;
  setCronIntervalMinutes: (v: number) => void;

  cronCompany: string;
  setCronCompany: (v: string) => void;

  cronGeo: string;
  setCronGeo: (v: string) => void;

  cronFinancialScope: string;
  setCronFinancialScope: (v: string) => void;

  cronTriggers: string;
  setCronTriggers: (v: string) => void;

  cronLeadCount: number;
  setCronLeadCount: (v: number) => void;

  cronTargetSegments: Segment[];
  setCronTargetSegments: (v: Segment[]) => void;

  cronReanalysisScope: 'active' | 'cache' | 'both';
  setCronReanalysisScope: (v: 'active' | 'cache' | 'both') => void;

  cronReanalysisLimit: number;
  setCronReanalysisLimit: (v: number) => void;

  // Derived
  resolvedCronExpression: string;
  isCronFormValid: boolean;

  // Actions
  toggleCronSegment: (segment: Segment) => void;
  /** Returns the new CronJob if the form is valid, otherwise null. */
  buildJobFromForm: () => CronJob | null;

  // Pure display utilities
  describeCronJobType: (type: CronJob['type']) => string;
  parseCronLastError: (rawValue?: string) => { message: string; processingErrorCode: string; timestamp: string } | null;
}

export function useCronFormState(): CronFormState {
  const [cronName, setCronName] = useState('Ny schemalagd korning');
  const [cronType, setCronType] = useState<'deep_dive' | 'batch_search' | 'lead_reanalysis'>('deep_dive');
  const [cronScheduleMode, setCronScheduleMode] = useState<CronScheduleMode>('daily');
  const [cronExpression, setCronExpression] = useState('0 8 * * 1-5');
  const [cronRunHour, setCronRunHour] = useState(8);
  const [cronRunMinute, setCronRunMinute] = useState(0);
  const [cronWeekdaysOnly, setCronWeekdaysOnly] = useState(true);
  const [cronIntervalMinutes, setCronIntervalMinutes] = useState(1440);
  const [cronCompany, setCronCompany] = useState('');
  const [cronGeo, setCronGeo] = useState('Sverige');
  const [cronFinancialScope, setCronFinancialScope] = useState('10-100 MSEK');
  const [cronTriggers, setCronTriggers] = useState('E-handel, logistik, expansion');
  const [cronLeadCount, setCronLeadCount] = useState(20);
  const [cronTargetSegments, setCronTargetSegments] = useState<Segment[]>([]);
  const [cronReanalysisScope, setCronReanalysisScope] = useState<'active' | 'cache' | 'both'>('active');
  const [cronReanalysisLimit, setCronReanalysisLimit] = useState(10);

  const resolvedCronExpression: string = (() => {
    if (cronScheduleMode === 'daily') {
      return buildDailyCronExpression(cronRunHour, cronRunMinute, cronWeekdaysOnly);
    }
    if (cronScheduleMode === 'interval') {
      return buildIntervalCronExpression(cronIntervalMinutes);
    }
    return cronExpression.trim();
  })();

  const isCronFormValid = isValidCronExpression(resolvedCronExpression);

  const toggleCronSegment = (segment: Segment) => {
    setCronTargetSegments(prev =>
      prev.includes(segment) ? prev.filter(s => s !== segment) : [...prev, segment]
    );
  };

  const buildJobFromForm = (): CronJob | null => {
    if (!cronName.trim() || !isCronFormValid) return null;
    if (cronType === 'deep_dive' && !cronCompany.trim()) return null;

    const payload: SearchFormData = cronType === 'deep_dive'
      ? {
          companyNameOrOrg: cronCompany.trim(),
          geoArea: '',
          financialScope: '',
          triggers: '',
          leadCount: 1,
          focusRole1: 'VD',
          focusRole2: 'Logistikchef',
          focusRole3: 'E-handelschef',
          icebreakerTopic: 'Leveransoptimering',
        }
      : cronType === 'lead_reanalysis'
        ? {
            companyNameOrOrg: '',
            geoArea: '',
            financialScope: '',
            triggers: '',
            leadCount: 1,
            focusRole1: 'VD',
            focusRole2: 'Logistikchef',
            focusRole3: 'E-handelschef',
            icebreakerTopic: 'Leveransoptimering',
            targetSegments: cronTargetSegments,
            reanalysisScope: cronReanalysisScope,
            reanalysisLimit: cronReanalysisLimit,
          }
        : {
            companyNameOrOrg: '',
            geoArea: cronGeo,
            financialScope: cronFinancialScope,
            triggers: cronTriggers,
            leadCount: cronLeadCount,
            focusRole1: 'VD',
            focusRole2: 'Logistikchef',
            focusRole3: 'E-handelschef',
            icebreakerTopic: 'Leveransoptimering',
            targetSegments: cronTargetSegments,
          };

    return createCronJob({
      name: cronName.trim(),
      type: cronType,
      cronExpression: resolvedCronExpression,
      enabled: true,
      scheduleMode: cronScheduleMode,
      payload,
    });
  };

  const describeCronJobType = (type: CronJob['type']): string => {
    if (type === 'deep_dive') return 'Analys';
    if (type === 'lead_reanalysis') return 'Återanalys';
    return 'Batchsökning';
  };

  const parseCronLastError = (rawValue?: string) => {
    if (!rawValue) return null;
    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && typeof parsed === 'object') {
        return {
          message: String((parsed as any).message || rawValue),
          processingErrorCode: (parsed as any).processingErrorCode ? String((parsed as any).processingErrorCode) : '',
          timestamp: (parsed as any).timestamp ? String((parsed as any).timestamp) : '',
        };
      }
    } catch {
      // fall through
    }
    return { message: rawValue, processingErrorCode: '', timestamp: '' };
  };

  return {
    cronName, setCronName,
    cronType, setCronType,
    cronScheduleMode, setCronScheduleMode,
    cronExpression, setCronExpression,
    cronRunHour, setCronRunHour,
    cronRunMinute, setCronRunMinute,
    cronWeekdaysOnly, setCronWeekdaysOnly,
    cronIntervalMinutes, setCronIntervalMinutes,
    cronCompany, setCronCompany,
    cronGeo, setCronGeo,
    cronFinancialScope, setCronFinancialScope,
    cronTriggers, setCronTriggers,
    cronLeadCount, setCronLeadCount,
    cronTargetSegments, setCronTargetSegments,
    cronReanalysisScope, setCronReanalysisScope,
    cronReanalysisLimit, setCronReanalysisLimit,
    resolvedCronExpression,
    isCronFormValid,
    toggleCronSegment,
    buildJobFromForm,
    describeCronJobType,
    parseCronLastError,
  };
}
