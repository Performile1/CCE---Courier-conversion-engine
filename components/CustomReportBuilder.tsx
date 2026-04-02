import React, { useState } from 'react';
import { FileText, Plus, Trash2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  metrics: string[];
  dateRange: 'week' | 'month' | 'quarter' | 'year' | 'custom';
}

interface CustomReportBuilderProps {
  userId: string;
  onReportGenerated?: (report: any) => void;
}

const AVAILABLE_METRICS = [
  { id: 'campaigns', label: 'Campaigns Sent', category: 'Email' },
  { id: 'opens', label: 'Total Opens', category: 'Email' },
  { id: 'clicks', label: 'Total Clicks', category: 'Email' },
  { id: 'openRate', label: 'Open Rate %', category: 'Email' },
  { id: 'clickRate', label: 'Click Rate %', category: 'Email' },
  { id: 'conversions', label: 'Conversions', category: 'Sales' },
  { id: 'revenue', label: 'Revenue Generated', category: 'Sales' },
  { id: 'totalCost', label: 'Total API Cost', category: 'Finance' },
  { id: 'roi', label: 'ROI', category: 'Finance' },
  { id: 'roiPercentage', label: 'ROI %', category: 'Finance' },
  { id: 'avgCostPerCampaign', label: 'Avg Cost/Campaign', category: 'Finance' },
  { id: 'leadsAdded', label: 'Leads Added', category: 'Prospects' },
  { id: 'hallucination', label: 'Avg Hallucination Score', category: 'Quality' },
  { id: 'crmSyncs', label: 'CRM Syncs', category: 'Integration' },
];

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'weekly-summary',
    name: 'Weekly Summary',
    description: 'Quick overview of weekly campaign performance',
    metrics: ['campaigns', 'opens', 'clicks', 'revenue'],
    dateRange: 'week',
  },
  {
    id: 'monthly-executive',
    name: 'Monthly Executive Report',
    description: 'Comprehensive monthly performance and ROI analysis',
    metrics: ['campaigns', 'opens', 'openRate', 'clicks', 'clickRate', 'revenue', 'totalCost', 'roi', 'roiPercentage'],
    dateRange: 'month',
  },
  {
    id: 'quarterly-financial',
    name: 'Quarterly Financial Report',
    description: 'Financial performance review with cost analysis',
    metrics: ['totalCost', 'revenue', 'roi', 'roiPercentage', 'avgCostPerCampaign'],
    dateRange: 'quarter',
  },
];

