<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditService
{
    public function record(
        ?User $user,
        string $action,
        string $module,
        string|int|null $recordId = null,
        ?int $companyId = null,
        ?array $before = null,
        ?array $after = null,
        ?Request $request = null,
    ): AuditLog {
        $request ??= request();

        return AuditLog::create([
            'user_id' => $user?->id,
            'company_id' => $companyId,
            'action' => $action,
            'module' => $module,
            'record_type' => $module,
            'record_id' => $recordId === null ? null : (string) $recordId,
            'previous_values' => $before,
            'new_values' => $after,
            'ip_address' => $request?->ip(),
            'user_agent' => mb_substr((string) $request?->userAgent(), 0, 1000),
        ]);
    }
}
