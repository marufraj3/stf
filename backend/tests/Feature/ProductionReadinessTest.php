<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Document;
use App\Models\DocumentRenewal;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\NotificationLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProductionReadinessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_fresh_install_contains_configuration_but_no_demo_business_records(): void
    {
        $this->assertDatabaseCount('companies', 4);
        $this->assertDatabaseCount('roles', 5);
        $this->assertDatabaseCount('document_types', 16);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('employees', 0);
        $this->assertDatabaseCount('vehicles', 0);
        $this->assertDatabaseCount('documents', 0);
        $this->assertDatabaseCount('notification_logs', 0);
    }

    public function test_admin_can_login_and_bootstrap_real_empty_data(): void
    {
        $login = $this->postJson('/api/auth/login', [
            'email' => 'admin@trustgroup.local',
            'password' => 'password',
        ])->assertOk()->assertJsonPath('user.roleName', 'Super Admin');

        $this->assertTrue($login->json('user.forcePasswordChange'));
        $this->withToken($login->json('token'))
            ->putJson('/api/auth/password', [
                'currentPassword' => 'password',
                'password' => 'Production-Ready-2026!',
                'password_confirmation' => 'Production-Ready-2026!',
            ])
            ->assertOk();
        $this->assertDatabaseHas('users', [
            'email' => 'admin@trustgroup.local',
            'force_password_change' => false,
        ]);

        $this->withToken($login->json('token'))
            ->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonCount(4, 'data.companies')
            ->assertJsonCount(0, 'data.employees')
            ->assertJsonCount(0, 'data.documents')
            ->assertJsonCount(0, 'data.vehicles')
            ->assertJsonPath('meta.isDemo', false);
    }

    public function test_company_scope_is_enforced_by_the_api(): void
    {
        $companyOne = Company::query()->firstOrFail();
        $companyTwo = Company::query()->whereKeyNot($companyOne->id)->firstOrFail();
        $hr = User::create([
            'name' => 'Scoped HR',
            'email' => 'scoped.hr@example.test',
            'password' => 'long-temporary-password',
            'status' => 'active',
            'all_companies' => false,
        ]);
        $hr->assignRole('HR');
        $hr->companies()->attach($companyOne->id, ['is_primary' => true]);
        Sanctum::actingAs($hr, ['erp']);

        $this->postJson('/api/resources/employees', [
            'companyId' => $companyTwo->id,
            'employeeCode' => 'DENIED-001',
            'fullName' => 'Denied Employee',
        ])->assertUnprocessable()->assertJsonValidationErrors('companyId');

        $this->postJson('/api/resources/employees', [
            'companyId' => $companyOne->id,
            'employeeCode' => 'ALLOWED-001',
            'fullName' => 'Allowed Employee',
        ])->assertCreated()->assertJsonPath('data.companyId', (string) $companyOne->id);
    }

    public function test_super_admin_impersonation_uses_a_real_audited_token(): void
    {
        $admin = User::where('email', 'admin@trustgroup.local')->firstOrFail();
        $target = User::create([
            'name' => 'HR Account',
            'email' => 'hr@example.test',
            'password' => 'long-temporary-password',
            'status' => 'active',
            'all_companies' => true,
        ]);
        $target->assignRole('HR');
        $target->companies()->sync(Company::pluck('id')->mapWithKeys(fn ($id) => [$id => ['is_primary' => false]])->all());
        Sanctum::actingAs($admin, ['erp']);

        $this->postJson('/api/auth/impersonate/'.$target->id)
            ->assertOk()
            ->assertJsonPath('user.id', (string) $target->id)
            ->assertJsonPath('user.roleName', 'HR')
            ->assertJsonStructure(['token', 'impersonatedBy']);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'IMPERSONATE',
            'record_id' => (string) $target->id,
        ]);
    }

    public function test_reminders_are_idempotent_and_renewal_preserves_history(): void
    {
        Queue::fake();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-07-24 09:00:00', 'Asia/Qatar'));
        $admin = User::where('email', 'admin@trustgroup.local')->firstOrFail();
        Sanctum::actingAs($admin, ['erp']);
        $company = Company::firstOrFail();
        $employee = Employee::create([
            'company_id' => $company->id,
            'employee_code' => 'REM-001',
            'full_name' => 'Reminder Employee',
            'email' => 'reminder@example.test',
            'mobile' => '+97450000001',
            'status' => 'active',
        ]);
        $type = DocumentType::where('code', 'qid')->firstOrFail();
        $document = Document::create([
            'company_id' => $company->id,
            'owner_type' => 'employee',
            'owner_id' => $employee->id,
            'document_type_id' => $type->id,
            'document_number' => 'QID-REM-001',
            'issue_date' => '2026-01-01',
            'expiry_date' => '2026-08-23',
            'status' => 'active',
            'reminder_enabled' => true,
        ]);

        $this->postJson('/api/reminders/scan')
            ->assertOk()
            ->assertJsonPath('generatedCount', 3)
            ->assertJsonPath('duplicateCount', 0);
        $this->postJson('/api/reminders/scan')
            ->assertOk()
            ->assertJsonPath('generatedCount', 0)
            ->assertJsonPath('duplicateCount', 3);
        $this->assertDatabaseCount('notification_logs', 3);

        $this->postJson('/api/documents/'.$document->id.'/renew', [
            'newDocNumber' => 'QID-REM-002',
            'newIssueDate' => '2026-08-01',
            'newExpiryDate' => '2027-08-23',
            'changeReason' => 'Annual renewal',
        ])->assertCreated()->assertJsonPath('data.document.documentNumber', 'QID-REM-002');

        $this->assertDatabaseCount('document_renewals', 1);
        $this->assertSame('QID-REM-001', DocumentRenewal::first()->previous_document_number);
        $this->assertSame(3, NotificationLog::where('status', 'cancelled')->count());
        CarbonImmutable::setTestNow();
    }

    public function test_bulk_import_requires_preview_then_commit_and_report_exports_are_real(): void
    {
        $admin = User::where('email', 'admin@trustgroup.local')->firstOrFail();
        Sanctum::actingAs($admin, ['erp']);
        $company = Company::firstOrFail();
        $file = UploadedFile::fake()->createWithContent(
            'employees.csv',
            "fullName,employeeCode,mobile,email,status\nImported Employee,IMP-001,+97450000002,imported@example.test,active\n"
        );

        $preview = $this->post('/api/imports/preview', [
            'type' => 'employees',
            'companyId' => $company->id,
            'file' => $file,
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.valid', 1)
            ->assertJsonPath('data.invalid', 0);

        $this->assertDatabaseCount('employees', 0);
        $this->postJson('/api/imports/'.$preview->json('data.batchId').'/commit')
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.failed', 0);
        $this->assertDatabaseHas('employees', ['employee_code' => 'IMP-001']);

        $this->get('/api/reports/export?type=employees&format=csv')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_private_document_file_requires_an_authenticated_company_scoped_download(): void
    {
        Storage::fake('local');
        $admin = User::where('email', 'admin@trustgroup.local')->firstOrFail();
        Sanctum::actingAs($admin, ['erp']);
        $company = Company::firstOrFail();
        $employee = Employee::create([
            'company_id' => $company->id,
            'employee_code' => 'FILE-001',
            'full_name' => 'File Test',
            'status' => 'active',
        ]);
        $type = DocumentType::where('code', 'qid')->firstOrFail();
        $response = $this->postJson('/api/resources/documents', [
            'companyId' => $company->id,
            'ownerType' => 'employee',
            'ownerId' => $employee->id,
            'documentTypeId' => $type->id,
            'documentNumber' => 'QID-FILE-001',
            'expiryDate' => '2027-01-01',
            'fileUrl' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        ])->assertCreated();

        $url = $response->json('data.fileUrl');
        $this->assertStringStartsWith('/files/', $url);
        $this->get('/api'.$url)->assertOk()->assertHeader('content-type', 'image/png');
        $this->assertDatabaseCount('stored_files', 1);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'DOWNLOAD',
            'module' => 'File',
        ]);
    }

    public function test_company_document_permissions_cannot_leak_employee_documents(): void
    {
        $company = Company::query()->firstOrFail();
        $employee = Employee::create([
            'company_id' => $company->id,
            'employee_code' => 'DOC-SCOPE-001',
            'full_name' => 'Document Scope Employee',
            'status' => 'active',
        ]);
        $employeeType = DocumentType::query()->where('code', 'qid')->firstOrFail();
        $companyType = DocumentType::query()->where('code', 'trade-license')->firstOrFail();
        Document::create([
            'company_id' => $company->id,
            'owner_type' => 'employee',
            'owner_id' => $employee->id,
            'document_type_id' => $employeeType->id,
            'document_number' => 'PRIVATE-EMPLOYEE-DOCUMENT',
            'expiry_date' => '2027-01-01',
            'status' => 'active',
        ]);

        $role = Role::create(['name' => 'Company License Manager', 'guard_name' => 'web']);
        $role->syncPermissions(['company_documents.view', 'company_documents.manage']);
        $user = User::create([
            'name' => 'Company License Manager',
            'email' => 'company.license.manager@example.test',
            'password' => 'long-temporary-password',
            'status' => 'active',
            'all_companies' => false,
        ]);
        $user->assignRole($role);
        $user->companies()->attach($company->id, ['is_primary' => true]);
        Sanctum::actingAs($user, ['erp']);

        $companyDocument = $this->postJson('/api/resources/documents', [
            'companyId' => $company->id,
            'ownerType' => 'company',
            'ownerId' => $company->id,
            'documentTypeId' => $companyType->id,
            'documentNumber' => 'COMPANY-LICENSE-001',
            'expiryDate' => '2027-01-01',
        ])->assertCreated()->json('data');

        $this->getJson('/api/resources/documents?per_page=100')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.documentNumber', 'COMPANY-LICENSE-001');
        $this->getJson('/api/resources/documents?owner_type=employee')
            ->assertForbidden();

        $this->postJson('/api/documents/'.$companyDocument['id'].'/renew', [
            'newDocNumber' => 'COMPANY-LICENSE-002',
            'newExpiryDate' => '2028-01-01',
            'changeReason' => 'Annual company licence renewal',
        ])->assertCreated()->assertJsonPath('data.document.documentNumber', 'COMPANY-LICENSE-002');
    }
}
