import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, Search, Plus, Eye, Edit, FileText, Phone, Filter, Archive, RotateCcw
} from 'lucide-react';
import { db } from '../../services/db';
import { Employee, DocumentRecord } from '../../types';
import { EmployeeDetailFormModal } from '../common/EmployeeDetailFormModal';
import { AddEditEmployeeModal } from '../common/AddEditEmployeeModal';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { SecureImage } from '../common/SecureFile';
import { ButtonSpinner, TableSkeleton } from '../common/LoadingSpinner';

interface EmployeeModuleProps {
  onOpenRenewModal: (doc: DocumentRecord) => void;
  onRefresh: () => void;
}

export const EmployeeModule: React.FC<EmployeeModuleProps> = ({ onOpenRenewModal, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Selected Employee for View Form (EmployeeDetailFormModal)
  const [selectedFormEmployee, setSelectedFormEmployee] = useState<Employee | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);

  // Selected Employee for Add/Edit Employee Modal
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);

  // Selected Document for Preview Modal
  const [previewDocument, setPreviewDocument] = useState<DocumentRecord | null>(null);
  const [isPreviewDocOpen, setIsPreviewDocOpen] = useState<boolean>(false);

  // Per-row spinner so the admin sees which record is being archived/restored.
  const [busyEmployeeId, setBusyEmployeeId] = useState<string | null>(null);

  const departments = db.getDepartments();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const employeeQuery = useQuery({
    queryKey: [
      'employees',
      db.getSelectedCompanyId(),
      debouncedSearch,
      statusFilter,
      departmentFilter,
      page,
      pageSize,
    ],
    queryFn: () => db.listEmployees({
      search: debouncedSearch,
      status: statusFilter,
      departmentId: departmentFilter,
      includeArchived: statusFilter === 'archived',
      archivedOnly: statusFilter === 'archived',
      page,
      pageSize,
      sortBy: 'full_name',
      direction: 'asc',
    }),
    placeholderData: previous => previous,
  });
  const employees = employeeQuery.data?.items || [];
  const total = employeeQuery.data?.total || 0;
  const totalPages = employeeQuery.data?.totalPages || 1;

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setIsAddEditOpen(true);
  };

  const employeeWithIdentityDocuments = (emp: Employee): Employee => {
    const documents = emp.documents || [];
    const types = db.getDocumentTypes();
    const byCode = (code: string) => {
      const type = types.find(item => item.code === code);
      return type ? documents.find(document => document.documentTypeId === type.id) : undefined;
    };
    const qid = byCode('qid');
    const passport = byCode('passport');
    const license = byCode('driving-license');
    const labour = byCode('labour-contract');
    const healthCard = byCode('health-card');

    return {
      ...emp,
      labourContractNumber: labour?.documentNumber || '',
      labourContractExpiryDate: labour?.expiryDate || '',
      labourContractFileUrl: labour?.fileUrl,
      healthCardNumber: healthCard?.documentNumber || '',
      healthCardExpiryDate: healthCard?.expiryDate || '',
      healthCardFileUrl: healthCard?.fileUrl,
      qidNumber: qid?.documentNumber || '',
      qidExpiryDate: qid?.expiryDate || '',
      qidFileUrl: qid?.fileUrl,
      passportNumber: passport?.documentNumber || '',
      passportExpiryDate: passport?.expiryDate || '',
      passportFileUrl: passport?.fileUrl,
      licenseNumber: license?.documentNumber || '',
      licenseExpiryDate: license?.expiryDate || '',
      licenseFileUrl: license?.fileUrl,
      uploadedDocuments: [qid, passport, license, labour, healthCard]
        .filter((document): document is DocumentRecord => Boolean(document))
        .map(document => ({
          id: document.id,
          type: document.documentTypeName,
          name: document.fileName || document.documentTypeName,
          fileUrl: document.fileUrl || '',
          expiryDate: document.expiryDate,
          docNumber: document.documentNumber,
          issueDate: document.issueDate,
        })),
    };
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(employeeWithIdentityDocuments(emp));
    setIsAddEditOpen(true);
  };

  const handleOpenViewDetails = (emp: Employee) => {
    setSelectedFormEmployee(employeeWithIdentityDocuments(emp));
    setIsFormModalOpen(true);
  };

  const handlePreviewDoc = (doc: DocumentRecord) => {
    setPreviewDocument(doc);
    setIsPreviewDocOpen(true);
  };

  const handleArchive = async (employee: Employee) => {
    if (!window.confirm(`Archive ${employee.fullName}? The record can be restored later.`)) return;
    setBusyEmployeeId(employee.id);
    try {
      await db.archiveEmployee(employee.id);
      await employeeQuery.refetch();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to archive employee.');
    } finally {
      setBusyEmployeeId(null);
    }
  };

  const handleRestore = async (employee: Employee) => {
    setBusyEmployeeId(employee.id);
    try {
      await db.restoreEmployee(employee.id);
      await employeeQuery.refetch();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to restore employee.');
    } finally {
      setBusyEmployeeId(null);
    }
  };

  // Helper to calculate expiry badge for Passport / License
  const renderExpiryBadge = (expiryDateStr?: string, defaultDays?: number) => {
    if (defaultDays !== undefined) {
      if (defaultDays < 0) {
        return <span className="inline-block bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full text-xs">Expired</span>;
      }
      if (defaultDays === 0) return <span className="inline-block bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full text-xs">Today</span>;
      const tone = defaultDays <= 30 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
      return <span className={`inline-block ${tone} font-bold px-2.5 py-1 rounded-full text-xs`}>{defaultDays} days</span>;
    }
    if (!expiryDateStr) {
      return <span className="inline-block bg-slate-100 text-slate-500 font-medium px-2.5 py-1 rounded-full text-xs">N/A</span>;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDateStr);
    exp.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays <= 0) {
      return (
        <span className="inline-block bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full text-xs">
          Expired
        </span>
      );
    } else if (diffDays <= 30) {
      return (
        <span className="inline-block bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-xs">
          {diffDays} days
        </span>
      );
    } else {
      return (
        <span className="inline-block bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-xs">
          {diffDays} days
        </span>
      );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Employee Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage multi-company staff records, residency permits, passports, driving licenses, and uploaded documents.
          </p>
        </div>

        {db.hasPermission('employees.create') && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, ID, mobile, passport..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
            <option value="archived">Archived</option>
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table matching Screenshot 2 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200 text-[11px]">
                <th className="py-3.5 px-4">NAME</th>
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">MOBILE</th>
                <th className="py-3.5 px-4">PASSPORT EXPIRE</th>
                <th className="py-3.5 px-4">LICENSE EXPIRE</th>
                <th className="py-3.5 px-4">DOCUMENTS</th>
                <th className="py-3.5 px-4 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employeeQuery.isLoading ? (
                <TableSkeleton rows={8} columns={7} />
              ) : employeeQuery.isError ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-rose-600 font-medium">
                    {employeeQuery.error instanceof Error ? employeeQuery.error.message : 'Unable to load employees.'}
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No employees matching the current company or search query.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const empDocs = emp.documents || [];

                  // Extract passport & license document records
                  const documentTypes = db.getDocumentTypes();
                  const passportType = documentTypes.find(type => type.code === 'passport');
                  const licenseType = documentTypes.find(type => type.code === 'driving-license');
                  const passportDoc = empDocs.find(document => document.documentTypeId === passportType?.id);
                  const licenseDoc = empDocs.find(document => document.documentTypeId === licenseType?.id);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Column 1: NAME */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {emp.profilePhoto ? (
                            <SecureImage
                              source={emp.profilePhoto}
                              alt={emp.fullName}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center shrink-0">
                              {emp.fullName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                              {emp.fullName}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {emp.designationName || emp.departmentName || 'No designation'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 text-xs sm:text-sm">
                        {emp.employeeCode}
                      </td>

                      {/* Column 3: MOBILE */}
                      <td className="py-3.5 px-4 font-mono text-slate-700 text-xs sm:text-sm">
                        {emp.mobile}
                      </td>

                      {/* Column 4: PASSPORT EXPIRE */}
                      <td className="py-3.5 px-4">
                        {renderExpiryBadge(
                          passportDoc?.expiryDate || emp.passportExpiryDate,
                          passportDoc?.daysRemaining
                        )}
                      </td>

                      {/* Column 5: LICENSE EXPIRE */}
                      <td className="py-3.5 px-4">
                        {renderExpiryBadge(
                          licenseDoc?.expiryDate || emp.licenseExpiryDate,
                          licenseDoc?.daysRemaining
                        )}
                      </td>

                      {/* Column 6: DOCUMENTS (Clickable badges) */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {empDocs.length > 0 ? (
                            empDocs.map((doc) => (
                              <button
                                key={doc.id}
                                onClick={() => handlePreviewDoc(doc)}
                                title={`Click to view ${doc.documentTypeName}`}
                                className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-lg text-xs border border-purple-200/80 inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <span>{doc.documentTypeName.replace(' (QID)', '').replace(' (Vehicle Registration)', '')}</span>
                              </button>
                            ))
                          ) : (
                            emp.uploadedDocuments && emp.uploadedDocuments.length > 0 ? (
                              emp.uploadedDocuments.map((doc) => (
                                <button
                                  key={doc.id}
                                  onClick={() => handlePreviewDoc({
                                    id: doc.id,
                                    companyId: emp.companyId,
                                    ownerType: 'employee',
                                    ownerId: emp.id,
                                    ownerName: emp.fullName,
                                    documentTypeId: 'doc-custom',
                                    documentTypeName: doc.type,
                                    documentNumber: doc.docNumber || 'N/A',
                                    expiryDate: doc.expiryDate || '',
                                    status: 'valid',
                                    fileUrl: doc.fileUrl,
                                    fileName: doc.name,
                                    reminderEnabled: true,
                                    createdBy: emp.createdBy,
                                    updatedBy: emp.updatedBy,
                                    createdAt: emp.createdAt,
                                    updatedAt: emp.updatedAt,
                                  })}
                                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-lg text-xs border border-purple-200/80 inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <span>{doc.type}</span>
                                </button>
                              ))
                            ) : (
                              <span className="text-slate-400 text-xs font-mono">No docs</span>
                            )
                          )}
                        </div>
                      </td>

                      {/* Column 7: ACTION (View Details & Edit Buttons matching Screenshot 2) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* View Details Button (Slate / Dark Gray Button) */}
                          <button
                            onClick={() => handleOpenViewDetails(emp)}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>

                          {/* Edit Button (Purple Button) */}
                          {emp.status !== 'archived' && db.hasPermission('employees.update') && (
                            <button
                              onClick={() => handleOpenEdit(emp)}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}
                          {emp.status !== 'archived' && db.hasPermission('employees.archive') && (
                            <button
                              onClick={() => handleArchive(emp)}
                              disabled={busyEmployeeId === emp.id}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors inline-flex items-center gap-1 disabled:opacity-60"
                            >
                              {busyEmployeeId === emp.id ? <ButtonSpinner /> : <Archive className="w-3.5 h-3.5" />}
                              <span>Archive</span>
                            </button>
                          )}
                          {emp.status === 'archived' && db.hasPermission('employees.restore') && (
                            <button
                              onClick={() => handleRestore(emp)}
                              disabled={busyEmployeeId === emp.id}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors inline-flex items-center gap-1 disabled:opacity-60"
                            >
                              {busyEmployeeId === emp.id ? <ButtonSpinner /> : <RotateCcw className="w-3.5 h-3.5" />}
                              <span>Restore</span>
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
            <div>
              Showing page {page} of {totalPages} ({total} employees total)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold hover:bg-slate-100 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold hover:bg-slate-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <EmployeeDetailFormModal
        employee={selectedFormEmployee}
        isOpen={isFormModalOpen}
        onClose={() => { setIsFormModalOpen(false); setSelectedFormEmployee(null); }}
      />

      <AddEditEmployeeModal
        employee={editingEmployee}
        isOpen={isAddEditOpen}
        onClose={() => { setIsAddEditOpen(false); setEditingEmployee(null); }}
        onSaveSuccess={() => {
          void employeeQuery.refetch();
          onRefresh();
        }}
      />

      <DocumentPreviewModal
        document={previewDocument}
        isOpen={isPreviewDocOpen}
        onClose={() => { setIsPreviewDocOpen(false); setPreviewDocument(null); }}
        onOpenRenewModal={onOpenRenewModal}
      />
    </div>
  );
};
