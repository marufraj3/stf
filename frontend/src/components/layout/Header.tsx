import React, { useState, useEffect } from 'react';
import { 
  Building2, Search, Bell, Clock, RefreshCw, UserCheck, 
  ChevronDown, ShieldCheck, LogOut, Check 
} from 'lucide-react';
import { db } from '../../services/db';
import { reminderEngine } from '../../services/reminderEngine';
import { logout } from '../../services/auth';
import { Company, User } from '../../types';
import { SecureImage } from '../common/SecureFile';
import { CompanyLogo } from '../common/CompanyLogo';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenQuickUserSwitch: () => void;
  onRefreshData: () => void;
  onOpenWorkspaceSelection?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onOpenSearch, 
  onOpenQuickUserSwitch, 
  onRefreshData,
  onOpenWorkspaceSelection,
}) => {
  const [currentUser, setCurrentUser] = useState<User>(db.getCurrentUser());
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(db.getSelectedCompanyId());
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [qatarTime, setQatarTime] = useState<string>('');
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    setCompanies(db.getCompanies());
    setCurrentUser(db.getCurrentUser());
    setSelectedCompanyId(db.getSelectedCompanyId());

    // Update Qatar Time
    const updateClock = () => {
      const now = new Date();
      // Format to Qatar Asia/Qatar (UTC+3)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Qatar',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      };
      setQatarTime(now.toLocaleTimeString('en-US', options));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
    db.setSelectedCompanyId(id);
    onRefreshData();
  };

  const handleTriggerScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const res = await reminderEngine.runScan();
      setScanResult(`Scan complete! ${res.generatedCount} notifications queued, ${res.scannedCount} docs checked.`);
      onRefreshData();
      setTimeout(() => setScanResult(null), 5000);
    } catch (e) {
      console.error(e);
      setScanResult('Scan encountered an error.');
    } finally {
      setIsScanning(false);
    }
  };

  // Check if current user has multi-company selector privilege
  const availableCompanies = currentUser.companyAccess === 'all' 
    ? companies 
    : companies.filter(c => currentUser.companyAccess.includes(c.id));

  // Branding follows the active workspace; "all companies" keeps the group mark.
  const activeCompany = selectedCompanyId !== 'all'
    ? companies.find(company => company.id === selectedCompanyId)
    : undefined;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs h-16 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Branding & Multi-Company Switcher */}
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2">
          {activeCompany ? (
            <CompanyLogo
              code={activeCompany.code}
              name={activeCompany.name}
              logoUrl={activeCompany.logoUrl}
              sizeClass="w-9 h-9"
              textClass="text-[10px]"
              rounded="rounded-lg"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 font-bold flex items-center justify-center text-sm shadow-sm">
              STF
            </div>
          )}
          <div className="leading-none max-w-[220px]">
            <span className="block font-bold text-slate-900 text-sm tracking-tight truncate">
              {activeCompany ? activeCompany.name : 'STF Group ERP'}
            </span>
            <span className="block text-[10px] font-semibold text-amber-600 uppercase tracking-widest mt-0.5">
              Multi-Company Compliance
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

        {/* Company Switcher */}
        <div className="relative flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
            <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={selectedCompanyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="bg-transparent font-medium text-xs sm:text-sm text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">🏢 All Authorized Companies ({companies.length})</option>
              {availableCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {onOpenWorkspaceSelection && (
            <button
              onClick={onOpenWorkspaceSelection}
              className="hidden sm:flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold px-2.5 py-1.5 rounded-lg text-xs border border-purple-200 transition-colors cursor-pointer shrink-0"
              title="Open Multi-Company Workspace Selection Grid"
            >
              <span>Workspace</span>
            </button>
          )}
        </div>
      </div>

      {/* Center: Global Search & Qatar Live Clock */}
      <div className="hidden lg:flex items-center gap-3">
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 text-slate-500 rounded-lg px-3.5 py-1.5 text-xs font-medium border border-slate-200/70 transition-all w-64 justify-between group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
            <span>Search QID, Employee, Plate...</span>
          </div>
          <kbd className="bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 rounded border border-slate-200 shadow-2xs">
            Ctrl K
          </kbd>
        </button>

        {/* Qatar Time Indicator */}
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-900 px-3 py-1 rounded-lg text-xs font-mono font-medium border border-amber-200/60">
          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          <span>Qatar (AST): {qatarTime || '09:00:00 AM'}</span>
        </div>
      </div>

      {/* Right: Trigger Scan, Quick Role Switcher, User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Run Expiry Scan Button */}
        {(currentUser.isSuperAdmin || currentUser.permissions?.includes('notifications.run')) && (
          <button
            onClick={handleTriggerScan}
            disabled={isScanning}
            title="Run Daily Expiry Scanner & Dispatch Notifications"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-all shadow-2xs active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isScanning ? 'Scanning...' : 'Run Expiry Scan'}</span>
          </button>
        )}

        {/* Quick User / Role Switcher Modal Button */}
        {currentUser.isSuperAdmin && db.getUsers().length > 1 && (
          <button
            onClick={onOpenQuickUserSwitch}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-all shadow-2xs"
            title="Securely impersonate an active user"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Impersonate</span>
          </button>
        )}

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {currentUser.avatarUrl ? (
              <SecureImage
                source={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                {currentUser.name.charAt(0)}
              </div>
            )}
            <div className="text-left hidden xl:block">
              <span className="block text-xs font-semibold text-slate-800 leading-tight">
                {currentUser.name}
              </span>
              <span className="block text-[10px] font-medium text-slate-500">
                {currentUser.roleName}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden xl:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded">
                  {currentUser.roleName}
                </span>
              </div>

              {currentUser.isSuperAdmin && db.getUsers().length > 1 && (
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    onOpenQuickUserSwitch();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span>Impersonate user</span>
                </button>
              )}

              {sessionStorage.getItem('stf_impersonator_token') && (
                <button
                  onClick={async () => {
                    setUserMenuOpen(false);
                    await db.stopImpersonating();
                    window.location.reload();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span>Return to Super Admin</span>
                </button>
              )}

              <button
                onClick={async () => {
                  setUserMenuOpen(false);
                  await logout();
                  window.location.reload();
                }}
                className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast Banner for Expiry Scan results */}
      {scanResult && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{scanResult}</span>
        </div>
      )}
    </header>
  );
};
