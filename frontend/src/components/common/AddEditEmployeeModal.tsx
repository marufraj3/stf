import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Check,
  User,
  FileText,
  Shield,
  AlertCircle,
  Eye,
  Trash2,
} from 'lucide-react';
import { Employee, Company, Department, Designation } from '../../types';
import { db } from '../../services/db';
import { SecureImage } from './SecureFile';
import { FilePreviewModal } from './FilePreviewModal';

interface AddEditEmployeeModalProps {
  employee: Partial<Employee> | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const AddEditEmployeeModal: React.FC<AddEditEmployeeModalProps> = ({
  employee,
  isOpen,
  onClose,
  onSaveSuccess,
}) => {
  const companies = db.getCompanies();
  const departments = db.getDepartments();
  const designations = db.getDesignations();

  const emptyForm = (): Partial<Employee> => {
    const selectedCompany = db.getSelectedCompanyId();
    const companyId = selectedCompany === 'all' ? companies[0]?.id || '' : selectedCompany;
    const departmentId = departments.find(department => department.companyId === companyId)?.id || '';
    const designationId = designations.find(designation =>
      designation.companyId === companyId && (!designation.departmentId || designation.departmentId === departmentId)
    )?.id || '';

    return {
    fullName: '',
    employeeCode: '',
    companyId,
    departmentId,
    designationId,
    nationality: '',
    dateOfBirth: '',
    gender: 'male',
    mobile: '',
    altMobile: '',
    email: '',
    qatarAddress: '',
    homeCountryAddress: '',
    emergencyContact: { name: '', relationship: '', phone: '' },
    joiningDate: new Date().toISOString().split('T')[0],
    basicSalary: 0,
    allowances: 0,
    status: 'active',
    qidNumber: '',
    qidExpiryDate: '',
    labourContractNumber: '',
    labourContractExpiryDate: '',
    passportNumber: '',
    passportExpiryDate: '',
    licenseNumber: '',
    licenseExpiryDate: '',
    healthCardNumber: '',
    healthCardExpiryDate: '',
    nocStatus: '',
    tradeSpecialization: '',
    salaryPaymentMode: '',
    previousCompanyName: '',
    bankWalletDetails: '',
    notes: '',
    uploadedDocuments: [],
    };
  };
  const [formData, setFormData] = useState<Partial<Employee>>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  // Uploaded files live behind the authenticated /api/files endpoint, so they
  // are streamed into a preview modal instead of being opened as a raw link
  // (which used to bounce the browser to the login page).
  const [preview, setPreview] = useState<{ source: string; title: string } | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    if (employee) {
      setFormData({
        ...employee,
        emergencyContact: employee.emergencyContact || { name: '', relationship: '', phone: '' },
        uploadedDocuments: employee.uploadedDocuments || [],
      });
    } else {
      setFormData(emptyForm());
    }
  }, [employee, isOpen]);

  if (!isOpen) return null;

