import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarRange,
  Download,
  FileSpreadsheet,
  Filter,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { apiDownload } from '../../services/api';
import { db } from '../../services/db';

type ReportFormat = 'csv' | 'xlsx' | 'pdf';
type ReportType =
  | 'employees'
  | 'vehicles'
  | 'documents'
  | 'expired-documents'
  | 'expiring-today'
  | 'expiring-7'
  | 'expiring-15'
  | 'expiring-30'
  | 'custom-expiry'
  | 'document-types'
  | 'vehicle-documents'
  | 'company-documents'
  | 'notifications'
  | 'failed-notifications'
  | 'renewals';

const REPORT_TYPES: Array<{ value: ReportType; label: string; group: string }> = [
  { value: 'employees', label: 'Employee Directory', group: 'Master Data' },
  { value: 'vehicles', label: 'Vehicle Fleet', group: 'Master Data' },
  { value: 'documents', label: 'All Documents', group: 'Compliance' },
  { value: 'expired-documents', label: 'Expired Documents', group: 'Compliance' },
  { value: 'expiring-today', label: 'Expiring Today', group: 'Compliance' },
  { value: 'expiring-7', label: 'Expiring in 7 Days', group: 'Compliance' },
  { value: 'expiring-15', label: 'Expiring in 15 Days', group: 'Compliance' },
  { value: 'expiring-30', label: 'Expiring in 30 Days', group: 'Compliance' },
  { value: 'custom-expiry', label: 'Custom Expiry Range', group: 'Compliance' },
  { value: 'document-types', label: 'Documents by Type', group: 'Compliance' },
  { value: 'vehicle-documents', label: 'Vehicle Documents', group: 'Compliance' },
  { value: 'company-documents', label: 'Company Documents', group: 'Compliance' },
  { value: 'renewals', label: 'Renewal History', group: 'History' },
  { value: 'notifications', label: 'Notification Delivery Log', group: 'Notifications' },
  { value: 'failed-notifications', label: 'Failed Notifications', group: 'Notifications' },
];

const EMPTY_FILTERS = {
  companyId: '',
  departmentId: '',
  documentTypeId: '',
  ownerType: '',
  employeeStatus: '',
  vehicleStatus: '',
  expiryStatus: '',
  dateFrom: '',
  dateTo: '',
  nationality: '',
  notificationStatus: '',
};

type ReportFilters = typeof EMPTY_FILTERS;

