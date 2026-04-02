import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Target, BarChart3 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface CampaignROI {
  campaignId: string;
  campaignName: string;
  costInvested: number;
  revenueGenerated: number;
  roi: number;
  roiPercentage: number;
  status: 'draft' | 'sent' | 'completed';
}

interface ROICalculatorProps {
  userId: string;
}

export const ROICalculator: React.FC<ROICalculatorProps> = ({ userId }) => {
  const [campaigns, setCampaigns] = useState<CampaignROI[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'completed'>('completed');

  useEffect(() => {
    loadROIData();
  }, [userId]);

  const loadROIData = async () => {
    try {
      // Get campaigns with analytics
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          status,
          total_recipients,
          total_opened,
          total_clicked
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get cost data
      const { data: costData, error: costError } = await supabase
        .from('cost_tracking')
        .select('user_id, cost_usd')
        .eq('user_id', userId);

      if (costError) throw costError;

      // Calculate total API costs
      const totalAPIcosts = costData?.reduce((sum, c) => sum + c.cost_usd, 0) || 0;
      const apiCostPerCampaign = totalAPIcosts / (data?.length || 1);

      // Calculate ROI per campaign
      const roiData: CampaignROI[] = data?.map((campaign: any) => {
        const costInvested = apiCostPerCampaign;
        // Estimate: 30% of clicks convert to $150 revenue
        const conversions = Math.round((campaign.total_clicked || 0) * 0.3);
        const revenueGenerated = conversions * 150;
        const roi = revenueGenerated - costInvested;
        const roiPercentage = costInvested > 0 ? (roi / costInvested) * 100 : 0;

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          costInvested,
          revenueGenerated,
          roi,
          roiPercentage,
          status: campaign.status,
        };
      }) || [];

      setCampaigns(roiData);
    } catch (err) {
      console.error('Error loading ROI data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-sm p-6 text-center">Loading ROI data...</div>;
  }

  const filteredCampaigns = campaigns.filter(
    (c) => filterStatus === 'all' || c.status === filterStatus
  );

  const totalRevenue = filteredCampaigns.reduce((sum, c) => sum + c.revenueGenerated, 0);
  const totalCost = filteredCampaigns.reduce((sum, c) => sum + c.costInvested, 0);
  const totalROI = totalRevenue - totalCost;
  const avgROI = filteredCampaigns.length > 0 ? totalROI / filteredCampaigns.length : 0;
  const roiPercentage = totalCost > 0 ? (totalROI / totalCost) * 100 : 0;

  const bestPerformer = filteredCampaigns.sort((a, b) => b.roiPercentage - a.roiPercentage)[0];
  const worstPerformer = filteredCampaigns.sort((a, b) => a.roiPercentage - b.roiPercentage)[0];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-sm border border-dhl-gray-medium p-4">
          <p className="text-sm text-dhl-gray-dark mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-dhl-black mb-2">${totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-dhl-gray-dark">{filteredCampaigns.length} campaigns</p>
        </div>

        <div className="bg-white rounded-sm border border-dhl-gray-medium p-4">
          <p className="text-sm text-dhl-gray-dark mb-1">Total Cost</p>
          <p className="text-2xl font-bold text-dhl-black mb-2">${totalCost.toFixed(2)}</p>
          <p className="text-xs text-dhl-gray-dark">API + Email cost</p>
        </div>

        <div
          className={`rounded-sm border p-4 ${
            totalROI >= 0
              ? 'bg-dhl-gray-light border-green-200'
              : 'bg-dhl-gray-light border-dhl-gray-medium'
          }`}
        >
          <p className="text-sm text-dhl-gray-dark mb-1">Total ROI</p>
          <p
            className={`text-2xl font-bold mb-2 ${
              totalROI >= 0 ? 'text-dhl-yellow' : 'text-red-600'
            }`}
          >
            ${totalROI.toFixed(2)}
          </p>
          <p
            className={`text-xs ${
              totalROI >= 0 ? 'text-dhl-yellow' : 'text-red-700'
            }`}
          >
            {roiPercentage.toFixed(1)}% return
          </p>
        </div>

        <div className="bg-white rounded-sm border border-dhl-gray-medium p-4">
          <p className="text-sm text-dhl-gray-dark mb-1">Average ROI/Campaign</p>
          <p className="text-2xl font-bold text-dhl-black mb-2">${avgROI.toFixed(2)}</p>
          <p className="text-xs text-dhl-gray-dark">Per campaign avg</p>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bestPerformer && (
          <div className="bg-dhl-gray-light border border-green-200 rounded-sm p-4">
            <div className="flex items-start gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-dhl-yellow" />
              <div>
                <p className="text-sm font-medium text-dhl-black">Best Performer</p>
                <p className="text-xs text-dhl-gray-dark">{bestPerformer.campaignName}</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-dhl-yellow mb-1">
              {bestPerformer.roiPercentage.toFixed(1)}%
            </p>
            <p className="text-xs text-dhl-yellow">
              ROI: ${bestPerformer.roi.toFixed(2)}
            </p>
          </div>
        )}

        {worstPerformer && (
          <div
            className={`${
              worstPerformer.roi >= 0
                ? 'bg-dhl-gray-light border-amber-200'
                : 'bg-dhl-gray-light border-dhl-gray-medium'
            } border rounded-sm p-4`}
          >
            <div className="flex items-start gap-3 mb-2">
              <Target className="w-5 h-5 text-dhl-yellow" />
              <div>
                <p className="text-sm font-medium text-dhl-black">Needs Improvement</p>
                <p className="text-xs text-dhl-gray-dark">{worstPerformer.campaignName}</p>
              </div>
            </div>
            <p
              className={`text-2xl font-bold mb-1 ${
                worstPerformer.roi >= 0 ? 'text-dhl-yellow' : 'text-red-600'
              }`}
            >
              {worstPerformer.roiPercentage.toFixed(1)}%
            </p>
            <p
              className={`text-xs ${
                worstPerformer.roi >= 0 ? 'text-amber-700' : 'text-red-700'
              }`}
            >
              ROI: ${worstPerformer.roi.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'sent', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-sm font-medium transition-all ${
              filterStatus === status
                ? 'bg-dhl-red text-white'
                : 'bg-dhl-gray-light text-dhl-gray-dark hover:bg-dhl-gray-medium'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Campaign Details */}
      <div className="bg-white rounded-sm border border-dhl-gray-medium p-4">
        <h3 className="font-bold text-dhl-black mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-dhl-red" />
          Campaign ROI Breakdown
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dhl-gray-medium">
                <th className="text-left py-2 px-2 text-dhl-gray-dark font-medium">Campaign</th>
                <th className="text-right py-2 px-2 text-dhl-gray-dark font-medium">Cost</th>
                <th className="text-right py-2 px-2 text-dhl-gray-dark font-medium">Revenue</th>
                <th className="text-right py-2 px-2 text-dhl-gray-dark font-medium">ROI</th>
                <th className="text-right py-2 px-2 text-dhl-gray-dark font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((campaign) => (
                <tr key={campaign.campaignId} className="border-b border-slate-100 hover:bg-dhl-gray-light">
                  <td className="py-2 px-2 font-medium text-dhl-black">
                    {campaign.campaignName}
                  </td>
                  <td className="text-right py-2 px-2 text-dhl-gray-dark">
                    ${campaign.costInvested.toFixed(2)}
                  </td>
                  <td className="text-right py-2 px-2 text-dhl-gray-dark">
                    ${campaign.revenueGenerated.toLocaleString()}
                  </td>
                  <td
                    className={`text-right py-2 px-2 font-bold ${
                      campaign.roi >= 0 ? 'text-dhl-yellow' : 'text-red-600'
                    }`}
                  >
                    ${campaign.roi.toFixed(2)}
                  </td>
                  <td
                    className={`text-right py-2 px-2 font-bold ${
                      campaign.roiPercentage >= 0 ? 'text-dhl-yellow' : 'text-red-600'
                    }`}
                  >
                    {campaign.roiPercentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCampaigns.length === 0 && (
          <p className="text-center text-dhl-gray-dark py-8">No campaigns in this filter</p>
        )}
      </div>

      {/* Recommendation */}
      {roiPercentage > 500 && (
        <div className="bg-dhl-gray-light border border-green-200 rounded-sm p-4">
          <p className="text-sm text-green-900">
            ✅ <strong>Excellent Performance:</strong> Your campaigns are generating{' '}
            <strong>${totalROI.toFixed(2)}</strong> in profit. Consider scaling up successful
            campaigns.
          </p>
        </div>
      )}

      {roiPercentage < 0 && (
        <div className="bg-dhl-gray-light border border-dhl-gray-medium rounded-sm p-4">
          <p className="text-sm text-red-900">
            ⚠️ <strong>Negative ROI:</strong> Your campaigns are losing money. Review targeting,
            messaging, and audience selection.
          </p>
        </div>
      )}
    </div>
  );
};

export default ROICalculator;


