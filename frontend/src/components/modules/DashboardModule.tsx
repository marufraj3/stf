import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, FileText, Car, AlertTriangle, Clock, CheckCircle2, 
  XCircle, Send, Plus, RefreshCw, Filter, ChevronRight, FileCheck, FileWarning
} from 'lucide-react';
import { db } from '../../services/db';
import { StatusBadge } from '../common/StatusBadge';
import { ExpiryAlertBox } from '../common/ExpiryAlertBox';
import { DocumentRecord } from '../../types';
import { NavTab } from '../layout/Sidebar';

interface DashboardModuleProps {
  onNavigate: (tab: NavTab, filterStatus?: string) => void;
  onOpenRenewModal: (doc: DocumentRecord) => void;
  onRefresh: () => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ 
  onNavigate, 
  onOpenRenewModal,
  onRefresh 
}) => {
  const [selectedOwnerType, setSelectedOwnerType] = useState<string>('all');
  const [selectedDocType, setSelectedDocType] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedExpiryStatus, setSelectedExpiryStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const docTypes = db.getDocumentTypes();
  const dashboardQuery = useQuery({
    queryKey: [
      'dashboard',
      db.getSelectedCompanyId(),
      selectedDepartment,
      selectedDocType,
      selectedOwnerType,
      selectedExpiryStatus,
      dateFrom,
      dateTo,
    ],
    queryFn: () => db.dashboardSummary({
      departmentId: selectedDepartment,
      documentTypeId: selectedDocType,
      ownerType: selectedOwnerType,
      expiryStatus: selectedExpiryStatus,
      expiryFrom: dateFrom,
      expiryTo: dateTo,
    }),
  });
  const stats = dashboardQuery.data?.stats || db.getKPIStats();
  const urgentDocs = dashboardQuery.data?.urgentDocuments || [];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Compliance & HR Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-company monitoring for Qatar ID, Passport, Estimara, and Commercial License expiries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {db.hasPermission('employees.create') && (
            <button
              onClick={() => onNavigate('employees')}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Employee</span>
            </button>
          )}
          {db.hasPermission('documents.create') && (
            <button
              onClick={() => onNavigate('documents')}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter className="w-4 h-4 text-amber-500" />
            Live dashboard filters
          </div>
          <button
            onClick={() => dashboardQuery.refetch()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dashboardQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <select value={selectedDepartment} onChange={event => setSelectedDepartment(event.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <option value="all">All Departments</option>
            {db.getDepartments().map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select value={selectedDocType} onChange={event => setSelectedDocType(event.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <option value="all">All Document Types</option>
            {docTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
          <select value={selectedOwnerType} onChange={event => setSelectedOwnerType(event.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <option value="all">All Owners</option>
            <option value="employee">Employees</option>
            <option value="vehicle">Vehicles</option>
            <option value="company">Companies</option>
          </select>
          <select value={selectedExpiryStatus} onChange={event => setSelectedExpiryStatus(event.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <option value="all">All Expiry Statuses</option>
            <option value="expired">Expired</option>
            <option value="expires_today">Expires Today</option>
            <option value="critical">1–10 Days</option>
            <option value="warning">11–30 Days</option>
            <option value="valid">31+ Days</option>
            <option value="no_expiry">No Expiry</option>
          </select>
          <input type="date" aria-label="Expiry from" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
          <input type="date" aria-label="Expiry to" min={dateFrom || undefined} value={dateTo} onChange={event => setDateTo(event.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
        </div>
        {dashboardQuery.isError && (
          <p className="mt-3 text-xs text-rose-600">
            {dashboardQuery.error instanceof Error ? dashboardQuery.error.message : 'Unable to refresh dashboard.'}
          </p>
        )}
      </div>

      {/* Expiry notification box: QID 15 / Passport 90 / Istimara 30 days */}
      <ExpiryAlertBox
        alerts={dashboardQuery.data?.documentTypeAlerts}
        isLoading={dashboardQuery.isLoading}
        onSelect={(code, status) => {
          const type = docTypes.find(item => item.code === code);
          if (type) setSelectedDocType(type.id);
          setSelectedExpiryStatus(status);
          onNavigate('documents', status);
        }}
      />

      {/* Per-document-type summary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ['Total Staff', stats.totalEmployees, 'text-slate-900'],
          ['Total Vehicles', stats.totalVehicles, 'text-slate-900'],
          ['Expiring QID', stats.expiringQid, 'text-amber-700'],
          ['Expiring Passport', stats.expiringPassport, 'text-amber-700'],
          ['Expiring Istimara', stats.expiringIstimara, 'text-amber-700'],
          ['Expired Documents', stats.expiredDocuments, 'text-rose-700'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
            <span className={`mt-1 block text-2xl font-extrabold ${tone}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* KPI Cards Grid - Top Row: Primary HR & Document Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Employees */}
        <button
          onClick={() => onNavigate('employees')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs text-left transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-slate-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Staff</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-900">{stats.totalEmployees}</span>
            <span className="text-xs text-emerald-600 font-semibold">{stats.activeEmployees} active</span>
          </div>
        </button>

        {/* Expired Documents (Red) */}
        <button
          onClick={() => onNavigate('documents', 'expired')}
          className="bg-rose-50/80 hover:bg-rose-100/80 p-4 rounded-2xl border border-rose-200/80 shadow-2xs text-left transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Expired Docs</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-rose-700">{stats.expiredDocuments}</span>
            <span className="text-xs text-rose-600 font-medium">Critical</span>
          </div>
        </button>

        {/* Expires Today (Blue) */}
        <button
          onClick={() => onNavigate('documents', 'expires_today')}
          className="bg-blue-50/80 hover:bg-blue-100/80 p-4 rounded-2xl border border-blue-200/80 shadow-2xs text-left transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Expires Today</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-blue-700">{stats.expiringToday}</span>
            <span className="text-xs text-blue-600 font-medium">Action Needed</span>
          </div>
        </button>

        {/* Expiring in 7 Days (Orange) */}
        <button
          onClick={() => onNavigate('documents', 'critical')}
          className="bg-orange-50/80 hover:bg-orange-100/80 p-4 rounded-2xl border border-orange-200/80 shadow-2xs text-left transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between text-orange-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">In 1 - 7 Days</span>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-orange-700">{stats.expiringIn7Days}</span>
            <span className="text-xs text-orange-600 font-medium">1-7 Days</span>
          </div>
        </button>

        {/* Expiring in 15 Days (Yellow) */}
        <button
          onClick={() => onNavigate('documents', 'warning')}
          className="bg-amber-50/80 hover:bg-amber-100/80 p-4 rounded-2xl border border-amber-200/80 shadow-2xs text-left transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">In 8 - 15 Days</span>
            <FileWarning className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-amber-800">{stats.expiringIn15Days}</span>
            <span className="text-xs text-amber-700 font-medium">15 Days</span>
          </div>
        </button>

        {/* Expiring in 30 Days */}
        <button
          onClick={() => onNavigate('documents', 'warning')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs text-left transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">In 30 Days</span>
            <FileCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-900">{stats.expiringIn30Days}</span>
            <span className="text-xs text-slate-500 font-medium">Upcoming</span>
          </div>
        </button>
      </div>

      {/* KPI Row 2: Fleet, Notification Pipeline & Daily Logs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Vehicles summary */}
        <button
          onClick={() => onNavigate('vehicles')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs text-left flex items-center justify-between"
        >
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehicle Fleet</span>
            <div className="text-xl font-bold text-slate-900 mt-1">{stats.totalVehicles} Vehicles</div>
            <span className="text-[11px] text-slate-400">Estimara & Insurance tracked</span>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <Car className="w-6 h-6" />
          </div>
        </button>

        {/* Today's SMS Sent */}
        <button
          onClick={() => onNavigate('reminders')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs text-left flex items-center justify-between"
        >
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's SMS</span>
            <div className="text-xl font-bold text-slate-900 mt-1">{stats.todaySmsCount} Sent</div>
            <span className="text-[11px] text-emerald-600 font-medium">Ooredoo / Vodafone Gateway</span>
          </div>
          <div className="p-3 bg-sky-50 rounded-xl text-sky-600">
            <Send className="w-6 h-6" />
          </div>
        </button>

        {/* Today's WhatsApp */}
        <button
          onClick={() => onNavigate('reminders')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs text-left flex items-center justify-between"
        >
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's WhatsApp</span>
            <div className="text-xl font-bold text-slate-900 mt-1">{stats.todayWhatsappCount} Sent</div>
            <span className="text-[11px] text-emerald-600 font-medium">Meta Business API</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Send className="w-6 h-6" />
          </div>
        </button>

        {/* Failed Notifications Alert */}
        <button
          onClick={() => onNavigate('reminders')}
          className={`p-4 rounded-2xl border shadow-2xs text-left flex items-center justify-between transition-all ${
            stats.failedNotifications > 0 
              ? 'bg-rose-50 border-rose-200 text-rose-900' 
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-75">Delivery Failures</span>
            <div className="text-xl font-bold mt-1">{stats.failedNotifications} Failed</div>
            <span className="text-[11px] opacity-80">Click to inspect and retry</span>
          </div>
          <div className={`p-3 rounded-xl ${stats.failedNotifications > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
            <XCircle className="w-6 h-6" />
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          ['Total Documents', stats.totalDocuments, 'text-slate-900'],
          ['No Expiry Date', stats.documentsWithoutExpiry, 'text-slate-600'],
          ['Cancelled Staff', stats.cancelledEmployees, 'text-rose-700'],
          ['Archived Staff', stats.archivedEmployees, 'text-slate-600'],
          ["Today's Email", stats.todayEmailCount, 'text-sky-700'],
          ['Queued', stats.queuedNotifications, 'text-amber-700'],
          ['Sent', stats.sentNotifications, 'text-emerald-700'],
          ['Delivered', stats.deliveredNotifications, 'text-emerald-700'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
            <span className={`mt-1 block text-xl font-extrabold ${tone}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Main Section: Urgent Expiry Attention Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Documents Requiring Immediate Renewal</span>
            </h2>
            <p className="text-xs text-slate-500">
              Listing expired, expiring today, and urgent documents across staff, vehicles, and company licenses.
            </p>
          </div>

          <button
            onClick={() => onNavigate('documents')}
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View All Dynamic Documents</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {dashboardQuery.isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading live compliance data…</div>
        ) : urgentDocs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">All Documents Compliant!</p>
            <p className="text-slate-400 mt-0.5">No expired or urgent documents detected at present.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200/80">
                  <th className="py-3 px-4">Owner Name</th>
                  <th className="py-3 px-4">Owner Type</th>
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">Doc Number</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {urgentDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{doc.ownerName}</td>
                    <td className="py-3 px-4 capitalize font-medium text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                        {doc.ownerType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{doc.documentTypeName}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">{doc.documentNumber}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">{doc.expiryDate || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <StatusBadge type="expiry" status={doc.status} daysRemaining={doc.daysRemaining} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {db.hasPermission('documents.renew') && (
                        <button
                          onClick={() => onOpenRenewModal(doc)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3 py-1 rounded-lg text-[11px] shadow-2xs transition-all active:scale-95"
                        >
                          Renew
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
