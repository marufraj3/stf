import React, { useState } from 'react';
import { UploadCloud, Download, CheckCircle2, AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { db } from '../../services/db';
import { apiDownload, apiMultipart, apiRequest } from '../../services/api';

interface ImportModuleProps {
  onRefresh: () => void;
}

type ImportType = 'employees' | 'documents' | 'vehicles';
type Preview = {
  batchId: string;
  total: number;
  valid: number;
  invalid: number;
  rows: Array<{ rowNumber: number; data: Record<string, unknown>; errors: string[]; status: string }>;
};

const HEADERS: Record<ImportType, string> = {
  employees: 'fullName,employeeCode,mobile,email,nationality,dateOfBirth,gender,joiningDate,basicSalary,allowances,status',
  documents: 'ownerType,ownerId,documentTypeId,documentNumber,issueDate,expiryDate,issuingAuthority',
  vehicles: 'internalVehicleId,vehicleNumber,plateNumber,make,model,year,color,chassisNumber,engineNumber,vehicleType,ownershipType,status',
};

const TARGET_FIELDS: Record<ImportType, string[]> = {
  employees: ['fullName', 'employeeCode', 'internalId', 'mobile', 'altMobile', 'email', 'nationality', 'dateOfBirth', 'gender', 'joiningDate', 'basicSalary', 'allowances', 'status', 'notes'],
  documents: ['ownerType', 'ownerId', 'documentTypeId', 'documentNumber', 'issueDate', 'expiryDate', 'issuingCountry', 'issuingAuthority', 'notes'],
  vehicles: ['internalVehicleId', 'vehicleNumber', 'plateNumber', 'make', 'model', 'year', 'color', 'chassisNumber', 'engineNumber', 'vehicleType', 'ownershipType', 'registrationDate', 'status', 'notes'],
};

export const ImportModule: React.FC<ImportModuleProps> = ({ onRefresh }) => {
  const companies = db.getCompanies();
  const selectedWorkspace = db.getSelectedCompanyId();
  const [type, setType] = useState<ImportType>('employees');
  const [companyId, setCompanyId] = useState(
    selectedWorkspace === 'all' ? companies[0]?.id || '' : selectedWorkspace,
  );
  const [file, setFile] = useState<File | null>(null);
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [updateExisting, setUpdateExisting] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; failed: number; skippedInvalid: number } | null>(null);

  const mapHeaders = (headers: string[], nextType: ImportType) => Object.fromEntries(
    headers.map(header => [header, TARGET_FIELDS[nextType].includes(header) ? header : '']),
  );

  const inspectFile = async (selectedFile: File, nextType = type) => {
    setInspecting(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      const response = await apiMultipart<{ data: { headers: string[]; rowCount: number } }>('/imports/inspect', form);
      setSourceHeaders(response.data.headers);
      setColumnMapping(mapHeaders(response.data.headers, nextType));
    } catch (error) {
      setFile(null);
      alert(error instanceof Error ? error.message : 'Unable to inspect import file.');
    } finally {
      setInspecting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([`${HEADERS[type]}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trust-group-${type}-import-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const runPreview = async () => {
    if (!file || !companyId) {
      alert('Select a company and an import file.');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('type', type);
      form.append('companyId', companyId);
      form.append('file', file);
      form.append('columnMapping', JSON.stringify(
        Object.fromEntries(Object.entries(columnMapping).filter(([, target]) => target)),
      ));
      form.append('updateExisting', updateExisting ? '1' : '0');
      const response = await apiMultipart<{ data: Preview }>('/imports/preview', form);
      setPreview(response.data);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to preview import.');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview || preview.valid === 0) return;
    setBusy(true);
    try {
      const response = await apiRequest<{ data: { created: number; updated: number; failed: number; skippedInvalid: number } }>(
        `/imports/${preview.batchId}/commit`,
        { method: 'POST' },
      );
      setResult(response.data);
      await db.initialize();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to commit import.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Excel & CSV Bulk Import</h1>
          <p className="text-xs text-slate-500 mt-0.5">Server-validated preview first; database writes happen only after confirmation.</p>
        </div>
        <button onClick={downloadTemplate} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold">
          <Download className="w-4 h-4" /> Download Blank Template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
          <label className="block">
            <span className="font-bold text-slate-700 block mb-1">Dataset</span>
            <select
              value={type}
              onChange={event => {
                const nextType = event.target.value as ImportType;
                setType(nextType);
                setPreview(null);
                setResult(null);
                setColumnMapping(mapHeaders(sourceHeaders, nextType));
              }}
              className="w-full border rounded-xl px-3 py-2"
            >
              <option value="employees">Employees</option>
              <option value="documents">Documents</option>
              <option value="vehicles">Vehicles</option>
            </select>
          </label>
          <label className="block">
            <span className="font-bold text-slate-700 block mb-1">Target Company</span>
            <select required value={companyId} onChange={event => setCompanyId(event.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="">Select company</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label className="block border-2 border-dashed border-slate-300 rounded-xl p-5 text-center cursor-pointer hover:border-amber-500">
            <UploadCloud className="w-8 h-8 mx-auto text-amber-500" />
            <span className="block mt-2 font-bold">
              {inspecting ? 'Reading columns…' : file?.name || 'Choose CSV / XLSX / XLS'}
            </span>
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="hidden"
              onChange={event => {
                const selectedFile = event.target.files?.[0] || null;
                setFile(selectedFile);
                setPreview(null);
                setResult(null);
                if (selectedFile) void inspectFile(selectedFile);
              }}
            />
          </label>
          {sourceHeaders.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="font-bold text-slate-700">Column mapping</div>
              <div className="max-h-52 overflow-y-auto space-y-2">
                {sourceHeaders.map(header => (
                  <label key={header} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <span className="truncate font-mono text-[11px]" title={header}>{header}</span>
                    <span className="text-slate-400">→</span>
                    <select
                      value={columnMapping[header] || ''}
                      onChange={event => setColumnMapping({ ...columnMapping, [header]: event.target.value })}
                      className="min-w-0 border rounded-lg px-2 py-1.5"
                    >
                      <option value="">Skip column</option>
                      {TARGET_FIELDS[type].map(field => <option key={field} value={field}>{field}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input type="checkbox" checked={updateExisting} onChange={event => setUpdateExisting(event.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" />
            <span>
              <b className="block">Update matching existing records</b>
              <span className="text-[11px] text-slate-500">Match by employee code, vehicle internal ID, or owner document identity.</span>
            </span>
          </label>
          <button disabled={busy || inspecting || !file} onClick={runPreview} className="w-full bg-amber-500 text-slate-950 py-2.5 rounded-xl font-bold disabled:opacity-50">
            {busy ? 'Validating…' : 'Validate & Preview'}
          </button>
        </div>

        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200">
          {!preview && !result && (
            <div className="h-full min-h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
              <Database className="w-10 h-10 mb-2" />
              Upload a file to see row-level validation before import.
            </div>
          )}
          {preview && !result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="bg-slate-50 rounded-xl p-3"><b className="text-xl block">{preview.total}</b>Total rows</div>
                <div className="bg-emerald-50 text-emerald-800 rounded-xl p-3"><b className="text-xl block">{preview.valid}</b>Valid</div>
                <div className="bg-rose-50 text-rose-800 rounded-xl p-3"><b className="text-xl block">{preview.invalid}</b>Invalid</div>
              </div>
              {preview.invalid > 0 && (
                <div className="space-y-2">
                  <div className="max-h-52 overflow-auto space-y-2">
                    {preview.rows.filter(row => row.errors.length).map(row => (
                      <div key={row.rowNumber} className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
                        <b>Row {row.rowNumber}:</b> {row.errors.join(' ')}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => void apiDownload(`/imports/${preview.batchId}/errors`)}
                    className="text-xs font-bold text-rose-700 underline"
                  >
                    Download row error report
                  </button>
                </div>
              )}
              <button disabled={busy || preview.valid === 0} onClick={commit} className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold disabled:opacity-50">
                {busy ? 'Importing…' : `Import ${preview.valid} Valid Rows`}
              </button>
            </div>
          )}
          {result && (
            <div className="min-h-56 flex flex-col items-center justify-center text-center">
              {result.failed === 0 ? <CheckCircle2 className="w-12 h-12 text-emerald-500" /> : <AlertTriangle className="w-12 h-12 text-amber-500" />}
              <h3 className="font-bold text-slate-900 mt-3">Import completed</h3>
              <p className="text-xs text-slate-500 mt-1">
                {result.created} created; {result.updated} updated; {result.skippedInvalid} invalid skipped; {result.failed} failed.
              </p>
              {result.failed > 0 && preview && (
                <button onClick={() => void apiDownload(`/imports/${preview.batchId}/errors`)} className="mt-2 text-xs font-bold text-rose-700 underline">
                  Download error report
                </button>
              )}
              <button onClick={() => { setResult(null); setPreview(null); setFile(null); setSourceHeaders([]); setColumnMapping({}); }} className="mt-4 px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold">
                Start another import
              </button>
            </div>
          )}
          {busy && !preview && <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto mt-20" />}
        </div>
      </div>
    </div>
  );
};
