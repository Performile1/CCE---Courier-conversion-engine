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
    <div className="bg-white rounded-sm border border-dhl-gray-medium p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-dhl-black flex items-center gap-2">
          <Mail className="w-5 h-5 text-dhl-red" />
          Email Campaigns
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="py-2 px-4 bg-dhl-red hover:bg-red-800 text-white font-semibold rounded-sm transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-dhl-gray-light border border-dhl-gray-medium rounded-sm flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="border border-dhl-gray-medium rounded-sm p-4 space-y-4 bg-dhl-gray-light">
          <h4 className="font-bold text-dhl-black">Campaign Templates</h4>
          <div className="grid grid-cols-1 gap-2">
            {templates.map((template) => (
              <button
                key={template.name}
                onClick={() => handleTemplateSelect(template)}
                className="text-left p-3 border border-dhl-gray-medium rounded-sm hover:bg-dhl-gray-light transition-all"
              >
                <p className="font-medium text-dhl-black">{template.name}</p>
                <p className="text-sm text-dhl-gray-dark">{template.subject}</p>
              </button>
            ))}
          </div>

          <div className="space-y-3 border-t border-dhl-gray-medium pt-4">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Campaign Name"
              className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black focus:ring-2 focus:ring-dhl-red"
            />

            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Email Subject"
              className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black focus:ring-2 focus:ring-dhl-red"
            />

            <textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="Email Body"
              rows={6}
              className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black focus:ring-2 focus:ring-dhl-red"
            />

            <div>
              <p className="text-sm font-medium text-dhl-black mb-2">Recipients ({formData.selectedLeads.length})</p>
              <div className="max-h-32 overflow-y-auto border border-dhl-gray-medium rounded-sm p-2 space-y-1">
                {leads.map((lead) => (
                  <label key={lead.id} className="flex items-center gap-2 p-2 hover:bg-dhl-gray-light rounded">
                    <input
                      type="checkbox"
                      checked={formData.selectedLeads.includes(lead.id)}
                      onChange={() => handleLeadToggle(lead.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-dhl-black">{lead.companyName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t border-dhl-gray-medium pt-4">
            <button
              onClick={handleCreateCampaign}
              disabled={loading}
              className="flex-1 py-2 px-4 bg-dhl-red hover:bg-red-800 disabled:bg-dhl-gray-medium text-white font-semibold rounded-sm transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 px-4 bg-dhl-gray-medium hover:bg-dhl-gray-medium text-dhl-black font-semibold rounded-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {campaigns.length === 0 ? (
          <p className="text-sm text-dhl-gray-dark text-center py-4">No campaigns yet</p>
        ) : (
          campaigns.map((campaign) => (
            <div key={campaign.id} className="border border-dhl-gray-medium rounded-sm p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-dhl-black">{campaign.name}</p>
                  <p className="text-sm text-dhl-gray-dark">{campaign.subject}</p>
                  <div className="flex gap-4 mt-2 text-xs text-dhl-gray-dark">
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
                      className="py-1 px-3 bg-dhl-yellow hover:bg-dhl-yellow text-white text-sm font-semibold rounded transition-all flex items-center gap-1"
                    >
                      {sending ? <Loader className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Send
                    </button>
                  ) : (
                    <CheckCircle className="w-5 h-5 text-dhl-yellow" />
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



