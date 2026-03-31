# Phase 9 Quick Integration Guide

**Quick Reference:** Integrating Webhooks and Custom Integrations into your CCE app

---

## Installation & Setup

### 1. Import Components

```typescript
// In your main component or page
import { WebhookSystemManager } from '../components/WebhookSystemManager';
import { CustomIntegrationAdapter } from '../components/CustomIntegrationAdapter';
import { EventTriggersComponent } from '../components/EventTriggersComponent';
import { IntegrationManagerComponent } from '../components/Phase9IntegrationManager';
import { CustomAPIConnectorBuilder } from '../components/CustomAPIConnectorBuilder';
import webhookService, { triggerEvents } from '../services/webhookService';
```

### 2. Add to Your Dashboard

```typescript
export const SettingsPage: React.FC = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Integration Settings</h1>

      {/* Integration Hub */}
      <IntegrationManagerComponent userId={user?.id} />

      {/* Individual Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WebhookSystemManager userId={user?.id} />
        <CustomIntegrationAdapter userId={user?.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EventTriggersComponent userId={user?.id} />
        <CustomAPIConnectorBuilder userId={user?.id} />
      </div>
    </div>
  );
};
```

---

## Firing Events

### Basic Event Firing

```typescript
import { triggerEvents } from '../services/webhookService';

// When a lead is created
const onLeadCreated = async (leadData) => {
  // ... create lead in database ...
  
  // Fire webhook event
  await triggerEvents.leadCreated(userId, leadData);
};

// When an email is opened
const onEmailOpened = async (emailId, campaignId) => {
  await triggerEvents.emailOpened(userId, {
    emailId,
    campaignId,
    openedAt: new Date().toISOString(),
  });
};

// When campaign completes
const onCampaignComplete = async (campaignMetrics) => {
  await triggerEvents.campaignCompleted(userId, campaignMetrics);
};
```

### Event Firing in Campaign Service

```typescript
// In emailCampaign.ts
export const sendCampaign = async (campaignId: string) => {
  const campaign = await fetchCampaign(campaignId);
  
  // Send emails...
  
  // Fire webhook
  await triggerEvents.campaignSent(userId, {
    campaignId,
    campaignName: campaign.name,
    recipientCount: recipients.length,
    sentAt: new Date().toISOString(),
  });
};
```

### Available Events

```typescript
// Lead Events
triggerEvents.leadCreated(userId, leadData);
triggerEvents.leadUpdated(userId, leadData);
triggerEvents.leadDeleted(userId, { leadId });

// Campaign Events
triggerEvents.campaignSent(userId, campaignData);
triggerEvents.campaignCompleted(userId, campaignData);

// Email Events
triggerEvents.emailOpened(userId, emailData);
triggerEvents.emailClicked(userId, emailData);

// Integration Events
triggerEvents.crmSynced(userId, syncData);

// Alert Events
triggerEvents.hallucintationAlert(userId, alertData);
```

---

## Database Setup

### Create Required Tables

```sql
-- Webhook configurations
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook delivery logs
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  status_code INTEGER,
  status_text TEXT,
  payload JSONB,
  delivered_at TIMESTAMPTZ DEFAULT now()
);

-- Event trigger configurations
CREATE TABLE event_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  webhook_ids UUID[] NOT NULL,
  custom_logic TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Custom API connectors
CREATE TABLE custom_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_type TEXT DEFAULT 'apikey',
  auth_config JSONB,
  endpoints JSONB NOT NULL DEFAULT '[]',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX idx_event_triggers_user_id ON event_triggers(user_id);
CREATE INDEX idx_custom_connectors_user_id ON custom_connectors(user_id);

-- Enable RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_connectors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own webhooks" 
  ON webhooks FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own webhooks" 
  ON webhooks FOR ALL 
  USING (auth.uid() = user_id);
```

---

## API Usage Examples

### Example 1: Slack Campaign Notifications

```typescript
// Setup:
// 1. Go to Slack App Integration page
// 2. Create webhook in WebhookSystemManager
// 3. Enter Slack webhook URL
// 4. Subscribe to: campaign.completed, campaign.sent

// The system automatically sends to Slack when events happen
// Webhook URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Example 2: Salesforce Lead Sync

```typescript
// Setup:
// 1. Create Custom Connector
// 2. Base URL: https://your-org.salesforce.com/services/data/v57.0
// 3. Auth Type: OAuth2
// 4. Add endpoint:
//    - Name: Create Lead
//    - Method: POST
//    - Path: /sobjects/Lead
//    - Mapping: CCE fields → SFDC fields

// Create Event Trigger on: lead.qualified
// Now qualified leads automatically sync to Salesforce!
```

### Example 3: Zapier Multi-Step Workflow

```typescript
// Setup:
// 1. Create Custom Adapter, type: Zapier
// 2. Get webhook URL from Zapier
// 3. Create Event Trigger on: email.clicked
// 4. In Zapier, configure actions:
//    - Step 1: Add row to Google Sheets
//    - Step 2: Send SMS via Twilio
//    - Step 3: Create task in Asana
//    - Step 4: Add tag in HubSpot