export const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({
  userId,
  onReportGenerated,
}) => {
  const [view, setView] = useState<'templates' | 'builder'>('templates');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [reportName, setReportName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedMetrics(template.metrics);
    setDateRange(template.dateRange);
    setReportName(template.name);
    setView('builder');
  };

  const handleMetricToggle = (metricId: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metricId)
        ? prev.filter((m) => m !== metricId)
        : [...prev, metricId]
    );
  };

  const generateReport = async () => {
    if (!reportName) {
      setError('Please enter a report name');
      return;
    }

    if (selectedMetrics.length === 0) {
      setError('Please select at least one metric');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      // Fetch data
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', userId);

      const { data: costs, error: costError } = await supabase
        .from('cost_tracking')
        .select('*')
        .eq('user_id', userId);

      if (campaignError) throw campaignError;
      if (costError) throw costError;

      // Build report
      const report: any = {
        name: reportName,
        generatedAt: new Date().toISOString(),
        dateRange,
        metrics: {},
      };

      if (selectedMetrics.includes('campaigns')) {
        report.metrics.campaigns = campaigns?.length || 0;
      }

      if (selectedMetrics.includes('opens')) {
        report.metrics.opens = campaigns?.reduce((sum, c) => sum + (c.total_opened || 0), 0) || 0;
      }

      if (selectedMetrics.includes('clicks')) {
        report.metrics.clicks = campaigns?.reduce((sum, c) => sum + (c.total_clicked || 0), 0) || 0;
      }

      if (selectedMetrics.includes('openRate')) {
        const totalOpens = campaigns?.reduce((sum, c) => sum + (c.total_opened || 0), 0) || 0;
        const totalSent = campaigns?.reduce((sum, c) => sum + (c.total_recipients || 0), 0) || 0;
        report.metrics.openRate = totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(1) : 0;
      }

      if (selectedMetrics.includes('clickRate')) {
        const totalClicks = campaigns?.reduce((sum, c) => sum + (c.total_clicked || 0), 0) || 0;
        const totalSent = campaigns?.reduce((sum, c) => sum + (c.total_recipients || 0), 0) || 0;
        report.metrics.clickRate = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : 0;
      }

      if (selectedMetrics.includes('totalCost')) {
        report.metrics.totalCost = costs?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0;
      }

      if (selectedMetrics.includes('revenue')) {
        const totalClicks = campaigns?.reduce((sum, c) => sum + (c.total_clicked || 0), 0) || 0;
        const conversions = Math.round(totalClicks * 0.3);
        report.metrics.revenue = conversions * 150;
      }

      onReportGenerated?.(report);
      setSuccess('Report generated successfully!');
      setReportName('');
      setSelectedMetrics([]);

      // Reset after 3 seconds
      setTimeout(() => {
        setSuccess('');
        setView('templates');
      }, 3000);
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
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

      {view === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-dhl-black flex items-center gap-2">
              <FileText className="w-5 h-5 text-dhl-red" />
              Report Templates
            </h3>
            <button
              onClick={() => setView('builder')}
              className="py-2 px-4 bg-dhl-red hover:bg-red-800 text-white font-semibold rounded-sm transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Custom Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {REPORT_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="border border-dhl-gray-medium rounded-sm p-4 hover:shadow-md transition-all cursor-pointer"
                onClick={() => handleTemplateSelect(template)}
              >
                <h4 className="font-bold text-dhl-black mb-2">{template.name}</h4>
                <p className="text-sm text-dhl-gray-dark mb-3">{template.description}</p>
                <p className="text-xs text-slate-500 mb-3">
                  Metrics: {template.metrics.length}
                </p>
                <button className="w-full py-2 px-3 bg-dhl-gray-light hover:bg-dhl-gray-medium text-dhl-red font-medium rounded-sm transition-all">
                  Use Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'builder' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                setView('templates');
                setReportName('');
                setSelectedMetrics([]);
              }}
              className="text-dhl-red hover:text-red-800 font-medium text-sm"
            >
              ← Back to Templates
            </button>
          </div>

          <div className="bg-white rounded-sm border border-dhl-gray-medium p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-dhl-black mb-1">
                Report Name
              </label>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="e.g., March 2026 Performance Report"
                className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black focus:ring-2 focus:ring-dhl-red"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dhl-black mb-1">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black focus:ring-2 focus:ring-dhl-red"
              >
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 90 Days</option>
                <option value="year">Last Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dhl-black mb-3">
                Metrics ({selectedMetrics.length} selected)
              </label>
              <div className="space-y-2  max-h-96 overflow-y-auto">
                {['Email', 'Sales', 'Finance', 'Prospects', 'Quality', 'Integration'].map((category) => (
                  <div key={category}>
                    <p className="text-xs font-bold text-dhl-gray-dark uppercase mb-2">{category}</p>
                    <div className="space-y-1 mb-3">
                      {AVAILABLE_METRICS.filter((m) => m.category === category).map((metric) => (
                        <label
                          key={metric.id}
                          className="flex items-center gap-2 p-2 hover:bg-dhl-gray-light rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMetrics.includes(metric.id)}
                            onChange={() => handleMetricToggle(metric.id)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-dhl-gray-dark">{metric.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 border-t border-dhl-gray-medium pt-4">
              <button
                onClick={generateReport}
                disabled={generating}
                className="flex-1 py-2 px-4 bg-dhl-red hover:bg-red-800 disabled:bg-dhl-gray-medium text-white font-semibold rounded-sm transition-all flex items-center justify-center gap-2"
              >
                {generating ? '⌛ Generating...' : '📊 Generate Report'}
              </button>
              <button
                onClick={() => setView('templates')}
                className="py-2 px-4 bg-dhl-gray-medium hover:bg-dhl-gray-medium text-dhl-black font-semibold rounded-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomReportBuilder;



