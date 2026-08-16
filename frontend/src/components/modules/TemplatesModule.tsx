import React, { useState } from 'react';
import { Plus, Edit, X, Code, Eye, Send, Loader2 } from 'lucide-react';
import { db } from '../../services/db';
import { apiRequest } from '../../services/api';
import { NotificationTemplate } from '../../types';

interface TemplatesModuleProps {
  onRefresh: () => void;
}

export const TemplatesModule: React.FC<TemplatesModuleProps> = ({ onRefresh }) => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>(db.getTemplates());
  const [editingTemplate, setEditingTemplate] = useState<Partial<NotificationTemplate> | null>(null);
  const [testingTemplate, setTestingTemplate] = useState<NotificationTemplate | null>(null);
  const [preview, setPreview] = useState<{ subject: string; message: string } | null>(null);
  const [recipientName, setRecipientName] = useState('ERP Test Recipient');
  const [recipientContact, setRecipientContact] = useState('');
  const [testCompanyId, setTestCompanyId] = useState(db.getCompanies()[0]?.id || '');
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState('');
  const canManage = db.hasPermission('templates.manage');
  const canTest = canManage && db.hasPermission('notifications.manage');

  const handleOpenEdit = (tpl: NotificationTemplate) => {
    setEditingTemplate({ ...tpl });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name) return;
    await db.saveTemplate(editingTemplate);
    setTemplates(db.getTemplates());
    setEditingTemplate(null);
    onRefresh();
  };

  const handleOpenPreview = async (template: NotificationTemplate) => {
    setTestingTemplate(template);
    setPreview(null);
    setTestResult('');
    setRecipientContact('');
    setTestCompanyId(template.companyId || db.getCompanies()[0]?.id || '');
    try {
      const response = await apiRequest<{ data: { subject: string; message: string } }>(
        `/templates/${template.id}/preview`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setPreview(response.data);
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : 'Unable to preview template.');
    }
  };

  const handleSendTest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!testingTemplate || !testCompanyId || !recipientContact) return;
    setTestBusy(true);
    setTestResult('');
    try {
      await apiRequest(`/templates/${testingTemplate.id}/test`, {
        method: 'POST',
        body: JSON.stringify({
          companyId: Number(testCompanyId),
          recipientName,
          recipientContact,
        }),
      });
      setTestResult('Test notification queued. Track its result in Notification History.');
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : 'Unable to queue test notification.');
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notification Message Templates</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure multi-channel text patterns with dynamic placeholders for Email, SMS, and WhatsApp alerts.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setEditingTemplate({
              name: '',
              channel: 'email',
              language: 'en',
              emailSubject: '',
              messageBody: '',
              body: '',
              active: true,
            })}
            className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold"
          >
            <Plus className="w-4 h-4" /> Add Template
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => (
          <div key={tpl.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                    {tpl.channel} • {tpl.language.toUpperCase()}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{tpl.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => void handleOpenPreview(tpl)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    aria-label={`Preview ${tpl.name}`}
                    title="Preview and test"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canManage && (
                    <button
                      onClick={() => handleOpenEdit(tpl)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                      aria-label={`Edit ${tpl.name}`}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {tpl.emailSubject && (
                <div className="mt-2 text-xs font-semibold text-slate-800">
                  Subject: <span className="text-slate-600 font-normal">{tpl.emailSubject}</span>
                </div>
              )}

              <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {tpl.messageBody}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
              <Code className="w-3.5 h-3.5 text-slate-400" />
              <span>Variables: {'{EmployeeName}, {EmployeeCode}, {CompanyName}, {DocumentType}, {DocumentNumber}, {ExpiryDate}, {DaysRemaining}, {VehicleNumber}, {HRName}, {ContactNumber}'}</span>
            </div>
          </div>
        ))}
      </div>

      {editingTemplate && canManage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">{editingTemplate.id ? 'Edit Template' : 'Create Template'}</h3>
              <button onClick={() => setEditingTemplate(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  value={editingTemplate.name || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="font-semibold text-slate-700 block mb-1">Channel *</span>
                  <select
                    required
                    value={editingTemplate.channel || 'email'}
                    onChange={event => setEditingTemplate({
                      ...editingTemplate,
                      channel: event.target.value as NotificationTemplate['channel'],
                    })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>
                <label>
                  <span className="font-semibold text-slate-700 block mb-1">Language *</span>
                  <select
                    required
                    value={editingTemplate.language || 'en'}
                    onChange={event => setEditingTemplate({
                      ...editingTemplate,
                      language: event.target.value as NotificationTemplate['language'],
                    })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="font-semibold text-slate-700 block mb-1">Company scope</span>
                  <select
                    value={editingTemplate.companyId || ''}
                    onChange={event => setEditingTemplate({ ...editingTemplate, companyId: event.target.value || undefined })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <option value="">All companies</option>
                    {db.getCompanies().map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="font-semibold text-slate-700 block mb-1">Document type</span>
                  <select
                    value={editingTemplate.documentTypeId || ''}
                    onChange={event => setEditingTemplate({ ...editingTemplate, documentTypeId: event.target.value || undefined })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <option value="">All document types</option>
                    {db.getDocumentTypes().map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </label>
              </div>

              {editingTemplate.channel === 'email' && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email Subject Line</label>
                  <input
                    type="text"
                    value={editingTemplate.emailSubject || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, emailSubject: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Message Body *</label>
                <textarea
                  rows={4}
                  required
                  value={editingTemplate.messageBody || editingTemplate.body || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, messageBody: e.target.value, body: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-mono"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl text-amber-900 text-[11px]">
                Available placeholders: <code>{'{EmployeeName}'}</code>, <code>{'{EmployeeCode}'}</code>, <code>{'{CompanyName}'}</code>, <code>{'{DocumentType}'}</code>, <code>{'{DocumentNumber}'}</code>, <code>{'{ExpiryDate}'}</code>, <code>{'{DaysRemaining}'}</code>, <code>{'{VehicleNumber}'}</code>, <code>{'{HRName}'}</code>, <code>{'{ContactNumber}'}</code>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="font-semibold text-slate-700">Template active</span>
                <input
                  type="checkbox"
                  checked={editingTemplate.active !== false}
                  onChange={event => setEditingTemplate({ ...editingTemplate, active: event.target.checked })}
                  className="h-4 w-4 accent-amber-500"
                />
              </label>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 text-slate-700 font-semibold hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {testingTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Template Preview</h3>
                <p className="text-[11px] text-slate-500">{testingTemplate.name} · {testingTemplate.channel.toUpperCase()}</p>
              </div>
              <button onClick={() => setTestingTemplate(null)} aria-label="Close preview">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              {!preview && !testResult && (
                <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Rendering preview…
                </div>
              )}
              {preview && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  {preview.subject && (
                    <p><b>Subject:</b> {preview.subject}</p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{preview.message}</p>
                </div>
              )}
              {canTest && (
                <form onSubmit={handleSendTest} className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="font-bold text-slate-800">Send a real test through the configured provider</div>
                  <select required value={testCompanyId} onChange={event => setTestCompanyId(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2">
                    <option value="">Select company</option>
                    {db.getCompanies()
                      .filter(company => !testingTemplate.companyId || company.id === testingTemplate.companyId)
                      .map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                  <input required value={recipientName} onChange={event => setRecipientName(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" placeholder="Recipient name" />
                  <input
                    required
                    type={testingTemplate.channel === 'email' ? 'email' : 'tel'}
                    value={recipientContact}
                    onChange={event => setRecipientContact(event.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    placeholder={testingTemplate.channel === 'email' ? 'recipient@example.com' : '+974 5000 0000'}
                  />
                  <button disabled={testBusy} className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl px-4 py-2.5 font-bold disabled:opacity-50">
                    {testBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {testBusy ? 'Queueing…' : 'Queue Test Notification'}
                  </button>
                </form>
              )}
              {testResult && (
                <p className={`rounded-xl p-3 ${testResult.startsWith('Test notification') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {testResult}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
