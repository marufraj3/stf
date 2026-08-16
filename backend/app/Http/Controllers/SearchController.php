<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Employee;
use App\Models\Vehicle;
use App\Services\ApiPresenter;
use App\Services\CompanyScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __construct(
        private readonly CompanyScope $companies,
        private readonly ApiPresenter $presenter,
    ) {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:120'],
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
        ]);
        $user = $request->user();
        if (!empty($validated['company_id'])) {
            $this->companies->authorize($user, (int) $validated['company_id']);
            $ids = [(int) $validated['company_id']];
        } else {
            $ids = $this->companies->ids($user);
        }
        $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $validated['q']).'%';

        $employees = ($user->isSuperAdmin() || $user->can('employees.view'))
            ? Employee::query()->whereIn('company_id', $ids)
                ->where(fn ($q) => $q
                    ->where('full_name', 'like', $term)
                    ->orWhere('employee_code', 'like', $term)
                    ->orWhere('mobile', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhereHas('documents', fn ($documents) => $documents
                        ->where('document_number', 'like', $term)))
                ->limit(15)->get()->map(fn ($item) => $this->presenter->employee($item))
            : collect();
        $canViewDocuments = $user->isSuperAdmin() || $user->can('documents.view');
        $canViewCompanyDocuments = $canViewDocuments || $user->can('company_documents.view');
        $documents = $canViewCompanyDocuments
            ? Document::query()->whereIn('company_id', $ids)
                ->when(!$canViewDocuments, fn ($query) => $query->where('owner_type', 'company'))
                ->with(['documentType', 'currentFile'])
                ->where(fn ($query) => $query
                    ->where('document_number', 'like', $term)
                    ->orWhere('issuing_authority', 'like', $term)
                    ->orWhereHas('documentType', fn ($types) => $types
                        ->where('name', 'like', $term)
                        ->orWhere('code', 'like', $term))
                    ->orWhereExists(fn ($employees) => $employees
                        ->selectRaw('1')
                        ->from('employees')
                        ->whereColumn('employees.id', 'documents.owner_id')
                        ->whereColumn('employees.company_id', 'documents.company_id')
                        ->where('documents.owner_type', 'employee')
                        ->whereNull('employees.deleted_at')
                        ->where(fn ($owner) => $owner
                            ->where('employees.full_name', 'like', $term)
                            ->orWhere('employees.employee_code', 'like', $term)))
                    ->orWhereExists(fn ($vehicles) => $vehicles
                        ->selectRaw('1')
                        ->from('vehicles')
                        ->whereColumn('vehicles.id', 'documents.owner_id')
                        ->whereColumn('vehicles.company_id', 'documents.company_id')
                        ->where('documents.owner_type', 'vehicle')
                        ->whereNull('vehicles.deleted_at')
                        ->where(fn ($owner) => $owner
                            ->where('vehicles.plate_number', 'like', $term)
                            ->orWhere('vehicles.vehicle_number', 'like', $term))))
                ->limit(15)->get()->map(fn ($item) => $this->presenter->document($item))
            : collect();
        $vehicles = ($user->isSuperAdmin() || $user->can('vehicles.view'))
            ? Vehicle::query()->whereIn('company_id', $ids)
                ->where(fn ($q) => $q
                    ->where('plate_number', 'like', $term)
                    ->orWhere('vehicle_number', 'like', $term)
                    ->orWhere('internal_vehicle_id', 'like', $term)
                    ->orWhere('chassis_number', 'like', $term)
                    ->orWhere('make', 'like', $term)
                    ->orWhere('model', 'like', $term))
                ->limit(15)->get()->map(fn ($item) => $this->presenter->vehicle($item))
            : collect();

        return response()->json(compact('employees', 'documents', 'vehicles'));
    }
}
