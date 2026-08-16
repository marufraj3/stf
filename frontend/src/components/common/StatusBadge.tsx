import React from 'react';
import { ExpiryStatus, EmployeeStatus, VehicleStatus, NotificationStatus } from '../../types';

interface StatusBadgeProps {
  type: 'expiry' | 'employee' | 'vehicle' | 'notification';
  status: string;
  daysRemaining?: number;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, status, daysRemaining }) => {
  if (type === 'expiry') {
    const s = status as ExpiryStatus;
    if (s === 'valid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Valid {daysRemaining !== undefined && `(${daysRemaining}d)`}
        </span>
      );
    }
    if (s === 'warning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Expiring Soon {daysRemaining !== undefined && `(${daysRemaining}d)`}
        </span>
      );
    }
    if (s === 'critical') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
          Urgent {daysRemaining !== undefined && `(${daysRemaining}d)`}
        </span>
      );
    }
    if (s === 'expires_today') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          Expires Today
        </span>
      );
    }
    if (s === 'expired') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
          Expired {daysRemaining !== undefined && `(${Math.abs(daysRemaining)}d ago)`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        No Expiry Date
      </span>
    );
  }

  if (type === 'employee') {
    const es = status as EmployeeStatus;
    const styles: Record<EmployeeStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
      active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Active' },
      on_leave: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500', label: 'On Leave' },
      suspended: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Suspended' },
      cancelled: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', label: 'Cancelled' },
      resigned: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', label: 'Resigned' },
      terminated: { bg: 'bg-zinc-100', text: 'text-zinc-800', border: 'border-zinc-300', dot: 'bg-zinc-600', label: 'Terminated' },
      archived: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400', label: 'Archived' },
    };
    const style = styles[es] || styles.active;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} border ${style.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
        {style.label}
      </span>
    );
  }

  if (type === 'vehicle') {
    const vs = status as VehicleStatus;
    const styles: Record<VehicleStatus, { bg: string; label: string }> = {
      active: { bg: 'bg-emerald-100 text-emerald-800', label: 'Active Fleet' },
      under_maintenance: { bg: 'bg-amber-100 text-amber-800', label: 'In Service' },
      inactive: { bg: 'bg-slate-100 text-slate-700', label: 'Inactive' },
      sold: { bg: 'bg-purple-100 text-purple-800', label: 'Sold' },
      cancelled: { bg: 'bg-rose-100 text-rose-800', label: 'Cancelled' },
      archived: { bg: 'bg-zinc-100 text-zinc-700', label: 'Archived' },
    };
    const style = styles[vs] || styles.active;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${style.bg}`}>
        {style.label}
      </span>
    );
  }

  if (type === 'notification') {
    const ns = status as NotificationStatus;
    const styles: Record<NotificationStatus, { bg: string; label: string }> = {
      queued: { bg: 'bg-sky-100 text-sky-800', label: 'Queued' },
      processing: { bg: 'bg-indigo-100 text-indigo-800', label: 'Sending...' },
      sent: { bg: 'bg-blue-100 text-blue-800', label: 'Sent' },
      delivered: { bg: 'bg-emerald-100 text-emerald-800', label: 'Delivered' },
      failed: { bg: 'bg-rose-100 text-rose-800', label: 'Failed' },
      rejected: { bg: 'bg-orange-100 text-orange-800', label: 'Rejected' },
      cancelled: { bg: 'bg-zinc-100 text-zinc-700', label: 'Cancelled' },
    };
    const style = styles[ns] || styles.queued;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${style.bg}`}>
        {style.label}
      </span>
    );
  }

  return <span className="text-xs">{status}</span>;
};
