<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->string('employee_name');
            $table->string('employee_code', 60)->nullable();
            $table->string('account_phone', 40)->nullable();
            $table->string('account_phone_owner', 20)->default('company'); // company|employee
            $table->string('personal_phone', 40)->nullable();
            $table->string('nationality', 100)->nullable();
            $table->string('iban_number', 80)->nullable();
            $table->date('bank_card_expiry_date')->nullable();
            $table->foreignId('bank_file_id')->nullable()->constrained('stored_files')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['company_id','employee_id']);
            $table->index(['bank_card_expiry_date']);
        });

        Schema::create('employee_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->string('employee_name');
            $table->string('subject', 255)->nullable();
            $table->text('message_body');
            $table->string('channel', 20)->default('internal');
            $table->string('status', 20)->default('sent');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['company_id','employee_id','created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_messages');
        Schema::dropIfExists('bank_documents');
    }
};