// File Upload Helpers
const handleFileUpload = (
  e: React.ChangeEvent<HTMLInputElement>,
  type: 'profile' | 'passport' | 'license' | 'qid' | 'labour' | 'health'
) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const allowed =
    type === 'profile'
      ? ['image/jpeg', 'image/png']
      : ['application/pdf', 'image/jpeg', 'image/png'];

  if (!allowed.includes(file.type)) {
    alert(
      type === 'profile'
        ? 'Profile photo must be JPG or PNG.'
        : 'Document must be PDF, JPG or PNG.'
    );
    e.target.value = '';
    return;
  }

  if (file.size > db.getSettings().defaultFileMaxSizeMb * 1024 * 1024) {
    alert(
      `File must not exceed ${db.getSettings().defaultFileMaxSizeMb} MB.`
    );
    e.target.value = '';
    return;
  }

  const reader = new FileReader();

  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;

    if (type === 'profile') {
      setFormData(prev => ({
        ...prev,
        profilePhoto: dataUrl,
        profilePhotoFileName: file.name,
        removeProfilePhoto: false,
      }));
    } else if (type === 'passport') {
      const docItem = {
        id: `doc-pass-${Date.now()}`,
        type: 'Passport',
        name: file.name,
        fileUrl: dataUrl,
        docNumber: formData.passportNumber,
        expiryDate: formData.passportExpiryDate,
      };

      setFormData(prev => ({
        ...prev,
        passportFileUrl: dataUrl,
        uploadedDocuments: [
          ...(prev.uploadedDocuments || []).filter(
            document => document.type !== 'Passport'
          ),
          docItem,
        ],
      }));
    } else if (type === 'license') {
      const docItem = {
        id: `doc-lic-${Date.now()}`,
        type: 'License',
        name: file.name,
        fileUrl: dataUrl,
        docNumber: formData.licenseNumber,
        expiryDate: formData.licenseExpiryDate,
      };

      setFormData(prev => ({
        ...prev,
        licenseFileUrl: dataUrl,
        uploadedDocuments: [
          ...(prev.uploadedDocuments || []).filter(
            document =>
              document.type !== 'License' &&
              document.type !== 'Driving License'
          ),
          docItem,
        ],
      }));
    } else if (type === 'qid') {
      const docItem = {
        id: `doc-qid-${Date.now()}`,
        type: 'QID',
        name: file.name,
        fileUrl: dataUrl,
        docNumber: formData.qidNumber,
        expiryDate: formData.qidExpiryDate,
      };

      setFormData(prev => ({
        ...prev,
        qidFileUrl: dataUrl,
        uploadedDocuments: [
          ...(prev.uploadedDocuments || []).filter(
            document => document.type !== 'QID'
          ),
          docItem,
        ],
      }));
    } else if (type === 'labour') {
      const docItem = {
        id: `doc-labour-${Date.now()}`,
        type: 'Labour Contract',
        name: file.name,
        fileUrl: dataUrl,
        expiryDate: formData.labourContractExpiryDate,
      };

      setFormData(prev => ({
        ...prev,
        labourContractFileUrl: dataUrl,
        uploadedDocuments: [
          ...(prev.uploadedDocuments || []).filter(
            document => document.type !== 'Labour Contract'
          ),
          docItem,
        ],
      }));
    } else if (type === 'health') {
      const docItem = {
        id: `doc-health-${Date.now()}`,
        type: 'Health Card',
        name: file.name,
        fileUrl: dataUrl,
        docNumber: formData.healthCardNumber,
        expiryDate: formData.healthCardExpiryDate,
      };

      setFormData(prev => ({
        ...prev,
        healthCardFileUrl: dataUrl,
        uploadedDocuments: [
          ...(prev.uploadedDocuments || []).filter(
            document => document.type !== 'Health Card'
          ),
          docItem,
        ],
      }));
    }
  };

  reader.readAsDataURL(file);
};


// Delete existing profile photo
const removeProfilePhoto = () => {
  if (!window.confirm('Are you sure you want to delete this profile photo?')) {
    return;
  }

  setFormData(prev => ({
    ...prev,
    profilePhoto: '',
    profilePhotoFileName: '',
    removeProfilePhoto: true,
  }));
};


// Delete Passport, License or QID
const removeIdentityDocument = async (
  code: 'passport' | 'driving-license' | 'qid' | 'labour-contract' | 'health-card',
  field: 'passportFileUrl' | 'licenseFileUrl' | 'qidFileUrl' | 'labourContractFileUrl' | 'healthCardFileUrl'
) => {
  if (!window.confirm('Are you sure you want to delete this document?')) {
    return;
  }

  const displayType =
    code === 'passport'
      ? 'Passport'
      : code === 'driving-license'
        ? 'License'
        : code === 'labour-contract'
          ? 'Labour Contract'
          : code === 'health-card'
            ? 'Health Card'
            : 'QID';

  try {
    // Previously saved document খুঁজবে
    const existingDocument = (formData.documents || []).find(
      document => document.documentTypeCode === code
    );

    // Database-এ saved থাকলে archive করবে
    if (existingDocument?.id) {
      await db.archiveDocument(existingDocument.id);
    }

    // Form থেকে file সরাবে
    setFormData(prev => ({
      ...prev,
      [field]: '',
      documents: (prev.documents || []).filter(
        document => document.documentTypeCode !== code
      ),
      uploadedDocuments: (prev.uploadedDocuments || []).filter(document => {
        if (displayType === 'License') {
          return (
            document.type !== 'License' &&
            document.type !== 'Driving License'
          );
        }

        return document.type !== displayType;
      }),
    }));
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : 'Unable to delete the document.'
    );
  }
};


