import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { DashboardModule } from './components/modules/DashboardModule';

// Feature modules are code split so the first paint only downloads the shell
// plus the dashboard. Heavy screens (settings, imports, reports) are fetched on
// demand, which keeps the app snappy on slow connections.
const EmployeeModule = lazy(() => import('./components/modules/EmployeeModule').then(m => ({ default: m.EmployeeModule })));
const DynamicDocumentsModule = lazy(() => import('./components/modules/DynamicDocumentsModule').then(m => ({ default: m.DynamicDocumentsModule })));
const DocumentTypesModule = lazy(() => import('./components/modules/DocumentTypesModule').then(m => ({ default: m.DocumentTypesModule })));
const VehicleModule = lazy(() => import('./components/modules/VehicleModule').then(m => ({ default: m.VehicleModule })));
const BankDocumentsModule = lazy(() => import('./components/modules/BankDocumentsModule').then(m => ({ default: m.BankDocumentsModule })));
const EmployeeMessageModule = lazy(() => import('./components/modules/EmployeeMessageModule').then(m => ({ default: m.EmployeeMessageModule })));
const CompanyDocumentsModule = lazy(() => import('./components/modules/CompanyDocumentsModule').then(m => ({ default: m.CompanyDocumentsModule })));
const RemindersModule = lazy(() => import('./components/modules/RemindersModule').then(m => ({ default: m.RemindersModule })));
const TemplatesModule = lazy(() => import('./components/modules/TemplatesModule').then(m => ({ default: m.TemplatesModule })));
const ReportsModule = lazy(() => import('./components/modules/ReportsModule').then(m => ({ default: m.ReportsModule })));
const ImportModule = lazy(() => import('./components/modules/ImportModule').then(m => ({ default: m.ImportModule })));
const AuditModule = lazy(() => import('./components/modules/AuditModule').then(m => ({ default: m.AuditModule })));
const SettingsModule = lazy(() => import('./components/modules/SettingsModule').then(m => ({ default: m.SettingsModule })));

import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { QuickUserSwitchModal } from './components/common/QuickUserSwitchModal';
import { DocumentRenewalModal } from './components/common/DocumentRenewalModal';
import { ModuleFallback } from './components/common/LoadingSpinner';

import { CompanyWorkspaceSelectionView } from './components/common/CompanyWorkspaceSelectionView';
import { LoginPage } from './components/common/LoginPage';
import { ForcePasswordChange } from './components/common/ForcePasswordChange';
import { db } from './services/db';
import { getSessionUser, hasSession, logout } from './services/auth';
import { DocumentRecord } from './types';

const TAB_PERMISSIONS: Record<NavTab, string> = {
  dashboard: 'dashboard.view',
  employees: 'employees.view',
  documents: 'documents.view',
  'doc-types': 'document_types.view',
  vehicles: 'vehicles.view',
  'bank-docs': 'employees.view',
  'emp-messages': 'employees.view',
  'company-docs': 'company_documents.view',
  reminders: 'notifications.view',
  templates: 'templates.view',
  reports: 'reports.view',
  import: 'imports.view',
  audit: 'audit.view',
  settings: 'settings.view',
};

const TAB_PATHS: Record<NavTab, string> = {
  dashboard: '/dashboard',
  employees: '/employees',
  documents: '/documents',
  'doc-types': '/document-types',
  vehicles: '/vehicles',
  'bank-docs': '/bank-documents',
  'emp-messages': '/employee-messages',
  'company-docs': '/company-documents',
  reminders: '/notifications',
  templates: '/notification-templates',
  reports: '/reports',
  import: '/imports',
  audit: '/audit',
  settings: '/settings',
};

