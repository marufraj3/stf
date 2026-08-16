<?php

use App\Http\Controllers\AccessController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BootstrapController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentRenewalController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\ReminderController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ResourceController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\OperationsController;
use App\Http\Controllers\TemplateController;
use App\Http\Middleware\EnsureActiveUser;
use App\Http\Middleware\EnsurePasswordChanged;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::middleware(['auth:sanctum', EnsureActiveUser::class, 'throttle:api'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/password', [AuthController::class, 'changePassword']);

    Route::middleware(EnsurePasswordChanged::class)->group(function () {
        Route::post('/auth/impersonate/{target}', [AuthController::class, 'impersonate']);
        Route::post('/auth/impersonation/stop', [AuthController::class, 'stopImpersonating']);

        Route::get('/bootstrap', BootstrapController::class);
        Route::get('/dashboard', DashboardController::class);
        Route::get('/files/{file}', [FileController::class, 'show']);
        Route::get('/search', SearchController::class);

        Route::get('/resources/{resource}', [ResourceController::class, 'index']);
        Route::post('/resources/{resource}', [ResourceController::class, 'store']);
        Route::put('/resources/{resource}/{id}', [ResourceController::class, 'update']);
        Route::delete('/resources/{resource}/{id}', [ResourceController::class, 'destroy']);
        Route::post('/resources/{resource}/{id}/restore', [ResourceController::class, 'restore']);

        Route::post('/documents/{document}/renew', [DocumentRenewalController::class, 'store']);
        Route::get('/notifications', [ReminderController::class, 'index']);
        Route::get('/audit-logs', [AuditController::class, 'index']);
        Route::post('/reminders/scan', [ReminderController::class, 'scan']);
        Route::post('/notifications/{notification}/retry', [ReminderController::class, 'retry']);
        Route::post('/templates/{template}/preview', [TemplateController::class, 'preview']);
        Route::post('/templates/{template}/test', [TemplateController::class, 'test']);

        Route::post('/users', [AccessController::class, 'storeUser']);
        Route::put('/users/{user}', [AccessController::class, 'updateUser']);
        Route::post('/roles', [AccessController::class, 'storeRole']);
        Route::put('/roles/{role}', [AccessController::class, 'updateRole']);
        Route::put('/settings', [AccessController::class, 'updateSettings']);
        Route::get('/operations', [OperationsController::class, 'index']);
        Route::post('/operations/failed-jobs/{uuid}/retry', [OperationsController::class, 'retry']);

        Route::get('/reports/export', [ReportController::class, 'export']);
        Route::post('/imports/inspect', [ImportController::class, 'inspect']);
        Route::post('/imports/preview', [ImportController::class, 'preview']);
        Route::post('/imports/{batch}/commit', [ImportController::class, 'commit']);
        Route::get('/imports/{batch}/errors', [ImportController::class, 'errors']);
    });
});
