import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Car, Search, Plus, Edit, RefreshCw, FileText, IdCard, BookUser, Ban,
} from 'lucide-react';
import { db } from '../../services/db';
import { DocumentRecord, Employee, Vehicle } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { CompanyLogo } from '../common/CompanyLogo';
import { ExpiryAlertBox } from '../common/ExpiryAlertBox';
import { AddEditEmployeeModal } from '../common/AddEditEmployeeModal';
import { VehicleDocumentModal } from '../common/VehicleDocumentModal';
import { useSecureFileUrl } from '../common/SecureFile';

/** The dedicated workspace is pinned to the limousine company. */
const LIMOUSINE_COMPANY_CODE = 'SAS';

interface LimousineModuleProps {
  onOpenRenewModal: (doc: DocumentRecord) => void;
  onRefresh: () => void;
}

/** Small inline link that resolves a private file id into a viewable blob URL. */
const DocumentLink: React.FC<{ label: string; document?: DocumentRecord }> = ({ label, document }) => {
  const file = useSecureFileUrl(document?.fileUrl);

  if (!document) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-400">
        <Ban className="w-3 h-3" /> {label}
      </span>
    );
  }

  if (!document.fileUrl) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
        <FileText className="w-3 h-3" /> {label}: no file
      </span>
    );
  }

  return (
    <a
      href={file.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 ${
        file.url ? '' : 'pointer-events-none opacity-60'
      }`}
    >
      <FileText className="w-3 h-3" /> {label}
    </a>
  );
};

export const LimousineModule: React.FC<LimousineModuleProps> = ({ onOpenRenewModal, onRefresh }) => {
  const [staffSearch, setStaffSearch] = useState('');
  const [debouncedStaffSearch, setDebouncedStaffSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [debouncedVehicleSearch, setDebouncedVehicleSearch] = useState('');

  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [istimaraVehicle, setIstimaraVehicle] = useState<Vehicle | null>(null);

  const company = db.getCompanies().find(item => item.code === LIMOUSINE_COMPANY_CODE);
  const companyId = company?.id;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedStaffSearch(staffSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [staffSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedVehicleSearch(vehicleSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [vehicleSearch]);

  const dashboardQuery = useQuery({
    queryKey: ['limousine-dashboard', companyId],
    queryFn: () => db.dashboardSummary({ companyId }),
    enabled: Boolean(companyId),
  });

  const staffQuery = useQuery({
    queryKey: ['limousine-staff', companyId, debouncedStaffSearch],
    queryFn: () => db.listEmployees({
      companyId,
      search: debouncedStaffSearch,
      page: 1,
      pageSize: 50,
      sortBy: 'full_name',
      direction: 'asc',
    }),
    enabled: Boolean(companyId),
    placeholderData: previous => previous,
  });

  const vehicleQuery = useQuery({
    queryKey: ['limousine-vehicles', companyId, debouncedVehicleSearch],
    queryFn: () => db.listVehicles({
      companyId,
      search: debouncedVehicleSearch,
      page: 1,
      pageSize: 50,
      sortBy: 'vehicle_name',
      direction: 'asc',
    }),
    enabled: Boolean(companyId),
    placeholderData: previous => previous,
  });

  const stats = dashboardQuery.data?.stats;
  const staff = staffQuery.data?.items || [];
  const vehicles = vehicleQuery.data?.items || [];

  const refreshAll = () => {
    void dashboardQuery.refetch();
    void staffQuery.refetch();
    void vehicleQuery.refetch();
    onRefresh();
  };

  const documentOf = (employee: Employee, code: string): DocumentRecord | undefined =>
    (employee.documents || []).find(document => document.documentTypeCode === code);

  if (!company) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <h1 className="text-sm font-bold text-amber-900">Limousine company not found</h1>
        <p className="mt-1 text-xs text-amber-800">
          Create a company with the code <b>{LIMOUSINE_COMPANY_CODE}</b> in Settings → Company Entities
          to enable this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-4">
          <CompanyLogo
            code={company.code}
            name={company.name}
            logoUrl={company.logoUrl}
            sizeClass="w-14 h-14"
            textClass="text-sm"
          />
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{company.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Staff records, identity documents and vehicle Istimara in one workspace.
            </p>
          </div>
        </div>
        <button
          onClick={refreshAll}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${dashboardQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Expiry notification box */}
      <ExpiryAlertBox
        alerts={dashboardQuery.data?.documentTypeAlerts}
        isLoading={dashboardQuery.isLoading}
      />

      {/* Summary boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ['Total Staff', stats?.totalEmployees ?? 0, 'text-slate-900'],
          ['Total Vehicles', stats?.totalVehicles ?? 0, 'text-slate-900'],
          ['Expiring QID', stats?.expiringQid ?? 0, 'text-amber-700'],
          ['Expiring Passport', stats?.expiringPassport ?? 0, 'text-amber-700'],
          ['Expiring Istimara', stats?.expiringIstimara ?? 0, 'text-amber-700'],
          ['Expired Documents', stats?.expiredDocuments ?? 0, 'text-rose-700'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
            <span className={`mt-1 block text-2xl font-extrabold ${tone}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Staff details card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Staff Details</h2>
              <p className="text-[11px] text-slate-500">
                QID, Passport, Driving License and Labour Contract for every staff member.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={staffSearch}
                onChange={event => setStaffSearch(event.target.value)}
                placeholder="Search name, QID, mobile…"
                className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs w-56"
              />
            </div>
            {db.hasPermission('employees.create') && (
              <button
                onClick={() => {
                  setEditingEmployee({ companyId });
                  setIsEmployeeModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Staff
              </button>
            )}
          </div>
        </div>

        {staffQuery.isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading staff…</div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No staff records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200/80">
                  <th className="py-3 px-4">Staff Name</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">QID</th>
                  <th className="py-3 px-4">Passport</th>
                  <th className="py-3 px-4">Driving License</th>
                  <th className="py-3 px-4">Documents</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map(employee => {
                  const qid = documentOf(employee, 'qid');
                  const passport = documentOf(employee, 'passport');
                  const license = documentOf(employee, 'driving-license');
                  const labour = documentOf(employee, 'labour-contract');

                  return (
                    <tr key={employee.id} className="hover:bg-slate-50/80 align-top">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{employee.fullName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{employee.employeeCode}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{employee.mobile || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-800">{qid?.documentNumber || '—'}</div>
                        <div className="mt-1">
                          {qid?.expiryDate ? (
                            <StatusBadge type="expiry" status={qid.status} daysRemaining={qid.daysRemaining} />
                          ) : (
                            <span className="text-[10px] text-slate-400">No expiry</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-800">{passport?.documentNumber || '—'}</div>
                        <div className="mt-1">
                          {passport?.expiryDate ? (
                            <StatusBadge type="expiry" status={passport.status} daysRemaining={passport.daysRemaining} />
                          ) : (
                            <span className="text-[10px] text-slate-400">No expiry</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-800">{license?.documentNumber || '—'}</div>
                        <div className="mt-1">
                          {license?.expiryDate ? (
                            <StatusBadge type="expiry" status={license.status} daysRemaining={license.daysRemaining} />
                          ) : (
                            <span className="text-[10px] text-slate-400">No expiry</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          <DocumentLink label="QID" document={qid} />
                          <DocumentLink label="Passport" document={passport} />
                          <DocumentLink label="License" document={license} />
                          <DocumentLink label="Contract" document={labour} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex gap-1.5">
                          {db.hasPermission('employees.update') && (
                            <button
                              onClick={() => {
                                setEditingEmployee({
                                  ...employee,
                                  qidNumber: qid?.documentNumber || '',
                                  qidExpiryDate: qid?.expiryDate || '',
                                  qidFileUrl: qid?.fileUrl,
                                  passportNumber: passport?.documentNumber || '',
                                  passportExpiryDate: passport?.expiryDate || '',
                                  passportFileUrl: passport?.fileUrl,
                                  licenseNumber: license?.documentNumber || '',
                                  licenseExpiryDate: license?.expiryDate || '',
                                  licenseFileUrl: license?.fileUrl,
                                  labourContractNumber: labour?.documentNumber || '',
                                  labourContractExpiryDate: labour?.expiryDate || '',
                                  labourContractFileUrl: labour?.fileUrl,
                                });
                                setIsEmployeeModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {qid && db.hasPermission('documents.renew') && (
                            <button
                              onClick={() => onOpenRenewModal(qid)}
                              className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                            >
                              Renew QID
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Istimara card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-amber-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Istimara Details</h2>
              <p className="text-[11px] text-slate-500">
                Vehicle registration numbers, expiry dates and uploaded Istimara copies.
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={vehicleSearch}
              onChange={event => setVehicleSearch(event.target.value)}
              placeholder="Search vehicle or plate…"
              className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs w-56"
            />
          </div>
        </div>

        {vehicleQuery.isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading vehicles…</div>
        ) : vehicles.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No vehicles registered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200/80">
                  <th className="py-3 px-4">Vehicle Name</th>
                  <th className="py-3 px-4">Plate Number</th>
                  <th className="py-3 px-4">Istimara Number</th>
                  <th className="py-3 px-4">Istimara Expiry</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.map(vehicle => {
                  const istimara = (vehicle.documents || []).find(
                    document => document.documentTypeCode === 'istimara',
                  );

                  return (
                    <tr key={vehicle.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {vehicle.vehicleName || `${vehicle.make} ${vehicle.model}`.trim() || vehicle.vehicleNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{vehicle.plateNumber}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{istimara?.documentNumber || '—'}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{istimara?.expiryDate || '—'}</td>
                      <td className="py-3 px-4">
                        {istimara ? (
                          <StatusBadge type="expiry" status={istimara.status} daysRemaining={istimara.daysRemaining} />
                        ) : (
                          <span className="text-[10px] text-slate-400">Not registered</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex gap-1.5">
                          <DocumentLink label="Istimara PDF" document={istimara} />
                          {db.hasPermission('documents.create') && (
                            <button
                              onClick={() => setIstimaraVehicle(vehicle)}
                              className="rounded-lg bg-amber-500 px-2 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-600"
                            >
                              {istimara ? 'Update' : 'Add'}
                            </button>
                          )}
                          {istimara && db.hasPermission('documents.renew') && (
                            <button
                              onClick={() => onOpenRenewModal(istimara)}
                              className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                            >
                              Renew
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddEditEmployeeModal
        isOpen={isEmployeeModalOpen}
        employee={editingEmployee}
        onClose={() => setIsEmployeeModalOpen(false)}
        onSaveSuccess={() => {
          setIsEmployeeModalOpen(false);
          refreshAll();
        }}
      />

      <VehicleDocumentModal
        isOpen={Boolean(istimaraVehicle)}
        vehicle={istimaraVehicle}
        documentTypeCode="istimara"
        onClose={() => setIstimaraVehicle(null)}
        onSaved={refreshAll}
      />
    </div>
  );
};
