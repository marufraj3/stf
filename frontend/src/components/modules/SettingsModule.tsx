import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Building, ShieldCheck, Key, Sliders, Plus, Edit, X, Users, ServerCog, RefreshCw, RotateCcw } from 'lucide-react';
import { db } from '../../services/db';
import { apiRequest } from '../../services/api';
import { CompanyLogo } from '../common/CompanyLogo';
import {
  Company,
  CustomReminderRecipient,
  Department,
  Designation,
  NotificationChannel,
  NotificationProviderSettings,
  Permission,
  ReminderRule,
  Role,
  User,
} from '../../types';

interface SettingsModuleProps {
  onRefresh: () => void;
}

type OperationsStatus = {
  connection: string;
  queuedJobs: number;
  failedJobs: number;
  oldestQueuedAt: number | null;
  lastExpiryScanAt: string | null;
  schedulerTimezone: string;
  failed: Array<{
    uuid: string;
    connection: string;
    queue: string;
    error: string;
    failedAt: string;
  }>;
};

export const SettingsModule: React.FC<SettingsModuleProps> = ({ onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'companies' | 'depts' | 'gateways' | 'reminders' | 'users' | 'rbac' | 'operations'>('companies');

  // Load state
  const [companies, setCompanies] = useState<Company[]>(db.getCompanies());
  const [departments, setDepartments] = useState<Department[]>(db.getDepartments());
  const [designations, setDesignations] = useState<Designation[]>(db.getDesignations());
  const [gateways, setGateways] = useState<NotificationProviderSettings>(db.getNotificationProviderSettings());
  const [users, setUsers] = useState<User[]>(db.getUsers());
  const [userForm, setUserForm] = useState<Partial<User> & { password?: string }>({
    name: '',
    email: '',
    password: '',
    roleId: db.getRoles().find(role => role.name === 'HR')?.id || '',
    roleIds: db.getRoles().find(role => role.name === 'HR')
      ? [db.getRoles().find(role => role.name === 'HR')!.id]
      : [],
    companyAccess: db.getCompanies()[0] ? [db.getCompanies()[0].id] : [],
    primaryCompanyId: db.getCompanies()[0]?.id || '',
    status: 'active',
  });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState<Partial<Role>>({ name: '', permissions: [] });
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [reminderRules, setReminderRules] = useState<ReminderRule[]>(db.getReminderRules());
  const [reminderRuleForm, setReminderRuleForm] = useState<Partial<ReminderRule> | null>(null);
  const [globalReminderDays, setGlobalReminderDays] = useState(db.getSettings().globalReminderDays.join(', '));
  const [autoExpiryScanEnabled, setAutoExpiryScanEnabled] = useState(db.getSettings().autoExpiryScanEnabled);

  // Editing Company Modal
  const [editingCompany, setEditingCompany] = useState<Partial<Company>>({});
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [companyError, setCompanyError] = useState<string>('');

  // Editing Dept Modal
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDesignationName, setNewDesignationName] = useState('');
  const [newDesignationCode, setNewDesignationCode] = useState('');
  const [newDesignationDepartmentId, setNewDesignationDepartmentId] = useState('');

  const canManageCompanies = db.hasPermission('companies.manage');
  const canManageDepartments = db.hasPermission('departments.manage');
  const canManageDesignations = db.hasPermission('designations.manage');
  const canManageSettings = db.hasPermission('settings.manage');
  const canViewUsers = db.hasPermission('users.view');
  const canManageUsers = db.hasPermission('users.manage');
  const canViewRoles = db.hasPermission('roles.view');
  const canManageRoles = db.hasPermission('roles.manage');
  const canManageReminders = db.hasPermission('notifications.manage');
  const operations = useQuery({
    queryKey: ['operations-status'],
    queryFn: async () => (await apiRequest<{ data: OperationsStatus }>('/operations')).data,
    enabled: activeTab === 'operations',
    refetchInterval: activeTab === 'operations' ? 30_000 : false,
  });

  const resetUserForm = () => setUserForm({
    name: '',
    email: '',
    password: '',
    roleId: db.getRoles().find(role => role.name === 'HR')?.id || '',
    roleIds: db.getRoles().find(role => role.name === 'HR')
      ? [db.getRoles().find(role => role.name === 'HR')!.id]
      : [],
    companyAccess: db.getCompanies()[0] ? [db.getCompanies()[0].id] : [],
    primaryCompanyId: db.getCompanies()[0]?.id || '',
    status: 'active',
  });

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany.name) return;
    setCompanyError('');
    try {
      await db.saveCompany(editingCompany);
      setCompanies(db.getCompanies());
      setIsCompanyModalOpen(false);
      onRefresh();
    } catch (error) {
      setCompanyError(error instanceof Error ? error.message : 'Unable to save the company.');
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setCompanyError('Logo must be a PNG or JPG image.');
      event.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setCompanyError('Logo may not be larger than 2 MB.');
      event.target.value = '';
      return;
    }
    setCompanyError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingCompany(current => ({
        ...current,
        logoUrl: String(reader.result || ''),
        logoFileName: file.name,
        removeLogo: false,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleLogoRemove = () => {
    setEditingCompany(current => ({
      ...current,
      logoUrl: '',
      logoFileName: '',
      removeLogo: true,
    }));
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName) return;
    const selected = db.getSelectedCompanyId();
    const companyId = selected === 'all' ? db.getCompanies()[0]?.id : selected;
    if (!companyId) {
      alert('Create or select a company first.');
      return;
    }
    await db.saveDepartment({
      companyId,
      name: newDeptName,
      code: newDeptCode || newDeptName.toUpperCase().slice(0, 4),
    });
    setDepartments(db.getDepartments());
    setNewDeptName('');
    setNewDeptCode('');
    onRefresh();
  };

  const handleAddDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    const selected = db.getSelectedCompanyId();
    const companyId = selected === 'all' ? db.getCompanies()[0]?.id : selected;
    if (!companyId || !newDesignationName) {
      alert('Create or select a company first.');
      return;
    }
    try {
      await db.saveDesignation({
        companyId,
        departmentId: newDesignationDepartmentId || undefined,
        name: newDesignationName,
        code: newDesignationCode || newDesignationName.toUpperCase().replace(/\s+/g, '_').slice(0, 30),
      });
      setDesignations(db.getDesignations());
      setNewDesignationName('');
      setNewDesignationCode('');
      setNewDesignationDepartmentId('');
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save designation.');
    }
  };

  const handleSaveGateways = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.saveNotificationProviderSettings(gateways);
    alert('Provider mode saved. Live credentials must be set in the server .env file.');
    onRefresh();
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.saveUser(userForm);
      setUsers(db.getUsers());
      setIsUserModalOpen(false);
      resetUserForm();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save user.');
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.saveRole({
        ...roleForm,
        permissions: roleForm.permissions || [],
      });
      setIsRoleModalOpen(false);
      setRoleForm({ name: '', permissions: [] });
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save role.');
    }
  };

  const handleSaveReminderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = [...new Set<number>(
      globalReminderDays
        .split(',')
        .map(value => Number(value.trim()))
        .filter(value => Number.isInteger(value) && value >= 0 && value <= 3650),
    )];
    if (!days.length) {
      alert('Enter at least one valid reminder day.');
      return;
    }
    try {
      await db.updateSettings({ globalReminderDays: days, autoExpiryScanEnabled });
      setGlobalReminderDays(days.join(', '));
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save reminder settings.');
    }
  };

  const handleSaveReminderRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderRuleForm) return;
    if (!(reminderRuleForm.reminderDays || []).length) {
      alert('Select at least one reminder day.');
      return;
    }
    if (!(reminderRuleForm.channels || []).length) {
      alert('Select at least one notification channel.');
      return;
    }
    if (!(reminderRuleForm.recipients || []).length) {
      alert('Select at least one recipient.');
      return;
    }
    try {
      await db.saveReminderRule(reminderRuleForm);
      setReminderRules(db.getReminderRules());
      setReminderRuleForm(null);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save reminder rule.');
    }
  };

  const toggleReminderRecipient = (
    type: 'owner' | 'assigned_hr' | 'company_manager' | 'super_admin' | 'custom',
    checked: boolean,
  ) => {
    if (!reminderRuleForm) return;
    const current = reminderRuleForm.recipients || [];
    const next = current.filter(recipient => typeof recipient === 'string' ? recipient !== type : recipient.type !== type);
    if (checked) {
      next.push(type === 'custom' ? { type: 'custom', name: '', email: '', phone: '' } : type);
    }
    setReminderRuleForm({ ...reminderRuleForm, recipients: next });
  };

  const updateCustomRecipient = (patch: Partial<CustomReminderRecipient>) => {
    if (!reminderRuleForm) return;
    const current = reminderRuleForm.recipients || [];
    const custom = current.find((recipient): recipient is CustomReminderRecipient => typeof recipient === 'object');
    setReminderRuleForm({
      ...reminderRuleForm,
      recipients: [
        ...current.filter(recipient => typeof recipient === 'string'),
        { type: 'custom', name: '', ...custom, ...patch },
      ],
    });
  };

  const retryFailedJob = async (uuid: string) => {
    try {
      await apiRequest(`/operations/failed-jobs/${uuid}/retry`, { method: 'POST' });
      await operations.refetch();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to retry the failed job.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Settings & Governance</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage multi-company entities, organizational structure, API messaging gateways, and RBAC security rules.
        </p>
      </div>

      {/* Tabs Navbar */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-white rounded-2xl p-1.5 gap-1 text-xs font-semibold shadow-2xs">
        {[
          { id: 'companies', label: 'Company Entities', icon: Building },
          { id: 'depts', label: 'Departments & Designations', icon: Sliders },
          { id: 'gateways', label: 'SMS / WhatsApp Gateways', icon: Key },
          { id: 'reminders', label: 'Reminder Rules', icon: Bell },
          ...(canViewUsers ? [{ id: 'users', label: 'User Accounts', icon: Users }] : []),
          ...(canViewRoles ? [{ id: 'rbac', label: 'RBAC Roles & Permissions', icon: ShieldCheck }] : []),
          { id: 'operations', label: 'Queue & Scheduler', icon: ServerCog },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-none flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Companies */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-slate-900 text-sm">Registered Corporate Entities</h2>
            {canManageCompanies && (
              <button
                onClick={() => {
                  setCompanyError('');
                  setEditingCompany({ name: '', code: '', crNumber: '', computerCardNumber: '', phone: '+974 ', email: '', address: 'Doha, Qatar' });
                  setIsCompanyModalOpen(true);
                }}
                className="bg-slate-900 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Company</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map(c => (
              <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CompanyLogo code={c.code} name={c.name} logoUrl={c.logoUrl} sizeClass="w-12 h-12" />
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] text-amber-600 font-bold uppercase">{c.code}</span>
                      <h3 className="font-bold text-slate-900 text-base leading-tight">{c.name}</h3>
                    </div>
                  </div>
                  {canManageCompanies && (
                    <button
                      onClick={() => { setCompanyError(''); setEditingCompany({ ...c }); setIsCompanyModalOpen(true); }}
                      className="p-1 text-slate-400 hover:text-slate-700"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-600 space-y-1 font-mono pt-2 border-t border-slate-100">
                  <div>CR Number: <b>{c.crNumber || 'N/A'}</b></div>
                  <div>Computer Card #: <b>{c.computerCardNumber || 'N/A'}</b></div>
                  <div>Contact: {c.phone} • {c.email}</div>
                  <div>Address: {c.address}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Real User Accounts</h3>
              <p className="text-slate-500 mt-1">Create an account, assign a role and company scope, then Super Admin can impersonate it.</p>
            </div>
            {canManageUsers && (
              <button
                onClick={() => { resetUserForm(); setIsUserModalOpen(true); }}
                className="bg-slate-900 text-white px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add User
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                <th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Company Scope</th><th className="p-3">Status</th>
                {canManageUsers && <th className="p-3 text-right">Action</th>}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="p-3 font-bold">{user.name}</td>
                    <td className="p-3 font-mono">{user.email}</td>
                    <td className="p-3">{(user.roleNames?.length ? user.roleNames : [user.roleName]).join(', ')}</td>
                    <td className="p-3">{user.companyAccess === 'all' ? 'All companies' : `${user.companyAccess.length} companies`}</td>
                    <td className="p-3 capitalize">{user.status}</td>
                    {canManageUsers && (
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setUserForm({
                              ...user,
                              roleIds: user.roleIds?.length
                                ? user.roleIds
                                : user.roles?.map(role => role.id) || (user.roleId ? [user.roleId] : []),
                              password: '',
                            });
                            setIsUserModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-900"
                          aria-label={`Edit ${user.name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Depts */}
      {activeTab === 'depts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Depts */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Departments</h3>
            {canManageDepartments && <form onSubmit={handleAddDept} className="grid grid-cols-[1fr_8rem_auto] gap-2 text-xs">
              <input
                type="text"
                placeholder="New Dept Name"
                required
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
              />
              <input
                type="text"
                placeholder="Code"
                value={newDeptCode}
                onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
              />
              <button type="submit" className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl">
                Add
              </button>
            </form>}
            <div className="space-y-1.5 text-xs">
              {departments.map(d => (
                <div key={d.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between font-medium">
                  <span className="text-slate-900">{d.name}</span>
                  <span className="font-mono text-slate-400">{d.code}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Designations */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Designations</h3>
            {canManageDesignations && (
              <form onSubmit={handleAddDesignation} className="grid grid-cols-2 gap-2 text-xs">
                <input
                  required
                  placeholder="Designation name"
                  value={newDesignationName}
                  onChange={event => setNewDesignationName(event.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
                <input
                  placeholder="Code"
                  value={newDesignationCode}
                  onChange={event => setNewDesignationCode(event.target.value.toUpperCase())}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                />
                <select
                  value={newDesignationDepartmentId}
                  onChange={event => setNewDesignationDepartmentId(event.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="">No department</option>
                  {departments.map(department => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
                <button type="submit" className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl">Add</button>
              </form>
            )}
            <div className="space-y-1.5 text-xs">
              {designations.map(d => (
                <div key={d.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between font-medium">
                  <span className="text-slate-900">{d.name}</span>
                  <span className="font-mono text-slate-400">{d.code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Messaging Gateways */}
      {activeTab === 'gateways' && (
        <form onSubmit={handleSaveGateways} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6 text-xs">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500" />
              Notification channel controls
            </h3>
            <p className="mt-1 text-slate-500">
              Provider credentials are intentionally kept out of the database and browser. Configure SMTP, SMS and WhatsApp secrets only in the server <code>.env</code> file.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'emailEnabled', label: 'Email / SMTP' },
              { key: 'smsEnabled', label: 'SMS API' },
              { key: 'whatsappEnabled', label: 'WhatsApp Business API' },
              { key: 'mockMode', label: 'Safe test mode (no external send)' },
            ].map(item => (
              <label key={item.key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="font-semibold text-slate-800">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(gateways[item.key as keyof NotificationProviderSettings])}
                  disabled={!canManageSettings}
                  onChange={event => setGateways({
                    ...gateways,
                    [item.key]: event.target.checked,
                  })}
                  className="h-4 w-4 accent-amber-500"
                />
              </label>
            ))}
          </div>

          {canManageSettings && <div className="pt-4 border-t border-slate-100 text-right">
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs"
            >
              Save Channel Settings
            </button>
          </div>}
        </form>
      )}

      {activeTab === 'reminders' && (
        <div className="space-y-5">
          <form onSubmit={handleSaveReminderSettings} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs text-xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Global reminder defaults</h3>
              <p className="mt-1 text-slate-500">
                These days apply when no company or document-specific rule matches. Day 0 means the expiry date.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
              <label>
                <span className="block font-semibold mb-1">Reminder days (comma separated)</span>
                <input
                  value={globalReminderDays}
                  disabled={!canManageReminders}
                  onChange={event => setGlobalReminderDays(event.target.value)}
                  placeholder="30, 15, 10, 7, 3, 1, 0"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 disabled:bg-slate-100"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-semibold">
                <input
                  type="checkbox"
                  checked={autoExpiryScanEnabled}
                  disabled={!canManageReminders}
                  onChange={event => setAutoExpiryScanEnabled(event.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                Automatic scheduled scan
              </label>
            </div>
            {canManageReminders && (
              <div className="text-right">
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl">
                  Save Defaults
                </button>
              </div>
            )}
          </form>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs text-xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Company and document rules</h3>
                <p className="mt-1 text-slate-500">Specific rules override the global defaults.</p>
              </div>
              {canManageReminders && (
                <button
                  onClick={() => setReminderRuleForm({
                    companyId: db.getCurrentUser().isSuperAdmin ? undefined : db.getCurrentUser().primaryCompanyId,
                    documentTypeId: undefined,
                    reminderDays: [30, 15, 10, 7, 3, 1, 0],
                    channels: ['email', 'sms', 'whatsapp'],
                    recipients: ['owner', 'assigned_hr'],
                    active: true,
                  })}
                  className="bg-slate-900 text-white px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Rule
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                    <th className="p-3">Scope</th>
                    <th className="p-3">Document Type</th>
                    <th className="p-3">Days</th>
                    <th className="p-3">Channels</th>
                    <th className="p-3">Recipients</th>
                    <th className="p-3">Status</th>
                    {canManageReminders && <th className="p-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reminderRules.map(rule => (
                    <tr key={rule.id}>
                      <td className="p-3 font-semibold">
                        {rule.companyId
                          ? companies.find(company => company.id === rule.companyId)?.name || 'Restricted company'
                          : 'All companies'}
                      </td>
                      <td className="p-3">
                        {rule.documentTypeId
                          ? db.getDocumentTypes().find(type => type.id === rule.documentTypeId)?.name || 'Restricted type'
                          : 'All document types'}
                      </td>
                      <td className="p-3 font-mono">{rule.reminderDays.join(', ')}</td>
                      <td className="p-3 capitalize">{rule.channels.join(', ')}</td>
                      <td className="p-3 capitalize">
                        {rule.recipients
                          .map(recipient => typeof recipient === 'string' ? recipient.replaceAll('_', ' ') : recipient.name || 'Custom')
                          .join(', ')}
                      </td>
                      <td className="p-3">{rule.active ? 'Active' : 'Inactive'}</td>
                      {canManageReminders && (
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setReminderRuleForm({
                              ...rule,
                              reminderDays: [...rule.reminderDays],
                              channels: [...rule.channels],
                              recipients: rule.recipients.map(recipient =>
                                typeof recipient === 'string' ? recipient : { ...recipient }),
                            })}
                            className="p-1.5 text-slate-500 hover:text-slate-900"
                            aria-label="Edit reminder rule"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!reminderRules.length && (
                    <tr>
                      <td colSpan={canManageReminders ? 7 : 6} className="p-8 text-center text-slate-500">
                        No specific rules. Global defaults will be used.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RBAC */}
      {activeTab === 'rbac' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Role-Based Access Control (RBAC) Matrix</h3>
              <p className="mt-1 text-slate-500">Create roles and assign database-backed permissions used by both the API and interface.</p>
            </div>
            {canManageRoles && (
              <button
                onClick={() => {
                  setRoleForm({ name: '', permissions: [] });
                  setIsRoleModalOpen(true);
                }}
                className="bg-slate-900 text-white px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Role
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Role Name</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Permissions Count</th>
                  {canManageRoles && <th className="py-2.5 px-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.getRoles().map(r => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{r.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{r.code}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{r.permissions.length} Granted</td>
                    {canManageRoles && (
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setRoleForm({ ...r, permissions: [...r.permissions] });
                            setIsRoleModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-900"
                          aria-label={`Edit ${r.name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'operations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Queue, Scheduler & Failed Jobs</h3>
              <p className="text-xs text-slate-500 mt-1">Live operational state from Laravel queue tables and the expiry scheduler.</p>
            </div>
            <button onClick={() => void operations.refetch()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold">
              <RefreshCw className={`w-4 h-4 ${operations.isFetching ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          {operations.isLoading && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">Loading operations status…</div>
          )}
          {operations.isError && (
            <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4 text-xs text-rose-700">
              {operations.error instanceof Error ? operations.error.message : 'Unable to load queue status.'}
            </div>
          )}
          {operations.data && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  ['Queue connection', operations.data.connection],
                  ['Queued jobs', operations.data.queuedJobs],
                  ['Failed jobs', operations.data.failedJobs],
                  ['Scheduler timezone', operations.data.schedulerTimezone],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</div>
                    <div className="text-lg font-extrabold text-slate-900 mt-1">{value}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs">
                <b className="text-slate-800">Last expiry scan:</b>{' '}
                <span className="text-slate-600">
                  {operations.data.lastExpiryScanAt ? new Date(operations.data.lastExpiryScanAt).toLocaleString() : 'Not run yet'}
                </span>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">Recent failed jobs</div>
                <div className="divide-y divide-slate-100">
                  {operations.data.failed.map(job => (
                    <div key={job.uuid} className="p-4 flex flex-col lg:flex-row lg:items-start gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono font-bold text-slate-800 break-all">{job.uuid}</div>
                        <div className="text-slate-500 mt-1">{job.queue} · {new Date(job.failedAt).toLocaleString()}</div>
                        <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-rose-50 p-3 text-[11px] text-rose-700 max-h-28 overflow-auto">{job.error}</pre>
                      </div>
                      {canManageSettings && (
                        <button onClick={() => void retryFailedJob(job.uuid)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white font-bold">
                          <RotateCcw className="w-4 h-4" /> Retry
                        </button>
                      )}
                    </div>
                  ))}
                  {operations.data.failed.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-500">No failed jobs.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Company Modal */}
      {isCompanyModalOpen && canManageCompanies && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Company Details</h3>
              <button onClick={() => setIsCompanyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-5 space-y-3 text-xs max-h-[75vh] overflow-y-auto">
              {companyError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 font-semibold">
                  {companyError}
                </div>
              )}

              {/* Company logo upload */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="font-semibold text-slate-700 block mb-2">Company Logo</span>
                <div className="flex items-center gap-3">
                  <CompanyLogo
                    code={editingCompany.code || ''}
                    name={editingCompany.name}
                    logoUrl={editingCompany.logoUrl}
                    sizeClass="w-16 h-16"
                    textClass="text-sm"
                  />
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                      onChange={handleLogoUpload}
                      className="w-full border border-slate-300 bg-white rounded-xl p-1 text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">PNG or JPG, max 2 MB.</span>
                      {editingCompany.logoUrl && (
                        <button
                          type="button"
                          onClick={handleLogoRemove}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                        >
                          Remove logo
                        </button>
                      )}
                    </div>
                    {!editingCompany.logoUrl && (
                      <p className="text-[11px] text-slate-400">
                        No logo uploaded — the company code badge is shown instead.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={editingCompany.name || ''}
                  onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Code Prefix *</label>
                  <input
                    type="text"
                    required
                    value={editingCompany.code || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">CR Number</label>
                  <input
                    type="text"
                    value={editingCompany.crNumber || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, crNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="font-semibold text-slate-700 block mb-1">Computer Card Number</span>
                  <input value={editingCompany.computerCardNumber || ''} onChange={event => setEditingCompany({ ...editingCompany, computerCardNumber: event.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono" />
                </label>
                <label>
                  <span className="font-semibold text-slate-700 block mb-1">Tax Number</span>
                  <input value={editingCompany.taxNumber || ''} onChange={event => setEditingCompany({ ...editingCompany, taxNumber: event.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="font-semibold text-slate-700 block mb-1">Email</span>
                  <input type="email" value={editingCompany.email || ''} onChange={event => setEditingCompany({ ...editingCompany, email: event.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
                </label>
                <label>
                  <span className="font-semibold text-slate-700 block mb-1">Phone</span>
                  <input value={editingCompany.phone || ''} onChange={event => setEditingCompany({ ...editingCompany, phone: event.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
                </label>
              </div>

              <label className="block">
                <span className="font-semibold text-slate-700 block mb-1">Address</span>
                <textarea rows={2} value={editingCompany.address || ''} onChange={event => setEditingCompany({ ...editingCompany, address: event.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
              </label>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="px-4 py-2 text-slate-700 font-semibold hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl shadow-xs"
                >
                  Save Entity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isUserModalOpen && canManageUsers && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">{userForm.id ? 'Edit User Account' : 'Create User Account'}</h3>
              <button onClick={() => setIsUserModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveUser} className="p-5 grid grid-cols-2 gap-3 text-xs">
              <label className="col-span-2"><span className="block font-semibold mb-1">Full Name</span>
                <input required value={userForm.name || ''} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="w-full border rounded-xl px-3 py-2" />
              </label>
              <label><span className="block font-semibold mb-1">Email</span>
                <input required type="email" value={userForm.email || ''} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="w-full border rounded-xl px-3 py-2" />
              </label>
              <label><span className="block font-semibold mb-1">Temporary Password</span>
                <input required={!userForm.id} minLength={12} type="password" value={userForm.password || ''} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="w-full border rounded-xl px-3 py-2" placeholder={userForm.id ? 'Leave blank to keep current password' : ''} />
              </label>
              <fieldset className="col-span-2 rounded-xl border border-slate-200 p-3">
                <legend className="px-1 font-semibold">Roles (one or more)</legend>
                <div className="grid grid-cols-2 gap-2">
                  {db.getRoles().map(role => {
                    const checked = (userForm.roleIds || []).includes(role.id);
                    return (
                      <label key={role.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => {
                            const next = event.target.checked
                              ? [...(userForm.roleIds || []), role.id]
                              : (userForm.roleIds || []).filter(id => id !== role.id);
                            setUserForm({ ...userForm, roleIds: next, roleId: next[0] || '' });
                          }}
                          className="h-4 w-4 accent-amber-500"
                        />
                        <span>{role.name}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="col-span-2 rounded-xl border border-slate-200 p-3">
                <legend className="px-1 font-semibold">Company access</legend>
                <label className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 p-2 font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    checked={userForm.companyAccess === 'all'}
                    onChange={event => setUserForm({
                      ...userForm,
                      companyAccess: event.target.checked
                        ? 'all'
                        : userForm.primaryCompanyId
                          ? [userForm.primaryCompanyId]
                          : db.getCompanies()[0]
                            ? [db.getCompanies()[0].id]
                            : [],
                      primaryCompanyId: userForm.primaryCompanyId || db.getCompanies()[0]?.id || '',
                    })}
                    className="h-4 w-4 accent-amber-500"
                  />
                  All authorized companies
                </label>
                {userForm.companyAccess !== 'all' && (
                  <div className="grid grid-cols-2 gap-2">
                    {db.getCompanies().map(company => {
                      const selected = userForm.companyAccess || [];
                      const checked = selected.includes(company.id);
                      return (
                        <label key={company.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={event => {
                              const next = event.target.checked
                                ? [...selected, company.id]
                                : selected.filter(id => id !== company.id);
                              setUserForm({
                                ...userForm,
                                companyAccess: next,
                                primaryCompanyId: next.includes(userForm.primaryCompanyId || '')
                                  ? userForm.primaryCompanyId
                                  : next[0] || '',
                              });
                            }}
                            className="h-4 w-4 accent-amber-500"
                          />
                          <span>{company.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
              <label><span className="block font-semibold mb-1">Primary Company</span>
                <select
                  required
                  value={userForm.primaryCompanyId || ''}
                  onChange={e => setUserForm({ ...userForm, primaryCompanyId: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2"
                >
                  <option value="">Select primary company</option>
                  {db.getCompanies()
                    .filter(company => userForm.companyAccess === 'all' || (userForm.companyAccess || []).includes(company.id))
                    .map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </label>
              <label><span className="block font-semibold mb-1">Status</span>
                <select value={userForm.status || 'active'} onChange={e => setUserForm({ ...userForm, status: e.target.value as User['status'] })} className="w-full border rounded-xl px-3 py-2">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div className="col-span-2 text-right pt-3 border-t">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 mr-2">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl">{userForm.id ? 'Save Account' : 'Create Account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRoleModalOpen && canManageRoles && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{roleForm.id ? 'Edit Role' : 'Create Role'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Permissions are enforced by the Laravel API.</p>
              </div>
              <button onClick={() => setIsRoleModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveRole} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[calc(90vh-4rem)]">
              <label className="block">
                <span className="block font-semibold mb-1">Role name</span>
                <input
                  required
                  disabled={roleForm.name === 'Super Admin'}
                  value={roleForm.name || ''}
                  onChange={event => setRoleForm({ ...roleForm, name: event.target.value })}
                  className="w-full border rounded-xl px-3 py-2 disabled:bg-slate-100"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(
                  db.getPermissions().reduce<Record<string, Permission[]>>(
                    (groups, permission) => {
                      (groups[permission.category] ||= []).push(permission);
                      return groups;
                    },
                    {},
                  ),
                ).map(([category, permissions]) => (
                  <fieldset key={category} className="rounded-xl border border-slate-200 p-3">
                    <legend className="px-1 font-bold text-slate-800">{category}</legend>
                    <div className="space-y-2">
                      {permissions.map(permission => (
                        <label key={permission.code} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={roleForm.name === 'Super Admin' || (roleForm.permissions || []).includes(permission.code)}
                            disabled={roleForm.name === 'Super Admin'}
                            onChange={event => setRoleForm({
                              ...roleForm,
                              permissions: event.target.checked
                                ? [...(roleForm.permissions || []), permission.code]
                                : (roleForm.permissions || []).filter(code => code !== permission.code),
                            })}
                            className="mt-0.5 h-4 w-4 accent-amber-500"
                          />
                          <span>
                            <span className="block font-semibold">{permission.name}</span>
                            <span className="block font-mono text-[10px] text-slate-400">{permission.code}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <div className="text-right pt-3 border-t">
                <button type="button" onClick={() => setIsRoleModalOpen(false)} className="px-4 py-2 mr-2">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl">Save Role</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reminderRuleForm && canManageReminders && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {reminderRuleForm.id ? 'Edit Reminder Rule' : 'Create Reminder Rule'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Set the scope, schedule, channels and recipients.</p>
              </div>
              <button onClick={() => setReminderRuleForm(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveReminderRule} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[calc(90vh-4rem)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span className="block font-semibold mb-1">Company scope</span>
                  <select
                    value={reminderRuleForm.companyId || ''}
                    onChange={event => setReminderRuleForm({
                      ...reminderRuleForm,
                      companyId: event.target.value || undefined,
                    })}
                    className="w-full border rounded-xl px-3 py-2"
                  >
                    {db.getCurrentUser().isSuperAdmin && <option value="">All companies</option>}
                    {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="block font-semibold mb-1">Document type</span>
                  <select
                    value={reminderRuleForm.documentTypeId || ''}
                    onChange={event => setReminderRuleForm({
                      ...reminderRuleForm,
                      documentTypeId: event.target.value || undefined,
                    })}
                    className="w-full border rounded-xl px-3 py-2"
                  >
                    <option value="">All document types</option>
                    {db.getDocumentTypes().map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="block font-semibold mb-1">Reminder days (comma separated)</span>
                <input
                  required
                  value={(reminderRuleForm.reminderDays || []).join(', ')}
                  onChange={event => setReminderRuleForm({
                    ...reminderRuleForm,
                    reminderDays: [...new Set<number>(event.target.value
                      .split(',')
                      .map(value => Number(value.trim()))
                      .filter(value => Number.isInteger(value) && value >= 0 && value <= 3650))],
                  })}
                  className="w-full border rounded-xl px-3 py-2 font-mono"
                />
              </label>

              <fieldset className="rounded-xl border border-slate-200 p-3">
                <legend className="px-1 font-bold">Channels</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(['email', 'sms', 'whatsapp'] as NotificationChannel[]).map(channel => (
                    <label key={channel} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 capitalize">
                      <input
                        type="checkbox"
                        checked={(reminderRuleForm.channels || []).includes(channel)}
                        onChange={event => setReminderRuleForm({
                          ...reminderRuleForm,
                          channels: event.target.checked
                            ? [...(reminderRuleForm.channels || []), channel]
                            : (reminderRuleForm.channels || []).filter(value => value !== channel),
                        })}
                        className="h-4 w-4 accent-amber-500"
                      />
                      {channel}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-xl border border-slate-200 p-3">
                <legend className="px-1 font-bold">Recipients</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    ['owner', 'Document owner'],
                    ['assigned_hr', 'Assigned HR users'],
                    ['company_manager', 'Company managers'],
                    ['super_admin', 'Super Admin users'],
                    ['custom', 'Custom recipient'],
                  ].map(([type, label]) => {
                    const checked = (reminderRuleForm.recipients || []).some(recipient =>
                      typeof recipient === 'string' ? recipient === type : recipient.type === type);
                    return (
                      <label key={type} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => toggleReminderRecipient(
                            type as 'owner' | 'assigned_hr' | 'company_manager' | 'super_admin' | 'custom',
                            event.target.checked,
                          )}
                          className="h-4 w-4 accent-amber-500"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
                {(reminderRuleForm.recipients || []).some(recipient => typeof recipient === 'object') && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                    <input
                      required
                      placeholder="Recipient name"
                      value={(reminderRuleForm.recipients || [])
                        .find((recipient): recipient is CustomReminderRecipient => typeof recipient === 'object')?.name || ''}
                      onChange={event => updateCustomRecipient({ name: event.target.value })}
                      className="border rounded-xl px-3 py-2"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={(reminderRuleForm.recipients || [])
                        .find((recipient): recipient is CustomReminderRecipient => typeof recipient === 'object')?.email || ''}
                      onChange={event => updateCustomRecipient({ email: event.target.value })}
                      className="border rounded-xl px-3 py-2"
                    />
                    <input
                      placeholder="Phone / WhatsApp"
                      value={(reminderRuleForm.recipients || [])
                        .find((recipient): recipient is CustomReminderRecipient => typeof recipient === 'object')?.phone || ''}
                      onChange={event => updateCustomRecipient({ phone: event.target.value })}
                      className="border rounded-xl px-3 py-2"
                    />
                  </div>
                )}
              </fieldset>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(reminderRuleForm.active)}
                  onChange={event => setReminderRuleForm({ ...reminderRuleForm, active: event.target.checked })}
                  className="h-4 w-4 accent-amber-500"
                />
                Rule is active
              </label>

              <div className="text-right pt-3 border-t">
                <button type="button" onClick={() => setReminderRuleForm(null)} className="px-4 py-2 mr-2">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl">Save Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
