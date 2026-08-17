import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  Search, Plus, Edit, Trash2, CreditCard, FileText, X, Printer, Paperclip, Phone, Filter,
} from 'lucide-react';
import { db } from '../../services/db';
import { ButtonSpinner, LoadingSpinner, TableSkeleton } from '../common/LoadingSpinner';
import { FilePreviewModal } from '../common/FilePreviewModal';
import { StatusBadge } from '../common/StatusBadge';
import { BankDocument, ExpiryStatus } from '../../types';

type EditableBankDocument = Partial<BankDocument> & { id?: string };

const value = (input?: string | null) => (input && String(input).trim()) || 'N/A';

/** Fallback badge for records loaded before the API returned a status. */
function expiryBadge(date?: string, status?: ExpiryStatus, days?: number | null) {
  if (!date) {
    return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">No date</span>;
  }
  if (status) {
    return <StatusBadge type="expiry" status={status} daysRemaining={days ?? undefined} />;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(date);
  expiry.setHours(0, 0, 0, 0);
  const diff = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  const tone = diff < 0 ? 'bg-rose-100 text-rose-700' : diff <= 30 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>
      {diff < 0 ? `Expired (${Math.abs(diff)}d)` : `${diff} days`}
    </span>
  );
}

export const BankDocumentsModule: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cardFilter, setCardFilter] = useState('all');
  const [phoneFilter, setPhoneFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditableBankDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [fileData, setFileData] = useState('');
  const [fileName, setFileName] = useState('');

  const [previewDoc, setPreviewDoc] = useState<BankDocument | null>(null);
  const [detailDoc, setDetailDoc] = useState<BankDocument | null>(null);

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [debouncedEmployeeSearch, setDebouncedEmployeeSearch] = useState('');

  const companies = db.getCompanies();

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(searchTerm.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedEmployeeSearch(employeeSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [employeeSearch]);

  const listQuery = useQuery({
    queryKey: ['bank-docs', db.getSelectedCompanyId(), debouncedSearch, cardFilter, phoneFilter, ownerFilter, page],
    queryFn: () => db.listBankDocuments({
      search: debouncedSearch,
      expiryStatus: cardFilter,
      phoneExpiryStatus: phoneFilter,
      owner: ownerFilter,
      page,
      pageSize,
    }),
    placeholderData: previous => previous,
  });

  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;
  const totalPages = listQuery.data?.totalPages || 1;

  // Employees are only fetched while the modal is open, and always server-side
  // filtered, so a 300+ staff database never ships down in one payload.
  const employeeQuery = useQuery({
    queryKey: ['bank-doc-employees', editing?.companyId || db.getSelectedCompanyId(), debouncedEmployeeSearch],
    queryFn: () => db.listEmployees({
      companyId: editing?.companyId,
      search: debouncedEmployeeSearch,
      page: 1,
      pageSize: 50,
      sortBy: 'full_name',
      direction: 'asc',
    }),
    enabled: isFormOpen,
    placeholderData: previous => previous,
  });
  const employees = employeeQuery.data?.items || [];

  const stats = useMemo(() => ({
    total,
    expiredCards: items.filter(item => item.bankCardExpiryStatus === 'expired').length,
    expiredPhones: items.filter(item => item.accountPhoneExpiryStatus === 'expired').length,
  }), [items, total]);

  const openCreate = () => {
    const selected = db.getSelectedCompanyId();
    setEditing({
      companyId: selected !== 'all' ? selected : companies[0]?.id || '',
      accountPhoneOwner: 'company',
    });
    setEmployeeSearch('');
    setFileData('');
    setFileName('');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEdit = (record: BankDocument) => {
    setEditing({ ...record });
    setEmployeeSearch(record.employeeName || '');
    setFileData('');
    setFileName('');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    if (!editing?.employeeId) {
      setFormError('Select the employee this bank document belongs to.');
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      await db.saveBankDocument({
        ...editing,
        bankDocument: fileData || undefined,
        bankDocumentFileName: fileName || undefined,
      });
      setIsFormOpen(false);
      setEditing(null);
      await listQuery.refetch();
      onRefresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the bank document.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (record: BankDocument) => {
    if (!window.confirm(`Delete the bank document of ${record.employeeName}? This cannot be undone.`)) return;
    setDeletingId(record.id);
    try {
      await db.deleteBankDocument(record.id);
      await listQuery.refetch();
      onRefresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to delete the bank document.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
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
    setFileData(await db.toDataUrl(file));
    setFileName(file.name);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
            <CreditCard className="h-5 w-5 text-amber-500" /> All Bank Document
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Employee bank accounts, IBAN, salary card expiry and account phone number expiry with secure document previews.
          </p>
        </div>
        {db.hasPermission('employees.create') && (
          <button
            onClick={openCreate}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            <span>Add Bank Document</span>
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total records</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Expired cards (this page)</p>
          <p className="mt-1 text-2xl font-black text-rose-700">{stats.expiredCards}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Expired account phones (this page)</p>
          <p className="mt-1 text-2xl font-black text-amber-700">{stats.expiredPhones}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee, code, IBAN, phone…"
              value={searchTerm}
              onChange={event => { setSearchTerm(event.target.value); setPage(1); }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-purple-600 focus:outline-none"
            />
          </div>
          <select
            value={cardFilter}
            onChange={event => { setCardFilter(event.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none"
          >
            <option value="all">All bank card statuses</option>
            <option value="expired">Bank card expired</option>
            <option value="valid">Bank card valid</option>
          </select>
          <select
            value={phoneFilter}
            onChange={event => { setPhoneFilter(event.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none"
          >
            <option value="all">All account phone statuses</option>
            <option value="expired">Account phone expired</option>
            <option value="valid">Account phone valid</option>
          </select>
          <select
            value={ownerFilter}
            onChange={event => { setOwnerFilter(event.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none"
          >
            <option value="all">Any phone ownership</option>
            <option value="company">Company owned number</option>
            <option value="employee">Employee owned number</option>
          </select>
        </div>
        {listQuery.isFetching && (
          <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <LoadingSpinner size={14} label="Refreshing results…" />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Employee</th>
                <th className="px-4 py-3 font-bold">Account Phone</th>
                <th className="px-4 py-3 font-bold">Phone Expire</th>
                <th className="px-4 py-3 font-bold">Card Expire</th>
                <th className="px-4 py-3 font-bold">IBAN</th>
                <th className="px-4 py-3 font-bold">Document</th>
                <th className="px-4 py-3 text-center font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listQuery.isLoading ? (
                <TableSkeleton rows={6} columns={7} />
              ) : listQuery.isError ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs font-semibold text-rose-600">
                    {listQuery.error instanceof Error ? listQuery.error.message : 'Unable to load bank documents.'}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                    No bank documents match the current filters.
                  </td>
                </tr>
              ) : (
                items.map(record => (
                  <tr key={record.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                          {(record.employeeName || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-900 sm:text-sm">{record.employeeName}</span>
                          <span className="block text-[11px] text-slate-500">
                            {record.employeeCode || 'No code'}{record.nationality ? ` • ${record.nationality}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-xs text-slate-800">{record.accountPhoneNumber || '-'}</div>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${record.accountPhoneOwner === 'company' ? 'bg-emerald-500' : 'bg-orange-500'}`}>
                        {record.accountPhoneOwner === 'company' ? 'Company' : 'Employee'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>{expiryBadge(record.accountPhoneExpiryDate, record.accountPhoneExpiryStatus, record.accountPhoneDaysRemaining)}</div>
                      <span className="mt-1 block font-mono text-[10px] text-slate-400">{record.accountPhoneExpiryDate || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>{expiryBadge(record.bankCardExpiryDate, record.bankCardExpiryStatus, record.bankCardDaysRemaining)}</div>
                      <span className="mt-1 block font-mono text-[10px] text-slate-400">{record.bankCardExpiryDate || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-700">{record.ibanNumber || '-'}</td>
                    <td className="px-4 py-3.5">
                      {record.bankDocumentUrl ? (
                        <button
                          onClick={() => setPreviewDoc(record)}
                          title="Preview the attached bank document"
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-purple-200/80 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 transition-colors hover:bg-purple-100"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          <span>Bank Doc</span>
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-slate-400">No file</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setDetailDoc(record)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-slate-900"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>View Details</span>
                        </button>
                        {db.hasPermission('employees.update') && (
                          <button
                            onClick={() => openEdit(record)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-purple-700"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                        {db.hasPermission('employees.archive') && (
                          <button
                            onClick={() => handleDelete(record)}
                            disabled={deletingId === record.id}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
                          >
                            {deletingId === record.id ? <ButtonSpinner /> : <Trash2 className="h-3.5 w-3.5" />}
                            <span>Delete</span>
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

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
          <span>Showing page {page} of {totalPages} ({total} bank documents)</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(current => current - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold hover:bg-slate-100 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(current => current + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold hover:bg-slate-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {isFormOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSave}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-900">{editing.id ? 'Edit Bank Document' : 'Add Bank Document'}</h3>
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5 text-xs">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-semibold text-rose-700">{formError}</div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-700">Company *</span>
                  <select
                    required
                    value={editing.companyId || ''}
                    onChange={event => setEditing({ ...editing, companyId: event.target.value, employeeId: '', employeeName: '' })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <option value="">Select company</option>
                    {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-700">Find employee</span>
                  <input
                    type="search"
                    value={employeeSearch}
                    onChange={event => setEmployeeSearch(event.target.value)}
                    placeholder="Search name, code or mobile"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block font-semibold text-slate-700">Employee *</span>
                  <select
                    required
                    value={editing.employeeId || ''}
                    onChange={event => {
                      const employee = employees.find(item => item.id === event.target.value);
                      setEditing({
                        ...editing,
                        employeeId: event.target.value,
                        employeeName: employee?.fullName || editing.employeeName,
                        employeeCode: employee?.employeeCode || editing.employeeCode,
                        nationality: employee?.nationality || editing.nationality,
                        personalPhoneNumber: editing.personalPhoneNumber || employee?.mobile || '',
                      });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <option value="">-- Select employee --</option>
                    {editing.employeeId && !employees.some(item => item.id === editing.employeeId) && (
                      <option value={editing.employeeId}>{editing.employeeName || 'Current employee'}</option>
                    )}
                    {employees.map(employee => (
                      <option key={employee.id} value={employee.id}>{employee.fullName} ({employee.employeeCode})</option>
                    ))}
                  </select>
                  {employeeQuery.isFetching && <span className="mt-1 block text-[11px] text-slate-500">Loading matching employees…</span>}
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-700">Account phone number</span>
                  <input
                    value={editing.accountPhoneNumber || ''}
                    onChange={event => setEditing({ ...editing, accountPhoneNumber: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-700">Account phone ownership</span>
                  <select
                    value={editing.accountPhoneOwner || 'company'}
                    onChange={event => setEditing({ ...editing, accountPhoneOwner: event.target.value as BankDocument['accountPhoneOwner'] })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <option value="company">Company (green)</option>
                    <option value="employee">Employee (orange)</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-700">Account phone expiry date</span>
                  <input
                    type="date"
                    value={editing.accountPhoneExpiryDate || ''}
                    onChange={event => setEditing({ ...editing, accountPhoneExpiryDate: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">Used for the phone expiry alert badge.</span>
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-700">Bank card expiry date</span>
                  <input
                    type="date"
                    value={editing.bankCardExpiryDate || ''}
                    onChange={event => setEditing({ ...editing, bankCardExpiryDate: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-700">Personal phone number</span>
                  <input
                    value={editing.personalPhoneNumber || ''}
                    onChange={event => setEditing({ ...editing, personalPhoneNumber: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-700">Nationality</span>
                  <input
                    value={editing.nationality || ''}
                    onChange={event => setEditing({ ...editing, nationality: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block font-semibold text-slate-700">IBAN number</span>
                  <input
                    value={editing.ibanNumber || ''}
                    onChange={event => setEditing({ ...editing, ibanNumber: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block font-semibold text-slate-700">Notes</span>
                  <textarea
                    rows={2}
                    value={editing.notes || ''}
                    onChange={event => setEditing({ ...editing, notes: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block font-semibold text-slate-700">Bank document (PDF / JPG / PNG)</span>
                  {editing.bankDocumentUrl && !fileData && (
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
                  {fileName && <p className="mt-1 text-[11px] text-emerald-600">Selected: {fileName}</p>}
                </label>
              </div>
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700 disabled:opacity-60"
              >
                {isSaving && <ButtonSpinner />}
                <span>{isSaving ? 'Saving…' : editing.id ? 'Save Changes' : 'Save Bank Document'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Detail / print modal */}
      {detailDoc && createPortal(
        <div className="employee-print-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs">
          <div className="employee-print-modal my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="no-print flex items-center justify-between bg-slate-900 p-4 text-white">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-bold">Bank Document Details</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
                >
                  <Printer className="h-4 w-4" /> <span>Print</span>
                </button>
                <button onClick={() => setDetailDoc(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="printable-form-container stf-print-sheet flex-1 space-y-4 overflow-y-auto p-6 text-sm">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-lg font-black text-slate-900">{detailDoc.employeeName}</h2>
                <p className="text-xs text-slate-500">
                  {detailDoc.employeeCode || 'No code'} • {detailDoc.companyName || companies.find(item => item.id === detailDoc.companyId)?.name || ''}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ['Nationality', value(detailDoc.nationality)],
                  ['IBAN number', value(detailDoc.ibanNumber)],
                  ['Account phone number', value(detailDoc.accountPhoneNumber)],
                  ['Account phone owner', detailDoc.accountPhoneOwner === 'company' ? 'Company' : 'Employee'],
                  ['Account phone expiry', value(detailDoc.accountPhoneExpiryDate)],
                  ['Bank card expiry', value(detailDoc.bankCardExpiryDate)],
                  ['Personal phone number', value(detailDoc.personalPhoneNumber)],
                  ['Attached document', detailDoc.bankDocumentFileName || (detailDoc.bankDocumentUrl ? 'Attached' : 'None')],
                ].map(([label, text]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{text}</p>
                  </div>
                ))}
              </div>

              {detailDoc.notes && (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{detailDoc.notes}</p>
                </div>
              )}

              <div className="no-print flex flex-wrap gap-2 pt-2">
                {detailDoc.bankDocumentUrl && (
                  <button
                    onClick={() => { setPreviewDoc(detailDoc); }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    <Paperclip className="h-3.5 w-3.5" /> <span>Preview attachment</span>
                  </button>
                )}
                {db.hasPermission('employees.update') && (
                  <button
                    onClick={() => { const record = detailDoc; setDetailDoc(null); openEdit(record); }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700"
                  >
                    <Edit className="h-3.5 w-3.5" /> <span>Edit record</span>
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500">
                  <Phone className="h-3.5 w-3.5" /> Salary account details are audited on every change.
                </span>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <FilePreviewModal
        isOpen={Boolean(previewDoc?.bankDocumentUrl)}
        source={previewDoc?.bankDocumentUrl}
        title={`${previewDoc?.employeeName || 'Employee'} — Bank Document`}
        subtitle={previewDoc?.ibanNumber ? `IBAN ${previewDoc.ibanNumber}` : undefined}
        fileName={previewDoc?.bankDocumentFileName}
        mimeType={previewDoc?.bankDocumentMimeType}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
};
