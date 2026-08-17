import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../services/db';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Search, Plus, Edit, Trash2, CreditCard } from 'lucide-react';
import { BankDocument } from '../../types';

export const BankDocumentsModule: React.FC<{ onRefresh:()=>void }> = ({ onRefresh }) => {
  const [search,setSearch]=useState(''); const [deb,setDeb]=useState('');
  const [page,setPage]=useState(1); const pageSize=10;
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<Partial<BankDocument>|null>(null);
  const [saving,setSaving]=useState(false); const [deletingId,setDeletingId]=useState<string|null>(null); const [fileData,setFileData]=useState<string>(''); const [fileName,setFileName]=useState('');
  useEffect(()=>{ const t=setTimeout(()=>setDeb(search.trim()),300); return()=>clearTimeout(t)},[search]);
  const q=useQuery({queryKey:['bank-docs',db.getSelectedCompanyId(),deb,page], queryFn:()=>db.listBankDocuments({search:deb,page,pageSize}), placeholderData:p=>p});
  const items=q.data?.items||[]; const totalPages=q.data?.totalPages||1;
  const companies=db.getCompanies(); const employeesCache=useQuery({queryKey:['emp-list-bank',db.getSelectedCompanyId()], queryFn:()=>db.listEmployees({page:1,pageSize:200}), enabled:open});
  const empList=employeesCache.data?.items||[];
  const openCreate=()=>{
    const cid=db.getSelectedCompanyId()!=='all'?db.getSelectedCompanyId():companies[0]?.id||'';
    setEditing({companyId:cid, accountPhoneOwner:'company'} as any); setFileData(''); setFileName(''); setOpen(true);
  };
  const openEdit=(b:BankDocument)=>{ setEditing({...b}); setFileData(''); setFileName(''); setOpen(true); };
  const handleSave=async(e:React.FormEvent)=>{
    e.preventDefault(); if(!editing?.employeeId) return alert('Select employee');
    setSaving(true);
    try{
      await db.saveBankDocument({...editing, bankDocument:fileData||undefined, bankDocumentFileName:fileName||undefined});
      setOpen(false); await q.refetch(); onRefresh();
    }catch(err){alert(err instanceof Error?err.message:'Save failed')} finally{setSaving(false)}
  };
  const handleDelete=async(b:BankDocument)=>{ setDeletingId(b.id); try{
    if(!confirm(`Delete bank document for ${b.employeeName}?`)) return;
    await db.deleteBankDocument(b.id); await q.refetch(); onRefresh(); } finally { setDeletingId(null); }
  };
  const onFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0]; if(!f) return; const d=await db.toDataUrl(f); setFileData(d); setFileName(f.name);
  };
  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center">
        <div><h1 className="text-xl font-bold flex gap-2 items-center"><CreditCard className="w-5 h-5 text-amber-500"/> All Bank Document</h1><p className="text-xs text-slate-500">Employee bank & card documents</p></div>
        <button onClick={openCreate} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex gap-1 items-center"><Plus className="w-4 h-4"/>Add Bank Document</button>
      </div>
      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3"><Search className="w-4 h-4 text-slate-400"/><input value={search} onChange={e=>{setSearch(e.target.value); setPage(1)}} placeholder="Search employee, IBAN, phone..." className="flex-1 bg-transparent py-2 text-sm outline-none"/></div>
        {q.isFetching && <LoadingSpinner label="Loading"/>}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Employee</th><th className="px-4 py-3">Account Phone</th><th className="px-4 py-3">Personal Phone</th><th className="px-4 py-3">IBAN</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Doc</th><th className="px-4 py-3">Actions</th></tr></thead>
          <tbody>{items.map(b=>(
            <tr key={b.id} className="border-t border-slate-100">
              <td className="px-4 py-2"><div className="font-semibold">{b.employeeName}</div><div className="text-xs text-slate-500">{b.employeeCode} • {b.nationality}</div></td>
              <td className="px-4 py-2"><span className="font-mono text-xs">{b.accountPhoneNumber||'-'}</span> <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${b.accountPhoneOwner==='company'?'bg-emerald-500 text-white':'bg-orange-500 text-white'}`}>{b.accountPhoneOwner==='company'?'Company':'Employee'}</span></td>
              <td className="px-4 py-2 font-mono text-xs">{b.personalPhoneNumber||'-'}</td>
              <td className="px-4 py-2 font-mono text-xs">{b.ibanNumber||'-'}</td>
              <td className="px-4 py-2 text-xs">{b.bankCardExpiryDate||'-'}</td>
              <td className="px-4 py-2">{b.bankDocumentUrl?<a href={b.bankDocumentUrl} target="_blank" className="text-blue-600 underline text-xs">View</a>:'-'}</td>
              <td className="px-4 py-2 flex gap-1"><button onClick={()=>openEdit(b)} className="p-1.5 bg-slate-100 rounded-lg"><Edit className="w-3.5 h-3.5"/></button><button onClick={()=>handleDelete(b)} className="p-1.5 bg-rose-50 rounded-lg">{deletingId===b.id?<LoadingSpinner size={12}/>:<Trash2 className="w-3.5 h-3.5 text-rose-600"/>}</button></td>
            </tr>
          ))}{items.length===0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No bank documents</td></tr>}</tbody></table>
        </div>
        <div className="flex justify-between p-3 border-t"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded-lg text-xs disabled:opacity-40">Prev</button><span className="text-xs">Page {page} / {totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded-lg text-xs disabled:opacity-40">Next</button></div>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-3">
            <h2 className="font-bold text-lg">{(editing as any)?.id?'Edit':'Add'} Bank Document</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">Company<select value={(editing as any)?.companyId||''} onChange={e=>setEditing({...editing, companyId:e.target.value} as any)} className="w-full border rounded-xl px-3 py-2 mt-1">{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="text-xs">Employee<select value={(editing as any)?.employeeId||''} onChange={e=>{const emp=empList.find(x=>x.id===e.target.value); setEditing({...editing, employeeId:e.target.value, employeeName:emp?.fullName, nationality:emp?.nationality} as any)}} className="w-full border rounded-xl px-3 py-2 mt-1"><option value="">Select</option>{empList.map(emp=><option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeCode})</option>)}</select></label>
              <label className="text-xs">Account Phone<input value={(editing as any)?.accountPhoneNumber||''} onChange={e=>setEditing({...editing, accountPhoneNumber:e.target.value} as any)} className="w-full border rounded-xl px-3 py-2 mt-1"/></label>
              <label className="text-xs">Ownership<select value={(editing as any)?.accountPhoneOwner||'company'} onChange={e=>setEditing({...editing, accountPhoneOwner:e.target.value} as any)} className="w-full border rounded-xl px-3 py-2 mt-1"><option value="company">Company (Green)</option><option value="employee">Employee (Orange)</option></select></label>
              <label className="text-xs">Personal Phone<input value={(editing as any)?.personalPhoneNumber||''} onChange={e=>setEditing({...editing, personalPhoneNumber:e.target.value} as any)} className="w-full border rounded-xl px-3 py-2 mt-1"/></label>
              <label className="text-xs">Nationality<input value={(editing as any)?.nationality||''} onChange={e=>setEditing({...editing, nationality:e.target.value} as any)} className="w-full border rounded-xl px-3 py-2 mt-1"/></label>
              <label className="text-xs">IBAN<input value={(editing as any)?.ibanNumber||''} onChange={e=>setEditing({...editing, ibanNumber:e.target.value} as any)} className="w-full border rounded-xl px-3 py-2 mt-1"/></label>
              <label className="text-xs">Card Expiry<input type="date" value={(editing as any)?.bankCardExpiryDate||''} onChange={e=>setEditing({...editing, bankCardExpiryDate:e.target.value} as any)} className="w-full border rounded-xl px-3 py-2 mt-1"/></label>
            </div>
            <label className="text-xs block">Bank Document Upload<input type="file" accept=".pdf,.jpg,.png" onChange={onFile} className="w-full border rounded-xl px-3 py-2 mt-1"/>{fileName && <span className="text-emerald-600">{fileName} selected</span>}</label>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={()=>setOpen(false)} className="px-4 py-2 border rounded-xl text-sm">Cancel</button><button disabled={saving} className="px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold flex gap-2 items-center">{saving&&<LoadingSpinner size={14}/> }Save</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
