import React, { useEffect, useState } from 'react';
import { Settings, Plus, Edit2, Trash2, CheckCircle, AlertCircle, Code, TestTube } from 'lucide-react';
import { createCustomAdapter, deleteCustomAdapter, loadCustomAdapters } from '../services/automationConfigService';

interface CustomAdapter {
  id: string;
  name: string;
  description: string;
  type: 'http' | 'javascript' | 'zapier';
  config: Record<string, any>;
  active: boolean;
  createdAt: string;
}

interface CustomIntegrationAdapterProps {
  userId: string;
}

const ADAPTER_TEMPLATES = {
  http: {
    name: 'HTTP Request',
    description: 'Send data to external HTTP endpoint',
    config: {
      method: 'POST',
      url: '',
      headers: { 'Content-Type': 'application/json' },
      bodyTemplate: '{"event": "{{event}}", "data": {{data}}}',
    },
  },
  javascript: {
    name: 'JavaScript Custom Logic',
    description: 'Execute custom JavaScript transformations',
    config: {
      code: `
// Input: { event, data, timestamp }
// Output: Processed data

function transform(input) {
  return {
    ...input.data,
    processedAt: new Date().toISOString()
  };
}

transform(input);
      `,
    },
  },
  zapier: {
    name: 'Zapier Integration',
    description: 'Connect with Zapier for complex workflows',
    config: {
      webhookUrl: '',
      triggerOn: ['campaign.completed', 'lead.created'],
    },
  },
};

