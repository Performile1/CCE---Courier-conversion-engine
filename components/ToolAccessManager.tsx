import React, { useMemo, useState } from 'react';
import { Shield, Save, X, Plus, Trash2 } from 'lucide-react';
import { ToolAccessConfig, UserRole } from '../types';

interface ToolAccessManagerProps {
  isOpen: boolean;
  onClose: () => void;
  config: ToolAccessConfig;
  onSave: (config: ToolAccessConfig) => void;
  currentUserId: string;
}

const ROLES: UserRole[] = ['admin', 'user', 'viewer'];

const TOOL_LABELS: Record<string, string> = {
  carrierSettings: 'Market Intelligence Center',
  inclusions: 'Riktad Sokning',
  cache: 'Lead Reservoir',
  mailTemplate: 'Mailmotor',
  sniSettings: 'Fraktpotential per SNI',
  exclusions: 'Exkluderingar',
  backups: 'System Backup',
  threePL: '3PL Manager',
  newsSources: 'Source Managers',
  modelSelector: 'AI Model Selection',
  campaignAnalytics: 'Kampanj Analytics',
  campaignPerformance: 'Performance Dashboard',
  costAnalysis: 'Kostnadsanalys',
  exportManager: 'Export Manager',
  customApi: 'Custom API Builder',
  customIntegration: 'Custom Integration',
  webhookManager: 'Webhook System',
  slackManager: 'Slack Integration',
  crmManager: 'CRM Manager',
  phase9: 'Phase 9 Integrations',
  emailCampaign: 'Email Campaign Builder',
  eventTriggers: 'Event Triggers',
  customReport: 'Custom Report Builder',
  toolAccess: 'Role and Tool Access'
};

const TOOL_KEYS = Object.keys(TOOL_LABELS);

export const ToolAccessManager: React.FC<ToolAccessManagerProps> = ({ isOpen, onClose, config, onSave, currentUserId }) => {
  const [localConfig, setLocalConfig] = useState<ToolAccessConfig>(config);
  const [newUserId, setNewUserId] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');

  const userEntries = useMemo(() => Object.entries(localConfig.userRoles), [localConfig.userRoles]);

  if (!isOpen) return null;

  const setRoleForUser = (userId: string, role: UserRole) => {
    setLocalConfig(prev => ({
      ...prev,
      userRoles: {
        ...prev.userRoles,
        [userId]: role
      }
    }));
  };

  const addUserRole = () => {
    const id = newUserId.trim();
    if (!id) return;
    setRoleForUser(id, newUserRole);
    setNewUserId('');
    setNewUserRole('user');
  };

  const removeUserRole = (userId: string) => {
    if (userId === currentUserId) return;
    setLocalConfig(prev => {
      const next = { ...prev.userRoles };
      delete next[userId];
      return { ...prev, userRoles: next };
    });
  };

  const toggleToolForRole = (role: UserRole, toolKey: string) => {
    setLocalConfig(prev => {
      const current = prev.roleToolAccess[role] || [];
      const next = current.includes(toolKey)
        ? current.filter(t => t !== toolKey)
        : [...current, toolKey];

      return {
        ...prev,
        roleToolAccess: {
          ...prev.roleToolAccess,
          [role]: next
        }
      };
    });
  };

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-5xl shadow-2xl border-t-4 border-red-600 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-dhl-gray-medium flex justify-between items-center bg-[#ffcc00]">
          <h2 className="text-sm font-black italic uppercase flex items-center gap-2 text-black">
            <Shield className="w-5 h-5 text-red-600" />
            Role and Tool Access
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors"><X className="w-5 h-5 text-black" /></button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div className="border border-dhl-gray-medium rounded-sm p-3 space-y-2">
            <div className="text-[10px] font-black uppercase text-slate-500">User Roles</div>
            <div className="grid grid-cols-[2fr_1fr_auto] gap-2">
              <input
                type="text"
                value={newUserId}
                onChange={e => setNewUserId(e.target.value)}
                placeholder="User ID"
                className="text-xs border border-dhl-gray-medium rounded-sm p-2"
              />
              <select
                value={newUserRole}
                onChange={e => setNewUserRole(e.target.value as UserRole)}
                className="text-xs border border-dhl-gray-medium rounded-sm p-2"
              >
                {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
              <button onClick={addUserRole} className="px-3 py-2 bg-dhl-black text-white rounded-sm text-xs font-black uppercase flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            <div className="space-y-1">
              {userEntries.map(([userId, role]) => (
                <div key={userId} className="grid grid-cols-[2fr_1fr_auto] gap-2 items-center bg-dhl-gray-light border border-dhl-gray-medium p-2 rounded-sm">
                  <div className="text-[10px] font-mono truncate">{userId}</div>
                  <select value={role} onChange={e => setRoleForUser(userId, e.target.value as UserRole)} className="text-xs border border-dhl-gray-medium rounded-sm p-1">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button disabled={userId === currentUserId} onClick={() => removeUserRole(userId)} className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-dhl-gray-medium rounded-sm p-3">
            <div className="text-[10px] font-black uppercase text-slate-500 mb-2">Tool Visibility by Role</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-dhl-gray-medium">
                    <th className="text-left py-2">Tool</th>
                    {ROLES.map(role => (
                      <th key={role} className="text-center py-2 uppercase">{role}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TOOL_KEYS.map(toolKey => (
                    <tr key={toolKey} className="border-b border-slate-100">
                      <td className="py-2 pr-2">{TOOL_LABELS[toolKey]}</td>
                      {ROLES.map(role => {
                        const selected = (localConfig.roleToolAccess[role] || []).includes(toolKey);
                        return (
                          <td key={`${toolKey}-${role}`} className="text-center">
                            <button
                              type="button"
                              onClick={() => toggleToolForRole(role, toolKey)}
                              className={`px-2 py-1 rounded-sm border font-bold ${selected ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-dhl-gray-medium'}`}
                            >
                              {selected ? 'Yes' : 'No'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-4 bg-dhl-gray-light border-t flex justify-end">
          <button onClick={handleSave} className="bg-red-600 text-white px-6 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 transition-all shadow-md">
            <Save className="w-4 h-4" /> Save Access Rules
          </button>
        </div>
      </div>
    </div>
  );
};
