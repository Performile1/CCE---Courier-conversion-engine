import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateDeepDiveSequential, generateLeads } from '../services/openrouterService';
import { computeNextRun, CronJob } from '../services/cronJobService';
import { LeadData, SearchFormData } from '../types';
import { createAdminClient, rowToJob, setCors } from './_scheduledJobs';

function isAuthorized(req: VercelRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return true;
  const authHeader = req.headers.authorization || '';
  return authHeader === `Bearer ${configuredSecret}`;
}

function getDefaultSearchForm(companyNameOrOrg = ''): SearchFormData {
  return {
    companyNameOrOrg,
    geoArea: 'Sverige',
    financialScope: '10-100 MSEK',
    triggers: 'E-handel, logistik, expansion',
    leadCount: 20,
    focusRole1: 'VD',
    focusRole2: 'Logistikchef',
    focusRole3: 'E-handelschef',
    icebreakerTopic: 'Leveransoptimering'
  };
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
    success: true,
    result_summary: `${lead.companyName} • ${lead.segment || 'UNKNOWN'} • ${lead.revenue || 'utan omsättning'}`,
    raw_analysis: lead,
    created_at: new Date().toISOString()
  });
}

async function upsertLead(adminClient: any, userId: string, lead: LeadData, existingLeadId?: string) {
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
    freight_budget: lead.freightBudget || null,
    annual_packages: lead.annualPackages || null,
    ai_model: lead.aiModel || null,
    hallucination_score: lead.halluccinationScore || 0,
    hallucination_analysis: lead.halluccinationAnalysis || null,
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

  const lead = await generateDeepDiveSequential(
    getDefaultSearchForm(query),
    () => {},
    () => {},
    [],
    [],
    [],
    'DHL',
    [],
    undefined,
    undefined,
    'global'
  );

  await upsertLead(adminClient, userId, lead);
  await persistAnalysisHistory(adminClient, userId, 'deep_scan', query, lead);
  return `Deep dive klar för ${lead.companyName}`;
}

async function executeBatchJob(adminClient: any, userId: string, job: CronJob) {
  const { data: existingLeads } = await adminClient
    .from('leads')
    .select('company_name, org_number')
    .eq('user_id', userId);

  const exclusionList = (existingLeads || []).flatMap((row: any) => [row.company_name, row.org_number]).filter(Boolean);
  const leads = await generateLeads(
    {
      ...getDefaultSearchForm(''),
      geoArea: String(job.payload.geoArea || 'Sverige'),
      financialScope: String(job.payload.financialScope || '10-100 MSEK'),
      triggers: String(job.payload.triggers || 'E-handel, logistik, expansion'),
      leadCount: Number(job.payload.leadCount || 20),
      targetSegments: job.payload.targetSegments
    },
    () => {},
    [],
    exclusionList,
    'DHL',
    [],
    undefined,
    undefined,
    'global'
  );

  for (const lead of leads) {
    await upsertLead(adminClient, userId, lead);
    await persistAnalysisHistory(adminClient, userId, 'batch', lead.companyName, lead);
  }

  return `Batch klar: ${leads.length} leads`;
}

async function executeReanalysisJob(adminClient: any, userId: string, job: CronJob) {
  const scope = job.payload.reanalysisScope || 'active';
  if (scope === 'cache') {
    throw new Error('Backend återanalys når inte lokal reservoar. Synka leads till Supabase eller använd aktiva leads.');
  }

  const segments = job.payload.targetSegments || [];
  const limit = Math.max(1, Number(job.payload.reanalysisLimit || 10));

  let query = adminClient
    .from('leads')
    .select('id, company_name, org_number, segment, analysis_date')
    .eq('user_id', userId)
    .order('analysis_date', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (segments.length > 0) {
    query = query.in('segment', segments);
  }

  const { data: candidates, error } = await query;
  if (error) throw error;

  let processed = 0;
  for (const candidate of candidates || []) {
    const queryValue = String(candidate.org_number || candidate.company_name || '').trim();
    if (!queryValue) continue;

    const lead = await generateDeepDiveSequential(
      getDefaultSearchForm(queryValue),
      () => {},
      () => {},
      [],
      [],
      [],
      'DHL',
      [],
      undefined,
      undefined,
      'global'
    );

    await upsertLead(adminClient, userId, { ...lead, id: candidate.id });
    await persistAnalysisHistory(adminClient, userId, 'deep_scan', lead.companyName, lead);
    processed += 1;
  }

  return `Återanalys klar: ${processed} leads${scope === 'both' ? ' (lokal reservoar ingår inte i backendläge)' : ''}`;
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
      await adminClient
        .from('scheduled_jobs')
        .update({ last_status: 'running', updated_at: new Date().toISOString(), last_error: null })
        .eq('id', job.id);

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
        await adminClient
          .from('scheduled_jobs')
          .update({
            last_run_at: nowIso,
            next_run_at: computeNextRun(job.cronExpression, new Date()).toString(),
            last_status: 'error',
            last_error: jobError?.message || 'Job failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
        results.push({ id: job.id, status: 'error', error: jobError?.message || 'Job failed' });
      }
    }

    res.status(200).json({ processed: results.length, results });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}