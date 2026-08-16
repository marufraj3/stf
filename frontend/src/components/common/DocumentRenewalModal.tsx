import React, { useEffect, useState } from 'react';
import { RefreshCw, X, ShieldCheck } from 'lucide-react';
import { db } from '../../services/db';
import { DocumentRecord } from '../../types';

interface DocumentRenewalModalProps {
  document: DocumentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onRenewSuccess: () => void;
}

export const DocumentRenewalModal: React.FC<DocumentRenewalModalProps> = ({
  document,
  isOpen,
  onClose,
  onRenewSuccess
}) => {
  const todayInQatar = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Qatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Pre-fill default next expiry date (+1 year by default)
  const calculateDefaultNewExpiry = (record: DocumentRecord | null) => {
    if (!record?.expiryDate) {
      const nextYear = new Date(`${todayInQatar()}T00:00:00Z`);
      nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
      return nextYear.toISOString().slice(0, 10);
    }
    const parts = record.expiryDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10) + 1;
      return `${year}-${parts[1]}-${parts[2]}`;
    }
    return todayInQatar();
  };

  const [newDocNumber, setNewDocNumber] = useState('');
  const [newIssueDate, setNewIssueDate] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [changeReason, setChangeReason] = useState('Annual Government License Renewal');
  const [notes, setNotes] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !document) return;
    setNewDocNumber(document.documentNumber);
    setNewIssueDate(todayInQatar());
    setNewExpiryDate(calculateDefaultNewExpiry(document));
    setChangeReason('Annual Government License Renewal');
    setNotes('');
    setNewFileUrl('');
    setNewFileName('');
  }, [document?.id, isOpen]);

  if (!isOpen || !document) return null;

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      alert('Only PDF, JPG, and PNG files are allowed.');
      event.target.value = '';
      return;
    }
    if (file.size > db.getSettings().defaultFileMaxSizeMb * 1024 * 1024) {
      alert(`File must not exceed ${db.getSettings().defaultFileMaxSizeMb} MB.`);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setNewFileUrl(String(reader.result || ''));
      setNewFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await db.renewDocument(document.id, {
        newDocNumber,
        newIssueDate,
        newExpiryDate,
        newFileUrl: newFileUrl || undefined,
        newFileName: newFileName || undefined,
        changeReason,
        notes,
      });
      onRenewSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to process document renewal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Process Document Renewal</h3>
              <p className="text-xs text-amber-300 font-mono">{document.documentTypeName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Current Locked State Summary */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Locked Record</div>
            <div className="font-bold text-slate-900 text-xs">{document.ownerName}</div>
            <div className="flex items-center justify-between text-slate-600 font-mono text-[11px]">
              <span>Doc #: <b>{document.documentNumber}</b></span>
              <span>Exp: <b>{document.expiryDate || 'N/A'}</b></span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 flex items-start gap-2 text-amber-900 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <b>Atomic History Preservation:</b> Current document parameters will be archived into renewal history. Pending old notifications will be recalculated according to Qatar Asia/Qatar timezone.
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">New Document Number *</label>
            <input
              type="text"
              required
              value={newDocNumber}
              onChange={(e) => setNewDocNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">New Issue Date *</label>
              <input
                type="date"
                required
                value={newIssueDate}
                onChange={(e) => setNewIssueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">New Expiry Date *</label>
              <input
                type="date"
                required
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Renewal Reason / Category</label>
            <select
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500"
            >
              <option value="Annual Government License Renewal">Annual Government License Renewal</option>
              <option value="Metrash2 Residency Extension">Metrash2 Residency Extension</option>
              <option value="Traffic Department Estimara Renewal">Traffic Department Estimara Renewal</option>
              <option value="Commercial Registration (CR) Extension">Commercial Registration (CR) Extension</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Renewal Notes / Reference Number</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Replacement File (PDF/JPG/PNG)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleFile}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
            />
            {newFileName && <p className="mt-1 text-[11px] text-emerald-600">Selected: {newFileName}</p>}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-700 font-semibold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-md active:scale-95 transition-all"
            >
              {isSubmitting ? 'Processing...' : 'Confirm Renewal & Save History'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
