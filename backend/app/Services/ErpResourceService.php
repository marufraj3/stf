<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Document;
use App\Models\DocumentRenewal;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\NotificationTemplate;
use App\Models\ReminderRule;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleAssignment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ErpResourceService
{
    private const RESOURCES = [
        'companies' => [
            'model' => Company::class,
            'company_column' => 'id',
            'view' => 'companies.view',
            'create' => 'companies.manage',
            'update' => 'companies.manage',
            'archive' => 'companies.manage',
            'search' => ['name', 'code', 'email', 'phone'],
            'sort' => ['name', 'code', 'created_at'],
            'presenter' => 'company',
        ],
        'departments' => [
            'model' => Department::class,
            'company_column' => 'company_id',
            'view' => 'departments.view',
            'create' => 'departments.manage',
            'update' => 'departments.manage',
            'search' => ['name', 'code'],
            'sort' => ['name', 'code', 'created_at'],
            'presenter' => 'department',
        ],
        'designations' => [
            'model' => Designation::class,
            'company_column' => 'company_id',
            'view' => 'designations.view',
            'create' => 'designations.manage',
            'update' => 'designations.manage',
            'search' => ['name', 'code'],
            'sort' => ['name', 'code', 'created_at'],
            'presenter' => 'designation',
        ],
        'employees' => [
            'model' => Employee::class,
            'company_column' => 'company_id',
            'view' => 'employees.view',
            'create' => 'employees.create',
            'update' => 'employees.update',
            'archive' => 'employees.archive',
            'restore' => 'employees.restore',
            'search' => ['full_name', 'employee_code', 'mobile', 'email', 'nationality'],
            'sort' => ['full_name', 'employee_code', 'joining_date', 'status', 'created_at'],
            'presenter' => 'employee',
        ],
        'vehicles' => [
            'model' => Vehicle::class,
            'company_column' => 'company_id',
            'view' => 'vehicles.view',
            'create' => 'vehicles.manage',
            'update' => 'vehicles.manage',
            'archive' => 'vehicles.archive',
            'restore' => 'vehicles.restore',
            'search' => ['internal_vehicle_id', 'vehicle_number', 'plate_number', 'make', 'model'],
            'sort' => ['vehicle_number', 'plate_number', 'make', 'status', 'created_at'],
            'presenter' => 'vehicle',
        ],
        'document-types' => [
            'model' => DocumentType::class,
            'company_column' => null,
            'view' => 'document_types.view',
            'create' => 'document_types.manage',
            'update' => 'document_types.manage',
            'search' => ['name', 'code', 'owner_type'],
            'sort' => ['name', 'code', 'owner_type', 'created_at'],
            'presenter' => 'documentType',
        ],
        'documents' => [
            'model' => Document::class,
            'company_column' => 'company_id',
            'view' => 'documents.view',
            'create' => 'documents.create',
            'update' => 'documents.update',
            'archive' => 'documents.archive',
            'restore' => 'documents.restore',
            'search' => ['document_number', 'issuing_country', 'issuing_authority', 'notes'],
            'sort' => ['document_number', 'expiry_date', 'issue_date', 'created_at'],
            'presenter' => 'document',
        ],
        'templates' => [
            'model' => NotificationTemplate::class,
            'company_column' => 'company_id',
            'view' => 'templates.view',
            'create' => 'templates.manage',
            'update' => 'templates.manage',
            'search' => ['name', 'channel', 'language', 'message_body'],
            'sort' => ['name', 'channel', 'created_at'],
            'presenter' => 'template',
        ],
        'reminder-rules' => [
            'model' => ReminderRule::class,
            'company_column' => 'company_id',
            'view' => 'notifications.view',
            'create' => 'notifications.manage',
            'update' => 'notifications.manage',
            'search' => [],
            'sort' => ['company_id', 'document_type_id', 'created_at'],
            'presenter' => 'reminderRule',
        ],
    ];

    public function __construct(
        private readonly CompanyScope $companyScope,
        private readonly ApiPresenter $presenter,
        private readonly FileStorageService $files,
        private readonly AuditService $audit,
    ) {
    }

    public function list(string $resource, User $user, array $filters): LengthAwarePaginator
    {
        $config = $this->config($resource);
        $companyDocumentsOnly = false;
        if ($resource === 'documents' && !$user->isSuperAdmin() && !$user->can('documents.view')) {
            $this->authorize($user, 'company_documents.view');
            if (
                !empty($filters['owner_type'])
                && $filters['owner_type'] !== 'company'
            ) {
                abort(403, 'Company-document access cannot be used to view another owner type.');
            }
            $companyDocumentsOnly = true;
        } else {
            $this->authorize($user, $config['view']);
        }
        $archivedOnly = filter_var($filters['archived_only'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $includeArchived = $archivedOnly
            || filter_var($filters['include_archived'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $query = $this->query($resource, $user, $includeArchived);
        if ($companyDocumentsOnly) {
            $query->where('owner_type', 'company');
        }
        if ($archivedOnly && in_array($resource, ['employees', 'vehicles', 'documents', 'companies'], true)) {
            $query->onlyTrashed();
        }

        if ($companyId = ($filters['company_id'] ?? null)) {
            $this->companyScope->authorize($user, (int) $companyId);
            $column = $config['company_column'];
            if ($column) {
                $query->where($column === 'id' ? 'id' : $column, $companyId);
            }
        }

        if (($search = trim((string) ($filters['search'] ?? ''))) && $config['search'] !== []) {
            $query->where(function (Builder $nested) use ($config, $search) {
                foreach ($config['search'] as $index => $column) {
                    $method = $index === 0 ? 'where' : 'orWhere';
                    $nested->{$method}($column, 'like', '%'.$search.'%');
                }
            });
        }

        foreach (['owner_type', 'owner_id', 'document_type_id', 'department_id'] as $filter) {
            if (isset($filters[$filter]) && $filters[$filter] !== '') {
                $query->where($filter, $filters[$filter]);
            }
        }
        if (!empty($filters['status'])) {
            $resource === 'documents'
                ? $this->applyDocumentStatus($query, (string) $filters['status'])
                : $query->where('status', $filters['status']);
        }

        if (!empty($filters['expiry_from'])) {
            $query->whereDate('expiry_date', '>=', $filters['expiry_from']);
        }
        if (!empty($filters['expiry_to'])) {
            $query->whereDate('expiry_date', '<=', $filters['expiry_to']);
        }

        $sort = in_array(($filters['sort_by'] ?? ''), $config['sort'], true)
            ? $filters['sort_by']
            : 'created_at';
        $direction = ($filters['direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));

        $paginator = $query->orderBy($sort, $direction)->paginate($perPage);
        $paginator->setCollection(
            $paginator->getCollection()->map(
                fn (Model $model) => $this->present($resource, $model)
            )
        );

        return $paginator;
    }

    private function applyDocumentStatus(Builder $query, string $status): void
    {
        $today = now('Asia/Qatar')->toDateString();
        match ($status) {
            'expired' => $query->whereNotNull('expiry_date')->whereDate('expiry_date', '<', $today),
            'expires_today' => $query->whereDate('expiry_date', $today),
            'critical' => $query->whereBetween('expiry_date', [
                now('Asia/Qatar')->addDay()->toDateString(),
                now('Asia/Qatar')->addDays(10)->toDateString(),
            ]),
            'warning' => $query->whereBetween('expiry_date', [
                now('Asia/Qatar')->addDays(11)->toDateString(),
                now('Asia/Qatar')->addDays(30)->toDateString(),
            ]),
            'valid' => $query->whereDate('expiry_date', '>', now('Asia/Qatar')->addDays(30)->toDateString()),
            'no_expiry' => $query->whereNull('expiry_date'),
            default => $query->where('status', $status),
        };
    }

    public function all(string $resource, User $user, bool $includeArchived = false): array
    {
        $config = $this->config($resource);
        if (!$user->can($config['view']) && !$user->isSuperAdmin()) {
            return [];
        }

        return $this->query($resource, $user, $includeArchived)
            ->orderBy('id')
            ->get()
            ->map(fn (Model $model) => $this->present($resource, $model))
            ->all();
    }

    public function store(string $resource, User $user, array $data): array
    {
        $config = $this->config($resource);
        if ($resource === 'documents' && ($data['ownerType'] ?? null) === 'company') {
            $this->authorizeAny($user, [$config['create'], 'company_documents.manage']);
        } else {
            $this->authorize($user, $config['create']);
        }

        return DB::transaction(function () use ($resource, $user, $data) {
            $model = $this->saveModel($resource, null, $data, $user);
            $this->audit->record(
                $user,
                'CREATE',
                str($resource)->singular()->title()->toString(),
                $model->getKey(),
                $model->company_id ?? null,
                null,
                $model->toArray(),
            );

            return $this->present($resource, $model->fresh());
        });
    }

    public function update(string $resource, Model $model, User $user, array $data): array
    {
        $config = $this->config($resource);
        if (
            $resource === 'documents'
            && $model instanceof Document
            && $model->owner_type === 'company'
            && ($data['ownerType'] ?? 'company') === 'company'
        ) {
            $this->authorizeAny($user, [$config['update'], 'company_documents.manage']);
        } else {
            $this->authorize($user, $config['update']);
        }
        $this->authorizeModel($model, $config, $user);

        return DB::transaction(function () use ($resource, $model, $user, $data) {
            $before = $model->toArray();
            $saved = $this->saveModel($resource, $model, $data, $user);
            $this->audit->record(
                $user,
                'UPDATE',
                str($resource)->singular()->title()->toString(),
                $saved->getKey(),
                $saved->company_id ?? null,
                $before,
                $saved->toArray(),
            );

            return $this->present($resource, $saved->fresh());
        });
    }

    public function archive(string $resource, Model $model, User $user): void
    {
        $config = $this->config($resource);
        $permission = $config['archive'] ?? null;
        if (!$permission) {
            throw ValidationException::withMessages(['resource' => 'This resource cannot be archived.']);
        }
        if ($resource === 'documents' && $model instanceof Document && $model->owner_type === 'company') {
            $this->authorizeAny($user, [$permission, 'company_documents.manage']);
        } else {
            $this->authorize($user, $permission);
        }
        $this->authorizeModel($model, $config, $user);
        $before = $model->toArray();
        $model->delete();
        $this->audit->record(
            $user,
            'ARCHIVE',
            str($resource)->singular()->title()->toString(),
            $model->getKey(),
            $model->company_id ?? null,
            $before,
            null,
        );
    }

    public function restore(string $resource, int $id, User $user): array
    {
        $config = $this->config($resource);
        $permission = $config['restore'] ?? null;
        if (!$permission) {
            throw ValidationException::withMessages(['resource' => 'This resource cannot be restored.']);
        }
        /** @var Model $model */
        $model = $config['model']::withTrashed()->findOrFail($id);
        if ($resource === 'documents' && $model instanceof Document && $model->owner_type === 'company') {
            $this->authorizeAny($user, [$permission, 'company_documents.manage']);
        } else {
            $this->authorize($user, $permission);
        }
        $this->authorizeModel($model, $config, $user);
        $model->restore();
        $this->audit->record(
            $user,
            'RESTORE',
            str($resource)->singular()->title()->toString(),
            $model->getKey(),
            $model->company_id ?? null,
            null,
            $model->toArray(),
        );

        return $this->present($resource, $model->fresh());
    }

    public function findModel(string $resource, int $id, bool $withTrashed = false): Model
    {
        $config = $this->config($resource);
        $query = $config['model']::query();
        if ($withTrashed && method_exists($config['model'], 'bootSoftDeletes')) {
            $query->withTrashed();
        }

        return $query->findOrFail($id);
    }

    private function query(string $resource, User $user, bool $includeArchived): Builder
    {
        $config = $this->config($resource);
        /** @var Builder $query */
        $query = $config['model']::query();

        if ($includeArchived && in_array($resource, ['employees', 'vehicles', 'documents', 'companies'], true)) {
            $query->withTrashed();
        }

        if ($config['company_column']) {
            if ($resource === 'reminder-rules' && !$user->isSuperAdmin() && !$user->all_companies) {
                $query->where(function (Builder $scope) use ($user, $config) {
                    $scope->whereNull($config['company_column'])
                        ->orWhereIn($config['company_column'], $this->companyScope->ids($user));
                });
            } else {
                $this->companyScope->apply($query, $user, $config['company_column']);
            }
        }

        if ($resource === 'employees') {
            $query->with(['department', 'designation']);
            if ($user->isSuperAdmin() || $user->can('documents.view')) {
                $query->with(['documents.documentType', 'documents.currentFile']);
            }
        } elseif ($resource === 'vehicles') {
            $query->with(['assignedDriver', 'secondaryDriver']);
            if ($user->isSuperAdmin() || $user->can('documents.view')) {
                $query->with(['documents.documentType', 'documents.currentFile']);
            }
        } elseif ($resource === 'documents') {
            $query->with(['documentType', 'currentFile']);
        }

        return $query;
    }

    private function saveModel(string $resource, ?Model $model, array $data, User $user): Model
    {
        return match ($resource) {
            'companies' => $this->saveCompany($model, $data, $user),
            'departments' => $this->saveDepartment($model, $data, $user),
            'designations' => $this->saveDesignation($model, $data, $user),
            'employees' => $this->saveEmployee($model, $data, $user),
            'vehicles' => $this->saveVehicle($model, $data, $user),
            'document-types' => $this->saveDocumentType($model, $data),
            'documents' => $this->saveDocument($model, $data, $user),
            'templates' => $this->saveTemplate($model, $data, $user),
            'reminder-rules' => $this->saveReminderRule($model, $data, $user),
            default => throw ValidationException::withMessages(['resource' => 'Unsupported resource.']),
        };
    }

    private function saveCompany(?Model $model, array $data, User $user): Company
    {
        $company = $model instanceof Company ? $model : new Company();
        $validated = Validator::make($data, [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:30', Rule::unique('companies', 'code')->ignore($company->id)],
            'email' => ['nullable', 'email', 'max:255'],
        ])->validate();

        $logo = $this->files->storeDataUrl(
            $data['logoUrl'] ?? null,
            $company->id ?: null,
            $user,
            $data['logoFileName'] ?? 'company-logo',
            ['image/jpeg', 'image/png'],
        );
        $company->fill([
            ...$validated,
            'cr_number' => $data['crNumber'] ?? null,
            'tax_number' => $data['taxNumber'] ?? null,
            'computer_card_number' => $data['computerCardNumber'] ?? null,
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
            'po_box' => $data['poBox'] ?? null,
            'city' => $data['city'] ?? 'Doha',
            'country' => $data['country'] ?? 'Qatar',
            'is_active' => $data['active'] ?? true,
            'reminder_days' => $data['reminderDays'] ?? [30, 15, 10, 7, 3, 1, 0],
            'logo_path' => $logo?->id ?? $company->logo_path,
        ])->save();

        return $company;
    }

    private function saveDepartment(?Model $model, array $data, User $user): Department
    {
        $department = $model instanceof Department ? $model : new Department();
        $validated = Validator::make($data, [
            'companyId' => ['required', 'integer', 'exists:companies,id'],
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required', 'string', 'max:30',
                Rule::unique('departments', 'code')
                    ->where(fn ($query) => $query->where('company_id', $data['companyId'] ?? null))
                    ->ignore($department->id),
            ],
            'managerUserId' => ['nullable', 'integer', 'exists:users,id'],
        ])->validate();
        $this->companyScope->authorize($user, $validated['companyId']);
        $department->fill([
            'company_id' => $validated['companyId'],
            'name' => $validated['name'],
            'code' => $validated['code'],
            'manager_user_id' => $validated['managerUserId'] ?? null,
            'is_active' => $data['active'] ?? true,
        ])->save();

        return $department;
    }

    private function saveDesignation(?Model $model, array $data, User $user): Designation
    {
        $designation = $model instanceof Designation ? $model : new Designation();
        $validated = Validator::make($data, [
            'companyId' => ['required', 'integer', 'exists:companies,id'],
            'departmentId' => ['nullable', 'integer', 'exists:departments,id'],
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:30'],
        ])->validate();
        $this->companyScope->authorize($user, $validated['companyId']);
        if (!empty($validated['departmentId'])) {
            $this->validateBelongsToCompany(Department::class, (int) $validated['departmentId'], (int) $validated['companyId'], 'departmentId');
        }
        $designation->fill([
            'company_id' => $validated['companyId'],
            'department_id' => $validated['departmentId'] ?? null,
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'is_active' => $data['active'] ?? true,
        ])->save();

        return $designation;
    }

    private function saveEmployee(?Model $model, array $data, User $user): Employee
    {
        $employee = $model instanceof Employee ? $model : new Employee();
        $validated = Validator::make($data, [
            'companyId' => ['required', 'integer', 'exists:companies,id'],
            'departmentId' => ['nullable', 'integer', 'exists:departments,id'],
            'designationId' => ['nullable', 'integer', 'exists:designations,id'],
            'employeeCode' => [
                'required', 'string', 'max:60',
                Rule::unique('employees', 'employee_code')
                    ->where(fn ($query) => $query->where('company_id', $data['companyId'] ?? null))
                    ->ignore($employee->id),
            ],
            'fullName' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'dateOfBirth' => ['nullable', 'date', 'before:today'],
            'joiningDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'on_leave', 'suspended', 'cancelled', 'resigned', 'terminated'])],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'basicSalary' => ['nullable', 'numeric', 'min:0'],
            'allowances' => ['nullable', 'numeric', 'min:0'],
        ])->validate();
        $this->companyScope->authorize($user, $validated['companyId']);
        if (!empty($validated['departmentId'])) {
            $this->validateBelongsToCompany(Department::class, (int) $validated['departmentId'], (int) $validated['companyId'], 'departmentId');
        }
        if (!empty($validated['designationId'])) {
            $this->validateBelongsToCompany(Designation::class, (int) $validated['designationId'], (int) $validated['companyId'], 'designationId');
        }
        $photo = $this->files->storeDataUrl(
            $data['profilePhoto'] ?? null,
            (int) $validated['companyId'],
            $user,
            $data['profilePhotoFileName'] ?? 'profile-photo',
            ['image/jpeg', 'image/png'],
        );
        $emergency = Arr::wrap($data['emergencyContact'] ?? []);

        $employee->fill([
            'company_id' => $validated['companyId'],
            'department_id' => $validated['departmentId'] ?? null,
            'designation_id' => $validated['designationId'] ?? null,
            'internal_id' => $data['internalId'] ?? null,
            'employee_code' => $validated['employeeCode'],
            'full_name' => $validated['fullName'],
            'profile_photo_path' => !empty($data['removeProfilePhoto'])
    ? null
    : ($photo?->id ?? $employee->profile_photo_path),
            'nationality' => $data['nationality'] ?? null,
            'date_of_birth' => $this->nullable($validated['dateOfBirth'] ?? null),
            'gender' => $validated['gender'] ?? null,
            'mobile' => $data['mobile'] ?? null,
            'alternative_mobile' => $data['altMobile'] ?? null,
            'email' => $validated['email'] ?? null,
            'qatar_address' => $data['qatarAddress'] ?? null,
            'home_country_address' => $data['homeCountryAddress'] ?? null,
            'emergency_contact_name' => $emergency['name'] ?? null,
            'emergency_contact_relationship' => $emergency['relationship'] ?? null,
            'emergency_contact_phone' => $emergency['phone'] ?? null,
            'joining_date' => $this->nullable($validated['joiningDate'] ?? null),
            'basic_salary' => $validated['basicSalary'] ?? 0,
            'allowances' => $validated['allowances'] ?? 0,
            'noc_status' => $data['nocStatus'] ?? null,
            'trade_specialization' => $data['tradeSpecialization'] ?? null,
            'salary_payment_mode' => $data['salaryPaymentMode'] ?? null,
            'previous_company_name' => $data['previousCompanyName'] ?? null,
            'bank_wallet_details' => $data['bankWalletDetails'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'notes' => $data['notes'] ?? null,
            'created_by' => $employee->exists ? $employee->created_by : $user->id,
            'updated_by' => $user->id,
        ])->save();

        return $employee;
    }

    private function saveVehicle(?Model $model, array $data, User $user): Vehicle
    {
        $vehicle = $model instanceof Vehicle ? $model : new Vehicle();
        $validated = Validator::make($data, [
            'companyId' => ['required', 'integer', 'exists:companies,id'],
            'internalVehicleId' => [
                'required', 'string', 'max:60',
                Rule::unique('vehicles', 'internal_vehicle_id')
                    ->where(fn ($query) => $query->where('company_id', $data['companyId'] ?? null))
                    ->ignore($vehicle->id),
            ],
            'vehicleNumber' => ['required', 'string', 'max:80'],
            'plateNumber' => ['required', 'string', 'max:80'],
            'assignedDriverId' => ['nullable', 'integer', 'exists:employees,id'],
            'secondaryDriverId' => ['nullable', 'integer', 'exists:employees,id'],
            'year' => ['nullable', 'integer', 'between:1900,2100'],
            'status' => ['nullable', Rule::in(['active', 'under_maintenance', 'inactive', 'sold', 'cancelled'])],
            'ownershipType' => ['nullable', Rule::in(['owned', 'leased', 'rented'])],
        ])->validate();
        $this->companyScope->authorize($user, $validated['companyId']);
        if (!empty($validated['assignedDriverId'])) {
            $this->validateBelongsToCompany(Employee::class, (int) $validated['assignedDriverId'], (int) $validated['companyId'], 'assignedDriverId');
        }
        if (!empty($validated['secondaryDriverId'])) {
            $this->validateBelongsToCompany(Employee::class, (int) $validated['secondaryDriverId'], (int) $validated['companyId'], 'secondaryDriverId');
        }
        if (
            !empty($validated['assignedDriverId'])
            && (int) $validated['assignedDriverId'] === (int) ($validated['secondaryDriverId'] ?? 0)
        ) {
            throw ValidationException::withMessages(['secondaryDriverId' => 'Primary and secondary drivers must be different.']);
        }
        $oldPrimary = $vehicle->assigned_driver_id;
        $oldSecondary = $vehicle->secondary_driver_id;

        $vehicle->fill([
            'company_id' => $validated['companyId'],
            'internal_vehicle_id' => $validated['internalVehicleId'],
            'vehicle_number' => $validated['vehicleNumber'],
            'plate_number' => $validated['plateNumber'],
            'make' => $data['make'] ?? null,
            'model' => $data['model'] ?? null,
            'year' => $validated['year'] ?? null,
            'colour' => $data['color'] ?? null,
            'chassis_number' => $data['chassisNumber'] ?? null,
            'engine_number' => $data['engineNumber'] ?? null,
            'vehicle_type' => $data['vehicleType'] ?? null,
            'assigned_driver_id' => $validated['assignedDriverId'] ?? null,
            'secondary_driver_id' => $validated['secondaryDriverId'] ?? null,
            'ownership_type' => $validated['ownershipType'] ?? 'owned',
            'registration_date' => $this->nullable($data['registrationDate'] ?? null),
            'status' => $validated['status'] ?? 'active',
            'notes' => $data['notes'] ?? null,
            'created_by' => $vehicle->exists ? $vehicle->created_by : $user->id,
            'updated_by' => $user->id,
        ])->save();

        $this->syncDriverAssignment($vehicle, $oldPrimary, $vehicle->assigned_driver_id, 'primary', $user);
        $this->syncDriverAssignment($vehicle, $oldSecondary, $vehicle->secondary_driver_id, 'secondary', $user);

        return $vehicle;
    }

    private function saveDocumentType(?Model $model, array $data): DocumentType
    {
        $type = $model instanceof DocumentType ? $model : new DocumentType();
        $validated = Validator::make($data, [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:80', Rule::unique('document_types', 'code')->ignore($type->id)],
            'ownerType' => ['required', Rule::in(['employee', 'vehicle', 'company'])],
            'customReminderDays' => ['nullable', 'array'],
            'customReminderDays.*' => ['integer', 'min:0', 'max:3650'],
        ])->validate();
        $type->fill([
            'name' => $validated['name'],
            'code' => $validated['code'],
            'owner_type' => $validated['ownerType'],
            'document_number_required' => $data['docNumberRequired'] ?? true,
            'issue_date_required' => $data['issueDateRequired'] ?? false,
            'expiry_date_required' => $data['expiryDateRequired'] ?? true,
            'file_required' => $data['fileRequired'] ?? false,
            'reminder_enabled' => $data['reminderEnabled'] ?? true,
            'custom_reminder_days' => $validated['customReminderDays'] ?? [30, 15, 10, 7, 3, 1, 0],
            'default_validity_months' => $data['defaultValidityMonths'] ?? null,
            'is_active' => $data['active'] ?? true,
        ])->save();

        return $type;
    }

    private function saveDocument(?Model $model, array $data, User $user): Document
    {
        $document = $model instanceof Document ? $model : new Document();
        $validated = Validator::make($data, [
            'companyId' => ['required', 'integer', 'exists:companies,id'],
            'ownerType' => ['required', Rule::in(['employee', 'vehicle', 'company'])],
            'ownerId' => ['required', 'integer'],
            'documentTypeId' => ['required', 'integer', 'exists:document_types,id'],
            'documentNumber' => ['nullable', 'string', 'max:255'],
            'issueDate' => ['nullable', 'date'],
            'expiryDate' => ['nullable', 'date'],
        ])->validate();
        $this->companyScope->authorize($user, $validated['companyId']);
        $this->validateOwner($validated['ownerType'], (int) $validated['ownerId'], (int) $validated['companyId']);
        $type = DocumentType::query()->findOrFail($validated['documentTypeId']);
        if ($type->owner_type !== $validated['ownerType']) {
            throw ValidationException::withMessages(['documentTypeId' => 'Document type owner does not match.']);
        }
        if ($type->document_number_required && empty($validated['documentNumber'])) {
            throw ValidationException::withMessages(['documentNumber' => 'Document number is required.']);
        }
        if ($type->issue_date_required && empty($validated['issueDate'])) {
            throw ValidationException::withMessages(['issueDate' => 'Issue date is required.']);
        }
        if ($type->expiry_date_required && empty($validated['expiryDate'])) {
            throw ValidationException::withMessages(['expiryDate' => 'Expiry date is required.']);
        }
        if (
            !empty($validated['issueDate'])
            && !empty($validated['expiryDate'])
            && $validated['expiryDate'] < $validated['issueDate']
        ) {
            throw ValidationException::withMessages(['expiryDate' => 'Expiry date cannot be before issue date.']);
        }
        if ($type->file_required && !$document->current_file_id && empty($data['fileUrl'])) {
            throw ValidationException::withMessages(['file' => 'A file is required for this document type.']);
        }

        $file = $this->files->storeDataUrl(
            $data['fileUrl'] ?? null,
            (int) $validated['companyId'],
            $user,
            $data['fileName'] ?? null,
        );
        $document->fill([
            'company_id' => $validated['companyId'],
            'owner_type' => $validated['ownerType'],
            'owner_id' => $validated['ownerId'],
            'document_type_id' => $validated['documentTypeId'],
            'document_number' => $validated['documentNumber'] ?? null,
            'issue_date' => $this->nullable($validated['issueDate'] ?? null),
            'expiry_date' => $this->nullable($validated['expiryDate'] ?? null),
            'issuing_country' => $data['issuingCountry'] ?? null,
            'issuing_authority' => $data['issuingAuthority'] ?? null,
            'status' => 'active',
            'notes' => $data['notes'] ?? null,
            'current_file_id' => $file?->id ?? $document->current_file_id,
            'reminder_enabled' => $data['reminderEnabled'] ?? $type->reminder_enabled,
            'created_by' => $document->exists ? $document->created_by : $user->id,
            'updated_by' => $user->id,
        ])->save();

        return $document;
    }

    private function saveTemplate(?Model $model, array $data, User $user): NotificationTemplate
    {
        $template = $model instanceof NotificationTemplate ? $model : new NotificationTemplate();
        $validated = Validator::make($data, [
            'name' => ['required', 'string', 'max:255'],
            'channel' => ['required', Rule::in(['email', 'sms', 'whatsapp'])],
            'language' => ['nullable', 'string', 'max:10'],
            'companyId' => ['nullable', 'integer', 'exists:companies,id'],
            'documentTypeId' => ['nullable', 'integer', 'exists:document_types,id'],
            'messageBody' => ['required_without:body', 'nullable', 'string'],
            'body' => ['required_without:messageBody', 'nullable', 'string'],
        ])->validate();
        if (!empty($validated['companyId'])) {
            $this->companyScope->authorize($user, $validated['companyId']);
        } elseif (!$user->isSuperAdmin()) {
            throw ValidationException::withMessages([
                'companyId' => 'Only a Super Admin may create a global template.',
            ]);
        }
        $template->fill([
            'company_id' => $validated['companyId'] ?? null,
            'document_type_id' => $validated['documentTypeId'] ?? null,
            'name' => $validated['name'],
            'channel' => $validated['channel'],
            'language' => $validated['language'] ?? 'en',
            'email_subject' => $data['emailSubject'] ?? $data['subject'] ?? null,
            'message_body' => $validated['messageBody'] ?? $validated['body'],
            'is_active' => $data['active'] ?? true,
        ])->save();

        return $template;
    }

    private function saveReminderRule(?Model $model, array $data, User $user): ReminderRule
    {
        $rule = $model instanceof ReminderRule ? $model : new ReminderRule();
        $validated = Validator::make($data, [
            'companyId' => ['nullable', 'integer', 'exists:companies,id'],
            'documentTypeId' => ['nullable', 'integer', 'exists:document_types,id'],
            'reminderDays' => ['required', 'array', 'min:1'],
            'reminderDays.*' => ['required', 'integer', 'distinct', 'min:0', 'max:3650'],
            'channels' => ['required', 'array', 'min:1'],
            'channels.*' => ['required', Rule::in(['email', 'sms', 'whatsapp']), 'distinct'],
            'recipients' => ['required', 'array', 'min:1'],
            'active' => ['nullable', 'boolean'],
        ])->validate();
        if (!empty($validated['companyId'])) {
            $this->companyScope->authorize($user, $validated['companyId']);
        } elseif (!$user->isSuperAdmin()) {
            throw ValidationException::withMessages([
                'companyId' => 'Only a Super Admin may create a global reminder rule.',
            ]);
        }
        foreach ($validated['recipients'] as $recipient) {
            $type = is_array($recipient) ? ($recipient['type'] ?? null) : $recipient;
            if (!in_array($type, ['owner', 'assigned_hr', 'company_manager', 'super_admin', 'custom'], true)) {
                throw ValidationException::withMessages(['recipients' => 'A reminder recipient is invalid.']);
            }
            if ($type === 'custom' && (!is_array($recipient) || empty($recipient['email']) && empty($recipient['phone']))) {
                throw ValidationException::withMessages([
                    'recipients' => 'A custom recipient requires an email address or phone number.',
                ]);
            }
        }
        $duplicate = ReminderRule::query()
            ->where('company_id', $validated['companyId'] ?? null)
            ->where('document_type_id', $validated['documentTypeId'] ?? null)
            ->when($rule->exists, fn ($query) => $query->whereKeyNot($rule->id))
            ->exists();
        if ($duplicate) {
            throw ValidationException::withMessages([
                'documentTypeId' => 'A reminder rule already exists for this company and document type.',
            ]);
        }
        $rule->fill([
            'company_id' => $validated['companyId'] ?? null,
            'document_type_id' => $validated['documentTypeId'] ?? null,
            'reminder_days' => array_values(array_unique(array_map('intval', $validated['reminderDays']))),
            'channels' => array_values($validated['channels']),
            'recipients' => array_values($validated['recipients']),
            'is_active' => $validated['active'] ?? true,
        ])->save();

        return $rule;
    }

    private function syncDriverAssignment(
        Vehicle $vehicle,
        ?int $oldEmployeeId,
        ?int $newEmployeeId,
        string $type,
        User $user,
    ): void {
        if ($oldEmployeeId === $newEmployeeId) {
            return;
        }

        VehicleAssignment::query()
            ->where('vehicle_id', $vehicle->id)
            ->where('assignment_type', $type)
            ->whereNull('unassigned_date')
            ->update(['unassigned_date' => now('Asia/Qatar')->toDateString()]);

        if ($newEmployeeId) {
            VehicleAssignment::create([
                'company_id' => $vehicle->company_id,
                'vehicle_id' => $vehicle->id,
                'employee_id' => $newEmployeeId,
                'assignment_type' => $type,
                'assigned_date' => now('Asia/Qatar')->toDateString(),
                'assigned_by' => $user->id,
            ]);
        }
    }

    private function validateOwner(string $type, int $ownerId, int $companyId): void
    {
        $valid = match ($type) {
            'employee' => Employee::withTrashed()->whereKey($ownerId)->where('company_id', $companyId)->exists(),
            'vehicle' => Vehicle::withTrashed()->whereKey($ownerId)->where('company_id', $companyId)->exists(),
            'company' => Company::withTrashed()->whereKey($ownerId)->whereKey($companyId)->exists(),
            default => false,
        };

        if (!$valid) {
            throw ValidationException::withMessages(['ownerId' => 'The selected owner is invalid for this company.']);
        }
    }

    /** @param class-string<Model> $model */
    private function validateBelongsToCompany(string $model, int $id, int $companyId, string $field): void
    {
        if (!$model::query()->whereKey($id)->where('company_id', $companyId)->exists()) {
            throw ValidationException::withMessages([
                $field => 'The selected record does not belong to this company.',
            ]);
        }
    }

    private function authorizeModel(Model $model, array $config, User $user): void
    {
        $column = $config['company_column'];
        if ($column) {
            $companyId = $column === 'id' ? $model->getKey() : $model->{$column};
            $this->companyScope->authorize($user, $companyId);
        }
    }

    private function authorize(User $user, string $permission): void
    {
        abort_unless($user->isSuperAdmin() || $user->can($permission), 403, 'You do not have permission to perform this action.');
    }

    /** @param array<int, string> $permissions */
    private function authorizeAny(User $user, array $permissions): void
    {
        abort_unless(
            $user->isSuperAdmin()
                || collect($permissions)->contains(fn (string $permission) => $user->can($permission)),
            403,
            'You do not have permission to perform this action.',
        );
    }

    private function present(string $resource, Model $model): array
    {
        $method = $this->config($resource)['presenter'];

        return $this->presenter->{$method}($model);
    }

    private function config(string $resource): array
    {
        if (!isset(self::RESOURCES[$resource])) {
            abort(404, 'Resource not found.');
        }

        return self::RESOURCES[$resource];
    }

    private function nullable(mixed $value): mixed
    {
        return $value === '' ? null : $value;
    }
}