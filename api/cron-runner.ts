import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateDeepDiveSequential, generateLeads } from '../services/openrouterService.js';
import { computeNextRun } from '../services/cronJobService.js';
import type { CronJob } from '../services/cronJobService.js';
import type { AnalysisPolicy, LeadData, SearchFormData, SourcePolicyConfig } from '../types.js';
import { buildAnalysisPolicyFromSourcePolicyConfig } from '../services/analysisPolicy.js';
import { DEFAULT_TECH_SOLUTION_CONFIG, normalizeTechSolutionConfig } from '../services/techSolutionConfig.js';
import { createAdminClient, rowToJob, setCors } from './_scheduledJobs.js';

function isAuthorized(req: VercelRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return true;
  const authHeader = req.headers.authorization || '';
  return authHeader === `Bearer ${configuredSecret}`;
}

function getDefaultSearchForm(companyNameOrOrg = '', overrides: Partial<SearchFormData> = {}): SearchFormData {
  return {
    companyNameOrOrg,
    geoArea: overrides.geoArea || 'Global',
    financialScope: overrides.financialScope || '10-100 MSEK',
    triggers: overrides.triggers || 'E-handel, logistik, expansion',
    leadCount: Number(overrides.leadCount || 20),
    focusRole1: overrides.focusRole1 || 'VD',
    focusRole2: overrides.focusRole2 || 'Logistikchef',
    focusRole3: overrides.focusRole3 || 'E-handelschef',
    icebreakerTopic: overrides.icebreakerTopic || 'Leveransoptimering'
  };
}

function getScheduledSourceCountry(job: CronJob): string {
  const payload = job.payload as Record<string, unknown>;
  return String(payload.activeSourceCountry || payload.sourceCountry || 'global').trim().toLowerCase() || 'global';
}

function extractStructuredErrorCode(error: any): string | null {
  return error?.processingErrorCode || error?.code || null;
}

function formatStructuredJobError(error: any): string {
  return JSON.stringify({
    message: error?.message || 'Job failed',
    processingErrorCode: extractStructuredErrorCode(error),
    timestamp: new Date().toISOString()
  });
}

async function persistDecisionMakers(adminClient: any, leadId: string, lead: LeadData) {
  await adminClient.from('decision_makers').delete().eq('lead_id', leadId);

  const contacts = (lead.decisionMakers || []).filter((contact) => contact?.name);
  if (!contacts.length) return;

  await adminClient.from('decision_makers').insert(
    contacts.map((contact) => ({
      lead_id: leadId,
      name: contact.name,
      title: contact.title || null,
      email: contact.email || null,
      linkedin: contact.linkedin || null,
      direct_phone: contact.directPhone || null,
      verification_note: contact.verificationNote || null
    }))
  );
}

async function persistAnalysisHistory(adminClient: any, userId: string, analysisType: string, companyName: string, lead: LeadData) {
  await adminClient.from('analysis_history').insert({
    user_id: userId,
    analysis_type: analysisType,
    company_name: companyName,
    model_used: lead.aiModel || null,
    success: lead.processingStatus !== 'failed',
    result_summary: `${lead.companyName} • ${lead.segment || 'UNKNOWN'} • ${lead.revenue || 'utan omsättning'}${lead.processingStatus ? ` • ${lead.processingStatus}` : ''}`,
    raw_analysis: lead,
    created_at: new Date().toISOString()
  });
}

async function loadSharedExclusionValues(adminClient: any) {
  const { data, error } = await adminClient
    .from('shared_exclusions')
    .select('value');

  if (error) throw error;
  return (data || []).map((row: any) => row.value).filter(Boolean);
}

async function loadTechSolutionConfig(adminClient: any) {
  const { data, error } = await adminClient
    .from('app_shared_settings')
    .select('value')
    .eq('setting_key', 'tech_solutions')
    .maybeSingle();

  if (error) throw error;

  return normalizeTechSolutionConfig(data?.value || DEFAULT_TECH_SOLUTION_CONFIG);
}

