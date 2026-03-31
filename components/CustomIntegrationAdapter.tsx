import React, { useState } from 'react';
import { Settings, Plus, Edit2, Trash2, CheckCircle, AlertCircle, Code, TestTube } from 'lucide-react';

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
  const [config, setConfig] = useState(ADAPTER_TEMPLATES.http.config);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState('');

  const handleAddAdapter = async () => {
    if (!adapterName) {
      alert('Enter adapter name');
      return;
    }

    setSaving(true);

    try {
      const newAdapter: CustomAdapter = {
        id: Date.now().toString(),
        name: adapterName,
        description: adapterDescription,
        type: selectedType,
        config,
        active: true,
        createdAt: new Date().toISOString(),
      };

      const updated = [...adapters, newAdapter];
      setAdapters(updated);
      localStorage.setItem(`adapters_${userId}`, JSON.stringify(updated));

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
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-purple-600" />
        Custom Integration Adapters
      </h3>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Adapter
        </button>
      )}

      {showForm && (
        <div className="border border-slate-300 rounded-lg p-4 space-y-4 bg-slate-50">
          {/* Adapter Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
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
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    selectedType === key
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-slate-300 bg-white hover:border-purple-400'
                  }`}
                >
                  <p className="font-medium text-sm text-slate-900">{template.name}</p>
                  <p className="text-xs text-slate-600 mt-1">{template.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Adapter Details */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Adapter Name
            </label>
            <input
              type="text"
              value={adapterName}
              onChange={(e) => setAdapterName(e.target.value)}
              placeholder="e.g., Slack Notifications"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={adapterDescription}
              onChange={(e) => setAdapterDescription(e.target.value)}
              placeholder="What does this adapter do?"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          {/* Type-Specific Configuration */}
          {selectedType === 'http' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  HTTP Method
                </label>
                <select
                  value={config.method}
                  onChange={(e) =>
                    setConfig({ ...config, method: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Endpoint URL
                </label>
                <input
                  type="text"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://api.example.com/webhook"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Body Template
                </label>
                <textarea
                  value={config.bodyTemplate}
                  onChange={(e) =>
                    setConfig({ ...config, bodyTemplate: e.target.value })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs"
                />
                <p className="text-xs text-slate-600 mt-1">
                  Use {'{{event}}'} and {'{{data}}'} placeholders
                </p>
              </div>
            </>
          )}

          {selectedType === 'javascript' && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Transformation Code
              </label>
              <textarea
                value={config.code}
                onChange={(e) => setConfig({ ...config, code: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs"
              />
              <p className="text-xs text-slate-600 mt-1">
                Function receives {'{ event, data, timestamp }'} and must return transformed data
              </p>
            </div>
          )}

          {selectedType === 'zapier' && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Zapier Webhook URL
              </label>
              <input
                type="text"
                value={config.webhookUrl}
                onChange={(e) =>
                  setConfig({ ...config, webhookUrl: e.target.value })
                }
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          )}

          <div className="flex gap-2 border-t border-slate-300 pt-4">
            <button
              onClick={handleAddAdapter}
              disabled={saving}
              className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-semibold rounded-lg"
            >
              {saving ? 'Creating...' : 'Create Adapter'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setAdapterName('');
              }}
              className="flex-1 py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Test Result Display */}
      {testResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900 font-mono whitespace-pre-wrap">{testResult}</p>
        </div>
      )}

      {/* Adapters List */}
      <div className="space-y-2">
        {adapters.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-4">No adapters created</p>
        ) : (
          adapters.map((adapter) => (
            <div key={adapter.id} className="border border-slate-300 rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {adapter.active ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <h4 className="font-semibold text-slate-900">{adapter.name}</h4>
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                      {adapter.type}
                    </span>
                  </div>
                  {adapter.description && (
                    <p className="text-xs text-slate-600 mt-1">{adapter.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => testAdapter(adapter)}
                    className="p-1 hover:bg-blue-50 rounded text-blue-600"
                  >
                    <TestTube className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const updated = adapters.filter((a) => a.id !== adapter.id);
                      setAdapters(updated);
                      localStorage.setItem(`adapters_${userId}`, JSON.stringify(updated));
                    }}
                    className="p-1 hover:bg-red-50 rounded text-red-600"
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
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
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
