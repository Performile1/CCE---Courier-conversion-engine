import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, TrendingDown, Filter } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface CostData {
  model: string;
  cost: number;
  percentage: number;
  count: number;
}

interface CostAnalysisDashboardProps {
  userId: string;
  dateRange?: [Date, Date];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const CostAnalysisDashboard: React.FC<CostAnalysisDashboardProps> = ({
  userId,
  dateRange,
}) => {
  const [costByModel, setCostByModel] = useState<CostData[]>([]);
  const [costByService, setCostByService] = useState<any[]>([]);
  const [monthlyCosts, setMonthlyCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    loadCostAnalytics();
  }, [userId, dateRange]);

  const loadCostAnalytics = async () => {
    try {
      // Get cost by model
      const { data: costData, error: costError } = await supabase
        .from('cost_tracking')
        .select('service, model_or_action, cost_usd, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (costError) throw costError;

      // Group by model
      const modelCosts = new Map<string, { cost: number; count: number }>();
      const serviceCosts = new Map<string, number>();
      const monthCosts = new Map<string, number>();

      costData?.forEach((record: any) => {
        // By model
        const model = record.model_or_action || 'Unknown';
        const existing = modelCosts.get(model) || { cost: 0, count: 0 };
        existing.cost += record.cost_usd || 0;
        existing.count += 1;
        modelCosts.set(model, existing);

        // By service
        const service = record.service || 'Unknown';
        serviceCosts.set(service, (serviceCosts.get(service) || 0) + record.cost_usd);

        // By month
        const month = new Date(record.created_at).toLocaleDateString('sv-SE', {
          year: 'numeric',
          month: '2-digit',
        });
        monthCosts.set(month, (monthCosts.get(month) || 0) + record.cost_usd);
      });

      // Convert to arrays
      const totalModelCost = Array.from(modelCosts.values()).reduce((sum, m) => sum + m.cost, 0);
      const modelArray = Array.from(modelCosts.entries())
        .map(([model, data]) => ({
          model,
          cost: parseFloat(data.cost.toFixed(2)),
          percentage: ((data.cost / totalModelCost) * 100).toFixed(1),
          count: data.count,
        }))
        .sort((a, b) => b.cost - a.cost);

      const serviceArray = Array.from(serviceCosts.entries())
        .map(([service, cost]) => ({
          service,
          cost: parseFloat(cost.toFixed(2)),
        }))
        .sort((a, b) => b.cost - a.cost);

      const monthArray = Array.from(monthCosts.entries())
        .map(([month, cost]) => ({
          month,
          cost: parseFloat(cost.toFixed(2)),
        }))
        .sort();

      setCostByModel(modelArray);
      setCostByService(serviceArray);
      setMonthlyCosts(monthArray);
      setTotalCost(totalModelCost);
    } catch (err) {
      console.error('Error loading cost analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-sm p-6 text-center">Loading cost analysis...</div>;
  }

  const avgCostPerUse = costByModel.length > 0 ? (totalCost / costByModel.reduce((sum, m) => sum + m.count, 0)).toFixed(4) : '0';
  const highestCostModel = costByModel[0];

  return (
    <div className="space-y-6">
      {/* Total Cost & Trend */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-sm border border-dhl-gray-medium p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-dhl-gray-dark mb-1">Total API Cost (All Time)</p>
            <p className="text-4xl font-bold text-dhl-black mb-2">${totalCost.toFixed(2)}</p>
            <p className="text-xs text-dhl-gray-dark flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-dhl-yellow" />
              Average: ${avgCostPerUse} per call
            </p>
          </div>
          <DollarSign className="w-12 h-12 text-red-600 opacity-20" />
        </div>
      </div>

      {/* Cost by Model */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-sm border border-dhl-gray-medium p-4">
          <h3 className="font-bold text-dhl-black mb-4">Cost by Model</h3>
          {costByModel.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={costByModel}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ model, percentage }) => `${model.substring(0, 10)}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="cost"
                >
                  {costByModel.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${parseFloat(value).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-dhl-gray-dark py-8">No cost data</p>
          )}
        </div>

        {/* Cost Breakdown Table */}
        <div className="bg-white rounded-sm border border-dhl-gray-medium p-4">
          <h3 className="font-bold text-dhl-black mb-4">Cost Breakdown</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {costByModel.map((model, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 hover:bg-dhl-gray-light rounded">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  ></div>
                  <span className="text-sm font-medium text-dhl-black">{model.model}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-dhl-black">${model.cost.toFixed(2)}</p>
                  <p className="text-xs text-dhl-gray-dark">{model.count} calls</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost by Service */}
      <div className="bg-white rounded-sm border border-dhl-gray-medium p-4">
        <h3 className="font-bold text-dhl-black mb-4">Cost by Service</h3>
        {costByService.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={costByService}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="service" />
              <YAxis />
              <Tooltip formatter={(value) => `$${parseFloat(value).toFixed(2)}`} />
              <Bar dataKey="cost" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-dhl-gray-dark py-8">No data</p>
        )}
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-sm border border-dhl-gray-medium p-4">
        <h3 className="font-bold text-dhl-black mb-4">Monthly Cost Trend</h3>
        {monthlyCosts.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyCosts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `$${parseFloat(value).toFixed(2)}`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#3b82f6"
                dot={{ fill: '#3b82f6' }}
                name="Cost ($)"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-dhl-gray-dark py-8">No data</p>
        )}
      </div>

      {/* Cost Summary */}
      {highestCostModel && (
        <div className="bg-dhl-gray-light border border-amber-200 rounded-sm p-4">
          <p className="text-sm text-amber-900 mb-2">
            💡 <strong>Top Cost Driver:</strong> {highestCostModel.model} accounts for{' '}
            {highestCostModel.percentage}% of your API costs
          </p>
          <p className="text-xs text-amber-800">
            Consider switching to more cost-efficient models for routine tasks.
          </p>
        </div>
      )}
    </div>
  );
};

export default CostAnalysisDashboard;


