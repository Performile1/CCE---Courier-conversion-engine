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
      <h3 className="text-lg font-bold text-dhl-black flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-dhl-red" />
        Event Triggers
      </h3>

      {success && (
        <div className="p-3 bg-dhl-gray-light border border-green-200 rounded-sm flex gap-2">
          <CheckCircle className="w-5 h-5 text-dhl-yellow flex-shrink-0" />
          <p className="text-sm text-dhl-yellow">{success}</p>
        </div>
      )}

      {/* Event Selection Grid */}
      <div>
        <p className="text-sm font-medium text-dhl-black mb-2">Select Event to Trigger</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-dhl-gray-medium p-3 rounded bg-white">
          {AVAILABLE_EVENTS.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(event.id)}
              className={`p-3 rounded-sm border-2 text-left transition-all ${
                selectedEvent === event.id
                  ? 'border-blue-600 bg-dhl-gray-light'
                  : 'border-dhl-gray-medium bg-dhl-gray-light hover:border-blue-400'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl">{event.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-dhl-black">{event.label}</p>
                  <p className="text-xs text-dhl-gray-dark">{event.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedEvent && (
        <div className="border-t border-dhl-gray-medium pt-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-dhl-black mb-2">Trigger Webhooks</p>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-dhl-gray-medium p-3 rounded bg-dhl-gray-light">
              {webhooks.length === 0 ? (
                <p className="text-xs text-dhl-gray-dark italic">No webhooks configured. Create webhooks first.</p>
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
                    <span className="text-sm text-dhl-gray-dark truncate">{webhook.url}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-dhl-black mb-2">Custom Logic (Optional)</p>
            <textarea
              value={customLogic}
              onChange={(e) => setCustomLogic(e.target.value)}
              placeholder="// Optional: Add custom JavaScript logic to execute when this event fires
// Example: if (data.openRate > 0.5) { notifySlack('High open rate!'); }"
              rows={4}
              className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black font-mono text-xs"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddTrigger}
              disabled={saving}
              className="flex-1 py-2 px-4 bg-dhl-red hover:bg-dhl-red disabled:bg-dhl-gray-medium text-white font-semibold rounded-sm flex items-center justify-center gap-2"
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
              className="flex-1 py-2 px-4 bg-dhl-gray-medium hover:bg-dhl-gray-medium text-dhl-black font-semibold rounded-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Triggers List */}
      <div className="border-t border-dhl-gray-medium pt-4">
        <h4 className="font-semibold text-dhl-black mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-dhl-yellow" />
          Active Triggers ({eventTriggers.length})
        </h4>
        <div className="space-y-2">
          {eventTriggers.length === 0 ? (
            <p className="text-sm text-dhl-gray-dark text-center py-4">No event triggers configured</p>
          ) : (
            eventTriggers.map((trigger) => (
              <div key={trigger.id} className="border border-dhl-gray-medium rounded-sm p-3 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {trigger.active ? (
                        <CheckCircle className="w-4 h-4 text-dhl-yellow" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <h5 className="font-semibold text-dhl-black">
                        {eventLabel(trigger.event)}
                      </h5>
                    </div>
                    <div className="mt-1 space-y-1">
                      {trigger.webhook_ids.length > 0 && (
                        <p className="text-xs text-dhl-gray-dark">
                          Webhooks: {trigger.webhook_ids.length} configured
                        </p>
                      )}
                      {trigger.custom_logic && (
                        <p className="text-xs text-dhl-gray-dark">
                          Custom logic: {trigger.custom_logic.substring(0, 50)}...
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTrigger(trigger.id)}
                    className="text-red-600 hover:bg-dhl-gray-light p-1 rounded"
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
      <div className="bg-dhl-gray-light border border-indigo-200 rounded-sm p-4">
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


