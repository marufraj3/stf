<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Services\ApiPresenter;
use App\Services\CompanyScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function __construct(
        private readonly CompanyScope $companies,
        private readonly ApiPresenter $presenter,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('audit.view'), 403);

        $companyIds = $this->companies->ids($user);
        $query = AuditLog::query()
            ->with(['user', 'company'])
            ->where(fn ($scope) => $scope->whereNull('company_id')->orWhereIn('company_id', $companyIds));

        if ($request->filled('company_id')) {
            $companyId = $request->integer('company_id');
            $this->companies->authorize($user, $companyId);
            $query->where('company_id', $companyId);
        }
        if ($request->filled('module') && $request->input('module') !== 'all') {
            $query->where('module', $request->input('module'));
        }
        if ($request->filled('action') && $request->input('action') !== 'all') {
            $query->where('action', $request->input('action'));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date('date_to'));
        }
        if ($request->filled('search')) {
            $search = trim($request->string('search')->toString());
            $query->where(function ($nested) use ($search) {
                $nested
                    ->where('action', 'like', "%{$search}%")
                    ->orWhere('module', 'like', "%{$search}%")
                    ->orWhere('record_type', 'like', "%{$search}%")
                    ->orWhere('record_id', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($users) => $users
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%"));
            });
        }

        $sort = in_array($request->input('sort_by'), ['created_at', 'action', 'module'], true)
            ? $request->input('sort_by')
            : 'created_at';
        $direction = $request->input('direction') === 'asc' ? 'asc' : 'desc';
        $paginator = $query
            ->orderBy($sort, $direction)
            ->paginate(min(100, max(1, $request->integer('per_page', 20))));
        $paginator->setCollection(
            $paginator->getCollection()->map(fn (AuditLog $log) => $this->presenter->audit($log))
        );

        return response()->json($paginator);
    }
}
