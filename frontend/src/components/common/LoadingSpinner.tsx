import React from 'react';
import { Loader2 } from 'lucide-react';

/** Small inline spinner used inside buttons, cells and toolbars. */
export const LoadingSpinner: React.FC<{ size?: number; label?: string; className?: string }> = ({
  size = 20,
  label,
  className = '',
}) => (
  <span className={`inline-flex items-center gap-2 ${className}`}>
    <span
      className="inline-block animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
      style={{ width: size, height: size }}
    />
    {label && <span className="text-xs text-slate-600">{label}</span>}
  </span>
);

/** Spinner tuned for coloured buttons (inherits the text colour). */
export const ButtonSpinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Loader2 className={`w-3.5 h-3.5 animate-spin ${className}`} />
);

/** Full screen blocking overlay. */
export const LoadingOverlay: React.FC<{ show: boolean; label?: string }> = ({ show, label }) =>
  show ? (
    <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-[2px] flex items-center justify-center">
      <div className="bg-white rounded-2xl px-6 py-4 shadow-2xl border border-slate-200 flex items-center gap-3">
        <span className="inline-block animate-spin rounded-full border-2 border-slate-200 border-t-amber-500 w-6 h-6" />
        <span className="text-sm font-semibold text-slate-800">{label || 'Processing…'}</span>
      </div>
    </div>
  ) : null;

/** Grey shimmer rows shown while a table is loading its first page. */
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 6, columns = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <tr key={rowIndex} className="border-t border-slate-100">
        {Array.from({ length: columns }).map((__, columnIndex) => (
          <td key={columnIndex} className="px-4 py-3.5">
            <div className="h-3.5 rounded-full bg-slate-200/80 animate-pulse" style={{ width: `${55 + ((rowIndex + columnIndex) % 4) * 10}%` }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

/** Card placeholders used by grid based screens such as the vehicle fleet. */
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="h-4 w-1/2 rounded-full bg-slate-200 animate-pulse" />
        <div className="h-3 w-1/3 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-8 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    ))}
  </>
);

/** Centered spinner used as the Suspense fallback for lazily loaded modules. */
export const ModuleFallback: React.FC<{ label?: string }> = ({ label = 'Loading module…' }) => (
  <div className="flex items-center justify-center py-24">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-2xs">
      <span className="inline-block animate-spin rounded-full border-2 border-slate-200 border-t-amber-500 w-5 h-5" />
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </div>
  </div>
);