export const ReportsModule: React.FC = () => {
  const selectedWorkspace = db.getSelectedCompanyId();
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('documents');
  const [filters, setFilters] = useState<ReportFilters>({
    ...EMPTY_FILTERS,
    companyId: selectedWorkspace === 'all' ? '' : selectedWorkspace,
  });
  const [exporting, setExporting] = useState<ReportFormat | ''>('');

  const companies = db.getCompanies();
  const departments = db.getDepartments(filters.companyId || undefined);
  const documentTypes = db.getDocumentTypes();
  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([, value]) => Boolean(value)),
    [filters],
  );
  const dashboardQuery = useQuery({
    queryKey: ['report-summary', filters.companyId, filters.departmentId, filters.documentTypeId, filters.ownerType, filters.expiryStatus, filters.dateFrom, filters.dateTo],
    queryFn: () => db.dashboardSummary({
      companyId: filters.companyId,
      departmentId: filters.departmentId,
      documentTypeId: filters.documentTypeId,
      ownerType: filters.ownerType,
      expiryStatus: filters.expiryStatus,
      expiryFrom: filters.dateFrom,
      expiryTo: filters.dateTo,
    }),
  });
  const stats = dashboardQuery.data?.stats || db.getKPIStats();

  const setFilter = (key: keyof ReportFilters, value: string) => {
    setFilters(current => ({
      ...current,
      [key]: value,
      ...(key === 'companyId' ? { departmentId: '' } : {}),
    }));
  };

  const handleExport = async (format: ReportFormat) => {
    setExporting(format);
    try {
      const query = new URLSearchParams({ type: selectedReportType, format });
      activeFilters.forEach(([key, value]) => query.set(key, value));
      await apiDownload(`/reports/export?${query.toString()}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to export report.');
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Compliance Reports & Exports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Every export is generated from the live database, restricted to your permitted companies, and recorded in the audit log.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExport('pdf')}
            disabled={Boolean(exporting)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
          <button
            type="button"
            onClick={() => void handleExport('xlsx')}
            disabled={Boolean(exporting)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" /> {exporting === 'xlsx' ? 'Preparing…' : 'Excel'}
          </button>
          <button
            type="button"
            onClick={() => void handleExport('csv')}
            disabled={Boolean(exporting)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {exporting === 'csv' ? 'Preparing…' : 'CSV'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-4">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-sm text-slate-900">Report selection</h2>
          </div>
          <label className="block text-xs">
            <span className="font-bold text-slate-700 block mb-1">Report</span>
            <select
              value={selectedReportType}
              onChange={event => setSelectedReportType(event.target.value as ReportType)}
              className="w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl font-semibold"
            >
              {Array.from(new Set(REPORT_TYPES.map(report => report.group))).map(group => (
                <optgroup key={group} label={group}>
                  {REPORT_TYPES.filter(report => report.group === group).map(report => (
                    <option key={report.value} value={report.value}>{report.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <Filter className="w-4 h-4 text-slate-500" />
            <h2 className="font-bold text-sm text-slate-900">Optional filters</h2>
            <span className="ml-auto text-[11px] text-slate-400">{activeFilters.length} applied</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-xs">
            <FilterSelect label="Company" value={filters.companyId} onChange={value => setFilter('companyId', value)}>
              <option value="">All accessible companies</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Department" value={filters.departmentId} onChange={value => setFilter('departmentId', value)}>
              <option value="">All departments</option>
              {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Document type" value={filters.documentTypeId} onChange={value => setFilter('documentTypeId', value)}>
              <option value="">All document types</option>
              {documentTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Owner type" value={filters.ownerType} onChange={value => setFilter('ownerType', value)}>
              <option value="">All owners</option>
              <option value="employee">Employee</option>
              <option value="vehicle">Vehicle</option>
              <option value="company">Company</option>
            </FilterSelect>
            <FilterSelect label="Expiry status" value={filters.expiryStatus} onChange={value => setFilter('expiryStatus', value)}>
              <option value="">Any expiry status</option>
              <option value="expired">Expired</option>
              <option value="expires_today">Expires today</option>
              <option value="critical">Critical (1–10 days)</option>
              <option value="warning">Warning (11–30 days)</option>
              <option value="valid">Valid (over 30 days)</option>
              <option value="no_expiry">No expiry</option>
            </FilterSelect>
            <FilterSelect label="Employee status" value={filters.employeeStatus} onChange={value => setFilter('employeeStatus', value)}>
              <option value="">Any employee status</option>
              <option value="active">Active</option>
              <option value="on_leave">On leave</option>
              <option value="cancelled">Cancelled</option>
            </FilterSelect>
            <FilterSelect label="Vehicle status" value={filters.vehicleStatus} onChange={value => setFilter('vehicleStatus', value)}>
              <option value="">Any vehicle status</option>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </FilterSelect>
            <FilterSelect label="Notification status" value={filters.notificationStatus} onChange={value => setFilter('notificationStatus', value)}>
              <option value="">Any delivery status</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="rejected">Rejected</option>
            </FilterSelect>
            <label>
              <span className="font-bold text-slate-700 block mb-1">Nationality</span>
              <input value={filters.nationality} onChange={event => setFilter('nationality', event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5" placeholder="Any nationality" />
            </label>
            <label>
              <span className="font-bold text-slate-700 block mb-1">Date / expiry from</span>
              <input type="date" value={filters.dateFrom} onChange={event => setFilter('dateFrom', event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5" />
            </label>
            <label>
              <span className="font-bold text-slate-700 block mb-1">Date / expiry to</span>
              <input type="date" min={filters.dateFrom} value={filters.dateTo} onChange={event => setFilter('dateTo', event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5" />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setFilters({ ...EMPTY_FILTERS, companyId: selectedWorkspace === 'all' ? '' : selectedWorkspace })}
            className="text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            Clear optional filters
          </button>
        </section>

        <aside className="bg-slate-900 text-white rounded-2xl p-5 space-y-4">
          <ShieldCheck className="w-8 h-8 text-amber-400" />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Selected report</div>
            <div className="font-bold mt-1">{REPORT_TYPES.find(report => report.value === selectedReportType)?.label}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Metric label="Employees" value={stats.totalEmployees} />
            <Metric label="Vehicles" value={stats.totalVehicles} />
            <Metric label="Documents" value={stats.totalDocuments} />
            <Metric label="Expired" value={stats.expiredDocuments} danger />
            <Metric label="7-day window" value={stats.expiringIn7Days} warning />
            <Metric label="Failed alerts" value={stats.failedNotifications} danger />
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-white/5 p-3 text-[11px] text-slate-300">
            <CalendarRange className="w-4 h-4 shrink-0 text-amber-400" />
            Counts refresh from the server using the company and compliance filters above.
          </div>
          {dashboardQuery.isError && <p className="text-[11px] text-rose-300">Live summary could not be refreshed. Export remains available.</p>}
        </aside>
      </div>
    </div>
  );
};

const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ label, value, onChange, children }) => (
  <label>
    <span className="font-bold text-slate-700 block mb-1">{label}</span>
    <select value={value} onChange={event => onChange(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5">
      {children}
    </select>
  </label>
);

const Metric: React.FC<{ label: string; value: number; danger?: boolean; warning?: boolean }> = ({ label, value, danger, warning }) => (
  <div className="rounded-xl bg-white/5 p-3">
    <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    <div className={`text-xl font-extrabold mt-1 ${danger ? 'text-rose-300' : warning ? 'text-amber-300' : 'text-white'}`}>{value}</div>
  </div>
);
