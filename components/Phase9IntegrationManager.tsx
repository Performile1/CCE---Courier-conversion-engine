import React, { useState, useEffect } from 'react';
import { Settings, Zap, Code, GitBranch, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface IntegrationConfig {
  id: string;
  name: string;
  type: 'webhook' | 'adapter' | 'event-trigger' | 'zapier' | 'custom-api';
  status: 'active' | 'inactive' | 'error';
  lastSync: string | null;
  errorMessage?: string;
  config: Record<string, any>;
}

interface IntegrationManagerComponentProps {
  userId: string;
}

const INTEGRATION_TYPES = [
  {
    id: 'webhook',
    label: 'Webhooks',
    description: 'Send real-time data to external URLs',
    icon: '🔗',
    color: 'indigo',
  },
  {
    id: 'adapter',
    label: 'Custom Adapters',
    description: 'Transform and process data with custom logic',
    icon: '⚙️',
    color: 'purple',
  },
  {
    id: 'event-trigger',
    label: 'Event Triggers',
    description: 'Configure what actions trigger integrations',
    icon: '⚡',
    color: 'yellow',
  },
  {
    id: 'zapier',
    label: 'Zapier',
    description: 'Connect with 6000+ apps via Zapier',
    icon: '🚀',
    color: 'orange',
  },
  {
    id: 'custom-api',
    label: 'Custom API',
    description: 'Build and deploy custom API connectors',
    icon: '🔌',
    color: 'green',
  },
];

export const IntegrationManagerComponent: React.FC<IntegrationManagerComponentProps> = ({
  userId,
}) => {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrations();
  }, [userId]);

  const loadIntegrations = async () => {
    try {
      // Load from various localStorage keys
      const webhooks = JSON.parse(localStorage.getItem(`webhooks_${userId}`) || '[]');
      const adapters = JSON.parse(localStorage.getItem(`adapters_${userId}`) || '[]');
      const eventTriggers = JSON.parse(localStorage.getItem(`eventTriggers_${userId}`) || '[]');

      const allIntegrations: IntegrationConfig[] = [
        ...webhooks.map((w: any) => ({
          id: w.id,
          name: `Webhook: ${w.url.substring(0, 30)}`,
          type: 'webhook' as const,
          status: w.active ? 'active' : 'inactive',
          lastSync: w.lastTriggered,
          config: w,
        })),
        ...adapters.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: 'adapter' as const,
          status: a.active ? 'active' : 'inactive',
          lastSync: null,
          config: a,
        })),
        ...eventTriggers.map((et: any) => ({
          id: et.id,
          name: `Trigger: ${et.event}`,
          type: 'event-trigger' as const,
          status: et.active ? 'active' : 'inactive',
          lastSync: null,
          config: et,
        })),
      ];

      setIntegrations(allIntegrations);
    } catch (err) {
      console.error('Error loading integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getTypeIcon = (type: string) => {
    const integrationType = INTEGRATION_TYPES.find((it) => it.id === type);
    return integrationType?.icon || '🔧';
  };

  if (loading) {
    return <div className="bg-white rounded-lg p-6 text-center">Loading integrations...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-slate-700" />
          Integration Manager
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Manage all integrations, webhooks, and custom adapters in one centralized place
        </p>
      </div>

      {/* Integration Types Overview */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-3">Integration Types</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {INTEGRATION_TYPES.map((type) => {
            const count = integrations.filter((i) => i.type === type.id).length;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(selectedType === type.id ? null : type.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedType === type.id
                    ? `border-${type.color}-600 bg-${type.color}-50`
                    : 'border-slate-300 bg-white hover:border-slate-400'
                }`}
              >
                <div className="text-2xl mb-2">{type.icon}</div>
                <p className="font-semibold text-sm text-slate-900">{type.label}</p>
                <p className="text-xs text-slate-600 mt-1">{type.description}</p>
                <p className="text-xs font-bold text-slate-700 mt-2">{count} active</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Integrations List */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          {selectedType
            ? `${INTEGRATION_TYPES.find((t) => t.id === selectedType)?.label || 'All'} Integrations`
            : 'All Integrations'}
          ({integrations.filter((i) => !selectedType || i.type === selectedType).length})
        </h4>

        <div className="space-y-2">
          {integrations.filter((i) => !selectedType || i.type === selectedType).length === 0 ? (
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-6 text-center">
              <p className="text-slate-600">
                No {selectedType ? INTEGRATION_TYPES.find((t) => t.id === selectedType)?.label : ''} integrations yet
              </p>
            </div>
          ) : (
            integrations
              .filter((i) => !selectedType || i.type === selectedType)
              .map((integration) => (
                <div
                  key={integration.id}
                  className="border border-slate-300 rounded-lg p-4 bg-white hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getTypeIcon(integration.type)}</span>
                        <div>
                          <h5 className="font-semibold text-slate-900">{integration.name}</h5>
                          <p className="text-xs text-slate-600">
                            Type: {INTEGRATION_TYPES.find((t) => t.id === integration.type)?.label}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(integration.status)}`}
                        >
                          {integration.status === 'active' ? (
                            <CheckCircle className="w-3 h-3 inline mr-1" />
                          ) : (
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                          )}
                          {integration.status}
                        </span>

                        {integration.lastSync && (
                          <span className="text-xs text-slate-600">
                            Last sync: {new Date(integration.lastSync).toLocaleTimeString()}
                          </span>
                        )}

                        {integration.errorMessage && (
                          <span className="text-xs text-red-600">{integration.errorMessage}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setShowDetails(showDetails === integration.id ? null : integration.id)}
                      className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-sm font-medium"
                    >
                      {showDetails === integration.id ? 'Hide' : 'View'} Details
                    </button>
                  </div>

                  {/* Details Panel */}
                  {showDetails === integration.id && (
                    <div className="border-t border-slate-200 mt-4 pt-4">
                      <h6 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        Configuration
                      </h6>
                      <pre className="bg-slate-900 text-green-400 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(integration.config, null, 2)}
                      </pre>

                      <div className="mt-3 flex gap-2">
                        <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium">
                          Test
                        </button>
                        <button className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-900 text-sm rounded font-medium">
                          Edit
                        </button>
                        <button className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded font-medium">
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </div>

      {/* Integration Statistics */}
      <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
        <h4 className="font-semibold text-slate-900 mb-3">Integration Statistics</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {INTEGRATION_TYPES.map((type) => {
            const total = integrations.filter((i) => i.type === type.id).length;
            const active = integrations.filter((i) => i.type === type.id && i.status === 'active').length;
            return (
              <div key={type.id} className="text-center">
                <p className="text-2xl font-bold text-slate-900">{active}</p>
                <p className="text-xs text-slate-600 mt-1">of {total} {type.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">🚀 Quick Start: Adding Integrations</h4>
        <ol className="text-sm text-blue-900 space-y-1 list-decimal list-inside">
          <li>Go to the specific integration tab (Webhooks, Adapters, etc.)</li>
          <li>Click "Create/Add" to configure a new integration</li>
          <li>Test the integration to ensure it works correctly</li>
          <li>Monitor in this Integration Manager for status and logs</li>
          <li>Set up event triggers to automatically invoke integrations</li>
        </ol>
      </div>
    </div>
  );
};

export default IntegrationManagerComponent;
