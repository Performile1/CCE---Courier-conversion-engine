import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertCircle, Zap, Save, Plus } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface EventTrigger {
  id: string;
  event: string;
  webhook_ids: string[];
  custom_logic: string | null;
  active: boolean;
  createdAt: string;
}

interface EventTriggersComponentProps {
  userId: string;
  webhooks?: Array<{ id: string; url: string }>;
}

const AVAILABLE_EVENTS = [
  {
    id: 'lead.created',
    label: 'Lead Created',
    description: 'When a new lead is added to the system',
    icon: '👤',
  },
  {
    id: 'lead.updated',
    label: 'Lead Updated',
    description: 'When lead information is modified',
    icon: '✏️',
  },
  {
    id: 'lead.qualified',
    label: 'Lead Qualified',
    description: 'When a lead meets qualification criteria',
    icon: '⭐',
  },
  {
    id: 'campaign.sent',
    label: 'Campaign Sent',
    description: 'When a campaign is deployed to recipients',
    icon: '📧',
  },
  {
    id: 'campaign.completed',
    label: 'Campaign Completed',
    description: 'When a campaign finishes execution',
    icon: '✅',
  },
  {
    id: 'email.opened',
    label: 'Email Opened',
    description: 'When a recipient opens an email',
    icon: '👁️',
  },
  {
    id: 'email.clicked',
    label: 'Email Link Clicked',
    description: 'When a recipient clicks a link in email',
    icon: '🖱️',
  },
  {
    id: 'crm.synced',
    label: 'CRM Synchronized',
    description: 'When data syncs with your CRM',
    icon: '🔄',
  },
  {
    id: 'hallucination.detected',
    label: 'Hallucination Detected',
    description: 'When AI generates potentially inaccurate content',
    icon: '⚠️',
  },
  {
    id: 'conversion.completed',
    label: 'Conversion Completed',
    description: 'When an email recipient converts to a sales opportunity',
    icon: '💰',
  },
];

export const EventTriggersComponent: React.FC<EventTriggersComponentProps> = ({
  userId,
  webhooks = [],
}) => {
  const [eventTriggers, setEventTriggers] = useState<EventTrigger[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedWebhooks, setSelectedWebhooks] = useState<string[]>([]);
  const [customLogic, setCustomLogic] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadEventTriggers();
  }, [userId]);

  const loadEventTriggers = async () => {
    try {
      const stored = localStorage.getItem(`eventTriggers_${userId}`);
      if (stored) {
        setEventTriggers(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Error loading event triggers:', err);
    }
  };

  const handleAddTrigger = async () => {
    if (!selectedEvent) {
      alert('Select an event');
      return;
    }

    if (selectedWebhooks.length === 0 && !customLogic) {
      alert('Select webhooks or add custom logic');
      return;
    }

    setSaving(true);

    try {
      const newTrigger: EventTrigger = {
        id: Date.now().toString(),
        event: selectedEvent,
        webhook_ids: selectedWebhooks,
        custom_logic: customLogic || null,
        active: true,
        createdAt: new Date().toISOString(),
      };

      const updated = [...eventTriggers, newTrigger];
      setEventTriggers(updated);
      localStorage.setItem(`eventTriggers_${userId}`, JSON.stringify(updated));

      setSelectedEvent(null);
      setSelectedWebhooks([]);
      setCustomLogic('');
      setSuccess('Event trigger created successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert('Failed to create trigger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrigger = (id: string) => {
    const updated = eventTriggers.filter((t) => t.id !== id);
    setEventTriggers(updated);
    localStorage.setItem(`eventTriggers_${userId}`, JSON.stringify(updated));
  };

  const eventLabel = (eventId: string) => {
    return AVAILABLE_EVENTS.find((e) => e.id === eventId)?.label || eventId;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-blue-600" />
        Event Triggers
      </h3>

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {/* Event Selection Grid */}
      <div>
        <p className="text-sm font-medium text-slate-900 mb-2">Select Event to Trigger</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-slate-300 p-3 rounded bg-white">
          {AVAILABLE_EVENTS.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(event.id)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                selectedEvent === event.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-slate-300 bg-slate-50 hover:border-blue-400'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl">{event.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-900">{event.label}</p>
                  <p className="text-xs text-slate-600">{event.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedEvent && (
        <div className="border-t border-slate-300 pt-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-900 mb-2">Trigger Webhooks</p>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-300 p-3 rounded bg-slate-50">
              {webhooks.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No webhooks configured. Create webhooks first.</p>
              ) : (
                webhooks.map((webhook) => (
                  <label key={webhook.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedWebhooks.includes(webhook.id)}
                      onChange={(e) =>
                        setSelectedWebhooks(
                          e.target.checked
                            ? [...selectedWebhooks, webhook.id]
                            : selectedWebhooks.filter((wh) => wh !== webhook.id)
                        )
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 truncate">{webhook.url}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-900 mb-2">Custom Logic (Optional)</p>
            <textarea
              value={customLogic}
              onChange={(e) => setCustomLogic(e.target.value)}
              placeholder="// Optional: Add custom JavaScript logic to execute when this event fires
// Example: if (data.openRate > 0.5) { notifySlack('High open rate!'); }"
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddTrigger}
              disabled={saving}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Trigger
            </button>
            <button
              onClick={() => {
                setSelectedEvent(null);
                setSelectedWebhooks([]);
                setCustomLogic('');
              }}
              className="flex-1 py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Triggers List */}
      <div className="border-t border-slate-300 pt-4">
        <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600" />
          Active Triggers ({eventTriggers.length})
        </h4>
        <div className="space-y-2">
          {eventTriggers.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-4">No event triggers configured</p>
          ) : (
            eventTriggers.map((trigger) => (
              <div key={trigger.id} className="border border-slate-300 rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {trigger.active ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <h5 className="font-semibold text-slate-900">
                        {eventLabel(trigger.event)}
                      </h5>
                    </div>
                    <div className="mt-1 space-y-1">
                      {trigger.webhook_ids.length > 0 && (
                        <p className="text-xs text-slate-600">
                          Webhooks: {trigger.webhook_ids.length} configured
                        </p>
                      )}
                      {trigger.custom_logic && (
                        <p className="text-xs text-slate-600">
                          Custom logic: {trigger.custom_logic.substring(0, 50)}...
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTrigger(trigger.id)}
                    className="text-red-600 hover:bg-red-50 p-1 rounded"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Event Documentation */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <p className="text-sm text-indigo-900 font-semibold mb-2">💡 Event Trigger Info</p>
        <ul className="text-xs text-indigo-900 space-y-1">
          <li>• Each event can trigger multiple webhooks simultaneously</li>
          <li>• Custom logic executes if defined, in addition to webhook triggers</li>
          <li>• Events fire in real-time as activities occur in the system</li>
          <li>• Webhook delivery is retried automatically on failure</li>
        </ul>
      </div>
    </div>
  );
};

export default EventTriggersComponent;
