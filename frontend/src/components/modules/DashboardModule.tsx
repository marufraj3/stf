import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, FileText, Car, AlertTriangle, Clock, XCircle, Send, CreditCard, MessageSquare, History } from 'lucide-react';
import { db } from '../../services/db';
import { ExpiryAlertBox } from '../common/ExpiryAlertBox';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { NavTab } from '../layout/Sidebar';

export const DashboardModule: React.FC<{ onNavigate:(tab:NavTab, filter?:string)=>void }> = ({ onNavigate })=>{
  const docTypes=db.getDocumentTypes();
  const q=useQuery({queryKey:['dashboard',db.getSelectedCompanyId()], queryFn:()=>db.dashboardSummary({})});
  const stats=q.data?.stats || db.getKPIStats();
  const history=(q.data as any)?.todayHistory || [];

  const GridBox:React.FC<{label:string; value:string|number; sub:string; icon:any; onClick:()=>void; color?:string}> = ({label,value,sub,icon:Icon,onClick,color})=>(
    <button onClick={onClick} className={`p-4 rounded-2xl border text-left hover:-translate-y-0.5 transition-all ${color||'bg-white border-slate-200'}`}>
      <div className="flex justify-between items-center"><span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span><Icon className="w-4 h-4 text-slate-500"/></div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div><div className="text-xs text-slate-500">{sub}</div>
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center">
        <div><h1 className="text-xl font-bold">Dashboard</h1><p className="text-xs text-slate-500">Clean & fast overview</p></div>
        {q.isFetching && <LoadingSpinner label="Loading"/>}
      </div>

      <ExpiryAlertBox alerts={q.data?.documentTypeAlerts} isLoading={q.isLoading} onSelect={(code,status)=>{ const t=docTypes.find(x=>x.code===code); onNavigate('documents',status)}}/>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <GridBox label="All Staff Details" value={stats.totalEmployees} sub={`${stats.activeEmployees} active`} icon={Users} onClick={()=>onNavigate('employees')}/>
        <GridBox label="All Vehicles Details" value={stats.totalVehicles} sub="Fleet directory" icon={Car} onClick={()=>onNavigate('vehicles')}/>
        <GridBox label="All Expire Details" value={stats.expiredDocuments} sub="Click to see expired" icon={XCircle} onClick={()=>onNavigate('documents','expired')} color="bg-rose-50 border-rose-200"/>
        <GridBox label="All Bank Card Document" value={(stats as any).totalBankDocuments ?? 0} sub={`${(stats as any).expiredBankCards ?? 0} expired cards`} icon={CreditCard} onClick={()=>onNavigate('bank-docs' as any)}/>
        <GridBox label="Today Messages" value={(stats as any).todayMessages ?? 0} sub={`${(stats as any).todayDistinctMessagedEmployees ?? 0} employees messaged today`} icon={MessageSquare} onClick={()=>onNavigate('emp-messages' as any)} color="bg-blue-50 border-blue-200"/>
        <div className="p-4 rounded-2xl border bg-amber-50 border-amber-200">
          <div className="flex justify-between"><span className="text-[11px] font-bold uppercase">Document Expiry Notifications</span><AlertTriangle className="w-4 h-4 text-amber-600"/></div>
          <div className="mt-2 text-sm"><div>QID expiring: {stats.expiringQid} / expired: {stats.expiredQid}</div><div>Passport: {stats.expiringPassport}/{stats.expiredPassport}</div><div>Istimara: {stats.expiringIstimara}/{stats.expiredIstimara}</div></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2 font-bold text-sm"><History className="w-4 h-4"/> Today All History</div>
        {history.length===0 ? <div className="p-6 text-center text-xs text-slate-400">No activity today</div> :
          <div className="divide-y text-xs">{history.map((h:any)=><div key={h.id} className="px-4 py-2 flex justify-between"><span><b>{h.userName}</b> {h.action} <span className="text-slate-500">({h.module})</span></span><span className="text-slate-400">{new Date(h.timestamp).toLocaleTimeString()}</span></div>)}</div>
        }
      </div>
    </div>
  )
}