export const CustomIntegrationAdapter: React.FC<CustomIntegrationAdapterProps> = ({
  userId,
}) => {
  const [adapters, setAdapters] = useState<CustomAdapter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<'http' | 'javascript' | 'zapier'>('http');
  const [adapterName, setAdapterName] = useState('');
  const [adapterDescription, setAdapterDescription] = useState('');
  const [config, setConfig] = useState<Record<string, any>>(ADAPTER_TEMPLATES.http.config);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    const hydrateAdapters = async () => {
      try {
        const items = await loadCustomAdapters(userId);
        setAdapters(items);
      } catch (err) {
        console.error('Error loading custom adapters:', err);
      }
    };

    hydrateAdapters();
  }, [userId]);

  const handleAddAdapter = async () => {
    if (!adapterName) {
      alert('Enter adapter name');
      return;
    }

    setSaving(true);

    try {
      const newAdapter = await createCustomAdapter(userId, {
        name: adapterName,
        description: adapterDescription,
        type: selectedType,
        config,
        active: true
      });

      const updated = [...adapters, newAdapter];
      setAdapters(updated);

      setAdapterName('');
      setAdapterDescription('');
      setConfig(ADAPTER_TEMPLATES.http.config);
      setShowForm(false);
    } catch (err) {
      alert('Failed to add adapter');
    } finally {
      setSaving(false);
    }
  };

  const testAdapter = (adapter: CustomAdapter) => {
    try {
      if (adapter.type === 'javascript') {
        const testData = {
          event: 'test.integration',
          data: { testKey: 'testValue' },
          timestamp: new Date().toISOString(),
        };

        // In real implementation, would execute securely
        setTestResult(`✅ JavaScript adapter would process this data:\n${JSON.stringify(testData, null, 2)}`);
      } else if (adapter.type === 'http') {
        setTestResult(
          `✅ Would send POST request to:\n${adapter.config.url || '[URL not set]'}`
        );
      } else if (adapter.type === 'zapier') {
        setTestResult(
          `✅ Would trigger Zapier webhook:\n${adapter.config.webhookUrl || '[Webhook URL not set]'}`
        );
      }
    } catch (err: any) {
      setTestResult(`❌ Error: ${err.message}`);
    }

    setTimeout(() => setTestResult(''), 5000);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-dhl-black flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-dhl-red" />
        Custom Integration Adapters
      </h3>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 px-4 bg-dhl-red hover:bg-red-800 text-white font-semibold rounded-sm transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Adapter
        </button>
      )}

      {showForm && (
        <div className="border border-dhl-gray-medium rounded-sm p-4 space-y-4 bg-dhl-gray-light">
          {/* Adapter Type Selection */}
          <div>
            <label className="block text-sm font-medium text-dhl-black mb-2">
              Adapter Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ADAPTER_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedType(key as 'http' | 'javascript' | 'zapier');
                    setConfig(template.config);
                  }}
                  className={`p-3 rounded-sm border-2 text-left transition-all ${
                    selectedType === key
                      ? 'border-dhl-red bg-dhl-gray-light'
                      : 'border-dhl-gray-medium bg-white hover:border-dhl-red'
                  }`}
                >
                  <p className="font-medium text-sm text-dhl-black">{template.name}</p>
                  <p className="text-xs text-dhl-gray-dark mt-1">{template.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Adapter Details */}
          <div>
            <label className="block text-sm font-medium text-dhl-black mb-1">
              Adapter Name
            </label>
            <input
              type="text"
              value={adapterName}
              onChange={(e) => setAdapterName(e.target.value)}
              placeholder="e.g., Slack Notifications"
              className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dhl-black mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={adapterDescription}
              onChange={(e) => setAdapterDescription(e.target.value)}
              placeholder="What does this adapter do?"
              className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black"
            />
          </div>

          {/* Type-Specific Configuration */}
          {selectedType === 'http' && (
            <>
              <div>
                <label className="block text-sm font-medium text-dhl-black mb-1">
                  HTTP Method
                </label>
                <select
                  value={config.method}
                  onChange={(e) =>
                    setConfig({ ...config, method: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black"
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dhl-black mb-1">
                  Endpoint URL
                </label>
                <input
                  type="text"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://api.example.com/webhook"
                  className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dhl-black mb-1">
                  Body Template
                </label>
                <textarea
                  value={config.bodyTemplate}
                  onChange={(e) =>
                    setConfig({ ...config, bodyTemplate: e.target.value })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black font-mono text-xs"
                />
                <p className="text-xs text-dhl-gray-dark mt-1">
                  Use {'{{event}}'} and {'{{data}}'} placeholders
                </p>
              </div>
            </>
          )}

          {selectedType === 'javascript' && (
            <div>
              <label className="block text-sm font-medium text-dhl-black mb-1">
                Transformation Code
              </label>
              <textarea
                value={config.code}
                onChange={(e) => setConfig({ ...config, code: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black font-mono text-xs"
              />
              <p className="text-xs text-dhl-gray-dark mt-1">
                Function receives {'{ event, data, timestamp }'} and must return transformed data
              </p>
            </div>
          )}

          {selectedType === 'zapier' && (
            <div>
              <label className="block text-sm font-medium text-dhl-black mb-1">
                Zapier Webhook URL
              </label>
              <input
                type="text"
                value={config.webhookUrl}
                onChange={(e) =>
                  setConfig({ ...config, webhookUrl: e.target.value })
                }
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm text-dhl-black"
              />
            </div>
          )}

          <div className="flex gap-2 border-t border-dhl-gray-medium pt-4">
            <button
              onClick={handleAddAdapter}
              disabled={saving}
              className="flex-1 py-2 px-4 bg-dhl-red hover:bg-red-800 disabled:bg-dhl-gray-medium text-white font-semibold rounded-sm"
            >
              {saving ? 'Creating...' : 'Create Adapter'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setAdapterName('');
              }}
              className="flex-1 py-2 px-4 bg-dhl-gray-medium hover:bg-dhl-gray-medium text-dhl-black font-semibold rounded-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Test Result Display */}
      {testResult && (
        <div className="bg-dhl-gray-light border border-dhl-gray-medium rounded-sm p-3">
          <p className="text-sm text-blue-900 font-mono whitespace-pre-wrap">{testResult}</p>
        </div>
      )}

      {/* Adapters List */}
      <div className="space-y-2">
        {adapters.length === 0 ? (
          <p className="text-sm text-dhl-gray-dark text-center py-4">No adapters created</p>
        ) : (
          adapters.map((adapter) => (
            <div key={adapter.id} className="border border-dhl-gray-medium rounded-sm p-3 bg-white">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {adapter.active ? (
                      <CheckCircle className="w-4 h-4 text-dhl-yellow" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <h4 className="font-semibold text-dhl-black">{adapter.name}</h4>
                    <span className="text-xs bg-dhl-gray-light text-dhl-red px-2 py-0.5 rounded-sm">
                      {adapter.type}
                    </span>
                  </div>
                  {adapter.description && (
                    <p className="text-xs text-dhl-gray-dark mt-1">{adapter.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => testAdapter(adapter)}
                    className="p-1 hover:bg-dhl-gray-light rounded text-dhl-red"
                  >
                    <TestTube className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      await deleteCustomAdapter(userId, adapter.id);
                      setAdapters((prev) => prev.filter((a) => a.id !== adapter.id));
                    }}
                    className="p-1 hover:bg-dhl-gray-light rounded text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Use Cases */}
      <div className="bg-dhl-gray-light border border-amber-200 rounded-sm p-4 space-y-2">
        <p className="text-sm font-bold text-amber-900">Use Case Examples:</p>
        <ul className="text-xs text-amber-900 space-y-1">
          <li>• <strong>HTTP:</strong> Send campaign completions to your CRM via API</li>
          <li>• <strong>JavaScript:</strong> Transform data before sending to third-party tools</li>
          <li>• <strong>Zapier:</strong> Create complex multi-step workflows</li>
        </ul>
      </div>
    </div>
  );
};

export default CustomIntegrationAdapter;


