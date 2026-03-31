import { supabase } from './supabaseClient';

export interface AnalyticsData {
  totalCampaigns: number;
  totalOpens: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  averageOpenRate: number;
  averageClickRate: number;
  totalCost: number;
  roi: number;
  roiPercentage: number;
}

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
  conversions: number;
  revenue: number;
  cost: number;
  roi: number;
  createdAt: string;
}

export interface CostBreakdown {
  model: string;
  totalCost: number;
  callCount: number;
  averageCostPerCall: number;
  percentage: number;
}

/**
 * Get comprehensive analytics for a user
 */
export const getAnalytics = async (userId: string): Promise<AnalyticsData> => {
  try {
    // Get campaigns
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('total_recipients, total_opened, total_clicked')
      .eq('user_id', userId);

    if (campaignError) throw campaignError;

    const totalCampaigns = campaigns?.length || 0;
    const totalOpens = campaigns?.reduce((sum, c) => sum + (c.total_opened || 0), 0) || 0;
    const totalClicks = campaigns?.reduce((sum, c) => sum + (c.total_clicked || 0), 0) || 0;
    const totalSent = campaigns?.reduce((sum, c) => sum + (c.total_recipients || 0), 0) || 0;

    // Estimate conversions (30% of clicks)
    const totalConversions = Math.round(totalClicks * 0.3);
    const totalRevenue = totalConversions * 150; // $150 per conversion

    // Get costs
    const { data: costs, error: costError } = await supabase
      .from('cost_tracking')
      .select('cost_usd')
      .eq('user_id', userId);

    if (costError) throw costError;

    const totalCost = costs?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0;
    const roi = totalRevenue - totalCost;
    const roiPercentage = totalCost > 0 ? (roi / totalCost) * 100 : 0;

    return {
      totalCampaigns,
      totalOpens,
      totalClicks,
      totalConversions,
      totalRevenue,
      averageOpenRate: totalSent > 0 ? (totalOpens / totalSent) * 100 : 0,
      averageClickRate: totalSent > 0 ? (totalClicks / totalSent) * 100 : 0,
      totalCost,
      roi,
      roiPercentage,
    };
  } catch (error) {
    console.error('Error getting analytics:', error);
    throw error;
  }
};

/**
 * Get detailed campaign metrics
 */
export const getCampaignMetrics = async (userId: string): Promise<CampaignMetrics[]> => {
  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, total_recipients, total_opened, total_clicked, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get aggregated cost
    const { data: costs, error: costError } = await supabase
      .from('cost_tracking')
      .select('cost_usd')
      .eq('user_id', userId);

    if (costError) throw costError;

    const totalCost = costs?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0;
    const costPerCampaign = totalCost / (campaigns?.length || 1);

    return campaigns?.map((campaign: any) => {
      const sent = campaign.total_recipients || 0;
      const opened = campaign.total_opened || 0;
      const clicked = campaign.total_clicked || 0;
      const conversions = Math.round(clicked * 0.3);
      const revenue = conversions * 150;

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        sent,
        opened,
        clicked,
        openRate: sent > 0 ? (opened / sent) * 100 : 0,
        clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
        conversions,
        revenue,
        cost: costPerCampaign,
        roi: revenue - costPerCampaign,
        createdAt: campaign.created_at,
      };
    }) || [];
  } catch (error) {
    console.error('Error getting campaign metrics:', error);
    throw error;
  }
};

/**
 * Get cost breakdown by model
 */
export const getCostBreakdown = async (userId: string): Promise<CostBreakdown[]> => {
  try {
    const { data: costs, error } = await supabase
      .from('cost_tracking')
      .select('model_or_action, cost_usd')
      .eq('user_id', userId);

    if (error) throw error;

    const breakdown = new Map<string, { totalCost: number; callCount: number }>();

    costs?.forEach((record: any) => {
      const model = record.model_or_action || 'Unknown';
      const existing = breakdown.get(model) || { totalCost: 0, callCount: 0 };
      existing.totalCost += record.cost_usd || 0;
      existing.callCount += 1;
      breakdown.set(model, existing);
    });

    const totalCost = Array.from(breakdown.values()).reduce((sum, v) => sum + v.totalCost, 0);

    return Array.from(breakdown.entries())
      .map(([model, data]) => ({
        model,
        totalCost: parseFloat(data.totalCost.toFixed(2)),
        callCount: data.callCount,
        averageCostPerCall: parseFloat((data.totalCost / data.callCount).toFixed(6)),
        percentage: (data.totalCost / totalCost) * 100,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  } catch (error) {
    console.error('Error getting cost breakdown:', error);
    throw error;
  }
};

/**
 * Get metrics for a specific date range
 */
export const getMetricsByDateRange = async (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<AnalyticsData> => {
  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('total_recipients, total_opened, total_clicked')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const totalCampaigns = campaigns?.length || 0;
    const totalOpens = campaigns?.reduce((sum, c) => sum + (c.total_opened || 0), 0) || 0;
    const totalClicks = campaigns?.reduce((sum, c) => sum + (c.total_clicked || 0), 0) || 0;
    const totalSent = campaigns?.reduce((sum, c) => sum + (c.total_recipients || 0), 0) || 0;

    const totalConversions = Math.round(totalClicks * 0.3);
    const totalRevenue = totalConversions * 150;

    const { data: costs, error: costError } = await supabase
      .from('cost_tracking')
      .select('cost_usd')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (costError) throw costError;

    const totalCost = costs?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0;
    const roi = totalRevenue - totalCost;
    const roiPercentage = totalCost > 0 ? (roi / totalCost) * 100 : 0;

    return {
      totalCampaigns,
      totalOpens,
      totalClicks,
      totalConversions,
      totalRevenue,
      averageOpenRate: totalSent > 0 ? (totalOpens / totalSent) * 100 : 0,
      averageClickRate: totalSent > 0 ? (totalClicks / totalSent) * 100 : 0,
      totalCost,
      roi,
      roiPercentage,
    };
  } catch (error) {
    console.error('Error getting metrics by date range:', error);
    throw error;
  }
};

/**
 * Get trending metrics over time
 */
export const getTrendingMetrics = async (
  userId: string,
  days: number = 30
): Promise<
  Array<{
    date: string;
    opens: number;
    clicks: number;
    conversions: number;
    revenue: number;
  }>
> => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('created_at, total_opened, total_clicked')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const metrics = new Map<
      string,
      { opens: number; clicks: number; conversions: number; revenue: number }
    >();

    campaigns?.forEach((campaign: any) => {
      const date = new Date(campaign.created_at).toLocaleDateString('sv-SE');
      const existing = metrics.get(date) || {
        opens: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      };

      existing.opens += campaign.total_opened || 0;
      existing.clicks += campaign.total_clicked || 0;
      existing.conversions += Math.round((campaign.total_clicked || 0) * 0.3);
      existing.revenue = existing.conversions * 150;

      metrics.set(date, existing);
    });

    return Array.from(metrics.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));
  } catch (error) {
    console.error('Error getting trending metrics:', error);
    throw error;
  }
};

/**
 * Export analytics to PDF (requires external library)
 */
export const exportAnalyticsToPDF = async (analytics: AnalyticsData, filename: string) => {
  try {
    // This would use a library like html2pdf or pdfkit
    // For now, log to console and user can print-to-PDF
    console.log('Export to PDF:', analytics);
    console.log('User should use browser print-to-PDF feature');
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
};
