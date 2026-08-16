<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name');
            $table->string('cr_number')->nullable();
            $table->string('tax_number')->nullable();
            $table->string('computer_card_number')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 40)->nullable();
            $table->text('address')->nullable();
            $table->string('po_box', 50)->nullable();
            $table->string('city', 100)->default('Doha');
            $table->string('country', 100)->default('Qatar');
            $table->string('logo_path')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->json('reminder_days')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('company_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            $table->unique(['company_id', 'user_id']);
            $table->index(['user_id', 'is_primary']);
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 30);
            $table->foreignId('manager_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'is_active']);
        });

        Schema::create('designations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('code', 30)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['company_id', 'is_active']);
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('designation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('internal_id', 60)->nullable();
            $table->string('employee_code', 60);
            $table->string('full_name');
            $table->string('profile_photo_path')->nullable();
            $table->string('nationality', 100)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('mobile', 40)->nullable();
            $table->string('alternative_mobile', 40)->nullable();
            $table->string('email')->nullable();
            $table->text('qatar_address')->nullable();
            $table->text('home_country_address')->nullable();
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_relationship', 100)->nullable();
            $table->string('emergency_contact_phone', 40)->nullable();
            $table->date('joining_date')->nullable();
            $table->decimal('basic_salary', 12, 2)->default(0);
            $table->decimal('allowances', 12, 2)->default(0);
            $table->string('noc_status', 100)->nullable();
            $table->string('trade_specialization')->nullable();
            $table->string('salary_payment_mode', 100)->nullable();
            $table->string('previous_company_name')->nullable();
            $table->text('bank_wallet_details')->nullable();
            $table->string('status', 30)->default('active')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['company_id', 'employee_code']);
            $table->index(['company_id', 'department_id', 'status']);
            $table->index(['full_name', 'mobile']);
        });

        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('internal_vehicle_id', 60);
            $table->string('vehicle_number', 80);
            $table->string('plate_number', 80);
            $table->string('make', 100)->nullable();
            $table->string('model', 100)->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('colour', 60)->nullable();
            $table->string('chassis_number', 120)->nullable();
            $table->string('engine_number', 120)->nullable();
            $table->string('vehicle_type', 80)->nullable();
            $table->foreignId('assigned_driver_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('secondary_driver_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('ownership_type', 30)->default('owned');
            $table->date('registration_date')->nullable();
            $table->string('status', 30)->default('active')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['company_id', 'internal_vehicle_id']);
            $table->index(['company_id', 'plate_number']);
        });

        Schema::create('vehicle_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->string('assignment_type', 20)->default('primary');
            $table->date('assigned_date');
            $table->date('unassigned_date')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['vehicle_id', 'unassigned_date']);
            $table->index(['employee_id', 'unassigned_date']);
        });

        Schema::create('stored_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('disk', 40)->default('local');
            $table->string('path')->unique();
            $table->string('original_name');
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size_bytes');
            $table->char('sha256', 64)->index();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('document_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 80)->unique();
            $table->string('owner_type', 20)->index();
            $table->boolean('document_number_required')->default(true);
            $table->boolean('issue_date_required')->default(false);
            $table->boolean('expiry_date_required')->default(true);
            $table->boolean('file_required')->default(false);
            $table->boolean('reminder_enabled')->default(true);
            $table->json('custom_reminder_days')->nullable();
            $table->unsignedSmallInteger('default_validity_months')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('owner_type', 20);
            $table->unsignedBigInteger('owner_id');
            $table->foreignId('document_type_id')->constrained()->restrictOnDelete();
            $table->string('document_number')->nullable();
            $table->date('issue_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('issuing_country', 100)->nullable();
            $table->string('issuing_authority')->nullable();
            $table->string('status', 30)->default('active');
            $table->text('notes')->nullable();
            $table->foreignId('current_file_id')->nullable()->constrained('stored_files')->nullOnDelete();
            $table->boolean('reminder_enabled')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['company_id', 'owner_type', 'owner_id']);
            $table->index(['company_id', 'document_type_id', 'expiry_date']);
            $table->index(['document_number']);
        });

        Schema::create('document_renewals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->string('previous_document_number')->nullable();
            $table->date('previous_issue_date')->nullable();
            $table->date('previous_expiry_date')->nullable();
            $table->foreignId('previous_file_id')->nullable()->constrained('stored_files')->nullOnDelete();
            $table->string('new_document_number')->nullable();
            $table->date('new_issue_date')->nullable();
            $table->date('new_expiry_date')->nullable();
            $table->foreignId('new_file_id')->nullable()->constrained('stored_files')->nullOnDelete();
            $table->timestamp('renewed_at');
            $table->foreignId('renewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->text('change_reason')->nullable();
            $table->timestamps();
            $table->index(['document_id', 'renewed_at']);
        });

        Schema::create('reminder_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('document_type_id')->nullable()->constrained()->cascadeOnDelete();
            $table->json('reminder_days');
            $table->json('channels');
            $table->json('recipients');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['company_id', 'document_type_id']);
        });

        Schema::create('notification_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('document_type_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('channel', 20);
            $table->string('language', 10)->default('en');
            $table->string('email_subject')->nullable();
            $table->text('message_body');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['channel', 'is_active']);
        });

        Schema::create('notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_id')->nullable()->constrained()->nullOnDelete();
            $table->string('owner_type', 20)->nullable();
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->foreignId('document_type_id')->nullable()->constrained()->nullOnDelete();
            $table->string('recipient_name')->nullable();
            $table->string('recipient_contact');
            $table->string('channel', 20);
            $table->string('provider', 100)->nullable();
            $table->string('provider_message_id')->nullable();
            $table->string('email_subject')->nullable();
            $table->text('message_body');
            $table->date('expiry_date')->nullable();
            $table->smallInteger('reminder_day')->nullable();
            $table->date('scheduled_date')->nullable();
            $table->string('status', 30)->default('queued')->index();
            $table->text('failure_reason')->nullable();
            $table->unsignedTinyInteger('retry_count')->default(0);
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->string('idempotency_key', 190)->unique();
            $table->json('provider_payload')->nullable();
            $table->timestamps();
            $table->index(['company_id', 'channel', 'created_at']);
            $table->index(['document_id', 'scheduled_date']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('company_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 100);
            $table->string('module', 80);
            $table->string('record_type')->nullable();
            $table->string('record_id', 80)->nullable();
            $table->json('previous_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();
            $table->index(['module', 'created_at']);
            $table->index(['company_id', 'created_at']);
        });

        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('key', 100);
            $table->json('value');
            $table->boolean('is_secret')->default(false);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['company_id', 'key']);
        });

        Schema::create('import_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 50);
            $table->string('status', 30)->default('preview');
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('valid_rows')->default(0);
            $table->unsignedInteger('invalid_rows')->default(0);
            $table->unsignedInteger('created_rows')->default(0);
            $table->unsignedInteger('updated_rows')->default(0);
            $table->json('column_mapping')->nullable();
            $table->timestamps();
        });

        Schema::create('import_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->json('raw_data');
            $table->json('normalized_data')->nullable();
            $table->json('errors')->nullable();
            $table->string('status', 30)->default('pending');
            $table->timestamps();
            $table->unique(['import_batch_id', 'row_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_rows');
        Schema::dropIfExists('import_batches');
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('notification_logs');
        Schema::dropIfExists('notification_templates');
        Schema::dropIfExists('reminder_rules');
        Schema::dropIfExists('document_renewals');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('document_types');
        Schema::dropIfExists('stored_files');
        Schema::dropIfExists('vehicle_assignments');
        Schema::dropIfExists('vehicles');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('designations');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('company_user');
        Schema::dropIfExists('companies');
    }
};
