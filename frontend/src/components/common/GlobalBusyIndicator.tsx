import React from 'react';
import { useBusyState } from '../../services/busy';

/**
 * Application wide activity feedback.
 *
 * - A thin amber progress bar at the very top whenever *any* request runs.
 * - A blocking, spinner-backed overlay while a write request is in flight so
 *   the admin gets immediate feedback and cannot double submit.
 */
export const GlobalBusyIndicator: React.FC = () => {
  const busy = useBusyState();
  const showBar = busy.requests > 0;
  const showOverlay = busy.mutations > 0;

  return (
    <>
      {showBar && (
        <div className="fixed inset-x-0 top-0 z-[120] h-0.5 overflow-hidden bg-amber-100">
          <div className="h-full w-1/3 animate-[stf-progress_1.1s_ease-in-out_infinite] rounded-full bg-amber-500" />
        </div>
      )}

      {showOverlay && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/25 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-2xl">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" />
            <span className="text-sm font-bold text-slate-800">{busy.label}</span>
          </div>
        </div>
      )}
    </>
  );
};
