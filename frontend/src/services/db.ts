import {
  ActivityLog,
  Company,
  Department,
  Designation,
  DocumentRecord,
  DocumentRenewalRecord,
  DocumentType,
  Employee,
  ExpiryCounts,
  NotificationLog,
  NotificationProviderSettings,
  NotificationTemplate,
  Permission,
  ReminderRule,
  Role,
  SystemSettings,
  User,
  Vehicle,
} from '../types';
import { apiRequest, getAuthToken, setAuthToken } from './api';

type BootstrapData = {
  companies: Company[];
  departments: Department[];
  designations: Designation[];
  employees: Employee[];
  documentTypes: DocumentType[];
  documents: DocumentRecord[];
  renewals: DocumentRenewalRecord[];
  vehicles: Vehicle[];
  templates: NotificationTemplate[];
  reminderRules: ReminderRule[];
  notificationLogs: NotificationLog[];
  activityLogs: ActivityLog[];
  settings: SystemSettings;
  roles: Role[];
  permissions: Permission[];
  users: User[];
};

export type ServerPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type DocumentTypeAlert = {
  code: string;
  name: string;
  leadDays: number;
  expiringCount: number;
  expiredCount: number;
};

export type DashboardData = {
  stats: ExpiryCounts;
  /** Keyed by document type code: qid, passport, istimara. */
  documentTypeAlerts?: Record<string, DocumentTypeAlert>;
  urgentDocuments: DocumentRecord[];
  employeeCountsByCompany: Record<string, number>;
  appliedFilters: Record<string, unknown>;
  generatedAt: string;
};

export type GlobalSearchResults = {
  employees: Employee[];
  documents: DocumentRecord[];
  vehicles: Vehicle[];
};