const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (isSaving) return;

  if (!formData.fullName) {
    alert('Please fill in employee full name.');
    return;
  }

  setIsSaving(true);

  //
    // Auto update designation / department names
    const dept = departments.find(d => d.id === formData.departmentId);
    const desig = designations.find(d => d.id === formData.designationId);
    
    const employeeToSave = {
      ...formData,
      departmentName: dept?.name || '',
      designationName: desig?.name || '',
    };

    try {
      const savedEmp = await db.saveEmployee(employeeToSave);
      const existingDocs = await db.documentsByOwner('employee', savedEmp.id);
      const documentTypes = db.getDocumentTypes();

      const saveIdentityDocument = async (
        code: string,
        documentNumber?: string,
        expiryDate?: string,
        fileUrl?: string,
        fileName?: string,
      ) => {
        if (!documentNumber && !expiryDate && !fileUrl) return;
        const type = documentTypes.find(item => item.code === code);
        if (!type) throw new Error(`Required document type "${code}" is not configured.`);
        const existing = existingDocs.find(item => item.documentTypeId === type.id);
        await db.saveDocument({
          ...(existing || {}),
          companyId: savedEmp.companyId,
          ownerType: 'employee',
          ownerId: savedEmp.id,
          documentTypeId: type.id,
          documentNumber: documentNumber || existing?.documentNumber || '',
          expiryDate: expiryDate || existing?.expiryDate || '',
          fileUrl,
          fileName,
          reminderEnabled: true,
        });
      };

      const uploaded = formData.uploadedDocuments || [];
      await saveIdentityDocument('passport', formData.passportNumber, formData.passportExpiryDate, formData.passportFileUrl, uploaded.find(item => item.type === 'Passport')?.name);
      await saveIdentityDocument('driving-license', formData.licenseNumber, formData.licenseExpiryDate, formData.licenseFileUrl, uploaded.find(item => item.type === 'License')?.name);
      await saveIdentityDocument('qid', formData.qidNumber, formData.qidExpiryDate, formData.qidFileUrl, uploaded.find(item => item.type === 'QID')?.name);
      await saveIdentityDocument('labour-contract', formData.labourContractNumber, formData.labourContractExpiryDate, formData.labourContractFileUrl, uploaded.find(item => item.type === 'Labour Contract')?.name);
      await saveIdentityDocument('health-card', formData.healthCardNumber, formData.healthCardExpiryDate, formData.healthCardFileUrl, uploaded.find(item => item.type === 'Health Card')?.name);

      onSaveSuccess();
      onClose();
    } catch (error) {
  alert(error instanceof Error ? error.message : 'Unable to save employee.');
} finally {
  setIsSaving(false);
}
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95">
        
        {/* Modal Header matching Screenshot 3 */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            {formData.id ? 'Edit Employee' : 'Add Employee'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body matching Screenshot 3 layout */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 text-xs sm:text-sm">
          
          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h3 className="font-bold text-purple-600 text-sm sm:text-base border-b border-purple-100 pb-2">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employee ID *</label>
                <input
                  type="text"
                  required
                  value={formData.employeeCode || ''}
                  onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                  placeholder="e.g. 11"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName || ''}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Employee full name"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mobile *</label>
                <input
                  type="text"
                  required
                  value={formData.mobile || ''}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="e.g. 01625326736"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Alternative Contact Number</label>
                <input
                  type="text"
                  value={formData.altMobile || ''}
                  onChange={(e) => setFormData({ ...formData, altMobile: e.target.value })}
                  placeholder="Optional contact"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="maruf@company.qa"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nationality</label>
                <input
                  type="text"
                  value={formData.nationality || ''}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  placeholder="Bangladeshi"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Department</label>
                <select
                  value={formData.departmentId || ''}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value, designationId: '' })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                >
                  <option value="">No department</option>
                  {departments
                    .filter(department => department.companyId === formData.companyId)
                    .map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Gender</label>
                <select
                  value={formData.gender || 'male'}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
  <label className="font-semibold text-slate-700 block mb-1">
    Profile Photo (JPG/PNG)
  </label>

  {formData.profilePhoto && (
    <div className="mb-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
      <SecureImage
        source={formData.profilePhoto}
        alt="Current profile"
        className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
      />

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-emerald-700">Current photo available</p>

        <div className="mt-1 flex gap-2">
          <button
          type="button"
          onClick={() => setPreview({ source: formData.profilePhoto as string, title: 'Profile photo' })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>

          <button
            type="button"
            onClick={removeProfilePhoto}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  )}

  <input
    type="file"
    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
    onChange={(e) => handleFileUpload(e, 'profile')}
    className="w-full border border-slate-300 rounded-xl p-1 text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
  />
</div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Status</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                >
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Company</label>
                <select
                  value={formData.companyId || ''}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value, departmentId: '', designationId: '' })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                >
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Identification & Documents */}
          <div className="space-y-4">
            <h3 className="font-bold text-purple-600 text-sm sm:text-base border-b border-purple-100 pb-2">
              Identification &amp; Documents
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">QID Number</label>
                <input
                  type="text"
                  value={formData.qidNumber || ''}
                  onChange={(e) => setFormData({ ...formData, qidNumber: e.target.value })}
                  placeholder="e.g. 29650019283"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">QID Expiry Date</label>
                <input
                  type="date"
                  value={formData.qidExpiryDate || ''}
                  onChange={(e) => setFormData({ ...formData, qidExpiryDate: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Passport Number</label>
                <input
                  type="text"
                  value={formData.passportNumber || ''}
                  onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                  placeholder="e.g. A08291029"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Passport Expiry</label>
                <input
                  type="date"
                  value={formData.passportExpiryDate || ''}
                  onChange={(e) => setFormData({ ...formData, passportExpiryDate: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">License Number</label>
                <input
                  type="text"
                  value={formData.licenseNumber || ''}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  placeholder="e.g. DL-882910"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">License Expiry</label>
                <input
                  type="date"
                  value={formData.licenseExpiryDate || ''}
                  onChange={(e) => setFormData({ ...formData, licenseExpiryDate: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
  <label className="font-semibold text-slate-700 block mb-1">
    Passport PDF / Scan
  </label>

  {formData.passportFileUrl && (
    <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
      <p className="truncate text-xs font-semibold text-emerald-700">
        ✓ Current passport file available
      </p>

      <div className="mt-1 flex gap-3">
        <button
          type="button"
          onClick={() => setPreview({ source: formData.passportFileUrl as string, title: 'Passport' })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>

        <button
          type="button"
          onClick={() =>
            void removeIdentityDocument('passport', 'passportFileUrl')
          }
          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </div>
  )}

  <input
    type="file"
    accept="image/*,application/pdf"
    onChange={(e) => handleFileUpload(e, 'passport')}
    className="w-full border border-slate-300 rounded-xl p-1 text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
  />
</div>

              <div>
  <label className="font-semibold text-slate-700 block mb-1">
    License PDF / Scan
  </label>

  {formData.licenseFileUrl && (
    <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
      <p className="truncate text-xs font-semibold text-emerald-700">
        ✓ Current license file available
      </p>

      <div className="mt-1 flex gap-3">
        <button
          type="button"
          onClick={() => setPreview({ source: formData.licenseFileUrl as string, title: 'Driving licence' })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>

        <button
          type="button"
          onClick={() =>
            void removeIdentityDocument('driving-license', 'licenseFileUrl')
          }
          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </div>
  )}

  <input
    type="file"
    accept="image/*,application/pdf"
    onChange={(e) => handleFileUpload(e, 'license')}
    className="w-full border border-slate-300 rounded-xl p-1 text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
  />
</div>

              <div>
  <label className="font-semibold text-slate-700 block mb-1">
    QID PDF / Scan
  </label>

  {formData.qidFileUrl && (
    <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
      <p className="truncate text-xs font-semibold text-emerald-700">
        ✓ Current QID file available
      </p>

      <div className="mt-1 flex gap-3">
        <button
          type="button"
          onClick={() => setPreview({ source: formData.qidFileUrl as string, title: 'Qatar ID (QID)' })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>

        <button
          type="button"
          onClick={() => void removeIdentityDocument('qid', 'qidFileUrl')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </div>
  )}

  <input
    type="file"
    accept="image/*,application/pdf"
    onChange={(e) => handleFileUpload(e, 'qid')}
    className="w-full border border-slate-300 rounded-xl p-1 text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
  />
</div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Labour Contract Number</label>
                <input
                  type="text"
                  value={formData.labourContractNumber || ''}
                  onChange={(e) => setFormData({ ...formData, labourContractNumber: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Labour Contract Expiry</label>
                <input
                  type="date"
                  value={formData.labourContractExpiryDate || ''}
                  onChange={(e) => setFormData({ ...formData, labourContractExpiryDate: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Labour Contract PDF / Scan
                </label>

                {formData.labourContractFileUrl && (
                  <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
                    <p className="truncate text-xs font-semibold text-emerald-700">
                      ✓ Current Labour Contract available
                    </p>

                    <div className="mt-1 flex gap-3">
                      <button
          type="button"
          onClick={() => setPreview({ source: formData.labourContractFileUrl as string, title: 'Labour contract' })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>

                      <button
                        type="button"
                        onClick={() => void removeIdentityDocument('labour-contract', 'labourContractFileUrl')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileUpload(e, 'labour')}
                  className="w-full border border-slate-300 rounded-xl p-1 text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Health Card Number</label>
                <input
                  type="text"
                  value={formData.healthCardNumber || ''}
                  onChange={(e) => setFormData({ ...formData, healthCardNumber: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Health Card Expiry</label>
                <input
                  type="date"
                  value={formData.healthCardExpiryDate || ''}
                  onChange={(e) => setFormData({ ...formData, healthCardExpiryDate: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Health Card PDF / Scan
                </label>

                {formData.healthCardFileUrl && (
                  <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
                    <p className="truncate text-xs font-semibold text-emerald-700">
                      ✓ Current Health Card available
                    </p>

                    <div className="mt-1 flex gap-3">
                      <button
          type="button"
          onClick={() => setPreview({ source: formData.healthCardFileUrl as string, title: 'Health card' })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>

                      <button
                        type="button"
                        onClick={() => void removeIdentityDocument('health-card', 'healthCardFileUrl')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileUpload(e, 'health')}
                  className="w-full border border-slate-300 rounded-xl p-1 text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Employment & Emergency Contact */}
          <div className="space-y-4">
            <h3 className="font-bold text-purple-600 text-sm sm:text-base border-b border-purple-100 pb-2">
              Employment &amp; Emergency Contact
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Designation</label>
                <select
                  value={formData.designationId || ''}
                  onChange={(e) => setFormData({ ...formData, designationId: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                >
                  <option value="">No designation</option>
                  {designations
                    .filter(designation => designation.companyId === formData.companyId && (!designation.departmentId || designation.departmentId === formData.departmentId))
                    .map(designation => <option key={designation.id} value={designation.id}>{designation.name}</option>)}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Joining Date</label>
                <input
                  type="date"
                  value={formData.joiningDate || ''}
                  onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={formData.emergencyContact?.name || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    emergencyContact: {
                      ...(formData.emergencyContact || { relationship: 'Brother', phone: '' }),
                      name: e.target.value,
                    }
                  })}
                  placeholder="Contact person name"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Emergency Contact Mobile</label>
                <input
                  type="text"
                  value={formData.emergencyContact?.phone || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    emergencyContact: {
                      ...(formData.emergencyContact || { name: '', relationship: 'Brother' }),
                      phone: e.target.value,
                    }
                  })}
                  placeholder="Emergency mobile number"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Relationship</label>
                <input
                  type="text"
                  value={formData.emergencyContact?.relationship || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    emergencyContact: {
                      ...(formData.emergencyContact || { name: '', phone: '' }),
                      relationship: e.target.value,
                    }
                  })}
                  placeholder="e.g. Brother, Wife, Relative"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Qatar Address</label>
                <input
                  type="text"
                  value={formData.qatarAddress || ''}
                  onChange={(e) => setFormData({ ...formData, qatarAddress: e.target.value })}
                  placeholder="Building, Street, Zone, City"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Home Country Address</label>
                <input
                  type="text"
                  value={formData.homeCountryAddress || ''}
                  onChange={(e) => setFormData({ ...formData, homeCountryAddress: e.target.value })}
                  placeholder="Home address"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">NOC Status</label>
                <input
                  type="text"
                  value={formData.nocStatus || ''}
                  onChange={(e) => setFormData({ ...formData, nocStatus: e.target.value })}
                  placeholder="e.g. Approved NOC"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Trade / Specialization</label>
                <input
                  type="text"
                  value={formData.tradeSpecialization || ''}
                  onChange={(e) => setFormData({ ...formData, tradeSpecialization: e.target.value })}
                  placeholder="Limousine Driver"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Salary Payment Mode</label>
                <input
                  type="text"
                  value={formData.salaryPaymentMode || ''}
                  onChange={(e) => setFormData({ ...formData, salaryPaymentMode: e.target.value })}
                  placeholder="WPS Transfer / Bank"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Previous Company Name</label>
                <input
                  type="text"
                  value={formData.previousCompanyName || ''}
                  onChange={(e) => setFormData({ ...formData, previousCompanyName: e.target.value })}
                  placeholder="Previous employer"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bank / Wallet Details</label>
                <input
                  type="text"
                  value={formData.bankWalletDetails || ''}
                  onChange={(e) => setFormData({ ...formData, bankWalletDetails: e.target.value })}
                  placeholder="IBAN / Account Number"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="pt-6 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
  type="button"
  onClick={onClose}
  disabled={isSaving}
  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  Cancel
</button>
           <button
  type="submit"
  disabled={isSaving}
  className="min-w-[160px] px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
>
  {isSaving ? (
    <>
      <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
      Saving...
    </>
  ) : (
    <>
      <Check className="w-4 h-4" />
      Save Employee
    </>
  )}
</button>
          </div>

        </form>
      </div>

      <FilePreviewModal
        isOpen={Boolean(preview)}
        source={preview?.source}
        title={preview?.title || 'Document'}
        subtitle={formData.fullName}
        onClose={() => setPreview(null)}
      />
    </div>
  );
};