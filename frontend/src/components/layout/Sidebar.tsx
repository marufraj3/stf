import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  LayoutDashboard, Users, FileText, Settings2, Car, 
  Building, Bell, MessageSquareCode, BarChart3, UploadCloud, 
  History, Settings, ShieldAlert, AlertTriangle
} from 'lucide-react';
import { db } from '../../services/db';

export type NavTab = 
  | 'dashboard' 
  | 'employees' 
  | 'documents' 
  | 'doc-types' 
  | 'vehicles' 
  | 'company-docs' 
  | 'reminders' 
  | 'templates' 
  | 'reports' 
  | 'import' 
  | 'audit' 
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const summaryQuery = useQuery({
    queryKey: ['sidebar-summary', db.getSelectedCompanyId()],
    queryFn: () => db.dashboardSummary({}),
  });
  const stats = summaryQuery.data?.stats || db.getKPIStats();

  const navItems = ([ 
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
    { id: 'employees', label: 'Employees', icon: Users, permission: 'employees.view', badge: stats.totalEmployees, badgeColor: 'bg-slate-700 text-slate-200' },
    { id: 'documents', label: 'Dynamic Documents', icon: FileText, permission: 'documents.view', badge: stats.expiredDocuments > 0 ? stats.expiredDocuments : undefined, badgeColor: 'bg-rose-500 text-white animate-pulse' },
    { id: 'doc-types', label: 'Document Types', icon: Settings2, permission: 'document_types.view' },
    { id: 'vehicles', label: 'Vehicle Fleet', icon: Car, permission: 'vehicles.view', badge: stats.totalVehicles, badgeColor: 'bg-slate-700 text-slate-200' },
    { id: 'company-docs', label: 'Company Licenses', icon: Building, permission: 'company_documents.view' },
    { id: 'reminders', label: 'Reminders & Queue', icon: Bell, permission: 'notifications.view', badge: stats.failedNotifications > 0 ? stats.failedNotifications : undefined, badgeColor: 'bg-amber-500 text-white' },
    { id: 'templates', label: 'Notification Templates', icon: MessageSquareCode, permission: 'templates.view' },
    { id: 'reports', label: 'Reports & Exports', icon: BarChart3, permission: 'reports.view' },
    { id: 'import', label: 'Excel Bulk Import', icon: UploadCloud, permission: 'imports.view' },
    { id: 'audit', label: 'Audit Activity Log', icon: History, permission: 'audit.view' },
    { id: 'settings', label: 'System Settings', icon: Settings, permission: 'settings.view' },
  ] as {
    id: NavTab;
    label: string;
    icon: React.ElementType;
    permission: string;
    badge?: number;
    badgeColor?: string;
  }[]).filter(item => db.hasPermission(item.permission));

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-4rem)] border-r border-slate-800">
      {/* Expiry Quick Warning Bar */}
      {(stats.expiredDocuments > 0 || stats.expiringIn7Days > 0) && (
        <div className="p-3 mx-3 mt-3 bg-rose-950/60 border border-rose-800/60 rounded-xl flex items-center gap-2.5 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="leading-tight">
            <span className="font-bold block text-rose-300">Expiry Alert</span>
            <span className="text-[11px] text-rose-200/90">
              {stats.expiredDocuments} expired, {stats.expiringIn7Days} urgent in 7 days
            </span>
          </div>
        </div>
      )}

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Main Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
                  : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="leading-tight">
            <span className="font-semibold block text-slate-300">Qatar Compliance Server</span>
            <span className="text-[10px] text-slate-400">Timezone: Asia/Qatar (UTC+3)</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
