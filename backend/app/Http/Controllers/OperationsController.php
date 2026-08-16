<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class OperationsController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('settings.view'), 403);
        $lastScan = SystemSetting::query()
            ->whereNull('company_id')
            ->where('key', 'application')
            ->first()?->value['lastExpiryScanAt'] ?? null;

        return response()->json([
            'data' => [
                'connection' => config('queue.default'),
                'queuedJobs' => DB::table('jobs')->count(),
                'failedJobs' => DB::table('failed_jobs')->count(),
                'oldestQueuedAt' => DB::table('jobs')->min('created_at'),
                'lastExpiryScanAt' => $lastScan,
                'schedulerTimezone' => 'Asia/Qatar',
                'failed' => DB::table('failed_jobs')
                    ->latest('failed_at')
                    ->limit(25)
                    ->get(['uuid', 'connection', 'queue', 'exception', 'failed_at'])
                    ->map(fn ($job) => [
                        'uuid' => $job->uuid,
                        'connection' => $job->connection,
                        'queue' => $job->queue,
                        'error' => mb_substr((string) $job->exception, 0, 500),
                        'failedAt' => $job->failed_at,
                    ]),
            ],
        ]);
    }

    public function retry(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('settings.manage'), 403);
        abort_unless(DB::table('failed_jobs')->where('uuid', $uuid)->exists(), 404);

        $exitCode = Artisan::call('queue:retry', ['id' => [$uuid]]);
        abort_if($exitCode !== 0, 422, trim(Artisan::output()) ?: 'The failed job could not be retried.');
        $this->audit->record($user, 'RETRY', 'Queue', $uuid, null, null, ['command' => 'queue:retry'], $request);

        return response()->json(['message' => 'The failed job was returned to the queue.']);
    }
}
