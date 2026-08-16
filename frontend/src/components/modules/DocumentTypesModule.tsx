import React, { useState } from 'react';
import { Settings2, Plus, Edit, Check, X, Shield, Bell } from 'lucide-react';
import { db } from '../../services/db';
import { DocumentType } from '../../types';

interface DocumentTypesModuleProps {
  onRefresh: () => void;
}

export const DocumentTypesModule: React.FC<DocumentTypesModuleProps> = ({ onRefresh }) => {
  const [docTypes, setDocTypes] = useState<DocumentType[]>(db.getDocumentTypes());
  const [isOpen, setIsOpen] = useState(false);
  const [editingType, setEditingType] = useState<Partial<DocumentType>>({
    name: '',
    code: '',
    ownerType: 'employee',
    docNumberRequired: true,
    issueDateRequired: true,
    expiryDateRequired: true,
    fileRequired: true,
    reminderEnabled: true,
    customReminderDays: [30, 15, 10, 7, 3, 1, 0],
    alertLeadDays: 30,
    defaultValidityMonths: 12,
  });

  const handleOpenAdd = () => {
    setEditingType({
      name: '',
      code: '',
      ownerType: 'employee',
      docNumberRequired: true,
      issueDateRequired: true,
      expiryDateRequired: true,
      fileRequired: true,
      reminderEnabled: true,
      customReminderDays: [30, 15, 10, 7, 3, 1, 0],
      alertLeadDays: 30,
      defaultValidityMonths: 12,
    });
    setIsOpen(true);
  };

  const handleOpenEdit = (dt: DocumentType) => {
    setEditingType({ ...dt });
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType.name) return;
    await db.saveDocumentType(editingType);
    setDocTypes(db.getDocumentTypes());
    setIsOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dynamic Document Types Configurator</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Define custom document schemas, reminder intervals, and validity periods without modifying source code.
          </p>
        </div>

        {db.hasPermission('document_types.manage') && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Document Type</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docTypes.map((dt) => (
          <div key={dt.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                    {dt.ownerType} doc
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{dt.name}</h3>
                </div>
                {db.hasPermission('document_types.manage') && (
                  <button
                    onClick={() => handleOpenEdit(dt)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Code Prefix:</span> <b className="font-mono text-slate-800">{dt.code}</b>
                </div>
                <div className="flex justify-between">
                  <span>Default Validity:</span> <b>{dt.defaultValidityMonths || 12} Months</b>
                </div>
                <div className="flex justify-between">
                  <span>Automated Reminders:</span> 
                  <span className={dt.reminderEnabled ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                    {dt.reminderEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Reminder Days:</span> 
                  <span className="font-mono text-[11px] font-medium text-slate-800">
                    {dt.customReminderDays.join(', ')} days
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Alert Lead Time:</span>
                  <span className="font-mono text-[11px] font-bold text-amber-700">
                    {dt.alertLeadDays ?? 30} days
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
              <span className={`w-2 h-2 rounded-full ${dt.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
              <span>{dt.active ? 'Active & In Use' : 'Inactive'}</span>
            </div>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingType.id ? 'Edit Document Type' : 'Add New Document Type'}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Document Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Civil Defense Clearance"
                  value={editingType.name || ''}
                  onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Type Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="CIVIL_DEFENSE"
                    value={editingType.code || ''}
                    onChange={(e) => setEditingType({ ...editingType, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Owner Category *</label>
                  <select
                    value={editingType.ownerType || 'employee'}
                    onChange={(e) => setEditingType({ ...editingType, ownerType: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  >
                    <option value="employee">Employee Staff</option>
                    <option value="vehicle">Vehicle Fleet</option>
                    <option value="company">Company License</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reminder Intervals (Days before expiry)</label>
                <input
                  type="text"
                  placeholder="30, 15, 10, 7, 3, 1, 0"
                  value={editingType.customReminderDays ? editingType.customReminderDays.join(', ') : ''}
                  onChange={(e) => {
                    const days = e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
                    setEditingType({ ...editingType, customReminderDays: days });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Dashboard Alert Lead Time (Days before expiry)
                </label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  placeholder="30"
                  value={editingType.alertLeadDays ?? 30}
                  onChange={(e) =>
                    setEditingType({ ...editingType, alertLeadDays: Number(e.target.value) || 30 })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  When the yellow warning appears on the dashboard. QID uses 15, Passport 90, Istimara 30.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-slate-700 font-semibold hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
