import { supabase } from './supabaseClient';

export interface WebhookEvent {
  event: string;
  timestamp: string;
  userId: string;
  data: Record<string, any>;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

class WebhookService {
  private eventQueue: WebhookEvent[] = [];
  private processing = false;

  /**
   * Register a webhook to fire on specific events
   */
  async registerWebhook(
    userId: string,
    url: string,
    events: string[]
  ): Promise<{ id: string; createdAt: string }> {
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .insert({
          user_id: userId,
          url,
          events,
          active: true,
        })
        .select('id, created_at')
        .single();

      if (error) throw error;

      return {
        id: data.id,
        createdAt: data.created_at,
      };
    } catch (err) {
      console.error('Error registering webhook:', err);
      throw err;
    }
  }

  /**
   * Fire an event to all subscribed webhooks
   */
  async fireEvent(
    userId: string,
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    const event: WebhookEvent = {
      event: eventType,
      timestamp: new Date().toISOString(),
      userId,
      data,
    };

    // Add to queue
    this.eventQueue.push(event);

    // Process if not already processing
    if (!this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Process the event queue and deliver to webhooks
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          await this.deliverEvent(event);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Deliver event to subscribed webhooks
   */
  private async deliverEvent(event: WebhookEvent): Promise<void> {
    try {
      // Get all active webhooks for this user that subscribe to this event
      const { data: webhooks, error } = await supabase
        .from('webhooks')
        .select('id, url, events')
        .eq('user_id', event.userId)
        .eq('active', true);

      if (error) throw error;

      if (!webhooks) return;

      // Filter webhooks that subscribe to this event
      const targetWebhooks = webhooks.filter((webhook) =>
        webhook.events.includes(event.event) || webhook.events.includes('*')
      );

      // Send to each webhook
      const promises = targetWebhooks.map((webhook) =>
        this.sendToWebhook(webhook.id, webhook.url, event)
      );

      await Promise.allSettled(promises);
    } catch (err) {
      console.error('Error delivering event:', err);
    }
  }

  /**
   * Send event to a specific webhook URL
   */
  private async sendToWebhook(
    webhookId: string,
    url: string,
    event: WebhookEvent
  ): Promise<void> {
    const payload: WebhookPayload = {
      event: event.event,
      timestamp: event.timestamp,
      data: event.data,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CCE-Signature': this.generateSignature(JSON.stringify(payload)),
        },
        body: JSON.stringify(payload),
      });

      // Log delivery
      await this.logDelivery(webhookId, response.status, response.statusText);

      if (!response.ok) {
        console.warn(`Webhook delivery failed: ${response.statusText}`);
      }
    } catch (err: any) {
      console.error('Error sending to webhook:', err);
      await this.logDelivery(webhookId, 0, err.message);
    }
  }

  /**
   * Log webhook delivery attempt
   */
  private async logDelivery(
    webhookId: string,
    statusCode: number,
    statusText: string
  ): Promise<void> {
    try {
      await supabase.from('webhook_logs').insert({
        webhook_id: webhookId,
        status_code: statusCode,
        status_text: statusText,
        delivered_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error logging webhook delivery:', err);
    }
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(payload: string): string {
    // In production, use actual HMAC-SHA256
    // Example: crypto.createHmac('sha256', secret).update(payload).digest('hex')
    return Buffer.from(payload).toString('base64').substring(0, 32);
  }

  /**
   * Get webhook logs
   */
  async getWebhookLogs(
    webhookId: string,
    limit: number = 50
  ): Promise<Array<{ id: string; statusCode: number; statusText: string; deliveredAt: string }>> {
    try {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('id, status_code, status_text, delivered_at')
        .eq('webhook_id', webhookId)
        .order('delivered_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map((log) => ({
        id: log.id,
        statusCode: log.status_code,
        statusText: log.status_text,
        deliveredAt: log.delivered_at,
      }));
    } catch (err) {
      console.error('Error getting webhook logs:', err);
      return [];
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookId);

      if (error) throw error;
    } catch (err) {
      console.error('Error deleting webhook:', err);
      throw err;
    }
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string, url: string): Promise<boolean> {
    const testPayload: WebhookPayload = {
      event: 'test.webhook',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from CCE Platform',
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CCE-Signature': this.generateSignature(JSON.stringify(testPayload)),
        },
        body: JSON.stringify(testPayload),
      });

      await this.logDelivery(webhookId, response.status, `Test: ${response.statusText}`);

      return response.ok;
    } catch (err) {
      console.error('Error testing webhook:', err);
      return false;
    }
  }
}

// Event triggers for various activities
export const triggerEvents = {
  /**
   * Lead was created
   */
  leadCreated: (userId: string, leadData: any) => {
    return webhookService.fireEvent(userId, 'lead.created', leadData);
  },

  /**
   * Lead was updated
   */
  leadUpdated: (userId: string, leadData: any) => {
    return webhookService.fireEvent(userId, 'lead.updated', leadData);
  },

  /**
   * Lead was deleted
   */
  leadDeleted: (userId: string, leadId: string) => {
    return webhookService.fireEvent(userId, 'lead.deleted', { leadId });
  },

  /**
   * Campaign was sent
   */
  campaignSent: (userId: string, campaignData: any) => {
    return webhookService.fireEvent(userId, 'campaign.sent', campaignData);
  },

  /**
   * Campaign was completed
   */
  campaignCompleted: (userId: string, campaignData: any) => {
    return webhookService.fireEvent(userId, 'campaign.completed', campaignData);
  },

  /**
   * Email was opened
   */
  emailOpened: (userId: string, emailData: any) => {
    return webhookService.fireEvent(userId, 'email.opened', emailData);
  },

  /**
   * Email was clicked
   */
  emailClicked: (userId: string, emailData: any) => {
    return webhookService.fireEvent(userId, 'email.clicked', emailData);
  },

  /**
   * CRM sync completed
   */
  crmSynced: (userId: string, syncData: any) => {
    return webhookService.fireEvent(userId, 'crm.synced', syncData);
  },

  /**
   * Hallucination detected
   */
  hallucintationAlert: (userId: string, alertData: any) => {
    return webhookService.fireEvent(userId, 'alert.hallucination', alertData);
  },
};

const webhookService = new WebhookService();
export default webhookService;
