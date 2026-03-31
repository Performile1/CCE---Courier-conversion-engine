/**
 * PHASE 7: SLACK INTEGRATION & NOTIFICATIONS
 * Send notifications to Slack on lead creation, campaign events, etc.
 */

import { supabase } from './supabaseClient';

export interface SlackIntegration {
  id: string;
  userId: string;
  workspaceName: string;
  webhookUrl: string;
  channel: string;
  notificationsEnabled: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Notification {
  type: 'lead_created' | 'lead_verified' | 'campaign_started' | 'campaign_completed' | 'crm_synced' | 'alert';
  title: string;
  message: string;
  data?: Record<string, any>;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

/**
 * Save Slack integration
 */
export async function saveSlackIntegration(
  userId: string,
  workspaceName: string,
  webhookUrl: string,
  channel: string = '#notifications'
): Promise<SlackIntegration> {
  const { data, error } = await supabase
    .from('slack_integrations')
    .insert({
      user_id: userId,
      workspace_name: workspaceName,
      webhook_url: webhookUrl,
      channel,
      notifications_enabled: true,
      status: 'active'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get Slack integration for user
 */
export async function getSlackIntegration(userId: string): Promise<SlackIntegration | null> {
  const { data, error } = await supabase
    .from('slack_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error) return null;
  return data;
}

/**
 * Send message to Slack
 */
export async function sendSlackNotification(
  webhookUrl: string,
  notification: Notification
): Promise<boolean> {
  try {
    const color = {
      info: '#36a64f',
      warning: '#ff9900',
      error: '#ff0000',
      success: '#36a64f'
    }[notification.severity || 'info'];

    const payload = {
      attachments: [
        {
          color,
          title: notification.title,
          text: notification.message,
          ts: Math.floor(Date.now() / 1000),
          fields: Object.entries(notification.data || {}).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true
          }))
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.ok;

  } catch (error) {
    console.error('Slack notification error:', error);
    return false;
  }
}

/**
 * Format lead created notification
 */
export function formatLeadCreatedNotification(lead: any): Notification {
  return {
    type: 'lead_created',
    title: '🎯 New Lead Created',
    message: `${lead.companyName} has been analyzed and added to your leads.`,
    severity: 'success',
    data: {
      Company: lead.companyName,
      'Hallucination Score': `${lead.halluccinationScore}%`,
      'Potential': lead.freightBudget,
      'AI Model': lead.aiModel
    }
  };
}

/**
 * Format high hallucination alert
 */
export function formatHallucinationAlert(lead: any): Notification | null {
  if ((lead.halluccinationScore || 0) > 70) {
    return {
      type: 'alert',
      title: '⚠️ High Hallucination Score',
      message: `${lead.companyName} has a hallucination score of ${lead.halluccinationScore}%. Manual verification recommended.`,
      severity: 'warning',
      data: {
        Company: lead.companyName,
        'Score': `${lead.halluccinationScore}%`,
        'Action': 'Manual review required'
      }
    };
  }
  return null;
}

/**
 * Format campaign started notification
 */
export function formatCampaignStarted(campaign: any): Notification {
  return {
    type: 'campaign_started',
    title: '📧 Campaign Launched',
    message: `Campaign "${campaign.name}" has been sent to ${campaign.sent_count} recipients.`,
    severity: 'info',
    data: {
      Campaign: campaign.name,
      Recipients: campaign.sent_count,
      Status: campaign.status
    }
  };
}

/**
 * Format campaign completed notification
 */
export function formatCampaignCompleted(campaign: any): Notification {
  const openRate = campaign.sent_count ? ((campaign.open_count / campaign.sent_count) * 100).toFixed(2) : '0';
  const clickRate = campaign.sent_count ? ((campaign.click_count / campaign.sent_count) * 100).toFixed(2) : '0';

  return {
    type: 'campaign_completed',
    title: '📊 Campaign Completed',
    message: `Campaign "${campaign.name}" completed with ${openRate}% open rate and ${clickRate}% click rate.`,
    severity: 'success',
    data: {
      Campaign: campaign.name,
      Sent: campaign.sent_count,
      Opens: `${campaign.open_count} (${openRate}%)`,
      Clicks: `${campaign.click_count} (${clickRate}%)`
    }
  };
}

/**
 * Format CRM sync notification
 */
export function formatCRMSynced(crmType: string, leadsCount: number): Notification {
  return {
    type: 'crm_synced',
    title: '🔗 CRM Sync Complete',
    message: `Successfully synced ${leadsCount} leads to ${crmType}.`,
    severity: 'success',
    data: {
      'CRM': crmType,
      'Leads Synced': leadsCount,
      'Timestamp': new Date().toLocaleString()
    }
  };
}

/**
 * Notify user
 */
export async function notifyUser(
  userId: string,
  notification: Notification,
  useSlack: boolean = true,
  useBrowser: boolean = true
): Promise<void> {
  try {
    if (useSlack) {
      const integration = await getSlackIntegration(userId);
      if (integration?.notificationsEnabled) {
        await sendSlackNotification(integration.webhookUrl, notification);
      }
    }

    if (useBrowser) {
      // Browser notification would be sent via WebSocket or polling
      // For now, just store in database
      console.log('Browser notification:', notification);
    }
  } catch (error) {
    console.error('Notification error:', error);
  }
}

/**
 * Send batch notifications
 */
export async function sendBatchNotifications(
  userId: string,
  notifications: Notification[]
): Promise<void> {
  for (const notification of notifications) {
    await notifyUser(userId, notification);
  }
}

/**
 * Disable Slack integration
 */
export async function disableSlackIntegration(userId: string): Promise<void> {
  const { error } = await supabase
    .from('slack_integrations')
    .update({ status: 'inactive' })
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Delete Slack integration
 */
export async function deleteSlackIntegration(userId: string): Promise<void> {
  const { error } = await supabase
    .from('slack_integrations')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}
