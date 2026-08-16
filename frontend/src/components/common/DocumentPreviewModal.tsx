import React from 'react';
import { X, FileText, ExternalLink, Download, Calendar, ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';
import { DocumentRecord } from '../../types';
import { StatusBadge } from './StatusBadge';
import { downloadSecureFile, useSecureFileUrl } from './SecureFile';

interface DocumentPreviewModalProps {
  document: DocumentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenRenewModal?: (doc: DocumentRecord) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document: doc,
  isOpen,
  onClose,
  onOpenRenewModal,
}) => {
  const secureFile = useSecureFileUrl(doc?.fileUrl);
  if (!isOpen || !doc) return null;

  const isImage = doc.fileMimeType?.startsWith('image/') || (doc.fileUrl && (
    doc.fileUrl.startsWith('data:image/') ||
    doc.fileUrl.match(/\.(jpg|jpeg|png|webp|gif)($|\?)/i) ||
    doc.fileUrl.includes('unsplash.com')
  ));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{doc.documentTypeName}</h3>
              <p className="text-xs text-slate-400 font-mono">
                Doc #: {doc.documentNumber} • Owner: {doc.ownerName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status & Expiry Metadata Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block font-semibold">Expiry Status:</span>
              <div className="mt-1">
                <StatusBadge type="expiry" status={doc.status} daysRemaining={doc.daysRemaining} />
              </div>
            </div>

            <div>
              <span className="text-slate-400 block font-semibold">Expiry Date:</span>
              <span className="font-bold text-slate-900 mt-1 block font-mono">
                {doc.expiryDate || 'No Expiry Date'}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="text-slate-400 block font-semibold">Days Remaining:</span>
              <span className={`font-black text-sm mt-0.5 block ${
                doc.daysRemaining !== undefined && doc.daysRemaining < 0 ? 'text-red-600' :
                doc.daysRemaining !== undefined && doc.daysRemaining <= 30 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {doc.daysRemaining !== undefined
                  ? doc.daysRemaining < 0
                    ? `Expired (${Math.abs(doc.daysRemaining)} days ago)`
                    : `${doc.daysRemaining} days left`
                  : 'N/A'
                }
              </span>
            </div>
          </div>

          {/* Document File Viewer Box */}
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-slate-100 flex flex-col items-center justify-center min-h-[260px] relative overflow-hidden">
            {secureFile.loading ? (
              <div className="text-center text-xs font-semibold text-slate-500">Loading secure attachment…</div>
            ) : secureFile.error ? (
              <div className="text-center text-xs font-semibold text-rose-600">{secureFile.error}</div>
            ) : secureFile.url ? (
              isImage ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <img
                    src={secureFile.url}
                    alt={doc.documentTypeName}
                    className="max-h-[350px] w-auto object-contain rounded-xl shadow-md border border-slate-200"
                  />
                  <button
                    onClick={() => void downloadSecureFile(doc.fileUrl!, doc.fileName)}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Download Full Image</span>
                  </button>
                </div>
              ) : (
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto shadow-sm">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{doc.fileName || `${doc.documentTypeName}_Document.pdf`}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">PDF / Scanned Document Attachment</p>
                  </div>
                  <button
                    onClick={() => void downloadSecureFile(doc.fileUrl!, doc.fileName)}
                    className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View / Download Document</span>
                  </button>
                </div>
              )
            ) : (
              <div className="text-center p-6 space-y-2 text-slate-400">
                <FileText className="w-12 h-12 mx-auto stroke-1" />
                <p className="text-xs font-semibold">No direct file scan attached to this document record.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors"
          >
            Close
          </button>

          {onOpenRenewModal && (
            <button
              onClick={() => {
                onClose();
                onOpenRenewModal(doc);
              }}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Renew Document Now</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
