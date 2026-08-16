import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Bell, RefreshCw, Send, CheckCircle2, XCircle, Clock, 
  Search, Filter, RotateCcw, AlertTriangle, ShieldCheck 
} from 'lucide-react';
import { db } from '../../services/db';
import { NotificationLog, NotificationChannel, NotificationStatus } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { reminderEngine } from '../../services/reminderEngine';

interface RemindersModuleProps {
  onRefresh: () => void;
}

export const RemindersModule: React.FC<RemindersModuleProps> = ({ onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ dispatched: number; skipped: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const logQuery = useQuery({
    queryKey: [
      'notification-logs',
      db.getSelectedCompanyId(),
      debouncedSearch,
      channelFilter,
      statusFilter,
      documentTypeFilter,
      dateFrom,
      dateTo,
      page,
    ],
    queryFn: () => db.listNotificationLogs({
      channel: channelFilter,
      status: statusFilter,
      documentTypeId: documentTypeFilter,
      dateFrom,
      dateTo,
      search: debouncedSearch,
      page,
      pageSize,
    }),
    placeholderData: previous => previous,
  });
  const logs = logQuery.data?.items || [];
  const total = logQuery.data?.total || 0;
  const totalPages = logQuery.data?.totalPages || 1;

  const handleRunScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const res = await reminderEngine.scanAndDispatch();
      setScanResult(res);
      await logQuery.refetch();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Expiry scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRetryNotification = async (id: string) => {
    try {
      await db.retryNotification(id);
      await logQuery.refetch();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Retry failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Run Scan Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Automated Reminder & Dispatch Queue</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor and retry multi-channel notifications (Email, SMS via Ooredoo/Vodafone, WhatsApp Business API).
          </p>
        </div>

        {db.hasPermission('notifications.run') && (
          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Documents...' : 'Run Expiry Scan Now'}</span>
          </button>
        )}
      </div>

      {/* Scan Result Feedback Banner */}
      {scanResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-900 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold block">Expiry Scan Execution Complete!</span>
            <span>Dispatched <b>{scanResult.dispatched}</b> new reminders. Skipped <b>{scanResult.skipped}</b> (duplicate/idempotent).</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recipient, message body..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Channels (Email, SMS, WhatsApp)</option>
            <option value="email">Email Gateway</option>
            <option value="sms">SMS (Ooredoo / Vodafone)</option>
            <option value="whatsapp">WhatsApp Business API</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Delivery Statuses</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="queued">Queued</option>
          </select>

          <select
            value={documentTypeFilter}
            onChange={(e) => { setDocumentTypeFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Document Types</option>
            {db.getDocumentTypes().map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>

          <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={event => { setDateFrom(event.target.value); setPage(1); }}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>

          <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={event => { setDateTo(event.target.value); setPage(1); }}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
        </div>
      </div>

      {/* Notification Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Channel & Target</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Message Body</th>
                <th className="py-3 px-4">Trigger Time</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Loading notification history…</td>
                </tr>
              ) : logQuery.isError ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-rose-600">
                    {logQuery.error instanceof Error ? logQuery.error.message : 'Unable to load notification history.'}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No notification logs matching selection.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 uppercase tracking-wider">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        log.channel === 'whatsapp' ? 'bg-emerald-100 text-emerald-800' :
                        log.channel === 'sms' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {log.channel}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">{log.recipientContact}</td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={log.messageBody}>
                      {log.messageBody}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(log.queuedTime).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge type="notification" status={log.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {log.status === 'failed' && db.hasPermission('notifications.retry') && (
                        <button
                          onClick={() => handleRetryNotification(log.id)}
                          className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] shadow-2xs"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {logs.length} of {total} notifications</span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-medium"
            >
              Previous
            </button>
            <span className="px-2 font-semibold text-slate-700">Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
