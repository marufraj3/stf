<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ApiPresenter;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly ApiPresenter $presenter,
        private readonly AuditService $audit,
    ) {
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->whereRaw('LOWER(email) = ?', [strtolower($credentials['email'])])->first();
        if (!$user || $user->status !== 'active' || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'The email or password is incorrect.']);
        }

        $user->forceFill(['last_login_at' => now('Asia/Qatar')])->save();
        $token = $user->createToken(
            'erp-web',
            ['erp'],
            now()->addMinutes((int) config('sanctum.expiration', 120)),
        )->plainTextToken;
        $this->audit->record($user, 'LOGIN', 'Authentication');

        return response()->json([
            'token' => $token,
            'tokenType' => 'Bearer',
            'user' => $this->presenter->user($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->presenter->user($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->audit->record($request->user(), 'LOGOUT', 'Authentication');
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'currentPassword' => ['required', 'current_password'],
            'password' => ['required', 'string', 'min:12', 'confirmed'],
        ]);
        $user = $request->user();
        $user->update([
            'password' => $validated['password'],
            'password_changed_at' => now('Asia/Qatar'),
            'force_password_change' => false,
        ]);
        $user->tokens()->whereKeyNot($user->currentAccessToken()?->id)->delete();
        $this->audit->record($user, 'PASSWORD_CHANGE', 'Authentication');

        return response()->json(['message' => 'Password updated.']);
    }

    public function impersonate(Request $request, User $target): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isSuperAdmin(), 403);
        abort_if($target->status !== 'active', 422, 'The selected user is inactive.');
        abort_if($target->is($actor), 422, 'You are already using this account.');

        $token = $target->createToken(
            'impersonation-by-'.$actor->id,
            ['erp', 'impersonated', 'impersonator:'.$actor->id],
            now()->addHours(2),
        )->plainTextToken;
        $this->audit->record(
            $actor,
            'IMPERSONATE',
            'Authentication',
            $target->id,
            null,
            null,
            ['targetUserId' => $target->id, 'targetEmail' => $target->email],
        );

        return response()->json([
            'token' => $token,
            'tokenType' => 'Bearer',
            'user' => $this->presenter->user($target),
            'impersonatedBy' => $actor->id,
        ]);
    }

    public function stopImpersonating(Request $request): JsonResponse
    {
        $user = $request->user();
        $token = $user->currentAccessToken();
        abort_unless($token?->can('impersonated'), 403, 'This is not an impersonated session.');

        $impersonatorAbility = collect($token->abilities ?? [])
            ->first(fn ($ability) => str_starts_with((string) $ability, 'impersonator:'));
        $impersonatorId = $impersonatorAbility
            ? (int) str($impersonatorAbility)->after('impersonator:')->toString()
            : null;
        $impersonator = $impersonatorId ? User::query()->find($impersonatorId) : null;
        if ($impersonator) {
            $this->audit->record(
                $impersonator,
                'STOP_IMPERSONATE',
                'Authentication',
                $user->id,
                null,
                null,
                ['targetUserId' => $user->id, 'targetEmail' => $user->email],
            );
        }
        $token->delete();

        return response()->json(['message' => 'Impersonated session ended.']);
    }
}
