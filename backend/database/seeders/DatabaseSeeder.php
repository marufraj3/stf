<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\DocumentType;
use App\Models\NotificationTemplate;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissionCodes = [
            'dashboard.view',
            'companies.view', 'companies.manage',
            'departments.view', 'departments.manage',
            'designations.view', 'designations.manage',
            'employees.view', 'employees.create', 'employees.update', 'employees.archive', 'employees.restore',
            'documents.view', 'documents.create', 'documents.update', 'documents.archive', 'documents.restore', 'documents.renew',
            'document_types.view', 'document_types.manage',
            'vehicles.view', 'vehicles.manage', 'vehicles.archive', 'vehicles.restore',
            'company_documents.view', 'company_documents.manage',
            'notifications.view', 'notifications.manage', 'notifications.retry', 'notifications.run',
            'templates.view', 'templates.manage',
            'reports.view', 'reports.export',
            'imports.view', 'imports.create',
            'audit.view',
            'settings.view', 'settings.manage',
            'users.view', 'users.manage',
            'roles.view', 'roles.manage',
            'files.view', 'files.upload', 'files.download',
        ];

        foreach ($permissionCodes as $code) {
            Permission::firstOrCreate(['name' => $code, 'guard_name' => 'web']);
        }

        $rolePermissions = [
            'Super Admin' => $permissionCodes,
            'HR' => [
                'dashboard.view', 'companies.view', 'departments.view', 'designations.view',
                'employees.view', 'employees.create', 'employees.update', 'employees.archive', 'employees.restore',
                'documents.view', 'documents.create', 'documents.update', 'documents.archive', 'documents.restore', 'documents.renew',
                'document_types.view', 'vehicles.view', 'company_documents.view', 'company_documents.manage',
                'notifications.view', 'notifications.run', 'templates.view',
                'reports.view', 'reports.export', 'imports.view', 'imports.create',
                'files.view', 'files.upload', 'files.download',
            ],
            'Manager' => [
                'dashboard.view', 'companies.view', 'departments.view', 'designations.view',
                'employees.view', 'employees.update', 'documents.view', 'documents.create',
                'documents.update', 'documents.renew', 'document_types.view', 'vehicles.view',
                'vehicles.manage', 'company_documents.view', 'notifications.view',
                'reports.view', 'reports.export', 'files.view', 'files.upload', 'files.download',
            ],
            'Accountant' => [
                'dashboard.view', 'companies.view', 'employees.view', 'documents.view',
                'company_documents.view', 'reports.view', 'reports.export', 'files.view', 'files.download',
            ],
            'Read-Only User' => [
                'dashboard.view', 'companies.view', 'departments.view', 'designations.view',
                'employees.view', 'documents.view', 'document_types.view', 'vehicles.view',
                'company_documents.view', 'notifications.view', 'templates.view',
                'reports.view', 'audit.view', 'files.view', 'files.download',
            ],
        ];

        foreach ($rolePermissions as $roleName => $codes) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            $role->syncPermissions($codes);
        }

        foreach ([
            ['code' => 'TL', 'name' => 'Trust Limousine'],
            ['code' => 'TC', 'name' => 'Trust Contracting'],
            ['code' => 'TD', 'name' => 'Trust Delivery'],
            ['code' => 'FS', 'name' => 'Fly Safe'],
        ] as $company) {
            Company::firstOrCreate(['code' => $company['code']], [
                ...$company,
                'city' => 'Doha',
                'country' => 'Qatar',
                'is_active' => true,
                'reminder_days' => [30, 15, 10, 7, 3, 1, 0],
            ]);
        }

        $documentTypes = [
            ['QID', 'qid', 'employee', true, true],
            ['Passport', 'passport', 'employee', true, true],
            ['Visa', 'visa', 'employee', true, true],
            ['Driving License', 'driving-license', 'employee', true, true],
            ['Health Card', 'health-card', 'employee', true, true],
            ['Employment Contract', 'employment-contract', 'employee', false, false],
            ['Istimara', 'istimara', 'vehicle', true, true],
            ['Vehicle Insurance', 'vehicle-insurance', 'vehicle', true, true],
            ['Vehicle Inspection', 'vehicle-inspection', 'vehicle', true, true],
            ['Limousine Permit', 'limousine-permit', 'vehicle', true, true],
            ['Trade License', 'trade-license', 'company', true, true],
            ['Commercial Registration', 'commercial-registration', 'company', true, true],
            ['Computer Card', 'computer-card', 'company', true, true],
            ['Municipality License', 'municipality-license', 'company', true, true],
            ['Labour Contract', 'labour-contract', 'company', true, true],
            ['Establishment Card', 'establishment-card', 'company', true, true],
        ];

        foreach ($documentTypes as [$name, $code, $ownerType, $numberRequired, $expiryRequired]) {
            DocumentType::firstOrCreate(['code' => $code], [
                'name' => $name,
                'owner_type' => $ownerType,
                'document_number_required' => $numberRequired,
                'issue_date_required' => false,
                'expiry_date_required' => $expiryRequired,
                'file_required' => false,
                'reminder_enabled' => $expiryRequired,
                'custom_reminder_days' => [30, 15, 10, 7, 3, 1, 0],
                'is_active' => true,
            ]);
        }

        SystemSetting::updateOrCreate(
            ['company_id' => null, 'key' => 'application'],
            ['value' => [
                'timezone' => 'Asia/Qatar',
                'globalReminderDays' => [30, 15, 10, 7, 3, 1, 0],
                'defaultFileMaxSizeMb' => 5,
                'autoExpiryScanEnabled' => true,
                'providerConfig' => [
                    'emailEnabled' => true,
                    'smsEnabled' => true,
                    'whatsappEnabled' => true,
                    'mockMode' => true,
                ],
            ]]
        );

        foreach ([
            [
                'channel' => 'email',
                'name' => 'Default Expiry Email',
                'email_subject' => '{DocumentType} expiry reminder',
                'message_body' => 'Dear {EmployeeName}, your {DocumentType} will expire on {ExpiryDate}. Please renew it before expiry. Trust Group HR Department',
            ],
            [
                'channel' => 'sms',
                'name' => 'Default Expiry SMS',
                'email_subject' => null,
                'message_body' => 'Dear {EmployeeName}, your {DocumentType} will expire on {ExpiryDate}. Please renew it. Trust Group HR',
            ],
        ] as $template) {
            NotificationTemplate::firstOrCreate(
                [
                    'company_id' => null,
                    'document_type_id' => null,
                    'channel' => $template['channel'],
                    'language' => 'en',
                ],
                [...$template, 'is_active' => true]
            );
        }

        $admin = User::updateOrCreate(
            ['email' => 'admin@trustgroup.local'],
            [
                'name' => 'Trust Group Administrator',
                'password' => Hash::make('password'),
                'status' => 'active',
                'all_companies' => true,
                'force_password_change' => true,
            ]
        );
        $admin->syncRoles(['Super Admin']);
        $admin->companies()->sync(
            Company::query()->pluck('id')->mapWithKeys(
                fn ($id) => [$id => ['is_primary' => false]]
            )->all()
        );

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
