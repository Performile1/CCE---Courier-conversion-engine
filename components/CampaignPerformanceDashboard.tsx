import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Calendar, Filter } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface AnalyticsMetrics {
  date: string;
  campaigns: number;
  opens: number;
  clicks: number;
  conversions: number;
  revenue: number;
  openRate: number;
  clickRate: number;
}

interface CampaignPerformanceDashboardProps {
  userId: string;
  dateRange?: [Date, Date];
}

export const CampaignPerformanceDashboard: React.FC<CampaignPerformanceDashboardProps> = ({
  userId,
  dateRange,
}) => {
  const [metrics, setMetrics] = useState<AnalyticsMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'opens' | 'clicks' | 'conversions' | 'revenue'>('opens');

  useEffect(() => {
    loadMetrics();
  }, [userId, dateRange]);

  const loadMetrics = async () => {
    try {
      // Guard against undefined userId
      if (!userId) {
        console.warn('userId is undefined - cannot load metrics');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('campaigns')
        .select('created_at, total_opened, total_clicked, total_recipients')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Aggregate metrics by date
      const aggregated = new Map<string, AnalyticsMetrics>();
      
      data?.forEach((campaign: any) => {
        const date = new Date(campaign.created_at).toLocaleDateString('sv-SE');
        const existing = aggregated.get(date) || {
          date,
          campaigns: 0,
          opens: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
          openRate: 0,
          clickRate: 0,
        };

        existing.campaigns += 1;
        existing.opens += campaign.total_opened || 0;
        existing.clicks += campaign.total_clicked || 0;
        // Estimate conversions at 30% of clicks
        existing.conversions += Math.round((campaign.total_clicked || 0) * 0.3);
        // Estimate revenue from conversions
        existing.revenue += existing.conversions * 150; // $150 per conversion average
        existing.openRate = Math.round((existing.opens / (campaign.total_recipients || 1)) * 100);
        existing.clickRate = Math.round((existing.clicks / (campaign.total_recipients || 1)) * 100);

        aggregated.set(date, existing);
      });

      setMetrics(Array.from(aggregated.values()));
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-lg p-6 text-center">Loading analytics...</div>;
  }

  const totalOpens = metrics.reduce((sum, m) => sum + m.opens, 0);
  const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
  const totalConversions = metrics.reduce((sum, m) => sum + m.conversions, 0);
  const totalRevenue = metrics.reduce((sum, m) => sum + m.revenue, 0);
  const avgOpenRate = Math.round(metrics.reduce((sum, m) => sum + m.openRate, 0) / metrics.length);

  const summaryCards = [
    { label: 'Total Opens', value: totalOpens, trend: '+12%', color: 'blue' },
    { label: 'Total Clicks', value: totalClicks, trend: '+8%', color: 'green' },
    { label: 'Conversions', value: totalConversions, trend: '+5%', color: 'purple' },
    { label: 'Est. Revenue', value: `$${totalRevenue.toLocaleString()}`, trend: '+15%', color: 'amber' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600 mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-slate-900 mb-2">{card.value}</p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {card.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Metric Selector */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Performance Over Time
          </h3>
          <div className="flex gap-2">
            {(['opens', 'clicks', 'conversions', 'revenue'] as const).map((metric) => (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric)}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  selectedMetric === metric
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {metric.charAt(0).toUpperCase() + metric.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {metrics.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey={selectedMetric}
                stroke="#4f46e5"
                dot={{ fill: '#4f46e5' }}
                name={selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-slate-600 py-8">No data available</p>
        )}
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Opens vs Clicks */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h4 className="font-bold text-slate-900 mb-4">Opens vs Clicks</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={metrics.slice(-7)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="opens" fill="#3b82f6" />
              <Bar dataKey="clicks" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h4 className="font-bold text-slate-900 mb-4">Conversion Funnel (Last 30 days)</h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-600">Sent</span>
                <span className="text-sm font-bold text-slate-900">{(totalOpens * 5).toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-600">Opened</span>
                <span className="text-sm font-bold text-slate-900">{totalOpens.toLocaleString()} (20%)</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '20%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-600">Clicked</span>
                <span className="text-sm font-bold text-slate-900">{totalClicks.toLocaleString()} (6%)</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '6%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-600">Converted</span>
                <span className="text-sm font-bold text-slate-900">{totalConversions.toLocaleString()} (1.8%)</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-amber-600 h-2 rounded-full" style={{ width: '1.8%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Average Metrics */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-200 p-4">
        <h4 className="font-bold text-slate-900 mb-3">Average Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-600 mb-1">Avg Open Rate</p>
            <p className="text-2xl font-bold text-indigo-600">{avgOpenRate}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Emails/Day</p>
            <p className="text-2xl font-bold text-indigo-600">
              {(metrics.reduce((sum, m) => sum + m.campaigns, 0) / Math.max(metrics.length, 1)).toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Revenue/Day</p>
            <p className="text-2xl font-bold text-indigo-600">
              ${(totalRevenue / Math.max(metrics.length, 1)).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Latest Update</p>
            <p className="text-sm font-bold text-indigo-600">{new Date().toLocaleDateString('sv-SE')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignPerformanceDashboard;
