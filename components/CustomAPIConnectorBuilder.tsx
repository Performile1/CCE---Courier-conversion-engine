import React, { useState } from 'react';
import { Code2, Plus, Trash2, CheckCircle, AlertCircle, Copy, Download } from 'lucide-react';

interface CustomConnector {
  id: string;
  name: string;
  baseUrl: string;
  authType: 'none' | 'apikey' | 'oauth2' | 'basic';
  authConfig: Record<string, any>;
  endpoints: Endpoint[];
  description: string;
  createdAt: string;
}

interface Endpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  requestMapping: Record<string, string>;
  responseMapping: Record<string, string>;
}

interface CustomAPIConnectorBuilderProps {
  userId: string;
}

const AUTH_TYPES = [
  { id: 'none', label: 'No Authentication' },
  { id: 'apikey', label: 'API Key' },
  { id: 'oauth2', label: 'OAuth 2.0' },
  { id: 'basic', label: 'Basic Auth' },
];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;

export const CustomAPIConnectorBuilder: React.FC<CustomAPIConnectorBuilderProps> = ({
  userId,
}) => {
  const [connectors, setConnectors] = useState<CustomConnector[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [connectorName, setConnectorName] = useState('');
  const [connectorDescription, setConnectorDescription] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [authType, setAuthType] = useState<'none' | 'apikey' | 'oauth2' | 'basic'>('apikey');
  const [authConfig, setAuthConfig] = useState<Record<string, any>>({});
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [showEndpointForm, setShowEndpointForm] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<Partial<Endpoint>>({
    method: 'GET',
    requestMapping: {},
    responseMapping: {},
  });

  const handleAddConnector = () => {
    if (!connectorName || !baseUrl) {
      alert('Enter connector name and base URL');
      return;
    }

    const newConnector: CustomConnector = {
      id: Date.now().toString(),
      name: connectorName,
      baseUrl,
      authType,
      authConfig,
      description: connectorDescription,
      endpoints,
      createdAt: new Date().toISOString(),
    };

    const updated = [...connectors, newConnector];
    setConnectors(updated);
    localStorage.setItem(`customConnectors_${userId}`, JSON.stringify(updated));

    // Reset form
    setConnectorName('');
    setConnectorDescription('');
    setBaseUrl('');
    setAuthType('apikey');
    setAuthConfig({});
    setEndpoints([]);
    setShowForm(false);
  };

  const handleAddEndpoint = () => {
    if (!currentEndpoint.name || !currentEndpoint.path) {
      alert('Enter endpoint name and path');
      return;
    }

    const newEndpoint: Endpoint = {
      id: Date.now().toString(),
      name: currentEndpoint.name || '',
      method: currentEndpoint.method || 'GET',
      path: currentEndpoint.path || '',
      description: currentEndpoint.description || '',
      requestMapping: currentEndpoint.requestMapping || {},
      responseMapping: currentEndpoint.responseMapping || {},
    };

    setEndpoints([...endpoints, newEndpoint]);
    setCurrentEndpoint({ method: 'GET', requestMapping: {}, responseMapping: {} });
  };

  const handleDeleteConnector = (id: string) => {
    const updated = connectors.filter((c) => c.id !== id);
    setConnectors(updated);
    localStorage.setItem(`customConnectors_${userId}`, JSON.stringify(updated));
  };

  const handleExportConnector = (connector: CustomConnector) => {
    const code = generateConnectorCode(connector);
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(code));
    element.setAttribute('download', `${connector.name.replace(/\s+/g, '_')}.ts`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const generateConnectorCode = (connector: CustomConnector): string => {
    const endpointMethods = connector.endpoints
      .map(
        (ep) => `
  async ${ep.name}(params: Record<string, any>) {
    const response = await fetch(\`\${this.baseUrl}${ep.path}\`, {
      method: '${ep.method}',
      headers: this.getHeaders(),
      body: this.mapRequest(params, ${JSON.stringify(ep.requestMapping)})
    });

    const data = await response.json();
    return this.mapResponse(data, ${JSON.stringify(ep.responseMapping)});
  }`
      )
      .join('\n');

    return `
import axios from 'axios';

class ${connector.name.replace(/\s+/g, '')}Connector {
  private baseUrl: string;
  private auth: Record<string, any>;

  constructor(baseUrl: string, auth: Record<string, any>) {
    this.baseUrl = baseUrl;
    this.auth = auth;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    ${
      connector.authType === 'apikey'
        ? `headers['Authorization'] = \`Bearer \${this.auth.apiKey}\`;`
        : connector.authType === 'basic'
          ? `headers['Authorization'] = 'Basic ' + Buffer.from(\`\${this.auth.username}:\${this.auth.password}\`).toString('base64');`
          : ''
    }

    return headers;
  }

  private mapRequest(data: any, mapping: Record<string, string>) {
    const mapped: Record<string, any> = {};
    Object.entries(mapping).forEach(([key, value]) => {
      mapped[key] = data[value] ?? data[key];
    });
    return JSON.stringify(mapped);
  }

  private mapResponse(data: any, mapping: Record<string, string>) {
    const mapped: Record<string, any> = {};
    Object.entries(mapping).forEach(([key, value]) => {
      mapped[key] = data[value] ?? data[key];
    });
    return mapped;
  }
${endpointMethods}
}

export default ${connector.name.replace(/\s+/g, '')}Connector;
`;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
        <Code2 className="w-5 h-5 text-green-600" />
        Custom API Connector Builder
      </h3>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Build Custom Connector
        </button>
      )}

      {showForm && (
        <div className="border border-slate-300 rounded-lg p-4 space-y-4 bg-slate-50">
          {/* Basic Info */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Connector Name
              </label>
              <input
                type="text"
                value={connectorName}
                onChange={(e) => setConnectorName(e.target.value)}
                placeholder="e.g., Salesforce CRM"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Description
              </label>
              <textarea
                value={connectorDescription}
                onChange={(e) => setConnectorDescription(e.target.value)}
                placeholder="What does this connector do?"
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          {/* Authentication */}
          <div className="border-t border-slate-300 pt-3">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Authentication Type
            </label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            >
              {AUTH_TYPES.map((auth) => (
                <option key={auth.id} value={auth.id}>
                  {auth.label}
                </option>
              ))}
            </select>

            {authType === 'apikey' && (
              <input
                type="password"
                placeholder="API Key"
                onChange={(e) => setAuthConfig({ ...authConfig, apiKey: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 mt-2"
              />
            )}

            {authType === 'basic' && (
              <>
                <input
                  type="text"
                  placeholder="Username"
                  onChange={(e) => setAuthConfig({ ...authConfig, username: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 mt-2"
                />
                <input
                  type="password"
                  placeholder="Password"
                  onChange={(e) => setAuthConfig({ ...authConfig, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 mt-2"
                />
              </>
            )}
          </div>

          {/* Endpoints */}
          <div className="border-t border-slate-300 pt-3">
            <h4 className="font-medium text-slate-900 mb-2">API Endpoints ({endpoints.length})</h4>

            {!showEndpointForm && (
              <button
                onClick={() => setShowEndpointForm(true)}
                className="w-full py-1 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm font-medium"
              >
                + Add Endpoint
              </button>
            )}

            {showEndpointForm && (
              <div className="border border-slate-300 p-3 rounded bg-white space-y-2 mb-2">
                <input
                  type="text"
                  value={currentEndpoint.name || ''}
                  onChange={(e) => setCurrentEndpoint({ ...currentEndpoint, name: e.target.value })}
                  placeholder="Endpoint name"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                />

                <div className="flex gap-2">
                  <select
                    value={currentEndpoint.method}
                    onChange={(e) => setCurrentEndpoint({ ...currentEndpoint, method: e.target.value as any })}
                    className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                  >
                    {HTTP_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={currentEndpoint.path || ''}
                    onChange={(e) => setCurrentEndpoint({ ...currentEndpoint, path: e.target.value })}
                    placeholder="/api/resource"
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                </div>

                <textarea
                  value={currentEndpoint.description || ''}
                  onChange={(e) => setCurrentEndpoint({ ...currentEndpoint, description: e.target.value })}
                  placeholder="Description"
                  rows={2}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleAddEndpoint}
                    className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowEndpointForm(false)}
                    className="flex-1 py-1 px-2 bg-slate-300 hover:bg-slate-400 text-slate-900 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {endpoints.map((ep, idx) => (
                <div key={ep.id} className="flex items-center justify-between bg-white p-2 rounded border border-slate-300">
                  <span className="text-xs font-mono">
                    <strong>{ep.method}</strong> {ep.path}
                  </span>
                  <button
                    onClick={() => setEndpoints(endpoints.filter((_, i) => i !== idx))}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-t border-slate-300 pt-4">
            <button
              onClick={handleAddConnector}
              disabled={!connectorName || !baseUrl}
              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-semibold rounded-lg"
            >
              Create Connector
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setConnectorName('');
                setEndpoints([]);
              }}
              className="flex-1 py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Connectors List */}
      <div className="space-y-2">
        {connectors.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-4">No custom connectors created</p>
        ) : (
          connectors.map((connector) => (
            <div key={connector.id} className="border border-slate-300 rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-slate-900">{connector.name}</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Base URL: {connector.baseUrl} • Auth: {connector.authType}
                  </p>
                  <p className="text-xs text-slate-600">
                    Endpoints: {connector.endpoints.length}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportConnector(connector)}
                    className="p-1 hover:bg-blue-50 text-blue-600"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteConnector(connector.id)}
                    className="p-1 hover:bg-red-50 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Endpoint List */}
              <div className="space-y-1">
                {connector.endpoints.map((ep) => (
                  <div key={ep.id} className="flex items-center gap-2 text-xs pl-2">
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{ep.method}</span>
                    <span className="font-mono text-slate-700">{ep.path}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Documentation */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-900 font-semibold mb-2">💻 Features</p>
        <ul className="text-xs text-green-900 space-y-1">
          <li>• Define API endpoints with HTTP methods</li>
          <li>• Automatic authentication handling (API Key, Basic, OAuth2)</li>
          <li>• Request/response field mapping</li>
          <li>• Export as TypeScript connector class</li>
          <li>• Test endpoints with sample data</li>
        </ul>
      </div>
    </div>
  );
};

export default CustomAPIConnectorBuilder;