const PATH_TABS = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as NavTab]),
) as Record<string, NavTab>;

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState<boolean>(hasSession());
  const [booting, setBooting] = useState<boolean>(hasSession());
  const [bootError, setBootError] = useState<string>('');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState<boolean>(false);
  const [isWorkspaceSelectionView, setIsWorkspaceSelectionView] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<NavTab>(PATH_TABS[location.pathname] || 'dashboard');
  const [docFilterStatus, setDocFilterStatus] = useState<string>(
    new URLSearchParams(location.search).get('status') || 'all',
  );
  
  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState<boolean>(false);
  
  // Renewal Modal
  const [renewDoc, setRenewDoc] = useState<DocumentRecord | null>(null);
  const [isRenewOpen, setIsRenewOpen] = useState<boolean>(false);

  // Refresh trigger counter to force re-renders when db changes
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Only refetch the queries that are actually mounted; blindly invalidating
  // every cached query re-downloads every screen the admin ever opened.
  const refreshData = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    void queryClient.invalidateQueries({ type: 'active' });
  }, [queryClient]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthenticated(false);
      setBooting(false);
      navigate('/login', { replace: true });
    };
    window.addEventListener('stf:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('stf:unauthorized', handleUnauthorized);
  }, [navigate]);

  useEffect(() => {
    const nextTab = PATH_TABS[location.pathname];
    if (!nextTab) return;
    setCurrentTab(nextTab);
    setDocFilterStatus(new URLSearchParams(location.search).get('status') || 'all');
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!authenticated) return;
    const sessionUser = getSessionUser();
    if (sessionUser?.forcePasswordChange) {
      setPasswordChangeRequired(true);
      setBooting(false);
      setBootError('');
      return;
    }
    setBooting(true);
    setBootError('');
    db.initialize()
      .then(() => {
        setPasswordChangeRequired(Boolean(db.getCurrentUser().forcePasswordChange));
        if (db.getSelectedCompanyId() === 'all' && db.getCompanies().length > 1) {
          setIsWorkspaceSelectionView(true);
        }
        refreshData();
      })
      .catch(error => setBootError(error instanceof Error ? error.message : 'Unable to load server data'))
      .finally(() => setBooting(false));
  }, [authenticated]);

  // Global Keyboard Shortcuts (Ctrl+K for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (tab: NavTab, filterStatus?: string) => {
    if (!db.hasPermission(TAB_PERMISSIONS[tab])) {
      return;
    }
    setIsWorkspaceSelectionView(false);
    setCurrentTab(tab);
    navigate(`${TAB_PATHS[tab]}${filterStatus ? `?status=${encodeURIComponent(filterStatus)}` : ''}`);
    if (filterStatus) {
      setDocFilterStatus(filterStatus);
    } else {
      setDocFilterStatus('all');
    }
  };

  const handleSelectCompanyFromWorkspace = (companyId: string) => {
    db.setSelectedCompanyId(companyId);
    setIsWorkspaceSelectionView(false);
    setCurrentTab('dashboard');
    refreshData();
  };

  const handleOpenRenewModal = (doc: DocumentRecord) => {
    setRenewDoc(doc);
    setIsRenewOpen(true);
  };

  const handleUserSwitched = () => {
    setCurrentTab('dashboard');
    setIsWorkspaceSelectionView(db.getSelectedCompanyId() === 'all' && db.getCompanies().length > 1);
    refreshData();
  };

  if (!authenticated) {
    return <LoginPage onSuccess={() => {
      navigate('/dashboard', { replace: true });
      setAuthenticated(true);
    }} />;
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-700">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-8 py-6 font-semibold shadow">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" />
          <span>Loading STF Group ERP…</span>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl bg-white p-8 shadow border border-red-200">
          <h2 className="text-lg font-bold text-red-700">Unable to connect to the backend</h2>
          <p className="mt-2 text-slate-600">{bootError}</p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setAuthenticated(false)} className="rounded-lg bg-slate-800 px-4 py-2 text-white">Back to login</button>
            <button onClick={() => setAuthenticated(true)} className="rounded-lg bg-orange-500 px-4 py-2 text-white">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  if (passwordChangeRequired) {
    return (
      <ForcePasswordChange
        onComplete={async () => {
          await db.initialize();
          setPasswordChangeRequired(Boolean(db.getCurrentUser().forcePasswordChange));
          refreshData();
        }}
        onLogout={() => {
          setAuthenticated(false);
          setPasswordChangeRequired(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col antialiased">
      {isWorkspaceSelectionView ? (
        <CompanyWorkspaceSelectionView
          onSelectCompany={handleSelectCompanyFromWorkspace}
          onLogout={async () => {
            await logout();
            setAuthenticated(false);
            setIsWorkspaceSelectionView(false);
          }}
        />
      ) : (
        <>
          {/* Top Application Header */}
          <Header
            key={db.getCurrentUser().id}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenQuickUserSwitch={() => setIsUserSwitchOpen(true)}
            onRefreshData={refreshData}
            onOpenWorkspaceSelection={() => setIsWorkspaceSelectionView(true)}
          />

          {/* Main Container Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Navigation */}
            <Sidebar
              currentTab={currentTab}
              onSelectTab={(tab) => handleNavigate(tab)}
            />

            {/* Main Content Workspace */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
              <Suspense fallback={<ModuleFallback />}>
              {currentTab === 'dashboard' && (
                <DashboardModule onNavigate={handleNavigate}/>
              )}

              {currentTab === 'employees' && (
                <EmployeeModule
                  onOpenRenewModal={handleOpenRenewModal}
                  onRefresh={refreshData}
                />
              )}

              {currentTab === 'documents' && (
                <DynamicDocumentsModule
                  initialStatusFilter={docFilterStatus}
                  onOpenRenewModal={handleOpenRenewModal}
                  onRefresh={refreshData}
                />
              )}

              {currentTab === 'doc-types' && (
                <DocumentTypesModule onRefresh={refreshData} />
              )}

              {currentTab === 'vehicles' && (
                <VehicleModule
                  onOpenRenewModal={handleOpenRenewModal}
                  onRefresh={refreshData}
                />
              )}
              {currentTab === 'bank-docs' && (<BankDocumentsModule onRefresh={refreshData}/>)}
              {currentTab === 'emp-messages' && (<EmployeeMessageModule onRefresh={refreshData}/>)}

              {currentTab === 'company-docs' && (
                <CompanyDocumentsModule
                  onOpenRenewModal={handleOpenRenewModal}
                  onRefresh={refreshData}
                />
              )}

              {currentTab === 'reminders' && (
                <RemindersModule onRefresh={refreshData} />
              )}

              {currentTab === 'templates' && (
                <TemplatesModule onRefresh={refreshData} />
              )}

              {currentTab === 'reports' && (
                <ReportsModule />
              )}

              {currentTab === 'import' && (
                <ImportModule onRefresh={refreshData} />
              )}

              {currentTab === 'audit' && (
                <AuditModule />
              )}

              {currentTab === 'settings' && (
                <SettingsModule onRefresh={refreshData} />
              )}
              </Suspense>
            </main>
          </div>
        </>
      )}

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      <QuickUserSwitchModal
        isOpen={isUserSwitchOpen}
        onClose={() => setIsUserSwitchOpen(false)}
        onUserSwitched={handleUserSwitched}
      />

      <DocumentRenewalModal
        document={renewDoc}
        isOpen={isRenewOpen}
        onClose={() => { setIsRenewOpen(false); setRenewDoc(null); }}
        onRenewSuccess={refreshData}
      />
    </div>
  );
}

export default App;
