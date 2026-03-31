import React, { useState } from 'react';
import { Download, FileJson, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

interface ExportManagerProps {
  userId: string;
}

export const ExportManager: React.FC<ExportManagerProps> = ({ userId }) => {
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedItems, setSelectedItems] = useState({
    campaigns: true,
    leads: true,
    costs: true,
    analytics: true,
  });

  const downloadJSON = async () => {
    setExporting('json');
    setError('');

    try {
      const data: any = {};

      if (selectedItems.campaigns) {
        const { data: campaigns, error: err } = await supabase
          .from('campaigns')
          .select('*')
          .eq('user_id', userId);
        if (err) throw err;
        data.campaigns = campaigns;
      }

      if (selectedItems.leads) {
        const { data: leads, error: err } = await supabase
          .from('leads')
          .select('*')
          .eq('user_id', userId);
        if (err) throw err;
        data.leads = leads;
      }

      if (selectedItems.costs) {
        const { data: costs, error: err } = await supabase
          .from('cost_tracking')
          .select('*')
          .eq('user_id', userId);
        if (err) throw err;
        data.costs = costs;
      }

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cce-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      setSuccess('Exported to JSON successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(null);
    }
  };

  const downloadExcel = async () => {
    setExporting('excel');
    setError('');

    try {
      const workbook = XLSX.utils.book_new();

      if (selectedItems.campaigns) {
        const { data: campaigns, error: err } = await supabase
          .from('campaigns')
          .select('*')
          .eq('user_id', userId);
        if (err) throw err;

        const sheet = XLSX.utils.json_to_sheet(campaigns || []);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Campaigns');
      }

      if (selectedItems.leads) {
        const { data: leads, error: err } = await supabase
          .from('leads')
          .select('*')
          .eq('user_id', userId);
        if (err) throw err;

        const sheet = XLSX.utils.json_to_sheet(leads || []);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Leads');
      }

      if (selectedItems.costs) {
        const { data: costs, error: err } = await supabase
          .from('cost_tracking')
          .select('*')
          .eq('user_id', userId);
        if (err) throw err;

        const sheet = XLSX.utils.json_to_sheet(costs || []);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Costs');
      }

      if (selectedItems.analytics) {
        const { data: campaigns, error: err } = await supabase
          .from('campaigns')
          .select('name, total_recipients, total_opened, total_clicked, created_at')
          .eq('user_id', userId);
        if (err) throw err;

        const analytics = campaigns?.map((c: any) => ({
          Campaign: c.name,
          Sent: c.total_recipients,
          Opened: c.total_opened,
          Clicked: c.total_clicked,
          OpenRate: `${((c.total_opened / c.total_recipients) * 100).toFixed(1)}%`,
          ClickRate: `${((c.total_clicked / c.total_recipients) * 100).toFixed(1)}%`,
          Date: new Date(c.created_at).toLocaleDateString('sv-SE'),
        })) || [];

        const sheet = XLSX.utils.json_to_sheet(analytics);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Analytics');
      }

      XLSX.writeFile(workbook, `cce-export-${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccess('Exported to Excel successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(null);
    }
  };

  const downloadCSV = async () => {
    setExporting('csv');
    setError('');

    try {
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('name, total_recipients, total_opened, total_clicked, created_at')
        .eq('user_id', userId);

      if (error) throw error;

      const csv = [
        ['Campaign', 'Sent', 'Opened', 'Clicked', 'Open Rate %', 'Click Rate %', 'Date'],
        ...(campaigns?.map((c: any) => [
          c.name,
          c.total_recipients,
          c.total_opened,
          c.total_clicked,
          ((c.total_opened / c.total_recipients) * 100).toFixed(1),
          ((c.total_clicked / c.total_recipients) * 100).toFixed(1),
          new Date(c.created_at).toLocaleDateString('sv-SE'),
        ]) || []),
      ]
        .map((row) => row.join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cce-campaigns-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      setSuccess('Exported to CSV successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
        <Download className="w-5 h-5 text-indigo-600" />
        Export Data
      </h3>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {/* Data Selection */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-900 mb-3">Select data to export:</p>
        <div className="space-y-2">
          {Object.entries(selectedItems).map(([key, value]) => (
            <label key={key} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) =>
                  setSelectedItems({
                    ...selectedItems,
                    [key]: e.target.checked,
                  })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={downloadJSON}
          disabled={exporting !== null}
          className="flex items-center justify-center gap-2 p-4 border border-slate-200 rounded-lg hover:shadow-md transition-all disabled:opacity-50"
        >
          {exporting === 'json' ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <FileJson className="w-5 h-5 text-blue-600" />
          )}
          <div className="text-left">
            <p className="font-medium text-slate-900">JSON</p>
            <p className="text-xs text-slate-600">Structured data format</p>
          </div>
        </button>

        <button
          onClick={downloadExcel}
          disabled={exporting !== null}
          className="flex items-center justify-center gap-2 p-4 border border-slate-200 rounded-lg hover:shadow-md transition-all disabled:opacity-50"
        >
          {exporting === 'excel' ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <FileText className="w-5 h-5 text-green-600" />
          )}
          <div className="text-left">
            <p className="font-medium text-slate-900">Excel</p>
            <p className="text-xs text-slate-600">Multi-sheet workbook</p>
          </div>
        </button>

        <button
          onClick={downloadCSV}
          disabled={exporting !== null}
          className="flex items-center justify-center gap-2 p-4 border border-slate-200 rounded-lg hover:shadow-md transition-all disabled:opacity-50"
        >
          {exporting === 'csv' ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <FileText className="w-5 h-5 text-orange-600" />
          )}
          <div className="text-left">
            <p className="font-medium text-slate-900">CSV</p>
            <p className="text-xs text-slate-600">Campaign metrics</p>
          </div>
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          💡 <strong>Tip:</strong> Export your data regularly for backup and analysis purposes.
          Data is encrypted during export.
        </p>
      </div>
    </div>
  );
};

export default ExportManager;
