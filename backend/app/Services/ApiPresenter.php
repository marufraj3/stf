<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\BankDocument;
use App\Models\Company;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Document;
use App\Models\DocumentRenewal;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\EmployeeMessage;
use App\Models\NotificationLog;
use App\Models\NotificationTemplate;
use App\Models\ReminderRule;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class ApiPresenter
{
    /** @var array<string, string> */
    private array $ownerNames = [];

    public function user(User $user): array
    {
        $user->loadMissing('roles.permissions', 'companies');
        $primary = $user->companies->firstWhere('pivot.is_primary', true)?->id
            ?? $user->companies->first()?->id;
        $role = $user->roles->first();

        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roleId' => $role ? (string) $role->id : '',
            'roleName' => $role?->name ?? 'No Role',
            'roleIds' => $user->roles->pluck('id')->map(fn ($id) => (string) $id)->values(),
            'roleNames' => $user->roles->pluck('name')->values(),
            'roles' => $user->roles->map(fn (Role $item) => $this->role($item))->values(),
            'permissions' => $user->getAllPermissions()->pluck('name')->values(),
            'companyAccess' => ($user->isSuperAdmin() || $user->all_companies)
                ? 'all'
                : $user->companies->pluck('id')->map(fn ($id) => (string) $id)->values(),
            'primaryCompanyId' => $primary ? (string) $primary : '',
            'avatarUrl' => $this->fileUrl($user->profile_photo_path),
            'status' => $user->status,
            'lastLoginAt' => $user->last_login_at?->toIso8601String(),
            'forcePasswordChange' => $user->force_password_change,
            'isSuperAdmin' => $user->isSuperAdmin(),
        ];
    }

    public function role(Role $role): array
    {
        $role->loadMissing('permissions');

        return [
            'id' => (string) $role->id,
            'name' => $role->name,
            'description' => $role->name.' permissions',
            'code' => str($role->name)->slug('_')->toString(),
            'isSystem' => in_array($role->name, ['Super Admin', 'HR', 'Manager', 'Accountant', 'Read-Only User'], true),
            'permissions' => $role->permissions->pluck('name')->values(),
        ];
    }

    public function permission(Permission $permission): array
    {
        $category = str($permission->name)->before('.')->replace('_', ' ')->title()->toString();

        return [
            'id' => (string) $permission->id,
            'code' => $permission->name,
            'name' => str($permission->name)->after('.')->replace('_', ' ')->title()->toString(),
            'category' => $category,
            'description' => 'Allows '.$permission->name,
        ];
    }

    public function company(Company $company): array
    {
        return [
            'id' => (string) $company->id,
            'code' => $company->code,
            'name' => $company->name,
            'crNumber' => $company->cr_number,
            'taxNumber' => $company->tax_number,
            'computerCardNumber' => $company->computer_card_number,
            'email' => $company->email ?? '',
            'phone' => $company->phone ?? '',
            'address' => $company->address ?? '',
            'poBox' => $company->po_box,
            'city' => $company->city,
            'country' => $company->country,
            // Branding, not a controlled document: anyone who can see the
            // company may load its logo.
            'logoUrl' => $company->logo_path ? '/files/'.$company->logo_path : null,
            'active' => $company->is_active,
            'createdAt' => $company->created_at?->toIso8601String(),
        ];
    }

    public function department(Department $department): array
    {
        return [
            'id' => (string) $department->id,
            'companyId' => (string) $department->company_id,
            'name' => $department->name,
            'code' => $department->code,
            'managerName' => $department->manager_user_id
                ? User::query()->whereKey($department->manager_user_id)->value('name')
                : null,
        ];
    }

    public function designation(Designation $designation): array
    {
        return [
            'id' => (string) $designation->id,
            'companyId' => (string) $designation->company_id,
            'name' => $designation->name,
            'code' => $designation->code,
            'departmentId' => $designation->department_id ? (string) $designation->department_id : '',
        ];
    }

    public function employee(Employee $employee): array
    {
        $documents = $employee->relationLoaded('documents')
            ? $employee->documents->map(fn (Document $document) => $this->document($document))->values()
            : collect();
        $documentByCode = fn (string $code): ?array => $documents->first(
            fn (array $document) => ($document['documentTypeCode'] ?? null) === $code
        );
        $qid = $documentByCode('qid');
        $passport = $documentByCode('passport');
        $license = $documentByCode('driving-license');
        $healthCard = $documentByCode('health-card');

        return [
            'id' => (string) $employee->id,
            'internalId' => $employee->internal_id ?? '',
            'employeeCode' => $employee->employee_code,
            'fullName' => $employee->full_name,
            'profilePhoto' => $this->fileUrl($employee->profile_photo_path),
            'companyId' => (string) $employee->company_id,
            'departmentId' => $employee->department_id ? (string) $employee->department_id : '',
            'designationId' => $employee->designation_id ? (string) $employee->designation_id : '',
            'departmentName' => $employee->relationLoaded('department')
                ? ($employee->department?->name ?? '')
                : ($employee->department_id ? Department::whereKey($employee->department_id)->value('name') : ''),
            'designationName' => $employee->relationLoaded('designation')
                ? ($employee->designation?->name ?? '')
                : ($employee->designation_id ? Designation::whereKey($employee->designation_id)->value('name') : ''),
            'nationality' => $employee->nationality ?? '',
            'dateOfBirth' => $this->date($employee->date_of_birth),
            'gender' => $employee->gender ?? 'male',
            'mobile' => $employee->mobile ?? '',
            'altMobile' => $employee->alternative_mobile,
            'email' => $employee->email ?? '',
            'qatarAddress' => $employee->qatar_address ?? '',
            'homeCountryAddress' => $employee->home_country_address,
            'emergencyContact' => [
                'name' => $employee->emergency_contact_name ?? '',
                'relationship' => $employee->emergency_contact_relationship ?? '',
                'phone' => $employee->emergency_contact_phone ?? '',
            ],
            'joiningDate' => $this->date($employee->joining_date),
            'basicSalary' => (float) $employee->basic_salary,
            'allowances' => (float) $employee->allowances,
            'status' => $employee->deleted_at ? 'archived' : $employee->status,
            'notes' => $employee->notes,
            'nocStatus' => $employee->noc_status,
            'tradeSpecialization' => $employee->trade_specialization,
            'salaryPaymentMode' => $employee->salary_payment_mode,
            'previousCompanyName' => $employee->previous_company_name,
            'bankWalletDetails' => $employee->bank_wallet_details,
            'qidNumber' => $qid['documentNumber'] ?? '',
            'qidExpiryDate' => $qid['expiryDate'] ?? '',
            'qidFileUrl' => $qid['fileUrl'] ?? null,
            'passportNumber' => $passport['documentNumber'] ?? '',
            'passportExpiryDate' => $passport['expiryDate'] ?? '',
            'passportFileUrl' => $passport['fileUrl'] ?? null,
            'licenseNumber' => $license['documentNumber'] ?? '',
            'licenseExpiryDate' => $license['expiryDate'] ?? '',
            'licenseFileUrl' => $license['fileUrl'] ?? null,
            'healthCardNumber' => $healthCard['documentNumber'] ?? '',
            'healthCardExpiryDate' => $healthCard['expiryDate'] ?? '',
            'healthCardFileUrl' => $healthCard['fileUrl'] ?? null,
            'documents' => $documents,
            'uploadedDocuments' => $documents->map(fn (array $document) => [
                'id' => $document['id'],
                'documentTypeId' => $document['documentTypeId'],
                'type' => $document['documentTypeName'],
                'name' => $document['fileName'] ?? $document['documentTypeName'],
                'fileUrl' => $document['fileUrl'] ?? '',
                'expiryDate' => $document['expiryDate'],
                'docNumber' => $document['documentNumber'],
                'issueDate' => $document['issueDate'],
            ])->values(),
            'createdBy' => (string) ($employee->created_by ?? ''),
            'updatedBy' => (string) ($employee->updated_by ?? ''),
            'createdAt' => $employee->created_at?->toIso8601String(),
            'updatedAt' => $employee->updated_at?->toIso8601String(),
            'archivedAt' => $employee->deleted_at?->toIso8601String(),
        ];
    }

    public function documentType(DocumentType $type): array
    {
        return [
            'id' => (string) $type->id,
            'name' => $type->name,
            'code' => $type->code,
            'ownerType' => $type->owner_type,
            'docNumberRequired' => $type->document_number_required,
            'issueDateRequired' => $type->issue_date_required,
            'expiryDateRequired' => $type->expiry_date_required,
            'fileRequired' => $type->file_required,
            'reminderEnabled' => $type->reminder_enabled,
            'customReminderDays' => $type->custom_reminder_days ?? [],
            'alertLeadDays' => $type->alertLeadDays(),
            'defaultValidityMonths' => $type->default_validity_months,
            'active' => $type->is_active,
        ];
    }

    public function document(Document $document): array
    {
        $type = $document->relationLoaded('documentType')
            ? $document->documentType
            : DocumentType::query()->find($document->document_type_id);
        $file = $document->relationLoaded('currentFile')
            ? $document->currentFile
            : ($document->current_file_id
                ? \App\Models\StoredFile::query()->find($document->current_file_id)
                : null);
        $status = $this->expiryStatus($document->expiry_date, $type?->alertLeadDays());

        return [
            'id' => (string) $document->id,
            'companyId' => (string) $document->company_id,
            'ownerType' => $document->owner_type,
            'ownerId' => (string) $document->owner_id,
            'ownerName' => $this->ownerName($document->owner_type, $document->owner_id),
            'documentTypeId' => (string) $document->document_type_id,
            'documentTypeName' => $type?->name ?? 'Document',
            'documentTypeCode' => $type?->code ?? '',
            'documentNumber' => $document->document_number ?? '',
            'issueDate' => $this->date($document->issue_date),
            'expiryDate' => $this->date($document->expiry_date),
            'issuingAuthority' => $document->issuing_authority,
            'issuingCountry' => $document->issuing_country,
            'status' => $status['status'],
            'daysRemaining' => $status['daysRemaining'],
            'alertLeadDays' => $status['alertLeadDays'],
            'notes' => $document->notes,
            'fileUrl' => $this->fileUrl($document->current_file_id),
            'fileName' => $file?->original_name,
            'fileMimeType' => $file?->mime_type,
            'reminderEnabled' => $document->reminder_enabled,
            'createdBy' => (string) ($document->created_by ?? ''),
            'updatedBy' => (string) ($document->updated_by ?? ''),
            'createdAt' => $document->created_at?->toIso8601String(),
            'updatedAt' => $document->updated_at?->toIso8601String(),
            'archivedAt' => $document->deleted_at?->toIso8601String(),
        ];
    }

    public function renewal(DocumentRenewal $renewal): array
    {
        return [
            'id' => (string) $renewal->id,
            'documentId' => (string) $renewal->document_id,
            'previousDocNumber' => $renewal->previous_document_number ?? '',
            'previousIssueDate' => $this->date($renewal->previous_issue_date),
            'previousExpiryDate' => $this->date($renewal->previous_expiry_date),
            'previousFileUrl' => $this->fileUrl($renewal->previous_file_id),
            'newDocNumber' => $renewal->new_document_number ?? '',
            'newIssueDate' => $this->date($renewal->new_issue_date),
            'newExpiryDate' => $this->date($renewal->new_expiry_date),
            'newFileUrl' => $this->fileUrl($renewal->new_file_id),
            'renewalDate' => $renewal->renewed_at?->toDateString(),
            'renewedBy' => (string) ($renewal->renewed_by ?? ''),
            'renewedByName' => $renewal->renewed_by ? User::whereKey($renewal->renewed_by)->value('name') : '',
            'notes' => $renewal->notes,
            'changeReason' => $renewal->change_reason,
        ];
    }

    public function vehicle(Vehicle $vehicle): array
    {
        $documents = $vehicle->relationLoaded('documents')
            ? $vehicle->documents->map(fn (Document $document) => $this->document($document))->values()
            : collect();
        $registration = $this->expiryStatus($vehicle->expiry_date, 30);

        return [
            'id' => (string) $vehicle->id,
            'companyId' => (string) $vehicle->company_id,
            'internalVehicleId' => $vehicle->internal_vehicle_id,
            'vehicleName' => $vehicle->vehicle_name
                ?: trim(implode(' ', array_filter([$vehicle->make, $vehicle->model])))
                ?: $vehicle->vehicle_number,
            'vehicleNumber' => $vehicle->vehicle_number,
            'plateNumber' => $vehicle->plate_number,
            'make' => $vehicle->make ?? '',
            'model' => $vehicle->model ?? '',
            'year' => (int) ($vehicle->year ?? 0),
            'color' => $vehicle->colour ?? '',
            'chassisNumber' => $vehicle->chassis_number ?? '',
            'engineNumber' => $vehicle->engine_number ?? '',
            'vehicleType' => $vehicle->vehicle_type ?? '',
            'assignedDriverId' => $vehicle->assigned_driver_id ? (string) $vehicle->assigned_driver_id : null,
            'assignedDriverName' => $vehicle->relationLoaded('assignedDriver')
                ? $vehicle->assignedDriver?->full_name
                : ($vehicle->assigned_driver_id ? Employee::whereKey($vehicle->assigned_driver_id)->value('full_name') : null),
            'secondaryDriverId' => $vehicle->secondary_driver_id ? (string) $vehicle->secondary_driver_id : null,
            'secondaryDriverName' => $vehicle->relationLoaded('secondaryDriver')
                ? $vehicle->secondaryDriver?->full_name
                : ($vehicle->secondary_driver_id ? Employee::whereKey($vehicle->secondary_driver_id)->value('full_name') : null),
            'ownershipType' => $vehicle->ownership_type,
            'registrationDate' => $this->date($vehicle->registration_date),
            'issueDate' => $this->date($vehicle->issue_date),
            'expiryDate' => $this->date($vehicle->expiry_date),
            'renewDate' => $this->date($vehicle->renew_date),
            'registrationExpiryStatus' => $registration['status'],
            'registrationDaysRemaining' => $registration['daysRemaining'],
            'status' => $vehicle->deleted_at ? 'archived' : $vehicle->status,
            'notes' => $vehicle->notes,
            'documents' => $documents,
            'createdBy' => (string) ($vehicle->created_by ?? ''),
            'updatedBy' => (string) ($vehicle->updated_by ?? ''),
            'createdAt' => $vehicle->created_at?->toIso8601String(),
            'updatedAt' => $vehicle->updated_at?->toIso8601String(),
            'archivedAt' => $vehicle->deleted_at?->toIso8601String(),
        ];
    }

    public function template(NotificationTemplate $template): array
    {
        return [
            'id' => (string) $template->id,
            'name' => $template->name,
            'channel' => $template->channel,
            'companyId' => $template->company_id ? (string) $template->company_id : null,
            'documentTypeId' => $template->document_type_id ? (string) $template->document_type_id : null,
            'language' => $template->language,
            'subject' => $template->email_subject,
            'emailSubject' => $template->email_subject,
            'messageBody' => $template->message_body,
            'body' => $template->message_body,
            'active' => $template->is_active,
            'createdAt' => $template->created_at?->toIso8601String(),
        ];
    }

    public function reminderRule(ReminderRule $rule): array
    {
        return [
            'id' => (string) $rule->id,
            'companyId' => $rule->company_id ? (string) $rule->company_id : null,
            'documentTypeId' => $rule->document_type_id ? (string) $rule->document_type_id : null,
            'reminderDays' => $rule->reminder_days ?? [],
            'channels' => $rule->channels ?? [],
            'recipients' => $rule->recipients ?? [],
            'active' => $rule->is_active,
            'createdAt' => $rule->created_at?->toIso8601String(),
            'updatedAt' => $rule->updated_at?->toIso8601String(),
        ];
    }

    public function notification(NotificationLog $log): array
    {
        $company = Company::query()->find($log->company_id);
        $type = $log->document_type_id ? DocumentType::query()->find($log->document_type_id) : null;

        return [
            'id' => (string) $log->id,
            'recipientName' => $log->recipient_name ?? '',
            'recipientContact' => $log->recipient_contact,
            'companyId' => (string) $log->company_id,
            'companyName' => $company?->name ?? '',
            'ownerType' => $log->owner_type ?? 'employee',
            'ownerId' => (string) ($log->owner_id ?? ''),
            'ownerName' => $log->owner_type && $log->owner_id ? $this->ownerName($log->owner_type, $log->owner_id) : '',
            'documentTypeId' => (string) ($log->document_type_id ?? ''),
            'documentTypeName' => $type?->name ?? '',
            'documentNumber' => $log->document_id ? Document::whereKey($log->document_id)->value('document_number') : '',
            'expiryDate' => $this->date($log->expiry_date),
            'reminderDay' => (int) ($log->reminder_day ?? 0),
            'channel' => $log->channel,
            'emailSubject' => $log->email_subject,
            'messageBody' => $log->message_body,
            'provider' => $log->provider ?? 'Mock Provider',
            'providerMessageId' => $log->provider_message_id,
            'queuedTime' => $log->queued_at?->toIso8601String() ?? $log->created_at?->toIso8601String(),
            'sentTime' => $log->sent_at?->toIso8601String(),
            'deliveredTime' => $log->delivered_at?->toIso8601String(),
            'status' => $log->status,
            'failureReason' => $log->failure_reason,
            'retryCount' => $log->retry_count,
            'idempotencyKey' => $log->idempotency_key,
        ];
    }

    public function bankDocument(BankDocument $bd): array
    {
        $card = $this->expiryStatus($bd->bank_card_expiry_date, 30);
        $phone = $this->expiryStatus($bd->account_phone_expiry_date, 30);
        $file = $bd->relationLoaded('bankFile') ? $bd->bankFile : null;

        return [
            'id' => (string) $bd->id,
            'companyId' => (string) $bd->company_id,
            'companyName' => $bd->relationLoaded('company')
                ? ($bd->company?->name ?? '')
                : (Company::whereKey($bd->company_id)->value('name') ?? ''),
            'employeeId' => (string) $bd->employee_id,
            'employeeName' => $bd->employee_name,
            'employeeCode' => $bd->employee_code ?? '',
            'accountPhoneNumber' => $bd->account_phone ?? '',
            'accountPhoneOwner' => $bd->account_phone_owner ?? 'company',
            'accountPhoneExpiryDate' => $this->date($bd->account_phone_expiry_date),
            'accountPhoneExpiryStatus' => $phone['status'],
            'accountPhoneDaysRemaining' => $phone['daysRemaining'],
            'personalPhoneNumber' => $bd->personal_phone ?? '',
            'nationality' => $bd->nationality ?? '',
            'ibanNumber' => $bd->iban_number ?? '',
            'bankCardExpiryDate' => $this->date($bd->bank_card_expiry_date),
            'bankCardExpiryStatus' => $card['status'],
            'bankCardDaysRemaining' => $card['daysRemaining'],
            'bankDocumentUrl' => $this->fileUrl($bd->bank_file_id),
            'bankDocumentFileName' => $file?->original_name ?? '',
            'bankDocumentMimeType' => $file?->mime_type ?? '',
            'notes' => $bd->notes ?? '',
            'createdAt' => $bd->created_at?->toIso8601String(),
            'updatedAt' => $bd->updated_at?->toIso8601String(),
        ];
    }

    public function employeeMessage(EmployeeMessage $m): array
    {
        return [
            'id' => (string) $m->id,
            'companyId' => (string) $m->company_id,
            'employeeId' => (string) $m->employee_id,
            'employeeName' => $m->employee_name,
            'subject' => $m->subject ?? '',
            'messageBody' => $m->message_body,
            'channel' => $m->channel,
            'status' => $m->status,
            'createdBy' => (string) ($m->created_by ?? ''),
            'senderName' => $m->relationLoaded('sender') ? ($m->sender?->name ?? '') : (User::whereKey($m->created_by)->value('name') ?? ''),
            'createdAt' => $m->created_at?->toIso8601String(),
        ];
    }

    public function audit(AuditLog $log): array
    {
        $log->loadMissing(['user', 'company']);

        return [
            'id' => (string) $log->id,
            'userId' => (string) ($log->user_id ?? ''),
            'userName' => $log->user?->name ?? 'System',
            'userEmail' => $log->user?->email ?? '',
            'action' => $log->action,
            'module' => $log->module,
            'entityType' => $log->record_type,
            'entityId' => $log->record_id,
            'recordId' => $log->record_id,
            'companyId' => $log->company_id ? (string) $log->company_id : null,
            'companyName' => $log->company?->name,
            'previousValues' => $log->previous_values,
            'newValues' => $log->new_values,
            'ipAddress' => $log->ip_address ?? '',
            'userAgent' => $log->user_agent ?? '',
            'timestamp' => $log->created_at?->toIso8601String(),
        ];
    }

    public function settings(?SystemSetting $setting): array
    {
        $value = $setting?->value ?? [];
        $provider = $value['providerConfig'] ?? $value;

        return [
            'timezone' => 'Asia/Qatar',
            'qatarTimeOffset' => 3,
            'globalReminderDays' => $value['globalReminderDays'] ?? [30, 15, 10, 7, 3, 1, 0],
            'defaultFileMaxSizeMb' => $value['defaultFileMaxSizeMb'] ?? 5,
            'providerConfig' => [
                'emailEnabled' => $provider['emailEnabled'] ?? false,
                'smsEnabled' => $provider['smsEnabled'] ?? false,
                'whatsappEnabled' => $provider['whatsappEnabled'] ?? false,
                'mockMode' => $provider['mockMode'] ?? true,
            ],
            'autoExpiryScanEnabled' => $value['autoExpiryScanEnabled'] ?? true,
            'lastExpiryScanAt' => $value['lastExpiryScanAt'] ?? null,
        ];
    }

    private function ownerName(string $type, int $id): string
    {
        $key = $type.':'.$id;
        if (isset($this->ownerNames[$key])) {
            return $this->ownerNames[$key];
        }

        return $this->ownerNames[$key] = match ($type) {
            'employee' => Employee::withTrashed()->whereKey($id)->value('full_name') ?? 'Unknown employee',
            'vehicle' => Vehicle::withTrashed()->whereKey($id)->value('vehicle_number') ?? 'Unknown vehicle',
            'company' => Company::withTrashed()->whereKey($id)->value('name') ?? 'Unknown company',
            default => 'Unknown owner',
        };
    }

    private function fileUrl(int|string|null $fileId): ?string
    {
        if (!$fileId) {
            return null;
        }

        $user = auth()->user();
        if ($user && !$user->isSuperAdmin() && !$user->can('files.download')) {
            return null;
        }

        return '/files/'.$fileId;
    }

    private function date(mixed $date): string
    {
        if (!$date) {
            return '';
        }

        return $date instanceof \DateTimeInterface
            ? $date->format('Y-m-d')
            : (string) $date;
    }

    /**
     * Resolve the expiry state of a document.
     *
     * The yellow "expiring soon" window is driven by the document type's own
     * alert lead time (QID 15 days, Passport 90 days, Istimara 30 days, and
     * 30 days for everything else) instead of one hard-coded threshold.
     */
    private function expiryStatus(mixed $expiryDate, ?int $alertLeadDays = null): array
    {
        if (!$expiryDate) {
            return ['status' => 'no_expiry', 'daysRemaining' => null, 'alertLeadDays' => $alertLeadDays];
        }

        $leadDays = $alertLeadDays !== null && $alertLeadDays > 0 ? $alertLeadDays : 30;
        $expiry = CarbonImmutable::parse($expiryDate, 'Asia/Qatar')->startOfDay();
        $today = CarbonImmutable::now('Asia/Qatar')->startOfDay();
        $days = (int) $today->diffInDays($expiry, false);

        // "critical" stays reserved for the final stretch: a third of the lead
        // window, clamped to a sensible 3–10 day band.
        $criticalDays = max(3, min(10, (int) ceil($leadDays / 3)));

        return [
            'status' => match (true) {
                $days < 0 => 'expired',
                $days === 0 => 'expires_today',
                $days <= $criticalDays => 'critical',
                $days <= $leadDays => 'warning',
                default => 'valid',
            },
            'daysRemaining' => $days,
            'alertLeadDays' => $leadDays,
        ];
    }
}
