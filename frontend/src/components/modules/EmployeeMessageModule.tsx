import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../services/db';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Search, Send, MessageSquare } from 'lucide-react';

export const EmployeeMessageModule: React.FC<{onRefresh:()=>void}> = ({onRefresh})=>{
  const [search,setSearch]=useState(''); const [deb,setDeb]=useState(''); const [page,setPage]=useState(1);
  const [open,setOpen]=useState(false); const [subject,setSubject]=useState(''); const [body,setBody]=useState(''); const [selected,setSelected]=useState<string[]>([]); const [saving,setSaving]=useState(false); const [filterEmp,setFilterEmp]=useState('all');
  useEffect(()=>{const t=setTimeout(()=>setDeb(search.trim()),300); return()=>clearTimeout(t)},[search]);
  const q=useQuery({queryKey:['emp-messages',db.getSelectedCompanyId(),deb,filterEmp,page], queryFn:()=>db.listEmployeeMessages({search:deb, employeeId:filterEmp, page, pageSize:15}), placeholderData:p=>p});
  const empQuery=useQuery({queryKey:['emp-list-msg',db.getSelectedCompanyId()], queryFn:()=>db.listEmployees({page:1,pageSize:200})});
  const employees=empQuery.data?.items||[];
  const items=q.data?.items||[];
  const send=async(e:React.FormEvent)=>{
    e.preventDefault(); if(!body.trim()||selected.length===0) return alert('Select employee & message');
    setSaving(true);
    try{
      const cid=db.getSelectedCompanyId()!=='all'?db.getSelectedCompanyId():employees.find(x=>x.id===selected[0])?.companyId||'';
      if(selected.length===1) await db.sendEmployeeMessage({companyId:cid, employeeId:selected[0], subject, messageBody:body});
      else await db.sendEmployeeMessage({companyId:cid, employeeId:selected[0], employeeIds:selected, subject, messageBody:body});
      setOpen(false); setBody(''); setSubject(''); setSelected([]); await q.refetch(); onRefresh();
    }catch(err){alert(err instanceof Error?err.message:'Failed')}finally{setSaving(false)}
  };
  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center"><div><h1 className="text-xl font-bold flex gap-2 items-center"><MessageSquare className="w-5 h-5 text-blue-600"/> Employee Message</h1><p className="text-xs text-slate-500">Send & track messages to employees</p></div><button onClick={()=>setOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex gap-1 items-center"><Send className="w-4 h-4"/>Send Message</button></div>
      <div className="bg-white p-3 rounded-2xl border flex gap-2"><div className="flex-1 flex items-center gap-2 bg-slate-50 border rounded-xl px-3"><Search className="w-4 h-4 text-slate-400"/><input value={search} onChange={e=>{setSearch(e.target.value); setPage(1)}} placeholder="Search message, employee..." className="flex-1 bg-transparent py-2 text-sm outline-none"/></div><select value={filterEmp} onChange={e=>{setFilterEmp(e.target.value); setPage(1)}} className="border rounded-xl px-3 text-xs"><option value="all">All Employees</option>{employees.map(emp=><option key={emp.id} value={emp.id}>{emp.fullName}</option>)}</select>{q.isFetching&&<LoadingSpinner/>}</div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Employee</th><th className="px-4 py-3 text-left">Subject</th><th className="px-4 py-3 text-left">Message</th><th className="px-4 py-3">Sender</th><th className="px-4 py-3">Date</th></tr></thead><tbody>
        {items.map(m=><tr key={m.id} className="border-t"><td className="px-4 py-2 font-semibold">{m.employeeName}</td><td className="px-4 py-2 text-xs">{m.subject||'-'}</td><td className="px-4 py-2 text-xs max-w-xs truncate">{m.messageBody}</td><td className="px-4 py-2 text-xs">{m.senderName}</td><td className="px-4 py-2 text-xs">{new Date(m.createdAt).toLocaleString()}</td></tr>)}
        {items.length===0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">No messages yet</td></tr>}</tbody></table>
        <div className="flex justify-between p-3 border-t"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded-lg text-xs disabled:opacity-40">Prev</button><span className="text-xs">Page {page}/{q.data?.totalPages||1} · {q.data?.total||0} total</span><button disabled={page>=(q.data?.totalPages||1)} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded-lg text-xs disabled:opacity-40">Next</button></div>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={send} className="bg-white rounded-2xl w-full max-w-xl p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg">Send Message</h2>
            <div className="border rounded-xl p-3 max-h-40 overflow-y-auto space-y-1"><div className="text-xs font-bold mb-1">Select Employees (multi-select)</div>{employees.map(emp=><label key={emp.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(emp.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,emp.id]:prev.filter(x=>x!==emp.id))}/>{emp.fullName} <span className="text-xs text-slate-400">{emp.employeeCode}</span></label>)}</div>
            <label className="text-xs block">Subject<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Optional subject" className="w-full border rounded-xl px-3 py-2 mt-1"/></label>
            <label className="text-xs block">Message<textarea value={body} onChange={e=>setBody(e.target.value)} required rows={4} placeholder="Write your message..." className="w-full border rounded-xl px-3 py-2 mt-1"/></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={()=>setOpen(false)} className="px-4 py-2 border rounded-xl text-sm">Cancel</button><button disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex gap-2 items-center">{saving&&<LoadingSpinner size={14}/>}Send</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
