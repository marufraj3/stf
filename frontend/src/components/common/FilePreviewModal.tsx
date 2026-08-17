import React from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileText, Printer } from 'lucide-react';
import { downloadSecureFile, useSecureFileUrl } from './SecureFile';
import { LoadingSpinner } from './LoadingSpinner';

interface FilePreviewModalProps {
  isOpen: boolean;
  /** Stored file reference such as "/files/12" or a data URL. */
  source?: string | null;
  title: string;
  subtitle?: string;
  fileName?: string;
  mimeType?: string;
  onClose: () => void;
}

function looksLikePdf(source?: string | null, mimeType?: string, fileName?: string): boolean {
  if (mimeType) return mimeType === 'application/pdf';
  if (fileName?.toLowerCase().endsWith('.pdf')) return true;
  return Boolean(source?.startsWith('data:application/pdf'));
}

/**
 * Secure, reusable attachment viewer.
 *
 * Stored files live behind the authenticated `/api/files/{id}` endpoint, so a
 * plain <a href="/files/12"> just bounces the browser back to the login page.
 * This modal always streams the file through the API client (Bearer token
 * attached) and renders the resulting blob inline.
 */
export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  source,
  title,
  subtitle,
  fileName,
  mimeType,
  onClose,
}) => {
  const file = useSecureFileUrl(isOpen ? source : null);
  if (!isOpen) return null;

  const isPdf = looksLikePdf(source, mimeType, fileName);

  const printAttachment = () => {
    if (!file.url) return;
    const printWindow = window.open(file.url, '_blank');
    printWindow?.addEventListener('load', () => printWindow.print());
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">{title}</h3>
            <p className="truncate text-xs text-slate-500">{subtitle || fileName || 'Secure attachment'}</p>
          </div>
          <button onClick={onClose} aria-label="Close preview" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-[320px] flex-col items-center justify-center bg-slate-100 p-5">
          {file.loading ? (
            <LoadingSpinner size={26} label="Loading secure attachment…" />
          ) : file.error ? (
            <p className="text-xs font-semibold text-rose-600">{file.error}</p>
          ) : !file.url ? (
            <div className="space-y-2 text-center text-slate-400">
              <FileText className="mx-auto h-12 w-12 stroke-1" />
              <p className="text-xs font-semibold">No file attached to this record.</p>
            </div>
          ) : isPdf ? (
            <iframe src={file.url} title={title} className="h-[460px] w-full rounded-xl border border-slate-200 bg-white" />
          ) : (
            <img src={file.url} alt={title} className="max-h-[460px] rounded-xl border border-slate-200 object-contain shadow-md" />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-white p-4 text-xs">
          <button onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100">
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={printAttachment}
              disabled={!file.url}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={() => source && void downloadSecureFile(source, fileName || title)}
              disabled={!source}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
