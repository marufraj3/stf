<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Adds the extra fleet registration dates requested for the Vehicle Fleet
     * screen (Istimara issue/expiry/renew), the account phone expiry tracked on
     * the bank document screen, and a set of indexes that keep the list
     * endpoints fast once the database holds 300+ employees and thousands of
     * documents.
     */
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            if (!Schema::hasColumn('vehicles', 'issue_date')) {
                $table->date('issue_date')->nullable()->after('registration_date');
            }
            if (!Schema::hasColumn('vehicles', 'expiry_date')) {
                $table->date('expiry_date')->nullable()->after('issue_date');
            }
            if (!Schema::hasColumn('vehicles', 'renew_date')) {
                $table->date('renew_date')->nullable()->after('expiry_date');
            }
        });

        Schema::table('bank_documents', function (Blueprint $table) {
            if (!Schema::hasColumn('bank_documents', 'account_phone_expiry_date')) {
                $table->date('account_phone_expiry_date')->nullable()->after('account_phone_owner');
            }
        });

        $this->addIndex('vehicles', 'vehicles_company_id_expiry_date_index', ['company_id', 'expiry_date']);
        $this->addIndex('employees', 'employees_company_id_full_name_index', ['company_id', 'full_name']);
        $this->addIndex('employees', 'employees_employee_code_index', ['employee_code']);
        $this->addIndex('documents', 'documents_owner_type_owner_id_index', ['owner_type', 'owner_id']);
        $this->addIndex('documents', 'documents_company_id_expiry_date_index', ['company_id', 'expiry_date']);
        $this->addIndex('bank_documents', 'bank_documents_employee_name_index', ['employee_name']);
        $this->addIndex('bank_documents', 'bank_documents_account_phone_expiry_date_index', ['account_phone_expiry_date']);
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn(['issue_date', 'expiry_date', 'renew_date']);
        });

        Schema::table('bank_documents', function (Blueprint $table) {
            $table->dropColumn('account_phone_expiry_date');
        });
    }

    /**
     * Create an index only when the table exists and the index has not been
     * created by an earlier deployment, so re-running stays safe.
     */
    private function addIndex(string $table, string $name, array $columns): void
    {
        if (!Schema::hasTable($table)) {
            return;
        }
        foreach ($columns as $column) {
            if (!Schema::hasColumn($table, $column)) {
                return;
            }
        }
        try {
            $existing = collect(
                DB::connection()->getDoctrineSchemaManager()->listTableIndexes($table) ?? []
            )->keys()->all();
            if (in_array($name, $existing, true)) {
                return;
            }
        } catch (\Throwable) {
            // Doctrine DBAL is optional; fall through to a guarded create.
        }

        try {
            Schema::table($table, function (Blueprint $blueprint) use ($name, $columns) {
                $blueprint->index($columns, $name);
            });
        } catch (\Throwable) {
            // The index already exists - nothing to do.
        }
    }
};
