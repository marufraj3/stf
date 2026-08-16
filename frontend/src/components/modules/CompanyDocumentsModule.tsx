import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building, RefreshCw, FileText, Download, ShieldCheck, Check } from 'lucide-react';
import { db } from '../../services/db';
import { DocumentRecord } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface CompanyDocumentsModuleProps {
  onOpenRenewModal: (doc: DocumentRecord) => void;
  onRefresh: () => void;
}

export const CompanyDocumentsModule: React.FC<CompanyDocumentsModuleProps> = ({ 
  onOpenRenewModal, 
  onRefresh 
}) => {
  const companies = db.getCompanies();
  const documentsQuery = useQuery({
    queryKey: ['company-documents', db.getSelectedCompanyId()],
    queryFn: () => db.listDocuments({
      ownerType: 'company',
      page: 1,
      pageSize: 100,
      sortBy: 'expiry_date',
      direction: 'asc',
    }),
  });
  const documents = documentsQuery.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Company Commercial Licenses Hub</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Centralized governance for Commercial Registration (CR), Computer Card, Trade License, and Civil Defense approvals.
        </p>
      </div>

      <div className="space-y-6">
        {documentsQuery.isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            Loading company licenses…
          </div>
        )}
        {documentsQuery.isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-xs text-rose-700">
            {documentsQuery.error instanceof Error ? documentsQuery.error.message : 'Unable to load company licenses.'}
          </div>
        )}
        {companies.map((company) => {
          const companyDocs = documents.filter(document => document.ownerId === company.id);

          return (
            <div key={company.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">{company.name}</h2>
                  <p className="text-xs text-slate-500 font-mono">
                    CR #: {company.crNumber || 'N/A'} • Establishment Card: {company.computerCardNumber || 'N/A'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 self-start sm:self-auto">
                  Active Entity
                </span>
              </div>

              {companyDocs.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
                  No company commercial licenses uploaded yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {companyDocs.map((doc) => (
                    <div key={doc.id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900 text-xs">{doc.documentTypeName}</span>
                          <StatusBadge type="expiry" status={doc.status} daysRemaining={doc.daysRemaining} />
                        </div>
                        <div className="mt-2 font-mono text-xs font-bold text-slate-800">#{doc.documentNumber}</div>
                        <div className="text-[11px] text-slate-500 mt-1">Issuing Authority: {doc.issuingAuthority || 'MOCI Qatar'}</div>
                        <div className="text-[11px] text-slate-600 font-mono mt-0.5">Expires: {doc.expiryDate || 'No Expiry'}</div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono">Company License</span>
                        {(db.hasPermission('documents.renew') || db.hasPermission('company_documents.manage')) && (
                          <button
                            onClick={() => onOpenRenewModal(doc)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-3 py-1 rounded-lg"
                          >
                            Renew License
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
