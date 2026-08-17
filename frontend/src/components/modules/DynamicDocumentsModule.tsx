import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, Search, Plus, Filter, RefreshCw, Eye, Download, 
  X, Check, AlertTriangle, FileCheck, ExternalLink, Paperclip, Edit, Archive, RotateCcw
} from 'lucide-react';
import { db } from '../../services/db';
import { DocumentRecord, ExpiryStatus, OwnerType } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { downloadSecureFile, useSecureFileUrl } from '../common/SecureFile';
import { ButtonSpinner, TableSkeleton } from '../common/LoadingSpinner';

interface DynamicDocumentsModuleProps {
  initialStatusFilter?: string;
  onOpenRenewModal: (doc: DocumentRecord) => void;
  onRefresh: () => void;
}

export const DynamicDocumentsModule: React.FC<DynamicDocumentsModuleProps> = ({ 
  initialStatusFilter = 'all', 
  onOpenRenewModal, 
  onRefresh 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<string>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  // File Preview Modal
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const previewFile = useSecureFileUrl(previewDoc?.fileUrl);

  // Add Document Modal
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [debouncedOwnerSearch, setDebouncedOwnerSearch] = useState('');
  const [newDocData, setNewDocData] = useState<Partial<DocumentRecord>>({
    ownerType: 'employee',
    documentTypeId: '',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    issuingAuthority: '',
    reminderEnabled: true,
  });

  const docTypes = db.getDocumentTypes();
  const companies = db.getCompanies();
  const [isSaving, setIsSaving] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedOwnerSearch(ownerSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [ownerSearch]);

  const employeeLookup = useQuery({
    queryKey: ['document-owner-employees', db.getSelectedCompanyId(), debouncedOwnerSearch],
    queryFn: () => db.listEmployees({
      search: debouncedOwnerSearch,
      status: 'active',
      page: 1,
      pageSize: 50,
      sortBy: 'full_name',
      direction: 'asc',
    }),
    enabled: isAddOpen && newDocData.ownerType === 'employee',
  });
  const vehicleLookup = useQuery({
    queryKey: ['document-owner-vehicles', db.getSelectedCompanyId(), debouncedOwnerSearch],
    queryFn: () => db.listVehicles({
      search: debouncedOwnerSearch,
      status: 'active',
      page: 1,
      pageSize: 50,
      sortBy: 'vehicle_number',
      direction: 'asc',
    }),
    enabled: isAddOpen && newDocData.ownerType === 'vehicle',
  });
  const employees = employeeLookup.data?.items || [];
  const vehicles = vehicleLookup.data?.items || [];

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
    setPage(1);
  }, [initialStatusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const documentQuery = useQuery({
    queryKey: [
      'documents',
      db.getSelectedCompanyId(),
      debouncedSearch,
      ownerTypeFilter,
      docTypeFilter,
      statusFilter,
      page,
      pageSize,
    ],
    queryFn: () => db.listDocuments({
      ownerType: ownerTypeFilter === 'all' ? undefined : (ownerTypeFilter as OwnerType),
      documentTypeId: docTypeFilter,
      status: statusFilter === 'archived' ? undefined : statusFilter,
      includeArchived: statusFilter === 'archived',
      archivedOnly: statusFilter === 'archived',
      search: debouncedSearch,
      page,
      pageSize,
      sortBy: 'expiry_date',
      direction: 'asc',
    }),
    placeholderData: previous => previous,
  });

  const documents = documentQuery.data?.items || [];
  const total = documentQuery.data?.total || 0;
  const totalPages = documentQuery.data?.totalPages || 1;
  const selectedDocumentType = docTypes.find(type => type.id === newDocData.documentTypeId);

  const openNewDocument = () => {
    setOwnerSearch('');
    setNewDocData({
      ownerType: 'employee',
      ownerId: '',
      documentTypeId: '',
      documentNumber: '',
      issueDate: '',
      expiryDate: '',
      issuingAuthority: '',
      reminderEnabled: true,
    });
    setIsAddOpen(true);
  };

  const handleSaveNewDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocData.ownerId || !newDocData.documentTypeId) return;
    if (selectedDocumentType?.docNumberRequired && !newDocData.documentNumber) {
      alert('Document number is required for this document type.');
      return;
    }
    const companyId = newDocData.ownerType === 'company'
      ? newDocData.ownerId
      : newDocData.ownerType === 'vehicle'
        ? vehicles.find(item => item.id === newDocData.ownerId)?.companyId || newDocData.companyId
        : employees.find(item => item.id === newDocData.ownerId)?.companyId || newDocData.companyId;
    if (!companyId) {
      alert('Unable to resolve the owner company.');
      return;
    }
    if (isSaving) return;
    setIsSaving(true);
    try {
      await db.saveDocument({ ...newDocData, companyId });
      setIsAddOpen(false);
      await documentQuery.refetch();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save document.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (document: DocumentRecord) => {
    if (!window.confirm(`Archive ${document.documentTypeName} for ${document.ownerName}?`)) return;
    setBusyDocId(document.id);
    try {
      await db.archiveDocument(document.id);
      await documentQuery.refetch();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to archive document.');
    } finally {
      setBusyDocId(null);
    }
  };

  const handleRestore = async (document: DocumentRecord) => {
    setBusyDocId(document.id);
    try {
      await db.restoreDocument(document.id);
      await documentQuery.refetch();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to restore document.');
    } finally {
      setBusyDocId(null);
    }
  };

  const handleDocumentFile = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    reader.onload = () => setNewDocData({
      ...newDocData,
      fileUrl: String(reader.result || ''),
      fileName: file.name,
    });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dynamic Document Repository</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Polymorphic document management for staff QIDs, passports, vehicle estimaras, and commercial trade licenses.
          </p>
        </div>

        {db.hasPermission('documents.create') && (
          <button
            onClick={openNewDocument}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Upload New Document</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search document number, owner name..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Owner Type Filter */}
          <select
            value={ownerTypeFilter}
            onChange={(e) => { setOwnerTypeFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Owner Types (Employee, Vehicle, Company)</option>
            <option value="employee">Staff Documents</option>
            <option value="vehicle">Vehicle Fleet Documents</option>
            <option value="company">Company Commercial Licenses</option>
          </select>

          {/* Document Type Filter */}
          <select
            value={docTypeFilter}
            onChange={(e) => { setDocTypeFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Document Types ({docTypes.length})</option>
            {docTypes.map(dt => (
              <option key={dt.id} value={dt.id}>{dt.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="expired">Expired (Red)</option>
            <option value="expires_today">Expires Today (Blue)</option>
            <option value="critical">Urgent (1-10 Days)</option>
            <option value="warning">Warning (11-30 Days)</option>
            <option value="valid">Valid (31+ Days)</option>
            <option value="no_expiry">No Expiry Date</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Document Type</th>
                <th className="py-3 px-4">Document Number</th>
                <th className="py-3 px-4">Owner Name</th>
                <th className="py-3 px-4">Issuing Authority</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documentQuery.isLoading ? (
                <TableSkeleton rows={8} columns={7} />
              ) : documentQuery.isError ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-rose-600">
                    {documentQuery.error instanceof Error ? documentQuery.error.message : 'Unable to load documents.'}
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No documents match the current filter selection.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{doc.documentTypeName}</div>
                      <span className="text-[10px] font-mono text-slate-400 capitalize">{doc.ownerType} doc</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{doc.documentNumber}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{doc.ownerName}</td>
                    <td className="py-3 px-4 text-slate-600">{doc.issuingAuthority || 'Qatar Authority'}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">{doc.expiryDate || 'No Expiry'}</td>
                    <td className="py-3 px-4">
                      {doc.archivedAt
                        ? <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700">Archived</span>
                        : <StatusBadge type="expiry" status={doc.status} daysRemaining={doc.daysRemaining} />}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {doc.fileUrl && (
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            title="Preview File Attachment"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
                        )}
                        {!doc.archivedAt && db.hasPermission('documents.update') && (
                          <button
                            onClick={() => {
                              setNewDocData({ ...doc });
                              setOwnerSearch(doc.ownerName);
                              setIsAddOpen(true);
                            }}
                            title="Edit document"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {!doc.archivedAt && db.hasPermission('documents.renew') && (
                          <button
                            onClick={() => onOpenRenewModal(doc)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1 rounded-lg text-[11px] shadow-2xs transition-all active:scale-95"
                          >
                            Renew
                          </button>
                        )}
                        {!doc.archivedAt && db.hasPermission('documents.archive') && (
                          <button
                            onClick={() => handleArchive(doc)}
                            title="Archive document"
                            disabled={busyDocId === doc.id}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-60"
                          >
                            {busyDocId === doc.id ? <ButtonSpinner /> : <Archive className="w-4 h-4" />}
                          </button>
                        )}
                        {doc.archivedAt && db.hasPermission('documents.restore') && (
                          <button
                            onClick={() => handleRestore(doc)}
                            disabled={busyDocId === doc.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 disabled:opacity-60"
                          >
                            {busyDocId === doc.id ? <ButtonSpinner /> : <RotateCcw className="w-3.5 h-3.5" />} Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {documents.length} of {total} documents</span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-medium"
            >
              Previous
            </button>
            <span className="px-2 font-semibold text-slate-700">Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* File Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{previewDoc.documentTypeName} Attachment</h3>
                <p className="text-xs text-slate-500">{previewDoc.fileName || 'Uploaded_Document.pdf'}</p>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-100 flex flex-col items-center justify-center min-h-[300px]">
              {previewFile.loading ? (
                <div className="text-slate-500 text-xs">Loading secure attachment…</div>
              ) : previewFile.error ? (
                <div className="text-rose-600 text-xs">{previewFile.error}</div>
              ) : previewFile.url ? (
                previewDoc.fileMimeType === 'application/pdf' || previewDoc.fileUrl?.startsWith('data:application/pdf') ? (
                  <iframe
                    src={previewFile.url}
                    title={previewDoc.documentTypeName}
                    className="h-[430px] w-full rounded-xl border bg-white"
                  />
                ) : (
                  <img
                    src={previewFile.url}
                    alt={previewDoc.documentTypeName}
                    className="max-h-[400px] object-contain rounded-xl border shadow-md"
                  />
                )
              ) : (
                <div className="text-slate-400 text-xs">No preview available</div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500">Document #{previewDoc.documentNumber}</span>
              <button
                onClick={() => previewDoc.fileUrl && void downloadSecureFile(previewDoc.fileUrl, previewDoc.fileName)}
                disabled={!previewDoc.fileUrl}
                className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Attachment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload New Document Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">{newDocData.id ? 'Edit Document' : 'Upload New Document'}</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewDoc} className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Owner Type *</label>
                <select
                  value={newDocData.ownerType || 'employee'}
                  onChange={(e) => {
                    setOwnerSearch('');
                    setNewDocData({
                      ...newDocData,
                      ownerType: e.target.value as OwnerType,
                      ownerId: '',
                      companyId: '',
                      documentTypeId: '',
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                >
                  <option value="employee">Staff Employee</option>
                  <option value="vehicle">Vehicle Fleet</option>
                  <option value="company">Company License</option>
                </select>
              </div>

              <div>
                {newDocData.ownerType !== 'company' && (
                  <input
                    type="search"
                    value={ownerSearch}
                    onChange={event => setOwnerSearch(event.target.value)}
                    placeholder={newDocData.ownerType === 'employee'
                      ? 'Search employee name, code or mobile'
                      : 'Search vehicle number, plate or model'}
                    className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                  />
                )}
                <label className="font-semibold text-slate-700 block mb-1">Select Owner *</label>
                <select
                  required
                  value={newDocData.ownerId || ''}
                  onChange={(e) => {
                    const ownerId = e.target.value;
                    const companyId = newDocData.ownerType === 'company'
                      ? ownerId
                      : newDocData.ownerType === 'vehicle'
                        ? vehicles.find(vehicle => vehicle.id === ownerId)?.companyId || ''
                        : employees.find(employee => employee.id === ownerId)?.companyId || '';
                    setNewDocData({ ...newDocData, ownerId, companyId });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                >
                  <option value="">-- Choose Target Owner --</option>
                  {newDocData.ownerType === 'employee'
                    && newDocData.ownerId
                    && !employees.some(employee => employee.id === newDocData.ownerId) && (
                      <option value={newDocData.ownerId}>{newDocData.ownerName || 'Current employee'}</option>
                    )}
                  {newDocData.ownerType === 'employee' && employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeCode})</option>
                  ))}
                  {newDocData.ownerType === 'vehicle'
                    && newDocData.ownerId
                    && !vehicles.some(vehicle => vehicle.id === newDocData.ownerId) && (
                      <option value={newDocData.ownerId}>{newDocData.ownerName || 'Current vehicle'}</option>
                    )}
                  {newDocData.ownerType === 'vehicle' && vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.make} {v.model} ({v.plateNumber})</option>
                  ))}
                  {newDocData.ownerType === 'company' && companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {(employeeLookup.isFetching || vehicleLookup.isFetching) && (
                  <p className="mt-1 text-[11px] text-slate-500">Loading matching owners…</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Document Type *</label>
                <select
                  required
                  value={newDocData.documentTypeId || ''}
                  onChange={(e) => setNewDocData({ ...newDocData, documentTypeId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                >
                  <option value="">-- Select Document Type --</option>
                  {docTypes.filter(dt => dt.ownerType === newDocData.ownerType).map(dt => (
                    <option key={dt.id} value={dt.id}>{dt.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Document Number {selectedDocumentType?.docNumberRequired ? '*' : ''}
                </label>
                <input
                  type="text"
                  required={Boolean(selectedDocumentType?.docNumberRequired)}
                  placeholder="e.g. 28835601234 or CR-10928"
                  value={newDocData.documentNumber || ''}
                  onChange={(e) => setNewDocData({ ...newDocData, documentNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Issue Date {selectedDocumentType?.issueDateRequired ? '*' : ''}
                  </label>
                  <input
                    type="date"
                    required={Boolean(selectedDocumentType?.issueDateRequired)}
                    value={newDocData.issueDate || ''}
                    onChange={(e) => setNewDocData({ ...newDocData, issueDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Expiry Date {selectedDocumentType?.expiryDateRequired ? '*' : ''}
                  </label>
                  <input
                    type="date"
                    required={Boolean(selectedDocumentType?.expiryDateRequired)}
                    value={newDocData.expiryDate || ''}
                    onChange={(e) => setNewDocData({ ...newDocData, expiryDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Private File (PDF/JPG/PNG)</label>
                <input
                  type="file"
                  required={Boolean(selectedDocumentType?.fileRequired && !newDocData.fileUrl)}
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={handleDocumentFile}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
                />
                {newDocData.fileName && <p className="text-[11px] text-emerald-600 mt-1">Selected: {newDocData.fileName}</p>}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-slate-700 font-semibold hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSaving && <ButtonSpinner />}
                  <span>{isSaving ? 'Saving…' : newDocData.id ? 'Save Document' : 'Upload Document'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
