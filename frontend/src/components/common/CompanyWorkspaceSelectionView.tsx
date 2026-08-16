import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ArrowRight, Users, LogOut, ShieldCheck } from 'lucide-react';
import { Company } from '../../types';
import { db } from '../../services/db';

interface CompanyWorkspaceSelectionViewProps {
  onSelectCompany: (companyId: string) => void;
  onLogout?: () => void;
}

export const CompanyWorkspaceSelectionView: React.FC<CompanyWorkspaceSelectionViewProps> = ({
  onSelectCompany,
  onLogout,
}) => {
  const companies = db.getCompanies();
  const currentUser = db.getCurrentUser();
  const summaryQuery = useQuery({
    queryKey: ['workspace-company-counts'],
    queryFn: () => db.dashboardSummary({ companyId: 'all' }),
  });
  const employeeCounts = summaryQuery.data?.employeeCountsByCompany || {};

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Header Bar matching Screenshot 1 */}
      <header className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="font-black text-xl tracking-wider text-white flex items-center gap-2">
            <span className="text-purple-400">STF</span> GROUP
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>{currentUser.name} · {currentUser.roleName}</span>
          </div>
          <button
            onClick={() => {
              if (onLogout) onLogout();
            }}
            className="bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Workspace Title Header */}
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-1">
            MULTI-COMPANY WORKSPACE
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Select a company
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Each company uses the same system with completely separate employee data.
          </p>
        </div>

        {/* Company Cards Grid matching Screenshot 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {companies.map((company) => {
            const empCount = employeeCounts[company.id] || 0;

            return (
              <div
                key={company.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-purple-300 transition-all duration-200 p-6 flex flex-col justify-between group"
              >
                <div>
                  {/* Company Badge Pill */}
                  <div className="inline-block bg-purple-600 text-white font-black text-xs px-3 py-1.5 rounded-xl uppercase tracking-wider mb-5 shadow-xs">
                    {company.code}
                  </div>

                  {/* Company Full Name */}
                  <h2 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight uppercase leading-snug line-clamp-2 min-h-[2.5rem]">
                    {company.name}
                  </h2>

                  {/* Employee Count */}
                  <div className="text-xs text-slate-500 font-medium mt-2 flex items-center gap-1.5">
                    <span>{summaryQuery.isLoading ? 'Loading…' : `${empCount} employees`}</span>
                  </div>
                </div>

                {/* View Company Button */}
                <div className="mt-8">
                  <button
                    onClick={() => onSelectCompany(company.id)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs group-hover:bg-purple-700 cursor-pointer"
                  >
                    <span>View Company</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
