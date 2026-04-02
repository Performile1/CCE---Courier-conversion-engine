import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { getCRMIntegration, saveCRMIntegration, deleteCRMIntegration, syncLeadsToCRM } from '../services/crmIntegration';

interface CRMManagerProps {
  userId: string;
  leads: any[];
  onSyncComplete?: () => void;
}

export const CRMManager: React.FC<CRMManagerProps> = ({ userId, leads, onSyncComplete }) => {
  const [crmType, setCrmType] = useState<'hubspot' | 'pipedrive' | 'salesforce'>('hubspot');
  const [apiToken, setApiToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setsyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    checkConnection();
  }, [userId]);

  const checkConnection = async () => {
    try {
      const integration = await getCRMIntegration(userId, crmType);
      if (integration) {
        setIsConnected(true);
        setApiToken('***');
      }
    } catch (err) {
      setIsConnected(false);
    }
  };

  const handleConnect = async () => {
    if (!apiToken || apiToken === '***') {
      setError('Please enter your API token');
      return;
    }

    setLoading(true);
    try {
      await saveCRMIntegration(userId, crmType, apiToken);
      setIsConnected(true);
      setApiToken('***');
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await deleteCRMIntegration(userId, crmType);
      setIsConnected(false);
      setApiToken('');
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setsyncing(true);
    setSyncStatus('Syncing leads...');
    try {
      const result = await syncLeadsToCRM(
        userId,
        leads,
        crmType,
        apiToken,
        setSyncStatus
      );
      if (result.success) {
        setSyncStatus(`✅ Synced ${result.leadsCreated} leads to ${crmType}`);
        onSyncComplete?.();
      } else {
        setSyncStatus(`❌ Sync failed: ${result.error}`);
      }
    } catch (err: any) {
      setSyncStatus(`❌ Error: ${err.message}`);
    } finally {
      setsyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-sm border border-dhl-gray-medium p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-dhl-black flex items-center gap-2">
          <Settings className="w-5 h-5 text-dhl-red" />
          CRM Integration
        </h3>
        {isConnected && <CheckCircle className="w-5 h-5 text-dhl-yellow" />}
      </div>

      {error && (
        <div className="p-3 bg-dhl-gray-light border border-dhl-gray-medium rounded-sm flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-dhl-black mb-1">
            CRM Platform
          </label>
          <select
            value={crmType}
            onChange={(e) => setCrmType(e.target.value as any)}
            disabled={isConnected}
            className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black focus:ring-2 focus:ring-dhl-red"
          >
            <option value="hubspot">HubSpot</option>
            <option value="pipedrive">Pipedrive</option>
            <option value="salesforce">Salesforce</option>
          </select>
        </div>

        {!isConnected && (
          <div>
            <label className="block text-sm font-medium text-dhl-black mb-1">
              API Token
            </label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Enter your API token"
              className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black focus:ring-2 focus:ring-dhl-red"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={loading || !apiToken}
            className="flex-1 py-2 px-4 bg-dhl-red hover:bg-red-800 disabled:bg-dhl-gray-medium text-white font-semibold rounded-sm transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Connect
          </button>
        ) : (
          <>
            <button
              onClick={handleSync}
              disabled={syncing || leads.length === 0}
              className="flex-1 py-2 px-4 bg-dhl-yellow hover:bg-dhl-yellow disabled:bg-dhl-gray-medium text-white font-semibold rounded-sm transition-all flex items-center justify-center gap-2"
            >
              {syncing ? <Loader className="w-4 h-4 animate-spin" /> : '📤'}
              Sync {leads.length} Leads
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-sm transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {syncStatus && (
        <div className="p-3 bg-dhl-gray-light border border-dhl-gray-medium rounded-sm text-sm text-blue-900">
          <Loader className="w-4 h-4 inline animate-spin mr-2" />
          {syncStatus}
        </div>
      )}
    </div>
  );
};

export default CRMManager;



