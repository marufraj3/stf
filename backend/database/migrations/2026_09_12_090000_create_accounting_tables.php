<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('accounting_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('account_type', ['monthly_fee', 'company_car_rent', 'personal_car_rent', 'qid_fee']);
            $table->string('title');
            $table->string('reference_no')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->nullable();
            $table->decimal('down_payment_percent', 5, 2)->nullable();
            $table->decimal('interest_percent', 5, 2)->nullable();
            $table->unsignedInteger('program_months')->nullable();
            $table->string('status')->default('active');
            $table->json('details')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['company_id', 'account_type', 'status']);
        });

        Schema::create('accounting_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('accounting_account_id')->constrained('accounting_accounts')->cascadeOnDelete();
            $table->date('payment_date')->nullable();
            $table->date('due_date')->nullable();
            $table->string('period_label')->nullable();
            $table->decimal('amount_due', 12, 2)->default(0);
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->string('voucher_no')->nullable();
            $table->string('payment_method')->nullable();
            $table->string('status')->default('due');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['accounting_account_id', 'status', 'payment_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_payments');
        Schema::dropIfExists('accounting_accounts');
    }
};
