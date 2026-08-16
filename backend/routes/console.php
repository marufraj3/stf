<?php

use Illuminate\Foundation\Inspiring;
use App\Services\ReminderService;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(fn () => app(ReminderService::class)->scan())
    ->name('trust-group-expiry-reminders')
    ->dailyAt('09:00')
    ->timezone('Asia/Qatar')
    ->when(function () {
        $value = SystemSetting::whereNull('company_id')->where('key', 'application')->first()?->value ?? [];

        return ($value['autoExpiryScanEnabled'] ?? true) === true;
    })
    ->withoutOverlapping()
    ->onOneServer();
