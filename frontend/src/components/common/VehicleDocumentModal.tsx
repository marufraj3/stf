import React, { useEffect, useState } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import { db } from '../../services/db';
import { DocumentRecord, Vehicle } from '../../types';

interface VehicleDocumentModalProps {
  isOpen: boolean;
  vehicle: Vehicle | null;
  /** Document type code to create or update, e.g. "istimara". */
  documentTypeCode: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Adds or updates a single vehicle document (Istimara by default) straight
 * from the fleet card, so users no longer have to open the generic Dynamic
 * Documents screen and re-pick the owner.
 */
export const VehicleDocumentModal: React.FC<VehicleDocumentModalProps> = ({
  isOpen,
  vehicle,
  documentTypeCode,
  onClose,
  onSaved,
}) => {
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [existing, setExisting] = useState<DocumentRecord | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const documentType = db.getDocumentTypes().find(type => type.code === documentTypeCode);

  useEffect(() => {
    if (!isOpen || !vehicle) return;
    setError('');
    setIsSaving(false);
    setFileUrl('');
    setFileName('');

    const current = (vehicle.documents || []).find(
      document => document.documentTypeCode === documentTypeCode,
    );
    setExisting(current || null);
    setDocumentNumber(current?.documentNumber || '');
    setExpiryDate(current?.expiryDate || '');
  }, [isOpen, vehicle, documentTypeCode]);

  if (!isOpen || !vehicle) return null;

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setError('Only PDF, JPG and PNG files are allowed.');
      event.target.value = '';
      return;
    }
    const maxMb = db.getSettings().defaultFileMaxSizeMb;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File must not exceed ${maxMb} MB.`);
      event.target.value = '';
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setFileUrl(String(reader.result || ''));
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    if (!documentType) {
      setError(`Document type "${documentTypeCode}" is not configured.`);
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await db.saveDocument({
        ...(existing || {}),
        companyId: vehicle.companyId,
        ownerType: 'vehicle',
        ownerId: vehicle.id,
        documentTypeId: documentType.id,
        documentNumber,
        expiryDate,
        ...(fileUrl ? { fileUrl, fileName } : {}),
        reminderEnabled: true,
      });
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the document.');
    } finally {
      setIsSaving(false);
    }
  };

  const title = documentType?.name || 'Vehicle Document';
  const vehicleLabel = vehicle.vehicleName
    || `${vehicle.make} ${vehicle.model}`.trim()
    || vehicle.vehicleNumber;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {existing ? `Update ${title}` : `Add ${title}`}
              </h3>
              <p className="text-[11px] text-slate-500">
                {vehicleLabel} • {vehicle.plateNumber}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3 text-xs">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 font-semibold">
              {error}
            </div>
          )}

          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">
              {title} Number {documentType?.docNumberRequired && '*'}
            </span>
            <input
              required={documentType?.docNumberRequired}
              value={documentNumber}
              onChange={event => setDocumentNumber(event.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
            />
          </label>

          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">
              Expiry Date {documentType?.expiryDateRequired && '*'}
            </span>
            <input
              type="date"
              required={documentType?.expiryDateRequired}
              value={expiryDate}
              onChange={event => setExpiryDate(event.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
            />
            {documentType && (
              <span className="mt-1 block text-[11px] text-slate-400">
                A warning is raised {documentType.alertLeadDays} days before expiry.
              </span>
            )}
          </label>

          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">{title} PDF / Scan</span>
            {existing?.fileUrl && !fileUrl && (
              <p className="mb-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                ✓ A file is already attached. Choosing a new one replaces it.
              </p>
            )}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleFile}
              className="w-full border border-slate-300 rounded-xl p-1 text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
            />
            {fileName && <p className="mt-1 text-[11px] text-emerald-600">Selected: {fileName}</p>}
          </label>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 font-semibold hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {existing ? 'Update' : 'Save'} {title}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
