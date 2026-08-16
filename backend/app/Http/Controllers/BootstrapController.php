<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use App\Models\User;
use App\Services\ApiPresenter;
use App\Services\ErpResourceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class BootstrapController extends Controller
{
    public function __construct(
        private readonly ErpResourceService $resources,
        private readonly ApiPresenter $presenter,
    ) {
    }

    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        return response()->json([
            'user' => $this->presenter->user($user),
            'data' => [
                'companies' => $this->resources->all('companies', $user),
                'departments' => $this->resources->all('departments', $user),
                'designations' => $this->resources->all('designations', $user),
                'employees' => [],
                'documentTypes' => $this->resources->all('document-types', $user),
                'documents' => [],
                'renewals' => [],
                'vehicles' => [],
                'templates' => $this->resources->all('templates', $user),
                'reminderRules' => $this->resources->all('reminder-rules', $user),
                'notificationLogs' => [],
                'activityLogs' => [],
                'settings' => $this->presenter->settings(
                    SystemSetting::whereNull('company_id')->where('key', 'application')->first()
                ),
                'roles' => ($user->can('roles.view') || $user->isSuperAdmin())
                    ? Role::with('permissions')->orderBy('name')->get()->map(fn ($item) => $this->presenter->role($item))->values()
                    : [],
                'permissions' => ($user->can('roles.view') || $user->isSuperAdmin())
                    ? Permission::orderBy('name')->get()->map(fn ($item) => $this->presenter->permission($item))->values()
                    : [],
                'users' => ($user->can('users.view') || $user->isSuperAdmin())
                    ? User::with(['roles.permissions', 'companies'])->orderBy('name')->get()
                        ->map(fn ($item) => $this->presenter->user($item))->values()
                    : [$this->presenter->user($user)],
            ],
            'meta' => [
                'timezone' => 'Asia/Qatar',
                'serverTime' => now('Asia/Qatar')->toIso8601String(),
                'isDemo' => false,
                'businessDataMode' => 'server-paginated',
            ],
        ]);
    }
}
