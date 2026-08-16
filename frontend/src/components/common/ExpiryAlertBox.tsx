import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DocumentTypeAlert } from '../../services/db';

interface ExpiryAlertBoxProps {
  alerts?: Record<string, DocumentTypeAlert>;
  isLoading?: boolean;
  /** Called with a document type code + expiry status when an alert is clicked. */
  onSelect?: (code: string, status: 'expired' | 'warning') => void;
}

/** Order the tracked documents so the box always reads the same way. */
const TRACKED_ORDER = ['qid', 'passport', 'istimara'];

type AlertLine = {
  key: string;
  code: string;
  tone: 'expired' | 'warning';
  label: string;
  count: number;
};

function buildLines(alerts: Record<string, DocumentTypeAlert>): AlertLine[] {
  const lines: AlertLine[] = [];

  TRACKED_ORDER.forEach(code => {
    const alert = alerts[code];
    if (!alert) return;

    // Red first: expired documents are the most urgent.
    if (alert.expiredCount > 0) {
      lines.push({
        key: `${code}-expired`,
        code,
        tone: 'expired',
        label: `${alert.name} Expired`,
        count: alert.expiredCount,
      });
    }
    if (alert.expiringCount > 0) {
      const label = code === 'qid'
        ? `${alert.name} Expiring Soon (${alert.leadDays} Days Left)`
        : `${alert.name} Expiring Within ${alert.leadDays} Days`;
      lines.push({
        key: `${code}-warning`,
        code,
        tone: 'warning',
        label,
        count: alert.expiringCount,
      });
    }
  });

  return lines;
}

export const ExpiryAlertBox: React.FC<ExpiryAlertBoxProps> = ({
  alerts,
  isLoading = false,
  onSelect,
}) => {
  const lines = buildLines(alerts || {});

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <div>
          <h2 className="text-sm font-bold text-slate-900">Document Expiry Notifications</h2>
          <p className="text-[11px] text-slate-500">
            QID alerts 15 days ahead, Passport 90 days, Istimara 30 days.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <p className="text-xs text-slate-400">Checking document expiries…</p>
        ) : lines.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-800">All documents are valid</p>
              <p className="text-[11px] text-emerald-700">
                No QID, Passport or Istimara is expired or nearing expiry.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {lines.map(line => {
              const isExpired = line.tone === 'expired';
              const classes = isExpired
                ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800'
                : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900';

              return (
                <button
                  key={line.key}
                  type="button"
                  onClick={() => onSelect?.(line.code, line.tone)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${classes}`}
                >
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <span aria-hidden="true">{isExpired ? '🔴' : '🟡'}</span>
                    <span>{line.label}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                      isExpired ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {line.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
