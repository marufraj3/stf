import React from 'react';
export const LoadingSpinner: React.FC<{size?:number; label?:string}> = ({size=20,label}) => (
  <span className="inline-flex items-center gap-2">
    <span className="inline-block animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" style={{width:size,height:size}} />
    {label && <span className="text-xs text-slate-600">{label}</span>}
  </span>
);
export const LoadingOverlay: React.FC<{show:boolean; label?:string}> = ({show,label}) => show ? (
  <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl px-6 py-4 shadow-lg flex items-center gap-3">
      <span className="inline-block animate-spin rounded-full border-2 border-slate-300 border-t-amber-500 w-6 h-6" />
      <span className="text-sm font-semibold">{label || 'Processing...'}</span>
    </div>
  </div>
):null;
