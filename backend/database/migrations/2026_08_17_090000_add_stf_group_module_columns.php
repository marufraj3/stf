<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-document-type expiry alert lead time (in days) used by the dashboard
     * alert boxes, plus a human friendly vehicle name for the Istimara module.
     */
    private const ALERT_LEAD_DAYS = [
        'qid' => 15,
        'passport' => 90,
        'istimara' => 30,
    ];

    public function up(): void
    {
        Schema::table('document_types', function (Blueprint $table) {
            $table->unsignedSmallInteger('alert_lead_days')
                ->default(30)
                ->after('custom_reminder_days');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('vehicle_name')->nullable()->after('internal_vehicle_id');
        });

        foreach (self::ALERT_LEAD_DAYS as $code => $days) {
            DB::table('document_types')->where('code', $code)->update(['alert_lead_days' => $days]);
        }

        // Existing fleet records get a readable default name from make/model.
        DB::table('vehicles')->whereNull('vehicle_name')->orderBy('id')->chunkById(200, function ($vehicles) {
            foreach ($vehicles as $vehicle) {
                $name = trim(implode(' ', array_filter([$vehicle->make, $vehicle->model])));
                DB::table('vehicles')->where('id', $vehicle->id)->update([
                    'vehicle_name' => $name !== '' ? $name : $vehicle->vehicle_number,
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('document_types', function (Blueprint $table) {
            $table->dropColumn('alert_lead_days');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn('vehicle_name');
        });
    }
};
