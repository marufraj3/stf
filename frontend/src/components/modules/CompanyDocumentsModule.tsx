import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building, Plus, Edit, Trash2, Paperclip, X, RotateCcw, Search,
} from 'lucide-react';
import { db } from '../../services/db';
import { DocumentRecord } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { CompanyLogo } from '../common/CompanyLogo';
import { FilePreviewModal } from '../common/FilePreviewModal';
import { ButtonSpinner, LoadingSpinner } from '../common/LoadingSpinner';

interface CompanyDocumentsModuleProps {
  onOpenRenewModal: (doc: DocumentRecord) => void;
  onRefresh: () => void;
}

export const CompanyDocumentsModule: React.FC<CompanyDocumentsModuleProps> = ({
  onOpenRenewModal,
  onRefresh,
}) => {
  const companies = db.getCompanies();
  const documentTypes = db.getDocumentTypes().filter(type => type.ownerType === 'company');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<DocumentRecord> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);

  const canManage = db.hasPermission('company_documents.manage') || db.hasPermission('documents.create');
  const canDelete = db.hasPermission('company_documents.manage') || db.hasPermission('documents.archive');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const documentsQuery = useQuery({
    queryKey: ['company-documents', db.getSelectedCompanyId(), debouncedSearch, showArchived],
    queryFn: () => db.listDocuments({
      ownerType: 'company',
      search: debouncedSearch,
      includeArchived: showArchived,
      archivedOnly: showArchived,
      page: 1,
      pageSize: 100,
      sortBy: 'expiry_date',
      direction: 'asc',
    }),
    placeholderData: previous => previous,
  });
  const documents = documentsQuery.data?.items || [];

  const openCreate = (companyId: string) => {
    setEditing({
      ownerType: 'company',
      ownerId: companyId,
      companyId,
      documentTypeId: '',
      documentNumber: '',
      issueDate: '',
      expiryDate: '',
      issuingAuthority: '',
      reminderEnabled: true,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEdit = (doc: DocumentRecord) => {
    setEditing({ ...doc });
    setFormError('');
    setIsFormOpen(true);
  };

  const selectedType = documentTypes.find(type => type.id === editing?.documentTypeId);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editing) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setFormError('Only PDF, JPG and PNG files are allowed.');
      event.target.value = '';
      return;
    }
    const maxMb = db.getSettings().defaultFileMaxSizeMb;
    if (file.size > maxMb * 1024 * 1024) {
      setFormError(`The file must not exceed ${maxMb} MB.`);
      event.target.value = '';
      return;
    }
    setFormError('');
    const reader = new FileReader();
    reader.onload = () => setEditing(current => ({
      ...(current || {}),
      fileUrl: String(reader.result || ''),
      fileName: file.name,
    }));
    reader.readAsDataURL(file);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || isSaving) return;
    if (!editing.ownerId || !editing.documentTypeId) {
      setFormError('Choose the company and the licence type.');
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      await db.saveDocument({ ...editing, companyId: editing.ownerId });
      setIsFormOpen(false);
      setEditing(null);
      await documentsQuery.refetch();
      onRefresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the licence.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (doc: DocumentRecord) => {
    if (!window.confirm(`Delete ${doc.documentTypeName} (#${doc.documentNumber || 'N/A'})? It moves to the archive and can be restored.`)) return;
    setBusyId(doc.id);
    try {
      await db.archiveDocument(doc.id);
      await documentsQuery.refetch();
      onRefresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to delete the licence.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (doc: DocumentRecord) => {
    setBusyId(doc.id);
    try {
      await db.restoreDocument(doc.id);
      await documentsQuery.refetch();
      onRefresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to restore the licence.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
            <Building className="h-5 w-5 text-amber-500" /> Company Commercial Licenses Hub
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Add, edit, preview and delete Commercial Registration (CR), Computer Card, Trade License and Civil Defense approvals.
          </p>
        </div>
        {canManage && companies.length > 0 && (
          <button
            onClick={() => openCreate(db.getSelectedCompanyId() !== 'all' ? db.getSelectedCompanyId() : companies[0].id)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-xs transition-colors hover:bg-amber-600"
          >
            <Plus className="h-4 w-4" />
            <span>Add License</span>
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search licence number or issuing authority…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <select
            value={showArchived ? 'archived' : 'active'}
            onChange={event => setShowArchived(event.target.value === 'archived')}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
          >
            <option value="active">Active licenses</option>
            <option value="archived">Deleted / archived licenses</option>
          </select>
        </div>
        {documentsQuery.isFetching && (
          <div className="mt-3">
            <LoadingSpinner size={14} label="Refreshing licenses…" />
          </div>
        )}
      </div>

      <div className="space-y-6">
        {documentsQuery.isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-xs text-rose-700">
            {documentsQuery.error instanceof Error ? documentsQuery.error.message : 'Unable to load company licenses.'}
          </div>
        )}

        {companies.map(company => {
          const companyDocs = documents.filter(document => document.ownerId === company.id);

          return (
            <div key={company.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <CompanyLogo code={company.code} name={company.name} logoUrl={company.logoUrl} sizeClass="w-11 h-11" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{company.name}</h2>
                    <p className="font-mono text-xs text-slate-500">
                      CR #: {company.crNumber || 'N/A'} • Establishment Card: {company.computerCardNumber || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    {companyDocs.length} license{companyDocs.length === 1 ? '' : 's'}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => openCreate(company.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add License
                    </button>
                  )}
                </div>
              </div>

              {documentsQuery.isLoading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-32 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : companyDocs.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">
                  {showArchived ? 'No deleted licenses for this company.' : 'No company commercial licenses uploaded yet.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {companyDocs.map(doc => (
                    <div key={doc.id} className="flex flex-col justify-between space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">{doc.documentTypeName}</span>
                          {doc.archivedAt
                            ? <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700">Deleted</span>
                            : <StatusBadge type="expiry" status={doc.status} daysRemaining={doc.daysRemaining} />}
                        </div>
                        <div className="mt-2 font-mono text-xs font-bold text-slate-800">#{doc.documentNumber || 'N/A'}</div>
                        <div className="mt-1 text-[11px] text-slate-500">Issuing Authority: {doc.issuingAuthority || 'MOCI Qatar'}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-600">Issued: {doc.issueDate || 'N/A'}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-600">Expires: {doc.expiryDate || 'No Expiry'}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/60 pt-2">
                        {doc.fileUrl && (
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            title="Preview attachment"
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100"
                          >
                            <Paperclip className="h-3.5 w-3.5" /> Preview
                          </button>
                        )}
                        {!doc.archivedAt && canManage && (
                          <button
                            onClick={() => openEdit(doc)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
                          >
                            <Edit className="h-3.5 w-3.5" /> Edit
                          </button>
                        )}
                        {!doc.archivedAt && (db.hasPermission('documents.renew') || db.hasPermission('company_documents.manage')) && (
                          <button
                            onClick={() => onOpenRenewModal(doc)}
                            className="rounded-lg bg-slate-900 px-3 py-1 text-[11px] font-bold text-white hover:bg-slate-800"
                          >
                            Renew
                          </button>
                        )}
                        {!doc.archivedAt && canDelete && (
                          <button
                            onClick={() => handleDelete(doc)}
                            disabled={busyId === doc.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                          >
                            {busyId === doc.id ? <ButtonSpinner /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                          </button>
                        )}
                        {doc.archivedAt && db.hasPermission('documents.restore') && (
                          <button
                            onClick={() => handleRestore(doc)}
                            disabled={busyId === doc.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            {busyId === doc.id ? <ButtonSpinner /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / edit licence */}
      {isFormOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSave}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-900">{editing.id ? 'Edit Company License' : 'Add Company License'}</h3>
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5 text-xs">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-semibold text-rose-700">{formError}</div>
              )}

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">Company *</span>
                <select
                  required
                  value={editing.ownerId || ''}
                  onChange={event => setEditing({ ...editing, ownerId: event.target.value, companyId: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <option value="">-- Select company --</option>
                  {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">License type *</span>
                <select
                  required
                  value={editing.documentTypeId || ''}
                  onChange={event => setEditing({ ...editing, documentTypeId: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <option value="">-- Select license type --</option>
                  {documentTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">
                  License number {selectedType?.docNumberRequired ? '*' : ''}
                </span>
                <input
                  required={Boolean(selectedType?.docNumberRequired)}
                  value={editing.documentNumber || ''}
                  onChange={event => setEditing({ ...editing, documentNumber: event.target.value })}
                  placeholder="CR-10928"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-700">
                    Issue date {selectedType?.issueDateRequired ? '*' : ''}
                  </span>
                  <input
                    type="date"
                    required={Boolean(selectedType?.issueDateRequired)}
                    value={editing.issueDate || ''}
                    onChange={event => setEditing({ ...editing, issueDate: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-700">
                    Expiry date {selectedType?.expiryDateRequired ? '*' : ''}
                  </span>
                  <input
                    type="date"
                    required={Boolean(selectedType?.expiryDateRequired)}
                    value={editing.expiryDate || ''}
                    onChange={event => setEditing({ ...editing, expiryDate: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">Issuing authority</span>
                <input
                  value={editing.issuingAuthority || ''}
                  onChange={event => setEditing({ ...editing, issuingAuthority: event.target.value })}
                  placeholder="MOCI Qatar"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">License file (PDF / JPG / PNG)</span>
                {editing.id && editing.fileUrl?.startsWith('/files/') && (
                  <p className="mb-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                    ✓ A file is already attached. Choosing a new one replaces it.
                  </p>
                )}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={handleFile}
                  className="w-full rounded-xl border border-slate-300 p-1 text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                />
                {editing.fileName && <p className="mt-1 text-[11px] text-emerald-600">Selected: {editing.fileName}</p>}
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-xs hover:bg-amber-600 disabled:opacity-60"
              >
                {isSaving && <ButtonSpinner />}
                <span>{isSaving ? 'Saving…' : editing.id ? 'Save Changes' : 'Add License'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <FilePreviewModal
        isOpen={Boolean(previewDoc?.fileUrl)}
        source={previewDoc?.fileUrl}
        title={`${previewDoc?.documentTypeName || 'License'} — ${previewDoc?.ownerName || ''}`}
        subtitle={previewDoc?.documentNumber ? `License #${previewDoc.documentNumber}` : undefined}
        fileName={previewDoc?.fileName}
        mimeType={previewDoc?.fileMimeType}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
};
