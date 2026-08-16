import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Users, FileText, Car, Building2, ChevronRight } from 'lucide-react';
import { db } from '../../services/db';
import { Company } from '../../types';
import { NavTab } from '../layout/Sidebar';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab, filterId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ 
  isOpen, 
  onClose, 
  onNavigate 
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ['global-search', db.getSelectedCompanyId(), debouncedQuery],
    queryFn: () => db.globalSearch(debouncedQuery),
    enabled: isOpen && debouncedQuery.length >= 2,
  });
  const serverResults = searchQuery.data || { employees: [], documents: [], vehicles: [] };
  const companyTerm = debouncedQuery.toLowerCase();
  const companies: Company[] = companyTerm.length >= 2
    ? db.getCompanies().filter(company =>
        company.name.toLowerCase().includes(companyTerm)
        || company.code.toLowerCase().includes(companyTerm)
        || Boolean(company.crNumber?.toLowerCase().includes(companyTerm)))
    : [];
  const results = { ...serverResults, companies };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search by Employee Name, Code, QID, Passport, Plate #, CR #..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 text-xs font-medium px-2 py-1 rounded bg-slate-100"
            >
              Clear
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Results Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {!query.trim() && (
            <div className="text-center py-8 text-slate-400 text-xs">
              Type employee name, QID number, vehicle plate, or document type to search across all companies.
            </div>
          )}
          {query.trim().length === 1 && (
            <div className="text-center py-8 text-slate-400 text-xs">
              Enter at least 2 characters to search.
            </div>
          )}
          {searchQuery.isFetching && debouncedQuery.length >= 2 && (
            <div className="text-center py-3 text-slate-500 text-xs">Searching the server…</div>
          )}
          {searchQuery.isError && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {searchQuery.error instanceof Error ? searchQuery.error.message : 'Search failed.'}
            </div>
          )}

          {/* Employees Results */}
          {results.employees.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Employees ({results.employees.length})</span>
              </div>
              <div className="space-y-1">
                {results.employees.map(e => (
                  <button
                    key={e.id}
                    onClick={() => {
                      onNavigate('employees');
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between border border-transparent hover:border-slate-200 transition-all group"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900 group-hover:text-amber-600">
                        {e.fullName} <span className="font-mono text-[11px] text-slate-400">({e.employeeCode})</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {e.nationality} • {e.mobile} • {e.email}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Documents Results */}
          {results.documents.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Documents ({results.documents.length})</span>
              </div>
              <div className="space-y-1">
                {results.documents.map(d => (
                  <button
                    key={d.id}
                    onClick={() => {
                      onNavigate('documents');
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between border border-transparent hover:border-slate-200 transition-all group"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900 group-hover:text-amber-600">
                        {d.documentTypeName} — <span className="font-mono text-xs">{d.documentNumber}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Owner: {d.ownerName} • Expires: {d.expiryDate || 'No Expiry'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Vehicles Results */}
          {results.vehicles.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5" />
                <span>Vehicles ({results.vehicles.length})</span>
              </div>
              <div className="space-y-1">
                {results.vehicles.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      onNavigate('vehicles');
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between border border-transparent hover:border-slate-200 transition-all group"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900 group-hover:text-amber-600">
                        {v.make} {v.model} ({v.vehicleNumber})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Plate: {v.plateNumber} • Driver: {v.assignedDriverName || 'Unassigned'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Companies Results */}
          {results.companies.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Companies ({results.companies.length})</span>
              </div>
              <div className="space-y-1">
                {results.companies.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      db.setSelectedCompanyId(c.id);
                      onNavigate('dashboard');
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between border border-transparent hover:border-slate-200 transition-all group"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900 group-hover:text-amber-600">
                        {c.name} ({c.code})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        CR #: {c.crNumber || 'N/A'} • {c.phone}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {debouncedQuery.length >= 2 &&
           !searchQuery.isFetching &&
           results.employees.length === 0 && 
           results.documents.length === 0 && 
           results.vehicles.length === 0 && 
           results.companies.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs">
              No matching records found for "{query}". Try searching by code, QID, or plate number.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
