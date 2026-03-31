import React, { useState, useEffect } from 'react';
import { BarChart3, Mail, MousePointerClick, Eye, TrendingUp } from 'lucide-react';
import { getCampaignAnalytics } from '../services/emailCampaign';

interface CampaignAnalyticsProps {
  campaignId: string;
  campaignName: string;
}

interface Analytics {
  id: string;
  campaignId: string;
  totalSent: number;
  totalOpen: number;
  totalClick: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  conversions: number;
  topLinks: Array<{ url: string; clicks: number }>;
  recipientBreakdown: Array<{
    email: string;
    status: 'sent' | 'opened' | 'clicked' | 'bounced';
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export const CampaignAnalytics: React.FC<CampaignAnalyticsProps> = ({
  campaignId,
  campaignName,
}) => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalytics();
    // Refresh every 30 seconds
    const interval = setInterval(loadAnalytics, 30000);
    return () => clearInterval(interval);
  }, [campaignId]);

  const loadAnalytics = async () => {
    try {
      const data = await getCampaignAnalytics(campaignId);
      setAnalytics(data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 flex items-center justify-center h-64">
        <p className="text-slate-600">Loading analytics...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <p className="text-slate-600">No data available yet</p>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Sent',
      value: analytics.totalSent,
      icon: Mail,
      color: 'blue',
    },
    {
      label: 'Opened',
      value: analytics.totalOpen,
      icon: Eye,
      color: 'green',
      subtext: `${analytics.openRate}%`,
    },
    {
      label: 'Clicks',
      value: analytics.totalClick,
      icon: MousePointerClick,
      color: 'purple',
      subtext: `${analytics.clickRate}%`,
    },
    {
      label: 'Conversions',
      value: analytics.conversions,
      icon: TrendingUp,
      color: 'amber',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          {campaignName} Analytics
        </h3>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const colorClasses = {
              blue: 'text-blue-600 bg-blue-50',
              green: 'text-green-600 bg-green-50',
              purple: 'text-purple-600 bg-purple-50',
              amber: 'text-amber-600 bg-amber-50',
            };

            return (
              <div
                key={metric.label}
                className="border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[metric.color as keyof typeof colorClasses]} mb-2`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-600 mb-1">{metric.label}</p>
                <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
                {metric.subtext && (
                  <p className="text-xs text-slate-600 mt-1">{metric.subtext}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Metrics */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h4 className="font-bold text-slate-900 mb-3">Key Metrics</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
              <span className="text-slate-600">Open Rate</span>
              <span className="font-bold text-slate-900">{analytics.openRate}%</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
              <span className="text-slate-600">Click Rate</span>
              <span className="font-bold text-slate-900">{analytics.clickRate}%</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
              <span className="text-slate-600">Bounce Rate</span>
              <span className="font-bold text-slate-900">{analytics.bounceRate}%</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-green-50 rounded">
              <span className="text-slate-600">Conversion Rate</span>
              <span className="font-bold text-green-600">
                {analytics.totalSent > 0
                  ? ((analytics.conversions / analytics.totalSent) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>

        {/* Top Links */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h4 className="font-bold text-slate-900 mb-3">Top Clicked Links</h4>
          <div className="space-y-2 text-sm">
            {analytics.topLinks && analytics.topLinks.length > 0 ? (
              analytics.topLinks.slice(0, 5).map((link, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline truncate"
                    title={link.url}
                  >
                    {link.url.substring(0, 35)}...
                  </a>
                  <span className="font-bold text-slate-900 whitespace-nowrap ml-2">
                    {link.clicks} clicks
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-600">No clicks yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recipient Breakdown */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h4 className="font-bold text-slate-900 mb-3">Recipient Activity</h4>
        <div className="max-h-64 overflow-y-auto">
          <div className="space-y-1 text-sm">
            {analytics.recipientBreakdown && analytics.recipientBreakdown.length > 0 ? (
              analytics.recipientBreakdown.slice(0, 20).map((recipient, idx) => {
                const statusColors = {
                  sent: 'bg-blue-50 text-blue-700',
                  opened: 'bg-green-50 text-green-700',
                  clicked: 'bg-purple-50 text-purple-700',
                  bounced: 'bg-red-50 text-red-700',
                };

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 hover:bg-slate-50 rounded"
                  >
                    <span className="text-slate-600 truncate">{recipient.email}</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        statusColors[recipient.status as keyof typeof statusColors]
                      }`}
                    >
                      {recipient.status.charAt(0).toUpperCase() + recipient.status.slice(1)}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-slate-600">No activity yet</p>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={loadAnalytics}
        className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-lg transition-all text-sm"
      >
        🔄 Refresh Analytics
      </button>
    </div>
  );
};

export default CampaignAnalytics;
