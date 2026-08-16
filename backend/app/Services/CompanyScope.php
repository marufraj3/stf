<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class CompanyScope
{
    /** @return array<int> */
    public function ids(User $user): array
    {
        return $user->accessibleCompanyIds();
    }

    public function apply(Builder $query, User $user, string $column = 'company_id'): Builder
    {
        if ($user->isSuperAdmin() || $user->all_companies) {
            return $query;
        }

        return $query->whereIn($column, $this->ids($user));
    }

    public function authorize(User $user, int|string|null $companyId): void
    {
        if (!$user->canAccessCompany($companyId)) {
            throw ValidationException::withMessages([
                'companyId' => 'You do not have access to this company.',
            ]);
        }
    }
}
