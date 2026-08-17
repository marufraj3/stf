export type CompanyAccess = 'all' | string[];

export type UserRole = 'super_admin' | 'hr_manager' | 'department_manager' | 'accountant' | 'auditor' | 'custom';

export interface Permission {
  id: string;
  code: string; // e.g. 'employees.view'
  name: string;
  category: 'Employees' | 'Documents' | 'Vehicles' | 'Company Docs' | 'Reports' | 'Settings' | 'Notifications';
  description: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  code?: string;
  companyAccessScope?: string;
  isSystem?: boolean;
  permissions: string[]; // array of permission codes
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  roleIds?: string[];
  roleNames?: string[];
  companyAccess: CompanyAccess; // 'all' or list of company IDs
  primaryCompanyId: string;
  avatarUrl?: string;
  status: 'active' | 'inactive';
  lastLoginAt?: string;
  permissions?: string[];
  roles?: Role[];
  forcePasswordChange?: boolean;
  isSuperAdmin?: boolean;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  crNumber?: string;
  taxNumber?: string;
  computerCardNumber?: string;
  email: string;
  phone: string;
  address: string;
  poBox?: string;
  city: string;
  country: string;
  logoUrl?: string;
  /** Data URL set only while uploading a new logo from the Settings form. */
  logoFileName?: string;
  removeLogo?: boolean;
  active: boolean;
  createdAt: string;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  code: string;
  managerName?: string;
}

export interface Designation {
  id: string;
  companyId?: string;
  name: string;
  code?: string;
  departmentId?: string;
}

export type EmployeeStatus = 
  | 'active'
  | 'on_leave'
  | 'suspended'
  | 'cancelled'
  | 'resigned'
  | 'terminated'
  | 'archived';

