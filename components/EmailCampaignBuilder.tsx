import React, { useState, useEffect } from 'react';
import { Mail, Plus, Send, Loader, CheckCircle, AlertCircle, Trash2, Edit2 } from 'lucide-react';
import { createCampaign, addLeadsToCampaign, sendCampaign, getCampaignAnalytics } from '../services/emailCampaign';

interface EmailCampaignBuilderProps {
  userId: string;
  leads: any[];
  onCampaignSent?: () => void;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: 'draft' | 'scheduled' | 'sent';
  openRate: number;
  clickRate: number;
  recipientCount: number;
}

export const EmailCampaignBuilder: React.FC<EmailCampaignBuilderProps> = ({
  userId,
  leads,
  onCampaignSent,
}) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    selectedLeads: [] as string[],
  });

  const templates = [
    {
      name: 'Cold Outreach',
      subject: 'Interested in {{companyName}}?',
      body: 'Hi {{firstName}},\n\nWe noticed {{companyName}} might benefit from our solution.\n\nBest regards,\nTeam',
    },
    {
      name: 'Follow-up',
      subject: 'Following up: {{subject}}',
      body: 'Hi {{firstName}},\n\nJust checking in on our previous conversation.\n\nBest regards,\nTeam',
    },
    {
      name: 'Newsletter',
      subject: 'Latest news: {{topic}}',
      body: 'Hi {{firstName}},\n\nCheck out this week\'s highlights:\n\n{{content}}\n\nBest regards,\nTeam',
    },
  ];

  const handleTemplateSelect = (template: typeof templates[0]) => {
    setFormData({
      ...formData,
      subject: template.subject,
      body: template.body,
    });
  };

  const handleLeadToggle = (leadId: string) => {
    setFormData({
      ...formData,
      selectedLeads: formData.selectedLeads.includes(leadId)
        ? formData.selectedLeads.filter((id) => id !== leadId)
        : [...formData.selectedLeads, leadId],
    });
  };

  const handleCreateCampaign = async () => {
    if (!formData.name || !formData.subject || !formData.body) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.selectedLeads.length === 0) {
      setError('Please select at least one lead');
      return;
    }

    setLoading(true);
    try {
      const campaign = await createCampaign(userId, {
        name: formData.name,
        subject: formData.subject,
        body: formData.body,
        status: 'draft',
        createdAt: new Date(),
      });

      await addLeadsToCampaign(campaign.id, formData.selectedLeads);

      setCampaigns([...campaigns, campaign as Campaign]);
      setFormData({ name: '', subject: '', body: '', selectedLeads: [] });
      setShowForm(false);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    setSending(true);
    try {
      await sendCampaign(campaignId);
      const updated = campaigns.map((c) =>
        c.id === campaignId ? { ...c, status: 'sent' as const } : c
      );
      setCampaigns(updated);
      onCampaignSent?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleViewAnalytics = async (campaignId: string) => {
    try {
      const analytics = await getCampaignAnalytics(campaignId);
      console.log('Analytics:', analytics);
      // In a real app, show analytics in a modal
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-600" />
          Email Campaigns
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Campaign
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
          <h4 className="font-bold text-slate-900">Campaign Templates</h4>
          <div className="grid grid-cols-1 gap-2">
            {templates.map((template) => (
              <button
                key={template.name}
                onClick={() => handleTemplateSelect(template)}
                className="text-left p-3 border border-slate-300 rounded-lg hover:bg-indigo-50 transition-all"
              >
                <p className="font-medium text-slate-900">{template.name}</p>
                <p className="text-sm text-slate-600">{template.subject}</p>
              </button>
            ))}
          </div>

          <div className="space-y-3 border-t border-slate-300 pt-4">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Campaign Name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-600"
            />

            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Email Subject"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-600"
            />

            <textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="Email Body"
              rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-600"
            />

            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">Recipients ({formData.selectedLeads.length})</p>
              <div className="max-h-32 overflow-y-auto border border-slate-300 rounded-lg p-2 space-y-1">
                {leads.map((lead) => (
                  <label key={lead.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded">
                    <input
                      type="checkbox"
                      checked={formData.selectedLeads.includes(lead.id)}
                      onChange={() => handleLeadToggle(lead.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-900">{lead.companyName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t border-slate-300 pt-4">
            <button
              onClick={handleCreateCampaign}
              disabled={loading}
              className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
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
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-4">No campaigns yet</p>
        ) : (
          campaigns.map((campaign) => (
            <div key={campaign.id} className="border border-slate-300 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{campaign.name}</p>
                  <p className="text-sm text-slate-600">{campaign.subject}</p>
                  <div className="flex gap-4 mt-2 text-xs text-slate-600">
                    <span>Recipients: {campaign.recipientCount}</span>
                    <span>Open Rate: {campaign.openRate}%</span>
                    <span>Click Rate: {campaign.clickRate}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {campaign.status === 'draft' ? (
                    <button
                      onClick={() => handleSendCampaign(campaign.id)}
                      disabled={sending}
                      className="py-1 px-3 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded transition-all flex items-center gap-1"
                    >
                      {sending ? <Loader className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Send
                    </button>
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EmailCampaignBuilder;