// When email is clicked, all 4 actions execute automatically!
```

---

## Webhook Signature Verification

### For Webhook Recipients

When you receive a webhook POST, verify the signature:

```typescript
// Node.js example
import crypto from 'crypto';
import express from 'express';

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-cce-signature'];
  const payload = JSON.stringify(req.body);
  
  // Compute expected signature
  const expected = crypto
    .createHmac('sha256', process.env.CCE_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  // Verify
  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  console.log(`Event: ${req.body.event}`);
  console.log(`Data:`, req.body.data);
  
  res.json({ ok: true });
});
```

---

## Testing Webhooks Locally

### Using ngrok for Local Testing

```bash
# Install ngrok
npm install -g ngrok

# Start your local server
npm run dev

# In another terminal, expose it
ngrok http 3000

# You'll get a URL like: https://abc123.ngrok.io

# Use this URL as your webhook URL in CCE
# Example: https://abc123.ngrok.io/webhook
```

### Test Server Setup

```typescript
// test-webhook-server.ts
import express from 'express';

const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  console.log('Webhook received!');
  console.log('Event:', req.body.event);
  console.log('Data:', req.body.data);
  res.json({ ok: true });
});

app.listen(3001, () => {
  console.log('Webhook test server on http://localhost:3001');
});
```

---

## Troubleshooting

### Webhooks Not Firing

**Check:**
1. Event subscription is enabled
2. Webhook URL is accessible (`curl https://your-url`)
3. No firewall or CORS issues
4. Event actually occurring in system

**Debug:**
```typescript
// Add logging to event firing
await triggerEvents.campaignCompleted(userId, {
  ...data,
  debugLog: 'Webhook fired at ' + new Date().toISOString()
});
```

### Webhook Delivery Failed

**Check:**
1. URL returns 2xx status code
2. Payload is valid JSON
3. Endpoint timeout < 30 seconds
4. Headers are accepted

**View Logs:**
```typescript
const logs = await webhookService.getWebhookLogs(webhookId, 50);
logs.forEach(log => {
  console.log(`Status: ${log.statusCode} - ${log.statusText}`);
});
```

### Custom Connector Not Working

**Check:**
1. Base URL is correct (no trailing slash)
2. Authentication credentials are valid
3. Endpoint path is correct
4. Request mapping matches API schema
5. Test with Postman first

### Event Trigger Not Executing

**Check:**
1. Event trigger is active (not disabled)
2. Event type matches subscription
3. Webhooks are configured and active
4. Custom logic has no syntax errors

---

## Performance Tips

### Optimize Webhook Delivery

```typescript
// Use batching for bulk events
const batchLeads = leads.map(lead => 
  triggerEvents.leadCreated(userId, lead)
);
await Promise.all(batchLeads);

// Use event debouncing for frequent events
const debouncedSync = debounce(() => {
  triggerEvents.crmSynced(userId, syncData);
}, 5000); // Wait 5 seconds before firing
```

### Reduce Event Payload Size

```typescript
// ✅ Good: Only necessary fields
triggerEvents.campaignCompleted(userId, {
  campaignId: campaign.id,
  opens: metrics.opens,
  clicks: metrics.clicks,
});

// ❌ Bad: Sending entire objects
triggerEvents.campaignCompleted(userId, fullCampaignObject);
```

### Monitor Webhook Performance

```typescript
// Log performance metrics
const start = Date.now();
await triggerEvents.campaignSent(userId, data);
console.log(`Webhook fired in ${Date.now() - start}ms`);
```

---

## Advanced Patterns

### Conditional Webhook Firing

```typescript
// Only fire webhook if conditions are met
if (campaign.openRate > 0.3) {
  triggerEvents.campaignCompleted(userId, {
    ...campaign,
    quality: 'high-performing'
  });
}
```

### Custom Adapter with Conditional Logic

```typescript
// In Custom Adapter (JavaScript type):
function transform(input) {
  // Route to different endpoints based on condition
  if (input.data.conversionValue > 1000) {
    return {
      route: 'high_value_leads',
      ...input.data
    };
  }
  return input.data;
}
```

### Event Chaining

```typescript
// Fire subsequent events based on webhook response
const onCampaignSent = async (campaign) => {
  triggerEvents.campaignSent(userId, campaign);
  
  // Later, when completed:
  setTimeout(() => {
    triggerEvents.campaignCompleted(userId, campaign);
  }, 5000);
};
```

---

## Production Checklist

- [ ] Database tables created with RLS enabled
- [ ] Webhook URLs verified and accessible
- [ ] Event triggers configured
- [ ] Slack integration tested
- [ ] Salesforce connector configured
- [ ] Custom adapters deployed
- [ ] Webhook signing keys set up
- [ ] Error monitoring configured
- [ ] Rate limits set appropriately
- [ ] Backup strategy for webhook logs
- [ ] Team trained on webhook management
- [ ] Documentation shared with team

---

## Resources

- **Full Documentation:** PHASE_9_IMPLEMENTATION_GUIDE.md
- **API Examples:** PHASE_9_COMPLETION_REPORT.md
- **Integration Hub:** Phase9IntegrationManager component
- **Webhook Testing:** WebhookSystemManager component

---

## Support

For issues or questions:
1. Check webhook logs in Integration Manager
2. Review event subscription configuration
3. Test webhook URL endpoint manually
4. Verify event is actually firing
5. Check documentation for your integration type
