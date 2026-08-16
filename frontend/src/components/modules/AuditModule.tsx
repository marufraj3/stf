import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { db } from '../../services/db';

export const AuditModule: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const auditQuery = useQuery({
    queryKey: [
      'audit-logs',
      db.getSelectedCompanyId(),
      debouncedSearch,
      moduleFilter,
      dateFrom,
      dateTo,
      page,
    ],
    queryFn: () => db.listActivityLogs({
      search: debouncedSearch,
      module: moduleFilter,
      dateFrom,
      dateTo,
      page,
      pageSize,
      sortBy: 'created_at',
      direction: 'desc',
    }),
    placeholderData: previous => previous,
  });

  const logs = auditQuery.data?.items || [];
  const total = auditQuery.data?.total || 0;
  const totalPages = auditQuery.data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Audit Trail & Security Activity Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Server-recorded mutations, authentication events, renewals, imports and permission changes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search action, user, record or IP"
              value={searchTerm}
              onChange={event => { setSearchTerm(event.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={event => { setModuleFilter(event.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
          >
            <option value="all">All Modules</option>
            {[
              'Authentication',
              'Employee',
              'Employees',
              'Document',
              'Documents',
              'Vehicle',
              'Vehicles',
              'Notification',
              'Notifications',
              'Template',
              'Settings',
              'Import',
              'Report',
              'Role',
              'User',
            ].map(module => <option key={module} value={module}>{module}</option>)}
          </select>
          <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">From</span>
            <input type="date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent text-xs" />
          </label>
          <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">To</span>
            <input type="date" min={dateFrom || undefined} value={dateTo} onChange={event => { setDateTo(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent text-xs" />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4">Module / Record</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Timestamp (Asia/Qatar)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditQuery.isLoading ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading audit events…</td></tr>
              ) : auditQuery.isError ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-rose-600">
                    {auditQuery.error instanceof Error ? auditQuery.error.message : 'Unable to load audit logs.'}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">No matching audit events.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{log.action}</td>
                    <td className="py-3 px-4">
                      <span className="block font-semibold text-slate-800">{log.userName}</span>
                      <span className="block text-[10px] text-slate-400">{log.userEmail}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="block font-semibold text-slate-700">{log.module}</span>
                      <span className="block font-mono text-[10px] text-slate-400">
                        {log.entityType || 'system'} {log.entityId ? `#${log.entityId}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4">{log.companyName || 'Global'}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{log.ipAddress || 'Server'}</td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-600">
                      {new Date(log.timestamp).toLocaleString('en-GB', { timeZone: 'Asia/Qatar' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {logs.length} of {total} events</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40">
              Previous
            </button>
            <span className="font-semibold">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