async function loadSourcePolicies(adminClient: any): Promise<SourcePolicyConfig | undefined> {
  const { data, error } = await adminClient
    .from('app_shared_settings')
    .select('value')
    .eq('setting_key', 'source_configuration')
    .maybeSingle();

  if (error) throw error;

  return data?.value || undefined;
}

async function upsertLead(adminClient: any, userId: string, lead: LeadData, existingLeadId?: string, bucket: 'active' | 'reservoir' = 'active') {
  let leadId = existingLeadId;

  if (!leadId) {
    let query = adminClient.from('leads').select('id').eq('user_id', userId).limit(1);
    if (lead.orgNumber) {
      query = query.eq('org_number', lead.orgNumber);
    } else {
      query = query.eq('company_name', lead.companyName);
    }

    const { data: existing } = await query.maybeSingle();
    leadId = existing?.id;
  }

  const row = {
    id: leadId || lead.id,
    user_id: userId,
    company_name: lead.companyName,
    org_number: lead.orgNumber || null,
    domain: lead.domain || null,
    website_url: lead.websiteUrl || null,
    sni_code: lead.sniCode || null,
    industry: lead.industry || null,
    revenue: lead.revenue || null,
    revenue_year: lead.revenueYear || null,
    profit: lead.profit || null,
    segment: lead.segment || null,
    ecommerce_platform: lead.ecommercePlatform || null,
    payment_provider: lead.paymentProvider || null,
    carriers: lead.carriers || null,
    potential_sek: lead.potentialSek || null,
    freight_budget: lead.freightBudget || null,
    annual_packages: lead.annualPackages || null,
    analysis_model: lead.aiModel || null,
    hallucination_score: lead.halluccinationScore || 0,
    hallucination_details: lead.halluccinationAnalysis || null,
    lead_bucket: bucket,
    lead_payload: lead,
    status: 'pending',
    source: lead.source || 'scheduled-job',
    analysis_date: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await adminClient.from('leads').upsert(row, { onConflict: 'id' }).select('id').single();
  if (error) throw error;

  await persistDecisionMakers(adminClient, data.id, lead);
  return data.id as string;
}

async function executeDeepDiveJob(adminClient: any, userId: string, job: CronJob) {
  const query = String(job.payload.companyNameOrOrg || '').trim();
  if (!query) throw new Error('Deep dive job missing companyNameOrOrg');

  const [techSolutionConfig, sourcePolicies] = await Promise.all([
    loadTechSolutionConfig(adminClient),
    loadSourcePolicies(adminClient)
  ]);
  const activeSourceCountry = getScheduledSourceCountry(job);
  const analysisPolicy: AnalysisPolicy = buildAnalysisPolicyFromSourcePolicyConfig(sourcePolicies, activeSourceCountry);

  const lead = await generateDeepDiveSequential(
    getDefaultSearchForm(query, {
      geoArea: String(job.payload.geoArea || activeSourceCountry || 'Global'),
      financialScope: String(job.payload.financialScope || '10-100 MSEK'),
      triggers: String(job.payload.triggers || 'E-handel, logistik, expansion'),
      focusRole1: String(job.payload.focusRole1 || 'VD'),
      focusRole2: String(job.payload.focusRole2 || 'Logistikchef'),
      focusRole3: String(job.payload.focusRole3 || 'E-handelschef'),
      icebreakerTopic: String(job.payload.icebreakerTopic || 'Leveransoptimering')
    }),
    () => {},
    () => {},
    [],
    [],
    [],
    'DHL',
    [],
    undefined,
    sourcePolicies,
    activeSourceCountry,
    techSolutionConfig,
    analysisPolicy
  );

  await upsertLead(adminClient, userId, lead);
  await persistAnalysisHistory(adminClient, userId, 'deep_scan', query, lead);
  return `Deep dive klar för ${lead.companyName}`;
}

async function executeBatchJob(adminClient: any, userId: string, job: CronJob) {
  const [{ data: existingLeads }, sharedExclusions, techSolutionConfig, sourcePolicies] = await Promise.all([
    adminClient
      .from('leads')
      .select('company_name, org_number')
      .eq('user_id', userId),
    loadSharedExclusionValues(adminClient),
    loadTechSolutionConfig(adminClient),
    loadSourcePolicies(adminClient)
  ]);
  const activeSourceCountry = getScheduledSourceCountry(job);
  const analysisPolicy: AnalysisPolicy = buildAnalysisPolicyFromSourcePolicyConfig(sourcePolicies, activeSourceCountry);

  const exclusionList = [
    ...(existingLeads || []).flatMap((row: any) => [row.company_name, row.org_number]).filter(Boolean),
    ...sharedExclusions
  ];
  const leads = await generateLeads(
    getDefaultSearchForm('', {
      geoArea: String(job.payload.geoArea || activeSourceCountry || 'Global'),
      financialScope: String(job.payload.financialScope || '10-100 MSEK'),
      triggers: String(job.payload.triggers || 'E-handel, logistik, expansion'),
      leadCount: Number(job.payload.leadCount || 20),
      focusRole1: String(job.payload.focusRole1 || 'VD'),
      focusRole2: String(job.payload.focusRole2 || 'Logistikchef'),
      focusRole3: String(job.payload.focusRole3 || 'E-handelschef'),
      icebreakerTopic: String(job.payload.icebreakerTopic || 'Leveransoptimering'),
      targetSegments: job.payload.targetSegments
    }),
    () => {},
    [],
    exclusionList,
    'DHL',
    [],
    undefined,
    sourcePolicies,
    activeSourceCountry,
    techSolutionConfig,
    analysisPolicy
  );

  for (const lead of leads) {
    await upsertLead(adminClient, userId, lead);
    await persistAnalysisHistory(adminClient, userId, 'batch', lead.companyName, lead);
  }

  const failedCount = leads.filter((lead) => lead.processingStatus === 'failed').length;
  const partialCount = leads.filter((lead) => lead.processingStatus === 'partial').length;
  return `Batch klar: ${leads.length} leads${failedCount ? `, ${failedCount} failed` : ''}${partialCount ? `, ${partialCount} partial` : ''}`;
}

async function executeReanalysisJob(adminClient: any, userId: string, job: CronJob) {
  const scope = job.payload.reanalysisScope || 'active';
  const segments = job.payload.targetSegments || [];
  const limit = Math.max(1, Number(job.payload.reanalysisLimit || 10));
  const buckets = scope === 'both' ? ['active', 'reservoir'] : [scope === 'cache' ? 'reservoir' : 'active'];

  let query = adminClient
    .from('leads')
    .select('id, company_name, org_number, segment, analysis_date, lead_bucket')
    .eq('user_id', userId)
    .in('lead_bucket', buckets)
    .order('analysis_date', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (segments.length > 0) {
    query = query.in('segment', segments);
  }

  const { data: candidates, error } = await query;
  if (error) throw error;

  const [techSolutionConfig, sourcePolicies] = await Promise.all([
    loadTechSolutionConfig(adminClient),
    loadSourcePolicies(adminClient)
  ]);
  const activeSourceCountry = getScheduledSourceCountry(job);
  const analysisPolicy: AnalysisPolicy = buildAnalysisPolicyFromSourcePolicyConfig(sourcePolicies, activeSourceCountry);

  let processed = 0;
  for (const candidate of candidates || []) {
    const queryValue = String(candidate.org_number || candidate.company_name || '').trim();
    if (!queryValue) continue;

    const lead = await generateDeepDiveSequential(
      getDefaultSearchForm(queryValue, {
        geoArea: String(job.payload.geoArea || activeSourceCountry || 'Global'),
        financialScope: String(job.payload.financialScope || '10-100 MSEK'),
        triggers: String(job.payload.triggers || 'E-handel, logistik, expansion'),
        focusRole1: String(job.payload.focusRole1 || 'VD'),
        focusRole2: String(job.payload.focusRole2 || 'Logistikchef'),
        focusRole3: String(job.payload.focusRole3 || 'E-handelschef'),
        icebreakerTopic: String(job.payload.icebreakerTopic || 'Leveransoptimering')
      }),
      () => {},
      () => {},
      [],
      [],
      [],
      'DHL',
      [],
      undefined,
      sourcePolicies,
      activeSourceCountry,
      techSolutionConfig,
      analysisPolicy
    );

    await upsertLead(
      adminClient,
      userId,
      { ...lead, id: candidate.id, source: candidate.lead_bucket === 'reservoir' ? 'cache' : lead.source },
      candidate.id,
      candidate.lead_bucket === 'reservoir' ? 'reservoir' : 'active'
    );
    await persistAnalysisHistory(adminClient, userId, 'deep_scan', lead.companyName, lead);
    processed += 1;
  }

  return `Återanalys klar: ${processed} leads`;
}

async function executeJob(adminClient: any, job: CronJob) {
  if (job.type === 'deep_dive') {
    return executeDeepDiveJob(adminClient, (job as any).user_id, job);
  }
  if (job.type === 'lead_reanalysis') {
    return executeReanalysisJob(adminClient, (job as any).user_id, job);
  }
  return executeBatchJob(adminClient, (job as any).user_id, job);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized cron invocation' });
    return;
  }

  try {
    const adminClient = createAdminClient();
    const nowIso = new Date().toISOString();
    const { data: dueRows, error } = await adminClient
      .from('scheduled_jobs')
      .select('*')
      .eq('enabled', true)
      .lte('next_run_at', nowIso)
      .order('next_run_at', { ascending: true })
      .limit(10);
    if (error) throw error;

    const jobs = (dueRows || []).map((row: any) => ({ ...rowToJob(row), user_id: row.user_id }));
    const results: Array<{ id: string; status: string; summary?: string; error?: string }> = [];

    for (const job of jobs) {
      // Optimistic lock: atomically claim the job only if it has not already
      // been picked up by a concurrent invocation.
      //
      // The WHERE clause requires that the row is still in a "claimable" state:
      //   - last_status is NOT 'running', OR
      //   - it IS 'running' but was last updated more than 10 minutes ago,
      //     which means a previous invocation crashed without finishing and the
      //     lock has expired.
      //
      // Supabase returns the number of updated rows via `count`.
      // If count === 0, another instance already claimed this job — skip it.
      const claimTs = new Date().toISOString();
      const staleLockCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { count: claimedCount, error: claimError } = await adminClient
        .from('scheduled_jobs')
        .update({ last_status: 'running', updated_at: claimTs, last_error: null }, { count: 'exact' })
        .eq('id', job.id)
        .or(`last_status.neq.running,updated_at.lt.${staleLockCutoff}`);

      if (claimError) {
        results.push({ id: job.id, status: 'skipped', error: `Lock claim failed: ${claimError.message}` });
        continue;
      }

      if ((claimedCount ?? 0) === 0) {
        // Another concurrent invocation already claimed this job.
        results.push({ id: job.id, status: 'skipped', summary: 'Already claimed by another invocation' });
        continue;
      }

      try {
        const summary = await executeJob(adminClient, job as CronJob);
        await adminClient
          .from('scheduled_jobs')
          .update({
            last_run_at: nowIso,
            next_run_at: computeNextRun(job.cronExpression, new Date()).toString(),
            last_status: 'success',
            last_result_summary: summary,
            last_error: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
        results.push({ id: job.id, status: 'success', summary });
      } catch (jobError: any) {
        const structuredError = formatStructuredJobError(jobError);
        await adminClient
          .from('scheduled_jobs')
          .update({
            last_run_at: nowIso,
            next_run_at: computeNextRun(job.cronExpression, new Date()).toString(),
            last_status: 'error',
            last_error: structuredError,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
        results.push({ id: job.id, status: 'error', error: structuredError });
      }
    }

    res.status(200).json({ processed: results.length, results });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}