/**
 * PHASE 7: EMAIL CAMPAIGN SERVICE
 * Create, manage, and track email campaigns
 */

import { supabase } from './supabaseClient';
import { v4 as uuidv4 } from 'crypto';

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  description?: string;
  templateId?: string;
  leadCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  status: 'draft' | 'scheduled' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  leadId?: string;
  email: string;
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'bounced';
  openedAt?: string;
  clickedAt?: string;
}

/**
 * Create a new campaign
 */
export async function createCampaign(
  userId: string,
  name: string,
  description?: string,
  templateId?: string
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      user_id: userId,
      name,
      description,
      template_id: templateId,
      status: 'draft',
      lead_count: 0,
      sent_count: 0,
      open_count: 0,
      click_count: 0
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Add leads to campaign
 */
export async function addLeadsToCampaign(
  campaignId: string,
  leads: Array<{ leadId?: string; email: string }>
): Promise<CampaignRecipient[]> {
  const recipients = leads.map(lead => ({
    id: uuidv4(),
    campaign_id: campaignId,
    lead_id: lead.leadId,
    email: lead.email,
    status: 'pending'
  }));

  const { data, error } = await supabase
    .from('campaign_recipients')
    .insert(recipients)
    .select();

  if (error) throw error;

  // Update campaign lead count
  await supabase
    .from('campaigns')
    .update({ lead_count: leads.length })
    .eq('id', campaignId);

  return data;
}

/**
 * Send campaign (simulated via email service)
 */
export async function sendCampaign(
  campaignId: string,
  emailContent: string,
  subject: string,
  onProgress?: (message: string) => void
): Promise<number> {
  // Get campaign recipients
  const { data: recipients, error: fetchError } = await supabase
    .from('campaign_recipients')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');

  if (fetchError) throw fetchError;
  if (!recipients || recipients.length === 0) return 0;

  let sentCount = 0;

  // In production, integrate with SendGrid, Mailgun, etc.
  for (const recipient of recipients) {
    try {
      onProgress?.(`Sending to ${recipient.email}...`);

      // Call email service via Vercel Function
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient.email,
          subject,
          html: emailContent,
          campaignId,
          recipientId: recipient.id,
          trackingPixel: `${process.env.REACT_APP_BASE_URL}/track/open/${recipient.id}`,
          clickTrackingDomain: process.env.REACT_APP_BASE_URL
        })
      });

      if (response.ok) {
        sentCount++;

        // Update recipient status
        await supabase
          .from('campaign_recipients')
          .update({ status: 'sent' })
          .eq('id', recipient.id);
      }
    } catch (error) {
      console.error(`Error sending to ${recipient.email}:`, error);
    }
  }

  // Update campaign status
  await supabase
    .from('campaigns')
    .update({
      status: 'active',
      sent_count: sentCount
    })
    .eq('id', campaignId);

  return sentCount;
}

/**
 * Track email open
 */
export async function trackEmailOpen(recipientId: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_recipients')
    .update({
      status: 'opened',
      opened_at: new Date().toISOString()
    })
    .eq('id', recipientId);

  if (error) throw error;

  // Increment campaign open count
  const { data: recipient } = await supabase
    .from('campaign_recipients')
    .select('campaign_id')
    .eq('id', recipientId)
    .single();

  if (recipient) {
    await supabase
      .from('campaigns')
      .update({ open_count: supabase.rpc('increment', { row_id: recipient.campaign_id }) })
      .eq('id', recipient.campaign_id);
  }
}

/**
 * Track link click
 */
export async function trackLinkClick(recipientId: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_recipients')
    .update({
      status: 'clicked',
      clicked_at: new Date().toISOString()
    })
    .eq('id', recipientId);

  if (error) throw error;

  // Increment campaign click count
  const { data: recipient } = await supabase
    .from('campaign_recipients')
    .select('campaign_id')
    .eq('id', recipientId)
    .single();

  if (recipient) {
    await supabase
      .from('campaigns')
      .update({ click_count: supabase.rpc('increment', { row_id: recipient.campaign_id }) })
      .eq('id', recipient.campaign_id);
  }
}

/**
 * Get campaign analytics
 */
export async function getCampaignAnalytics(campaignId: string): Promise<any> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) return null;

  const { data: recipients } = await supabase
    .from('campaign_recipients')
    .select('status')
    .eq('campaign_id', campaignId);

  const stats = {
    campaign,
    totalRecipients: recipients?.length || 0,
    sentCount: campaign.sent_count || 0,
    openCount: campaign.open_count || 0,
    clickCount: campaign.click_count || 0,
    openRate: campaign.sent_count ? ((campaign.open_count || 0) / campaign.sent_count * 100).toFixed(2) : '0',
    clickRate: campaign.sent_count ? ((campaign.click_count || 0) / campaign.sent_count * 100).toFixed(2) : '0',
    recipientsByStatus: {
      pending: recipients?.filter(r => r.status === 'pending').length || 0,
      sent: recipients?.filter(r => r.status === 'sent').length || 0,
      opened: recipients?.filter(r => r.status === 'opened').length || 0,
      clicked: recipients?.filter(r => r.status === 'clicked').length || 0,
      bounced: recipients?.filter(r => r.status === 'bounced').length || 0
    }
  };

  return stats;
}

/**
 * Create email template
 */
export async function createEmailTemplate(
  userId: string,
  name: string,
  subject: string,
  htmlContent: string,
  isDefault: boolean = false
): Promise<any> {
  // Store in a templates table (not included in schema, will need to be added)
  return {
    id: uuidv4(),
    userId,
    name,
    subject,
    htmlContent,
    isDefault,
    createdAt: new Date().toISOString()
  };
}

/**
 * Get recipient email status
 */
export async function getRecipientStatus(recipientId: string): Promise<CampaignRecipient | null> {
  const { data, error } = await supabase
    .from('campaign_recipients')
    .select('*')
    .eq('id', recipientId)
    .single();

  if (error) return null;
  return data;
}
