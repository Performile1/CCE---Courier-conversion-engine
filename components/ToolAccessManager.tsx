import React, { useMemo, useState } from 'react';
import { Shield, Save, X, Plus, Trash2 } from 'lucide-react';
import { ToolAccessConfig, UserRole } from '../types';
import { inviteUserWithActivation, sendMagicLink, sendPasswordResetEmail } from '../services/supabaseClient';

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
  techSolutions: 'Tech Solution Manager',
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
  cronJobs: 'Cron Job Manager',
  toolAccess: 'Role and Tool Access',
  leadTabOverview: 'Lead Workspace: Översikt',
  leadTabAnalysis: 'Lead Workspace: Analysis',
  leadTabDiagnostics: 'Lead Workspace: Diagnostik',
  leadTabPricing: 'Lead Workspace: Offert',
  leadTabMail: 'Lead Workspace: Mail'
};

const TOOL_KEYS = Object.keys(TOOL_LABELS);

export const ToolAccessManager: React.FC<ToolAccessManagerProps> = ({ isOpen, onClose, config, onSave, currentUserId }) => {
  const [localConfig, setLocalConfig] = useState<ToolAccessConfig>(config);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('user');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);

  const userEntries = useMemo(() => Object.entries(localConfig.userRoles), [localConfig.userRoles]);
  const invitationEntries = useMemo(
    () => Object.values(localConfig.invitationHistory || {}).sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt)),
    [localConfig.invitationHistory]
  );

  if (!isOpen) return null;

  const setRoleForUser = (userId: string, role: UserRole) => {
    setLocalConfig(prev => {
      const nextInvitationHistory = { ...(prev.invitationHistory || {}) };
      const email = prev.userEmails?.[userId];
      if (email && nextInvitationHistory[email]) {
        nextInvitationHistory[email] = {
          ...nextInvitationHistory[email],
          role
        };
      }

      return {
        ...prev,
        userRoles: {
          ...prev.userRoles,
          [userId]: role
        },
        invitationHistory: nextInvitationHistory
      };
    });
  };

  const formatDateTime = (value?: string) => {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const handleInviteUser = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAdminMsg('Please enter a valid email address');
      return;
    }

    setIsInviting(true);
    try {
      const result = await inviteUserWithActivation(email, inviteRole, inviteFullName.trim() || undefined);
      const now = new Date().toISOString();

      setLocalConfig(prev => ({
        ...prev,
        userRoles: {
          ...prev.userRoles,
          [result.userId]: inviteRole
        },
        userEmails: {
          ...(prev.userEmails || {}),
          [result.userId]: email
        },
        invitationHistory: {
          ...(prev.invitationHistory || {}),
          [email]: {
            email,
            fullName: inviteFullName.trim() || undefined,
            role: inviteRole,
            userId: result.userId,
            invitedAt: prev.invitationHistory?.[email]?.invitedAt || now,
            lastSentAt: now,
            sentCount: (prev.invitationHistory?.[email]?.sentCount || 0) + 1,
            status: 'activation-sent'
          }
        }
      }));

      setAdminMsg(`Invitation and activation email sent to ${email}`);
      setInviteEmail('');
      setInviteFullName('');
      setInviteRole('user');
    } catch (e: any) {
      setAdminMsg(e?.message || 'Failed to invite user');
    } finally {
      setIsInviting(false);
    }
  };

  const handleResendInvitation = async (email: string) => {
    setResendingEmail(email);
    try {
      await sendMagicLink(email, false);
      const now = new Date().toISOString();
      setLocalConfig(prev => ({
        ...prev,
        invitationHistory: {
          ...(prev.invitationHistory || {}),
          [email]: {
            ...(prev.invitationHistory?.[email] || {
              email,
              role: 'user' as UserRole,
              invitedAt: now,
              sentCount: 0,
              status: 'sign-in-link-sent' as const
            }),
            lastSentAt: now,
            sentCount: (prev.invitationHistory?.[email]?.sentCount || 0) + 1,
            status: 'sign-in-link-sent'
          }
        }
      }));
      setAdminMsg(`Access link resent to ${email}`);
    } catch (e: any) {
      setAdminMsg(e?.message || 'Failed to resend access link');
    } finally {
      setResendingEmail(null);
    }
  };

  const removeUserRole = (userId: string) => {
    if (userId === currentUserId) return;
    setLocalConfig(prev => {
      const next = { ...prev.userRoles };
      delete next[userId];
      const nextEmails = { ...(prev.userEmails || {}) };
      delete nextEmails[userId];
      return { ...prev, userRoles: next, userEmails: nextEmails };
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

  const handleSendMagicLink = async () => {
    if (!adminEmail.trim()) return;
    try {
      await sendMagicLink(adminEmail.trim(), true);
      setAdminMsg(`Magic link sent to ${adminEmail.trim()}`);
    } catch (e: any) {
      setAdminMsg(e?.message || 'Failed to send magic link');
    }
  };

  const handleSendReset = async () => {
    if (!adminEmail.trim()) return;
    try {
      await sendPasswordResetEmail(adminEmail.trim());
      setAdminMsg(`Password reset email sent to ${adminEmail.trim()}`);
    } catch (e: any) {
      setAdminMsg(e?.message || 'Failed to send password reset email');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
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
            <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_auto] gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="text-xs border border-dhl-gray-medium rounded-sm p-2"
              />
              <input
                type="text"
                value={inviteFullName}
                onChange={e => setInviteFullName(e.target.value)}
                placeholder="Full name (optional)"
                className="text-xs border border-dhl-gray-medium rounded-sm p-2"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as UserRole)}
                className="text-xs border border-dhl-gray-medium rounded-sm p-2"
              >
                {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
              <button
                onClick={handleInviteUser}
                disabled={isInviting}
                className="px-3 py-2 bg-dhl-black text-white rounded-sm text-xs font-black uppercase flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> {isInviting ? 'Sending...' : 'Invite'}
              </button>
            </div>
            <div className="text-[10px] text-slate-500">
              Sends Supabase activation email and automatically maps the invited user ID to the selected role.
            </div>

            <div className="space-y-1">
              {userEntries.map(([userId, role]) => (
                <div key={userId} className="grid grid-cols-[2fr_2fr_1fr_auto] gap-2 items-center bg-dhl-gray-light border border-dhl-gray-medium p-2 rounded-sm">
                  <div className="text-[10px] truncate">{localConfig.userEmails?.[userId] || 'No email stored'}</div>
                  <div className="text-[10px] font-mono truncate" title={userId}>{userId}</div>
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

          <div className="border border-dhl-gray-medium rounded-sm p-3 space-y-2">
            <div className="text-[10px] font-black uppercase text-slate-500">Invitation History</div>
            {invitationEntries.length === 0 ? (
              <div className="text-[10px] text-slate-500">No invitations sent yet.</div>
            ) : (
              <div className="space-y-2">
                {invitationEntries.map((entry) => (
                  <div key={entry.email} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1.5fr_1.5fr_auto] gap-2 items-center bg-white border border-slate-200 rounded-sm p-2">
                    <div>
                      <div className="text-[10px] font-black text-slate-800 truncate">{entry.email}</div>
                      <div className="text-[10px] text-slate-500 truncate">{entry.fullName || 'No name provided'}</div>
                    </div>
                    <div className="text-[10px] uppercase text-slate-700">{entry.role}</div>
                    <div className="text-[10px] uppercase">
                      <span className={`inline-flex px-2 py-1 rounded-sm font-black ${entry.status === 'accepted' ? 'bg-green-100 text-green-800' : entry.status === 'activation-sent' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {entry.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-600">Invited: {formatDateTime(entry.invitedAt)}</div>
                    <div className="text-[10px] text-slate-600">Last sent: {formatDateTime(entry.lastSentAt)} ({entry.sentCount})</div>
                    <button
                      onClick={() => handleResendInvitation(entry.email)}
                      disabled={resendingEmail === entry.email}
                      className="px-3 py-2 text-[10px] font-black uppercase bg-dhl-black text-white rounded-sm hover:bg-red-600 disabled:opacity-50"
                    >
                      {resendingEmail === entry.email ? 'Sending...' : 'Resend'}
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                            <label className="inline-flex items-center justify-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleToolForRole(role, toolKey)}
                                className="w-4 h-4 accent-red-600"
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-dhl-gray-medium rounded-sm p-3 space-y-2">
            <div className="text-[10px] font-black uppercase text-slate-500">Admin User Actions</div>
            <div className="grid grid-cols-[2fr_auto_auto] gap-2">
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="user@example.com"
                className="text-xs border border-dhl-gray-medium rounded-sm p-2"
              />
              <button onClick={handleSendMagicLink} className="px-3 py-2 text-[10px] font-black uppercase bg-dhl-black text-white rounded-sm hover:bg-red-600">Send Sign-in Link</button>
              <button onClick={handleSendReset} className="px-3 py-2 text-[10px] font-black uppercase bg-dhl-gray-light text-dhl-gray-dark border border-dhl-gray-medium rounded-sm hover:border-red-300">Send Reset Link</button>
            </div>
            {adminMsg && <div className="text-[10px] text-slate-600">{adminMsg}</div>}
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