export interface Employee {
  id: string;
  internalId: string;
  employeeCode: string;
  fullName: string;
  profilePhoto?: string;
  profilePhotoFileName?: string;
  companyId: string;
  departmentId: string;
  designationId: string;
  nationality: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  mobile: string;
  altMobile?: string;
  email: string;
  qatarAddress: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  joiningDate: string;
  basicSalary: number;
  allowances?: number;
  status: EmployeeStatus;
  notes?: string;
  assignedVehicleId?: string;
  // Extra fields for Employee Form & Identification
  qidNumber?: string;
  qidExpiryDate?: string;
  passportNumber?: string;
  passportExpiryDate?: string;
  licenseNumber?: string;
  licenseExpiryDate?: string;
  labourContractNumber?: string;
  labourContractExpiryDate?: string;
  healthCardNumber?: string;
  healthCardExpiryDate?: string;
  passportFileUrl?: string;
  licenseFileUrl?: string;
  qidFileUrl?: string;
  labourContractFileUrl?: string;
  healthCardFileUrl?: string;
  homeCountryAddress?: string;
  nocStatus?: string;
  tradeSpecialization?: string;
  salaryPaymentMode?: string;
  previousCompanyName?: string;
  bankWalletDetails?: string;
  departmentName?: string;
  designationName?: string;
  uploadedDocuments?: Array<{
    id: string;
    documentTypeId?: string;
    type: string; // e.g. 'Passport', 'License', 'QID', 'Contract'
    name: string;
    fileUrl: string;
    expiryDate?: string;
    docNumber?: string;
    issueDate?: string;
  }>;
  documents?: DocumentRecord[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  removeProfilePhoto?: boolean;
}

export type OwnerType = 'employee' | 'vehicle' | 'company';

export interface DocumentType {
  id: string;
  name: string;
  code: string;
  ownerType: OwnerType;
  docNumberRequired: boolean;
  issueDateRequired: boolean;
  expiryDateRequired: boolean;
  fileRequired: boolean;
  reminderEnabled: boolean;
  customReminderDays: number[]; // e.g. [30, 15, 10, 7, 3, 1, 0]
  /** Days before expiry that a yellow warning is raised (QID 15, Passport 90, Istimara 30). */
  alertLeadDays: number;
  defaultValidityMonths?: number;
  active: boolean;
}

export type ExpiryStatus = 'valid' | 'warning' | 'critical' | 'expires_today' | 'expired' | 'no_expiry';

export interface DocumentRenewalRecord {
  id: string;
  documentId: string;
  previousDocNumber: string;
  previousIssueDate: string;
  previousExpiryDate: string;
  previousFileUrl?: string;
  newDocNumber: string;
  newIssueDate: string;
  newExpiryDate: string;
  newFileUrl?: string;
  renewalDate: string;
  renewedBy: string;
  renewedByName: string;
  notes?: string;
  changeReason?: string;
}

export interface DocumentRecord {
  id: string;
  companyId: string;
  ownerType: OwnerType;
  ownerId: string; // employeeId, vehicleId, or companyId
  ownerName: string; // cached for fast search
  documentTypeId: string;
  documentTypeName: string;
  documentTypeCode?: string;
  documentNumber: string;
  issueDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  status: ExpiryStatus;
  notes?: string;
  fileUrl?: string;
  fileName?: string;
  fileMimeType?: string;
  reminderEnabled: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  daysRemaining?: number;
  /** Lead time used to decide the warning window for this document's type. */
  alertLeadDays?: number;
}

export type VehicleStatus = 'active' | 'under_maintenance' | 'inactive' | 'sold' | 'cancelled' | 'archived';

export interface DriverAssignment {
  id: string;
  vehicleId: string;
  driverId: string;
  driverName: string;
  assignedDate: string;
  unassignedDate?: string;
  isSecondary: boolean;
  notes?: string;
}

export interface Vehicle {
  id: string;
  companyId: string;
  internalVehicleId: string;
  /** Human friendly name shown in the Istimara module. */
  vehicleName?: string;
  vehicleNumber: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
  chassisNumber: string;
  engineNumber: string;
  vehicleType: string; // Bus, Sedan, Pickup, Truck, Van
  assignedDriverId?: string;
  assignedDriverName?: string;
  secondaryDriverId?: string;
  secondaryDriverName?: string;
  ownershipType: 'owned' | 'leased' | 'rented';
  registrationDate: string;
  status: VehicleStatus;
  notes?: string;
  documents?: DocumentRecord[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export type NotificationChannel = 'email' | 'sms' | 'whatsapp';

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  triggerType?: string;
  companyId?: string; // null for all companies
  documentTypeId?: string; // null for all doc types
  language: 'en' | 'ar';
  subject?: string;
  emailSubject?: string;
  messageBody: string;
  body?: string;
  variables?: string[];
  active: boolean;
  createdAt: string;
}

export type NotificationStatus = 'queued' | 'processing' | 'sent' | 'delivered' | 'failed' | 'rejected' | 'cancelled';

export interface CustomReminderRecipient {
  type: 'custom';
  name: string;
  email?: string;
  phone?: string;
}

export interface ReminderRule {
  id: string;
  companyId?: string;
  documentTypeId?: string;
  reminderDays: number[];
  channels: NotificationChannel[];
  recipients: Array<'owner' | 'assigned_hr' | 'company_manager' | 'super_admin' | CustomReminderRecipient>;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationLog {
  id: string;
  recipientName: string;
  recipientContact: string; // email or phone
  companyId: string;
  companyName: string;
  ownerType: OwnerType;
  ownerId: string;
  ownerName: string;
  documentTypeId: string;
  documentTypeName: string;
  documentNumber: string;
  expiryDate: string;
  reminderDay: number;
  channel: NotificationChannel;
  messageBody: string;
  provider: 'Ooredoo SMS' | 'Vodafone SMS' | 'Meta WhatsApp API' | 'SMTP Email' | 'Mock Provider';
  providerMessageId?: string;
  queuedTime: string;
  sentTime?: string;
  deliveredTime?: string;
  status: NotificationStatus;
  failureReason?: string;
  retryCount: number;
  idempotencyKey: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string; // e.g. 'CREATE_EMPLOYEE', 'RENEW_DOCUMENT', 'LOGIN'
  module: 'Authentication' | 'Employee' | 'Document' | 'Vehicle' | 'Company' | 'Notification' | 'Template' | 'Settings' | 'Import';
  entityType?: string;
  entityId?: string;
  recordId?: string;
  companyId?: string;
  companyName?: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export type NotificationProviderSettings = ProviderConfig & {
  smsGatewayUrl?: string;
  smsSenderId?: string;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
};

export interface ExpiryCounts {
  /** Per-type alert counts driven by each document type's own lead time. */
  expiringQid: number;
  expiredQid: number;
  expiringPassport: number;
  expiredPassport: number;
  expiringIstimara: number;
  expiredIstimara: number;
  totalEmployees: number;
  activeEmployees: number;
  cancelledEmployees: number;
  archivedEmployees: number;
  totalVehicles: number;
  totalDocuments: number;
  expiredDocuments: number;
  expiringToday: number;
  expiringIn7Days: number;
  expiringIn15Days: number;
  expiringIn30Days: number;
  documentsWithoutExpiry: number;
  todaySmsCount: number;
  todayWhatsappCount: number;
  todayEmailCount: number;
  queuedNotifications: number;
  sentNotifications: number;
  deliveredNotifications: number;
  failedNotifications: number;
}

export interface ProviderConfig {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  mockMode: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smsApiKey?: string;
  smsSenderId?: string;
  whatsappToken?: string;
  whatsappPhoneNumberId?: string;
}

export interface SystemSettings {
  timezone: 'Asia/Qatar';
  qatarTimeOffset: number; // UTC+3
  globalReminderDays: number[];
  defaultFileMaxSizeMb: number;
  providerConfig: ProviderConfig;
  autoExpiryScanEnabled: boolean;
  lastExpiryScanAt?: string;
}