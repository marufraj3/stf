<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private readonly DashboardService $dashboard)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('dashboard.view'), 403);
        $validated = $request->validate([
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'document_type_id' => ['nullable', 'integer', 'exists:document_types,id'],
            'owner_type' => ['nullable', 'in:employee,vehicle,company'],
            'employee_status' => ['nullable', 'string', 'max:30'],
            'vehicle_status' => ['nullable', 'string', 'max:30'],
            'expiry_status' => ['nullable', 'in:expired,expires_today,critical,warning,valid,no_expiry'],
            'expiry_from' => ['nullable', 'date'],
            'expiry_to' => ['nullable', 'date', 'after_or_equal:expiry_from'],
        ]);

        return response()->json(['data' => $this->dashboard->summary($user, $validated)]);
    }
}