type LaravelPaginator<T> = {
  data: T[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
};

const EMPTY_SETTINGS: SystemSettings = {
  timezone: 'Asia/Qatar',
  qatarTimeOffset: 3,
  globalReminderDays: [30, 15, 10, 7, 3, 1, 0],
  defaultFileMaxSizeMb: 5,
  providerConfig: {
    emailEnabled: false,
    smsEnabled: false,
    whatsappEnabled: false,
    mockMode: true,
  },
  autoExpiryScanEnabled: true,
};

const EMPTY_USER: User = {
  id: '',
  name: 'Loading user',
  email: '',
  roleId: '',
  roleName: '',
  companyAccess: [],
  primaryCompanyId: '',
  status: 'inactive',
  permissions: [],
};

function paginate<T>(items: T[], page = 1, pageSize = 10) {
  const safeSize = Math.max(1, pageSize);
  return {
    items: items.slice((Math.max(1, page) - 1) * safeSize, Math.max(1, page) * safeSize),
    total: items.length,
  };
}

class ApiBackedDatabase {
  private currentUser: User = EMPTY_USER;
  private data: BootstrapData = {
    companies: [],
    departments: [],
    designations: [],
    employees: [],
    documentTypes: [],
    documents: [],
    renewals: [],
    vehicles: [],
    templates: [],
    reminderRules: [],
    notificationLogs: [],
    activityLogs: [],
    settings: EMPTY_SETTINGS,
    roles: [],
    permissions: [],
    users: [],
  };
  private selectedCompanyId = sessionStorage.getItem('stf_selected_company') || 'all';

  async initialize(): Promise<void> {
    const response = await apiRequest<{ user: User; data: BootstrapData }>('/bootstrap');
    this.currentUser = response.user;
    sessionStorage.setItem('stf_auth_user', JSON.stringify(response.user));
    this.data = {
      ...this.data,
      ...response.data,
      companies: response.data.companies || [],
      employees: response.data.employees || [],
      documents: response.data.documents || [],
      vehicles: response.data.vehicles || [],
      reminderRules: response.data.reminderRules || [],
    };
    const allowed = this.currentUser.companyAccess === 'all'
      || this.currentUser.companyAccess.includes(this.selectedCompanyId);
    if (this.selectedCompanyId !== 'all' && !allowed) {
      this.setSelectedCompanyId(this.currentUser.primaryCompanyId || 'all');
    }
  }

  getCurrentUser(): User {
    return this.currentUser;
  }

  hasPermission(code: string): boolean {
    return Boolean(this.currentUser.isSuperAdmin || this.currentUser.permissions?.includes(code));
  }

  async setCurrentUserId(id: string): Promise<void> {
    if (!this.currentUser.isSuperAdmin) {
      throw new Error('Only a Super Admin can impersonate another user.');
    }
    const response = await apiRequest<{ token: string; user: User }>(`/auth/impersonate/${id}`, { method: 'POST' });
    if (!sessionStorage.getItem('stf_impersonator_token')) {
      const originalToken = getAuthToken();
      if (originalToken) sessionStorage.setItem('stf_impersonator_token', originalToken);
    }
    setAuthToken(response.token);
    await this.initialize();
  }

  async stopImpersonating(): Promise<void> {
    const original = sessionStorage.getItem('stf_impersonator_token');
    if (!original) return;
    await apiRequest('/auth/impersonation/stop', { method: 'POST' }).catch(() => undefined);
    setAuthToken(original);
    sessionStorage.removeItem('stf_impersonator_token');
    await this.initialize();
  }

  getSelectedCompanyId(): string {
    return this.selectedCompanyId;
  }

  setSelectedCompanyId(companyId: string): void {
    this.selectedCompanyId = companyId;
    sessionStorage.setItem('stf_selected_company', companyId);
  }

  private companyFilter<T extends { companyId?: string }>(items: T[]): T[] {
    return this.selectedCompanyId === 'all'
      ? items
      : items.filter(item => !item.companyId || item.companyId === this.selectedCompanyId);
  }

  getCompanies(): Company[] {
    return this.data.companies;
  }

  getDepartments(companyId?: string): Department[] {
    const items = this.companyFilter(this.data.departments);
    return companyId ? items.filter(item => item.companyId === companyId) : items;
  }

  getDesignations(departmentId?: string): Designation[] {
    const items = this.companyFilter(this.data.designations);
    return departmentId ? items.filter(item => item.departmentId === departmentId) : items;
  }

  getRoles(): Role[] { return this.data.roles; }
  getPermissions(): Permission[] { return this.data.permissions; }
  getUsers(): User[] { return this.data.users; }
  getDocumentTypes(): DocumentType[] { return this.data.documentTypes; }
  getTemplates(): NotificationTemplate[] { return this.data.templates; }
  getReminderRules(): ReminderRule[] { return this.data.reminderRules; }
  getSettings(): SystemSettings { return this.data.settings; }
  getNotificationProviderSettings(): NotificationProviderSettings {
    return { ...this.data.settings.providerConfig };
  }

  private async listResource<T>(
    resource: string,
    params: Record<string, string | number | boolean | undefined>,
    endpoint = `/resources/${resource}`,
  ): Promise<ServerPage<T>> {
    const query = new URLSearchParams();
    const selected = this.getSelectedCompanyId();
    if (selected !== 'all') query.set('company_id', selected);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== 'all') {
        query.set(key, String(value));
      }
    });
    const response = await apiRequest<LaravelPaginator<T>>(`${endpoint}?${query.toString()}`);
    return {
      items: response.data || [],
      total: response.total || 0,
      page: response.current_page || 1,
      pageSize: response.per_page || Number(params.per_page) || 20,
      totalPages: response.last_page || 1,
    };
  }

  async listEmployees(params: {
    companyId?: string;
    search?: string;
    departmentId?: string;
    status?: string;
    includeArchived?: boolean;
    archivedOnly?: boolean;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    direction?: 'asc' | 'desc';
  }): Promise<ServerPage<Employee>> {
    return this.listResource<Employee>('employees', {
      company_id: params.companyId,
      search: params.search,
      department_id: params.departmentId,
      status: params.status === 'archived' ? undefined : params.status,
      include_archived: params.includeArchived,
      archived_only: params.archivedOnly || params.status === 'archived',
      page: params.page,
      per_page: params.pageSize,
      sort_by: params.sortBy,
      direction: params.direction,
    });
  }

  async listDocuments(params: {
    search?: string;
    ownerType?: DocumentRecord['ownerType'];
    ownerId?: string;
    documentTypeId?: string;
    status?: string;
    includeArchived?: boolean;
    archivedOnly?: boolean;
    expiryFrom?: string;
    expiryTo?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    direction?: 'asc' | 'desc';
  }): Promise<ServerPage<DocumentRecord>> {
    return this.listResource<DocumentRecord>('documents', {
      search: params.search,
      owner_type: params.ownerType,
      owner_id: params.ownerId,
      document_type_id: params.documentTypeId,
      status: params.status,
      include_archived: params.includeArchived,
      archived_only: params.archivedOnly,
      expiry_from: params.expiryFrom,
      expiry_to: params.expiryTo,
      page: params.page,
      per_page: params.pageSize,
      sort_by: params.sortBy,
      direction: params.direction,
    });
  }

  async listVehicles(params: {
    companyId?: string;
    search?: string;
    status?: string;
    includeArchived?: boolean;
    archivedOnly?: boolean;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    direction?: 'asc' | 'desc';
  }): Promise<ServerPage<Vehicle>> {
    return this.listResource<Vehicle>('vehicles', {
      company_id: params.companyId,
      search: params.search,
      status: params.status === 'archived' ? undefined : params.status,
      include_archived: params.includeArchived,
      archived_only: params.archivedOnly || params.status === 'archived',
      page: params.page,
      per_page: params.pageSize,
      sort_by: params.sortBy,
      direction: params.direction,
    });
  }

  async listNotificationLogs(params: {
    channel?: string;
    status?: string;
    documentTypeId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ServerPage<NotificationLog>> {
    return this.listResource<NotificationLog>('notifications', {
      channel: params.channel,
      status: params.status,
      document_type_id: params.documentTypeId,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      search: params.search,
      page: params.page,
      per_page: params.pageSize,
    }, '/notifications');
  }

  async listActivityLogs(params: {
    search?: string;
    module?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    direction?: 'asc' | 'desc';
  }): Promise<ServerPage<ActivityLog>> {
    return this.listResource<ActivityLog>('audit-logs', {
      search: params.search,
      module: params.module,
      action: params.action,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      page: params.page,
      per_page: params.pageSize,
      sort_by: params.sortBy,
      direction: params.direction,
    }, '/audit-logs');
  }

  async dashboardSummary(params: {
    companyId?: string;
    departmentId?: string;
    documentTypeId?: string;
    ownerType?: string;
    employeeStatus?: string;
    vehicleStatus?: string;
    expiryStatus?: string;
    expiryFrom?: string;
    expiryTo?: string;
  }): Promise<DashboardData> {
    const query = new URLSearchParams();
    const selected = params.companyId || this.getSelectedCompanyId();
    if (selected !== 'all') query.set('company_id', selected);
    const values: Record<string, string | undefined> = {
      department_id: params.departmentId,
      document_type_id: params.documentTypeId,
      owner_type: params.ownerType,
      employee_status: params.employeeStatus,
      vehicle_status: params.vehicleStatus,
      expiry_status: params.expiryStatus,
      expiry_from: params.expiryFrom,
      expiry_to: params.expiryTo,
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value && value !== 'all') query.set(key, value);
    });
    const response = await apiRequest<{ data: DashboardData }>(`/dashboard?${query.toString()}`);
    return response.data;
  }

  async documentsByOwner(
    ownerType: DocumentRecord['ownerType'],
    ownerId: string,
  ): Promise<DocumentRecord[]> {
    const page = await this.listDocuments({
      ownerType,
      ownerId,
      includeArchived: false,
      page: 1,
      pageSize: 100,
      sortBy: 'expiry_date',
      direction: 'asc',
    });
    return page.items;
  }

  async globalSearch(query: string): Promise<GlobalSearchResults> {
    const selected = this.getSelectedCompanyId();
    const params = new URLSearchParams({ q: query.trim() });
    if (selected !== 'all') params.set('company_id', selected);

    return apiRequest<GlobalSearchResults>(`/search?${params.toString()}`);
  }

  getEmployees(params?: {
    search?: string;
    departmentId?: string;
    status?: string;
    includeArchived?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    let items = this.companyFilter(this.data.employees);
    if (!params?.includeArchived) items = items.filter(item => item.status !== 'archived');
    if (params?.status && params.status !== 'all') items = items.filter(item => item.status === params.status);
    if (params?.departmentId && params.departmentId !== 'all') {
      items = items.filter(item => item.departmentId === params.departmentId);
    }
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      items = items.filter(item => [
        item.fullName, item.employeeCode, item.internalId, item.email, item.mobile, item.nationality,
      ].some(value => (value || '').toLowerCase().includes(q)));
    }
    return paginate(items, params?.page, params?.pageSize);
  }

  getEmployeeById(id: string): Employee | undefined {
    return this.data.employees.find(item => item.id === id);
  }

  getDocuments(params?: {
    ownerType?: DocumentRecord['ownerType'];
    ownerId?: string;
    documentTypeId?: string;
    status?: string;
    search?: string;
    includeArchived?: boolean;
    archivedOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    let items = this.companyFilter(this.data.documents);
    if (!params?.includeArchived) items = items.filter(item => !item.archivedAt);
    if (params?.archivedOnly) items = items.filter(item => Boolean(item.archivedAt));
    if (params?.ownerType) items = items.filter(item => item.ownerType === params.ownerType);
    if (params?.ownerId) items = items.filter(item => item.ownerId === params.ownerId);
    if (params?.documentTypeId && params.documentTypeId !== 'all') {
      items = items.filter(item => item.documentTypeId === params.documentTypeId);
    }
    if (params?.status && params.status !== 'all') items = items.filter(item => item.status === params.status);
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      items = items.filter(item => [
        item.documentNumber, item.documentTypeName, item.ownerName, item.issuingAuthority || '',
      ].some(value => value.toLowerCase().includes(q)));
    }
    return paginate(items, params?.page, params?.pageSize);
  }

  getDocumentsByOwner(ownerType: DocumentRecord['ownerType'], ownerId: string): DocumentRecord[] {
    return this.data.documents.filter(item => item.ownerType === ownerType && item.ownerId === ownerId);
  }

  getVehicleById(id: string): Vehicle | undefined {
    return this.data.vehicles.find(item => item.id === id);
  }

  getVehicles(params?: { search?: string; status?: string; includeArchived?: boolean; page?: number; pageSize?: number }) {
    let items = this.companyFilter(this.data.vehicles);
    if (!params?.includeArchived) items = items.filter(item => item.status !== 'archived');
    if (params?.status && params.status !== 'all') items = items.filter(item => item.status === params.status);
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      items = items.filter(item => [
        item.internalVehicleId, item.vehicleNumber, item.plateNumber, item.make, item.model,
        item.assignedDriverName || '',
      ].some(value => value.toLowerCase().includes(q)));
    }
    return paginate(items, params?.page, params?.pageSize);
  }

  getNotificationLogs(params?: { channel?: string; status?: string; search?: string; page?: number; pageSize?: number }) {
    let items = this.companyFilter(this.data.notificationLogs);
    if (params?.channel && params.channel !== 'all') items = items.filter(item => item.channel === params.channel);
    if (params?.status && params.status !== 'all') items = items.filter(item => item.status === params.status);
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      items = items.filter(item => [
        item.recipientName, item.recipientContact, item.documentTypeName, item.ownerName, item.messageBody,
      ].some(value => (value || '').toLowerCase().includes(q)));
    }
    return paginate(items, params?.page, params?.pageSize);
  }

  getActivityLogs(module?: ActivityLog['module']): ActivityLog[] {
    const items = this.companyFilter(this.data.activityLogs);
    return module ? items.filter(item => item.module === module) : items;
  }

  private async saveResource<T extends { id?: string }>(resource: string, value: Partial<T>): Promise<T> {
    const hasId = Boolean(value.id && /^\d+$/.test(value.id));
    const response = await apiRequest<{ data: T }>(
      hasId ? `/resources/${resource}/${value.id}` : `/resources/${resource}`,
      { method: hasId ? 'PUT' : 'POST', body: JSON.stringify(value) },
    );
    return response.data;
  }

  private upsert<T extends { id: string }>(items: T[], value: T): T[] {
    const index = items.findIndex(item => item.id === value.id);
    if (index < 0) return [value, ...items];
    return items.map(item => item.id === value.id ? value : item);
  }

  async saveCompany(value: Partial<Company>): Promise<Company> {
    const saved = await this.saveResource<Company>('companies', value);
    this.data.companies = this.upsert(this.data.companies, saved);
    return saved;
  }

  async saveDepartment(value: Partial<Department>): Promise<Department> {
    const payload = { ...value, companyId: value.companyId || this.currentUser.primaryCompanyId || this.selectedCompanyId };
    const saved = await this.saveResource<Department>('departments', payload);
    this.data.departments = this.upsert(this.data.departments, saved);
    return saved;
  }

  async saveDesignation(value: Partial<Designation>): Promise<Designation> {
    const payload = { ...value, companyId: value.companyId || this.currentUser.primaryCompanyId || this.selectedCompanyId };
    const saved = await this.saveResource<Designation>('designations', payload);
    this.data.designations = this.upsert(this.data.designations, saved);
    return saved;
  }

  async saveEmployee(value: Partial<Employee>): Promise<Employee> {
    const saved = await this.saveResource<Employee>('employees', value);
    this.data.employees = this.upsert(this.data.employees, saved);
    return saved;
  }

  async saveDocumentType(value: Partial<DocumentType>): Promise<DocumentType> {
    const saved = await this.saveResource<DocumentType>('document-types', value);
    this.data.documentTypes = this.upsert(this.data.documentTypes, saved);
    return saved;
  }

  async saveDocument(value: Partial<DocumentRecord>): Promise<DocumentRecord> {
    const saved = await this.saveResource<DocumentRecord>('documents', value);
    this.data.documents = this.upsert(this.data.documents, saved);
    return saved;
  }

  async saveVehicle(value: Partial<Vehicle>): Promise<Vehicle> {
    const saved = await this.saveResource<Vehicle>('vehicles', value);
    this.data.vehicles = this.upsert(this.data.vehicles, saved);
    return saved;
  }

  private async archiveResource(resource: 'employees' | 'vehicles' | 'documents', id: string): Promise<void> {
    await apiRequest(`/resources/${resource}/${id}`, { method: 'DELETE' });
  }

  private async restoreResource<T extends { id: string }>(
    resource: 'employees' | 'vehicles' | 'documents',
    id: string,
  ): Promise<T> {
    const response = await apiRequest<{ data: T }>(`/resources/${resource}/${id}/restore`, { method: 'POST' });
    return response.data;
  }

  async archiveEmployee(id: string): Promise<void> {
    await this.archiveResource('employees', id);
    this.data.employees = this.data.employees.map(item => item.id === id
      ? { ...item, status: 'archived', archivedAt: new Date().toISOString() }
      : item);
  }

  async restoreEmployee(id: string): Promise<Employee> {
    const restored = await this.restoreResource<Employee>('employees', id);
    this.data.employees = this.upsert(this.data.employees, restored);
    return restored;
  }

  async archiveVehicle(id: string): Promise<void> {
    await this.archiveResource('vehicles', id);
    this.data.vehicles = this.data.vehicles.map(item => item.id === id
      ? { ...item, status: 'archived', archivedAt: new Date().toISOString() }
      : item);
  }

  async restoreVehicle(id: string): Promise<Vehicle> {
    const restored = await this.restoreResource<Vehicle>('vehicles', id);
    this.data.vehicles = this.upsert(this.data.vehicles, restored);
    return restored;
  }

  async archiveDocument(id: string): Promise<void> {
    await this.archiveResource('documents', id);
    this.data.documents = this.data.documents.map(item => item.id === id
      ? { ...item, archivedAt: new Date().toISOString() }
      : item);
  }

  async restoreDocument(id: string): Promise<DocumentRecord> {
    const restored = await this.restoreResource<DocumentRecord>('documents', id);
    this.data.documents = this.upsert(this.data.documents, restored);
    return restored;
  }

  async saveTemplate(value: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    const saved = await this.saveResource<NotificationTemplate>('templates', value);
    this.data.templates = this.upsert(this.data.templates, saved);
    return saved;
  }

  async saveReminderRule(value: Partial<ReminderRule>): Promise<ReminderRule> {
    const saved = await this.saveResource<ReminderRule>('reminder-rules', value);
    this.data.reminderRules = this.upsert(this.data.reminderRules, saved);
    return saved;
  }

  async saveUser(value: Partial<User> & { password?: string }): Promise<User> {
    const roleIds = value.roleIds?.length
      ? value.roleIds
      : value.roleId
        ? [value.roleId]
        : [];
    const roleNames = roleIds
      .map(roleId => this.data.roles.find(item => item.id === roleId)?.name)
      .filter((name): name is string => Boolean(name));
    if (!roleNames.length || roleNames.length !== roleIds.length) {
      throw new Error('Select at least one valid role.');
    }
    const hasId = Boolean(value.id && /^\d+$/.test(value.id));
    const response = await apiRequest<{ data: User }>(
      hasId ? `/users/${value.id}` : '/users',
      {
        method: hasId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...value,
          roleNames,
          companyAccess: value.companyAccess || [],
        }),
      },
    );
    this.data.users = this.upsert(this.data.users, response.data);
    return response.data;
  }

  async saveRole(value: Partial<Role>): Promise<Role> {
    const hasId = Boolean(value.id && /^\d+$/.test(value.id));
    const response = await apiRequest<{ data: Role }>(
      hasId ? `/roles/${value.id}` : '/roles',
      {
        method: hasId ? 'PUT' : 'POST',
        body: JSON.stringify(value),
      },
    );
    this.data.roles = this.upsert(this.data.roles, response.data);
    return response.data;
  }

  async renewDocument(documentId: string, value: {
    newDocNumber: string;
    newIssueDate: string;
    newExpiryDate: string;
    newFileUrl?: string;
    newFileName?: string;
    notes?: string;
    changeReason?: string;
  }): Promise<{ document: DocumentRecord; renewalRecord: DocumentRenewalRecord }> {
    const response = await apiRequest<{ data: { document: DocumentRecord; renewal: DocumentRenewalRecord } }>(
      `/documents/${documentId}/renew`,
      { method: 'POST', body: JSON.stringify(value) },
    );
    this.data.documents = this.upsert(this.data.documents, response.data.document);
    this.data.renewals = [response.data.renewal, ...this.data.renewals];
    return { document: response.data.document, renewalRecord: response.data.renewal };
  }

  async retryNotification(id: string): Promise<void> {
    const response = await apiRequest<{ data: NotificationLog }>(`/notifications/${id}/retry`, { method: 'POST' });
    this.data.notificationLogs = this.upsert(this.data.notificationLogs, response.data);
  }

  async saveNotificationProviderSettings(config: NotificationProviderSettings): Promise<void> {
    const allowed = {
      emailEnabled: config.emailEnabled,
      smsEnabled: config.smsEnabled,
      whatsappEnabled: config.whatsappEnabled,
      mockMode: config.mockMode,
    };
    const response = await apiRequest<{ data: SystemSettings }>('/settings', {
      method: 'PUT',
      body: JSON.stringify({ providerConfig: allowed }),
    });
    this.data.settings = response.data;
  }

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const response = await apiRequest<{ data: SystemSettings }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    this.data.settings = response.data;
    return response.data;
  }

  getKPIStats(): ExpiryCounts {
    const employees = this.companyFilter(this.data.employees);
    const documents = this.companyFilter(this.data.documents);
    const vehicles = this.companyFilter(this.data.vehicles);
    const notifications = this.companyFilter(this.data.notificationLogs);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Qatar', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const trackedCounts = (code: string) => {
      const type = this.data.documentTypes.find(item => item.code === code);
      const leadDays = type?.alertLeadDays || 30;
      const scoped = documents.filter(item => item.documentTypeCode === code);
      return {
        expiring: scoped.filter(
          item => (item.daysRemaining ?? -1) >= 0 && (item.daysRemaining ?? 9999) <= leadDays,
        ).length,
        expired: scoped.filter(item => item.status === 'expired').length,
      };
    };
    const qid = trackedCounts('qid');
    const passport = trackedCounts('passport');
    const istimara = trackedCounts('istimara');

    return {
      expiringQid: qid.expiring,
      expiredQid: qid.expired,
      expiringPassport: passport.expiring,
      expiredPassport: passport.expired,
      expiringIstimara: istimara.expiring,
      expiredIstimara: istimara.expired,
      totalEmployees: employees.length,
      activeEmployees: employees.filter(item => item.status === 'active').length,
      cancelledEmployees: employees.filter(item => item.status === 'cancelled').length,
      archivedEmployees: employees.filter(item => item.status === 'archived').length,
      totalVehicles: vehicles.length,
      totalDocuments: documents.length,
      expiredDocuments: documents.filter(item => item.status === 'expired').length,
      expiringToday: documents.filter(item => item.status === 'expires_today').length,
      expiringIn7Days: documents.filter(item => (item.daysRemaining ?? -1) > 0 && (item.daysRemaining ?? 99) <= 7).length,
      expiringIn15Days: documents.filter(item => (item.daysRemaining ?? -1) > 0 && (item.daysRemaining ?? 99) <= 15).length,
      expiringIn30Days: documents.filter(item => (item.daysRemaining ?? -1) > 0 && (item.daysRemaining ?? 99) <= 30).length,
      documentsWithoutExpiry: documents.filter(item => item.status === 'no_expiry').length,
      todaySmsCount: notifications.filter(item => item.channel === 'sms' && item.queuedTime?.startsWith(today)).length,
      todayWhatsappCount: notifications.filter(item => item.channel === 'whatsapp' && item.queuedTime?.startsWith(today)).length,
      todayEmailCount: notifications.filter(item => item.channel === 'email' && item.queuedTime?.startsWith(today)).length,
      queuedNotifications: notifications.filter(item => item.status === 'queued').length,
      sentNotifications: notifications.filter(item => item.status === 'sent').length,
      deliveredNotifications: notifications.filter(item => item.status === 'delivered').length,
      failedNotifications: notifications.filter(item => item.status === 'failed').length,
    };
  }

}

export const db = new ApiBackedDatabase();
