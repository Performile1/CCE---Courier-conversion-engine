import React, { useState, useEffect } from 'react';
import { Zap, Plus, Edit2, Trash2, CheckCircle, AlertCircle, Loader, Copy, Eye, EyeOff } from 'lucide-react';
import { createWebhook, deleteWebhook, loadWebhooks as loadWebhookRecords } from '../services/automationConfigService';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered: string | null;
  createdAt: string;
}

interface WebhookSystemManagerProps {
  userId: string;
}

const AVAILABLE_EVENTS = [
  { id: 'lead.created', label: 'Lead Created', category: 'Leads' },
  { id: 'lead.updated', label: 'Lead Updated', category: 'Leads' },
  { id: 'lead.deleted', label: 'Lead Deleted', category: 'Leads' },
  { id: 'campaign.sent', label: 'Campaign Sent', category: 'Campaigns' },
  { id: 'campaign.completed', label: 'Campaign Completed', category: 'Campaigns' },
  { id: 'email.opened', label: 'Email Opened', category: 'Emails' },
  { id: 'email.clicked', label: 'Email Clicked', category: 'Emails' },
  { id: 'crm.synced', label: 'CRM Synced', category: 'CRM' },
  { id: 'alert.hallucination', label: 'Hallucination Alert', category: 'Quality' },
];

export const WebhookSystemManager: React.FC<WebhookSystemManagerProps> = ({
  userId,
}) => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWebhooks();
  }, [userId]);

  const loadWebhooks = async () => {
    try {
      const items = await loadWebhookRecords(userId);
      setWebhooks(items);
    } catch (err) {
      console.error('Error loading webhooks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWebhook = async () => {
    if (!webhookUrl) {
      setError('Please enter a webhook URL');
      return;
    }

    if (!webhookUrl.startsWith('http')) {
      setError('Invalid URL format');
      return;
    }

    if (selectedEvents.length === 0) {
      setError('Select at least one event');
      return;
    }

    setSaving(true);

    try {
      const newWebhook = await createWebhook(userId, webhookUrl, selectedEvents);
      const updated = [newWebhook, ...webhooks];
      setWebhooks(updated);

      setWebhookUrl('');
      setSelectedEvents([]);
      setShowForm(false);
      setSuccess('Webhook added successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to add webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    await deleteWebhook(userId, id);
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const testWebhook = async (webhook: Webhook) => {
    try {
      const payload = {
        event: 'test.webhook',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from CCE',
        },
      };

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSuccess(`✅ Test sent to ${webhook.url}`);
      } else {
        setError(`❌ Webhook returned ${response.status}`);
      }
    } catch (err: any) {
      setError(`Failed to test: ${err.message}`);
    }

    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 3000);
  };

  if (loading) {
    return <div className="bg-white rounded-sm p-6 text-center">Loading webhooks...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-dhl-black flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-dhl-red" />
        Webhook System
      </h3>

      {error && (
        <div className="p-3 bg-dhl-gray-light border border-dhl-gray-medium rounded-sm flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-dhl-gray-light border border-green-200 rounded-sm flex gap-2">
          <CheckCircle className="w-5 h-5 text-dhl-yellow flex-shrink-0" />
          <p className="text-sm text-dhl-yellow">{success}</p>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 px-4 bg-dhl-red hover:bg-red-800 text-white font-semibold rounded-sm transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      )}

      {showForm && (
        <div className="border border-dhl-gray-medium rounded-sm p-4 space-y-4 bg-dhl-gray-light">
          <div>
            <label className="block text-sm font-medium text-dhl-black mb-1">
              Webhook URL
            </label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black focus:ring-2 focus:ring-dhl-red"
            />
            <p className="text-xs text-dhl-gray-dark mt-1">
              POST requests will be sent to this URL with event data
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dhl-black mb-2">
              Subscribe to Events
            </label>
            <div className="space-y-3 max-h-64 overflow-y-auto border border-dhl-gray-medium p-3 rounded bg-white">
              {['Leads', 'Campaigns', 'Emails', 'CRM', 'Quality'].map((category) => (
                <div key={category}>
                  <p className="text-xs font-bold text-dhl-gray-dark mb-2">{category}</p>
                  <div className="space-y-1">
                    {AVAILABLE_EVENTS.filter((e) => e.category === category).map((event) => (
                      <label
                        key={event.id}
                        className="flex items-center gap-2 p-1 hover:bg-dhl-gray-light rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event.id)}
                          onChange={(e) =>
                            setSelectedEvents(
                              e.target.checked
                                ? [...selectedEvents, event.id]
                                : selectedEvents.filter((ev) => ev !== event.id)
                            )
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-dhl-gray-dark">{event.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-t border-dhl-gray-medium pt-4">
            <button
              onClick={handleAddWebhook}
              disabled={saving}
              className="flex-1 py-2 px-4 bg-dhl-red hover:bg-red-800 disabled:bg-dhl-gray-medium text-white font-semibold rounded-sm transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Webhook
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setWebhookUrl('');
                setSelectedEvents([]);
              }}
              className="flex-1 py-2 px-4 bg-dhl-gray-medium hover:bg-dhl-gray-medium text-dhl-black font-semibold rounded-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Webhooks List */}
      <div className="space-y-2">
        {webhooks.length === 0 ? (
          <p className="text-sm text-dhl-gray-dark text-center py-4">No webhooks configured</p>
        ) : (
          webhooks.map((webhook) => (
            <div key={webhook.id} className="border border-dhl-gray-medium rounded-sm p-3 bg-white">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {webhook.active ? (
                      <CheckCircle className="w-4 h-4 text-dhl-yellow" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-xs font-mono text-dhl-gray-dark">
                      {webhook.url.substring(0, 50)}...
                    </span>
                  </div>
                  <p className="text-xs text-dhl-gray-dark mt-1">
                    Events: {webhook.events.join(', ')}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => testWebhook(webhook)}
                    className="p-1 hover:bg-dhl-gray-light rounded text-dhl-red text-xs font-medium"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(webhook.id)}
                    className="p-1 hover:bg-dhl-gray-light rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
              {webhook.lastTriggered && (
                <p className="text-xs text-slate-500">
                  Last triggered: {new Date(webhook.lastTriggered).toLocaleString()}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Documentation */}
      <div className="bg-dhl-gray-light border border-dhl-gray-medium rounded-sm p-4">
        <p className="text-sm text-blue-900">
          💡 <strong>Webhook Payload Example:</strong>
        </p>
        <code className="block bg-blue-900 text-green-400 p-2 rounded mt-2 text-xs overflow-x-auto">
          {`{
  "event": "campaign.completed",
  "timestamp": "2026-03-31T10:00:00Z",
  "data": {
    "campaignId": "123",
    "campaignName": "Q1 Outreach",
    "opens": 25,
    "clicks": 8
  }
}`}
        </code>
      </div>
    </div>
  );
};

export default WebhookSystemManager;



