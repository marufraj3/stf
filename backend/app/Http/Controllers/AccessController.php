<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\ApiPresenter;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class AccessController extends Controller
{
    public function __construct(
        private readonly ApiPresenter $presenter,
        private readonly AuditService $audit,
    ) {
    }

    public function storeUser(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isSuperAdmin() || $actor->can('users.manage'), 403);
        $validated = $this->validateUser($request);
        $this->authorizeUserAssignment($actor, $validated);
        $user = DB::transaction(function () use ($validated, $actor) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => strtolower($validated['email']),
                'password' => Hash::make($validated['password']),
                'status' => $validated['status'] ?? 'active',
                'all_companies' => ($validated['companyAccess'] ?? []) === 'all',
                'force_password_change' => true,
            ]);
            $user->syncRoles($validated['roleNames']);
            $this->syncCompanies($user, $validated);
            $this->audit->record($actor, 'CREATE', 'User', $user->id, null, null, [
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $validated['roleNames'],
            ]);

            return $user;
        });

        return response()->json(['data' => $this->presenter->user($user)], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isSuperAdmin() || $actor->can('users.manage'), 403);
        abort_if(!$actor->isSuperAdmin() && $user->isSuperAdmin(), 403);
        $validated = $this->validateUser($request, $user);
        $this->authorizeUserAssignment($actor, $validated);
        if ($actor->is($user) && ($validated['status'] ?? 'active') !== 'active') {
            throw ValidationException::withMessages(['status' => 'You cannot deactivate your own account.']);
        }
        if ($actor->is($user) && !empty($validated['password'])) {
            throw ValidationException::withMessages([
                'password' => 'Use the Change Password screen to update your own password.',
            ]);
        }
        if (
            $user->hasRole('Super Admin')
            && (
                !in_array('Super Admin', $validated['roleNames'], true)
                || ($validated['status'] ?? 'active') !== 'active'
            )
            && User::role('Super Admin')->where('status', 'active')->count() <= 1
        ) {
            throw ValidationException::withMessages(['roleNames' => 'At least one active Super Admin account is required.']);
        }
        DB::transaction(function () use ($validated, $user, $actor) {
            $before = $user->only(['name', 'email', 'status', 'all_companies']);
            $passwordWasReset = !empty($validated['password']);
            $user->fill([
                'name' => $validated['name'],
                'email' => strtolower($validated['email']),
                'status' => $validated['status'] ?? $user->status,
                'all_companies' => ($validated['companyAccess'] ?? []) === 'all',
            ]);
            if ($passwordWasReset) {
                $user->password = $validated['password'];
                $user->force_password_change = true;
            }
            $user->save();
            $user->syncRoles($validated['roleNames']);
            $this->syncCompanies($user, $validated);
            if ($user->status !== 'active' || $passwordWasReset) {
                $user->tokens()->delete();
            }
            $this->audit->record($actor, 'UPDATE', 'User', $user->id, null, $before, $user->fresh()->toArray());
        });

        return response()->json(['data' => $this->presenter->user($user->fresh())]);
    }

    public function storeRole(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isSuperAdmin() || $actor->can('roles.manage'), 403);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:roles,name'],
            'permissions' => ['array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);
        $role = Role::create(['name' => $validated['name'], 'guard_name' => 'web']);
        $role->syncPermissions($validated['permissions'] ?? []);
        $this->audit->record($actor, 'CREATE', 'Role', $role->id, null, null, $validated);

        return response()->json(['data' => $this->presenter->role($role)], 201);
    }

    public function updateRole(Request $request, Role $role): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isSuperAdmin() || $actor->can('roles.manage'), 403);
        abort_if($role->name === 'Super Admin' && !$actor->isSuperAdmin(), 403);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('roles', 'name')->ignore($role->id)],
            'permissions' => ['array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);
        if ($role->name === 'Super Admin' && $validated['name'] !== 'Super Admin') {
            throw ValidationException::withMessages(['name' => 'The Super Admin role name cannot be changed.']);
        }
        $before = $this->presenter->role($role);
        $role->update(['name' => $validated['name']]);
        $role->syncPermissions(
            $role->name === 'Super Admin'
                ? Permission::query()->pluck('name')->all()
                : ($validated['permissions'] ?? [])
        );
        $this->audit->record($actor, 'UPDATE', 'Role', $role->id, null, $before, $this->presenter->role($role));

        return response()->json(['data' => $this->presenter->role($role)]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isSuperAdmin() || $actor->can('settings.manage'), 403);
        $validated = $request->validate([
            'globalReminderDays' => ['sometimes', 'array'],
            'globalReminderDays.*' => ['integer', 'min:0', 'max:3650'],
            'defaultFileMaxSizeMb' => ['sometimes', 'integer', 'min:1', 'max:25'],
            'autoExpiryScanEnabled' => ['sometimes', 'boolean'],
            'providerConfig.emailEnabled' => ['sometimes', 'boolean'],
            'providerConfig.smsEnabled' => ['sometimes', 'boolean'],
            'providerConfig.whatsappEnabled' => ['sometimes', 'boolean'],
            'providerConfig.mockMode' => ['sometimes', 'boolean'],
        ]);
        $setting = SystemSetting::whereNull('company_id')->where('key', 'application')->first();
        $before = $setting?->value ?? [];
        $value = array_replace_recursive($before, $validated);
        $setting = SystemSetting::updateOrCreate(
            ['company_id' => null, 'key' => 'application'],
            ['value' => $value, 'updated_by' => $actor->id],
        );
        $this->audit->record($actor, 'UPDATE', 'Settings', 'application', null, $before, $value);

        return response()->json(['data' => $this->presenter->settings($setting)]);
    }

    private function validateUser(Request $request, ?User $user = null): array
    {
        $companyAccessIsAll = $request->input('companyAccess') === 'all';
        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user?->id)],
            'password' => [$user ? 'nullable' : 'required', 'string', 'min:12'],
            'roleNames' => ['required', 'array', 'min:1'],
            'roleNames.*' => ['required', 'string', 'distinct', 'exists:roles,name'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'companyAccess' => $companyAccessIsAll
                ? ['required', Rule::in(['all'])]
                : ['required', 'array', 'min:1'],
            'primaryCompanyId' => ['required', 'integer', 'exists:companies,id'],
        ];
        if (!$companyAccessIsAll) {
            $rules['companyAccess.*'] = ['required', 'integer', 'distinct', 'exists:companies,id'];
        }
        $validated = $request->validate($rules);
        if (
            $validated['companyAccess'] !== 'all'
            && !in_array((int) $validated['primaryCompanyId'], array_map('intval', $validated['companyAccess']), true)
        ) {
            throw ValidationException::withMessages([
                'primaryCompanyId' => 'The primary company must be included in the selected company access.',
            ]);
        }

        return $validated;
    }

    private function authorizeUserAssignment(User $actor, array $validated): void
    {
        if (!$actor->isSuperAdmin() && in_array('Super Admin', $validated['roleNames'], true)) {
            throw ValidationException::withMessages([
                'roleNames' => 'Only a Super Admin may assign the Super Admin role.',
            ]);
        }
        if ($actor->isSuperAdmin()) {
            return;
        }
        if ($validated['companyAccess'] === 'all') {
            throw ValidationException::withMessages([
                'companyAccess' => 'Only a Super Admin may grant access to every company.',
            ]);
        }
        foreach ($validated['companyAccess'] as $companyId) {
            if (!$actor->canAccessCompany((int) $companyId)) {
                throw ValidationException::withMessages([
                    'companyAccess' => 'You may only grant access to companies you can access.',
                ]);
            }
        }
    }

    private function syncCompanies(User $user, array $validated): void
    {
        $ids = ($validated['companyAccess'] ?? []) === 'all'
            ? Company::query()->pluck('id')->all()
            : array_map('intval', (array) ($validated['companyAccess'] ?? []));
        $primary = isset($validated['primaryCompanyId']) ? (int) $validated['primaryCompanyId'] : null;
        $user->companies()->sync(
            collect($ids)->mapWithKeys(fn ($id) => [$id => ['is_primary' => $id === $primary]])->all()
        );
    }
}
