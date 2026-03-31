import React, { useState, useEffect } from 'react';
import { MessageCircle, Plus, Trash2, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface SlackManagerProps {
  userId: string;
}

interface SlackIntegration {
  id: string;
  webhookUrl: string;
  enabled: boolean;
  notifications: {
    leadCreated: boolean;
    hallucinationAlert: boolean;
    campaignStarted: boolean;
    campaignCompleted: boolean;
    crmSynced: boolean;
  };
}

export const SlackManager: React.FC<SlackManagerProps> = ({ userId }) => {
  const [integrations, setIntegrations] = useState<SlackIntegration[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState({
    leadCreated: true,
    hallucinationAlert: true,
    campaignStarted: true,
    campaignCompleted: true,
    crmSynced: true,
  });

  useEffect(() => {
    loadIntegrations();
  }, [userId]);

  const loadIntegrations = async () => {
    try {
      const { data, error: err } = await supabase
        .from('slack_integrations')
        .select('*')
        .eq('user_id', userId);

      if (err) throw err;
      setIntegrations(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddIntegration = async () => {
    if (!webhookUrl) {
      setError('Please enter a webhook URL');
      return;
    }

    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      setError('Invalid Slack webhook URL');
      return;
    }

    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('slack_integrations')
        .insert({
          user_id: userId,
          webhook_url: webhookUrl,
          enabled: true,
          notifications: notificationPrefs,
        })
        .select();

      if (err) throw err;

      setIntegrations([...integrations, data[0]]);
      setWebhookUrl('');
      setShowForm(false);
      setError('');

      // Test webhook
      testWebhook(webhookUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async (url: string) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '✅ Slack integration successful!',
          attachments: [
            {
              color: 'good',
              title: 'CCE Carrier Conversion Engine',
              text: 'Your Slack notifications are now active.',
              footer: 'Test notification',
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      });

      if (!response.ok) {
        setError('Webhook test failed. Please check your URL.');
      }
    } catch (err) {
      setError('Could not test webhook. It may still work.');
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('slack_integrations')
        .delete()
        .eq('id', id);

      if (err) throw err;

      setIntegrations(integrations.filter((i) => i.id !== id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNotifications = async (id: string, newPrefs: any) => {
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('slack_integrations')
        .update({ notifications: newPrefs })
        .eq('id', id);

      if (err) throw err;

      setIntegrations(
        integrations.map((i) =>
          i.id === id ? { ...i, notifications: newPrefs } : i
        )
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-indigo-600" />
          Slack Notifications
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Webhook
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="border border-slate-300 rounded-lg p-4 space-y-4 bg-slate-50">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Slack Webhook URL
              </label>
              <input
                type="password"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-600"
              />
              <p className="text-xs text-slate-600 mt-1">
                Get this from Slack Apps → Incoming Webhooks
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">Notifications</p>
              <div className="space-y-2">
                {Object.entries(notificationPrefs).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 p-2 hover:bg-white rounded">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) =>
                        setNotificationPrefs({ ...notificationPrefs, [key]: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-900">
                      {key === 'leadCreated' && 'New Lead Created'}
                      {key === 'hallucinationAlert' && 'Hallucination Alert (>70%)'}
                      {key === 'campaignStarted' && 'Campaign Started'}
                      {key === 'campaignCompleted' && 'Campaign Completed'}
                      {key === 'crmSynced' && 'CRM Synced'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t border-slate-300 pt-4">
            <button
              onClick={handleAddIntegration}
              disabled={loading || !webhookUrl}
              className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Connect
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 px-4 bg-slate-300 hover:bg-slate-400 text-slate-900 font-semibold rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {integrations.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-4">No Slack webhooks connected</p>
        ) : (
          integrations.map((integration) => (
            <div key={integration.id} className="border border-slate-300 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="font-medium text-slate-900">
                    {integration.webhookUrl.substring(0, 50)}...
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteIntegration(integration.id)}
                  disabled={loading}
                  className="p-1 hover:bg-red-50 rounded transition-all"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>

              <div className="space-y-1 text-xs text-slate-600">
                <p>
                  Lead Created: {integration.notifications?.leadCreated ? '✅' : '❌'}
                </p>
                <p>
                  Hallucination Alert: {integration.notifications?.hallucinationAlert ? '✅' : '❌'}
                </p>
                <p>
                  Campaign Events:{' '}
                  {integration.notifications?.campaignStarted &&
                  integration.notifications?.campaignCompleted
                    ? '✅'
                    : '❌'}
                </p>
                <p>
                  CRM Synced: {integration.notifications?.crmSynced ? '✅' : '❌'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SlackManager;
