<?php

namespace App\Http\Controllers;

use App\Exports\ArrayReportExport;
use App\Models\Company;
use App\Models\Document;
use App\Models\DocumentRenewal;
use App\Models\Employee;
use App\Models\NotificationLog;
use App\Models\Vehicle;
use App\Services\AuditService;
use App\Services\CompanyScope;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    private const TYPES = [
        'employees',
        'vehicles',
        'documents',
        'expired-documents',
        'expiring-today',
        'expiring-7',
        'expiring-15',
        'expiring-30',
        'custom-expiry',
        'document-types',
        'vehicle-documents',
        'company-documents',
        'notifications',
        'failed-notifications',
        'renewals',
    ];

    public function __construct(
        private readonly CompanyScope $companies,
        private readonly AuditService $audit,
    ) {
    }

    public function export(Request $request): Response|StreamedResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('reports.export'), 403);
        $validated = $request->validate([
            'type' => ['required', 'in:'.implode(',', self::TYPES)],
            'format' => ['required', 'in:csv,xlsx,pdf'],
            'companyId' => ['nullable', 'integer', 'exists:companies,id'],
            'departmentId' => ['nullable', 'integer', 'exists:departments,id'],
            'documentTypeId' => ['nullable', 'integer', 'exists:document_types,id'],
            'ownerType' => ['nullable', 'in:employee,vehicle,company'],
            'employeeStatus' => ['nullable', 'string', 'max:30'],
            'vehicleStatus' => ['nullable', 'string', 'max:30'],
            'expiryStatus' => ['nullable', 'in:expired,expires_today,critical,warning,valid,no_expiry'],
            'dateFrom' => ['nullable', 'date'],
            'dateTo' => ['nullable', 'date', 'after_or_equal:dateFrom'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'notificationStatus' => ['nullable', 'string', 'max:30'],
        ]);
        $ids = $this->companies->ids($user);
        if (!empty($validated['companyId'])) {
            $this->companies->authorize($user, $validated['companyId']);
            $ids = [(int) $validated['companyId']];
        }

        [$headings, $rows] = $this->data($validated['type'], $ids, $validated);
        $basename = 'trust-group-'.$validated['type'].'-'.now('Asia/Qatar')->format('Ymd-His');
        $this->audit->record($user, 'EXPORT', 'Report', null, $validated['companyId'] ?? null, null, [
            'type' => $validated['type'],
            'format' => $validated['format'],
            'filters' => $validated,
            'rows' => count($rows),
        ], $request);

        if ($validated['format'] === 'xlsx') {
            return Excel::download(new ArrayReportExport($rows, $headings), $basename.'.xlsx');
        }
        if ($validated['format'] === 'pdf') {
            $html = view('reports.table', [
                'title' => str($validated['type'])->replace('-', ' ')->title().' Report',
                'headings' => $headings,
                'rows' => $rows,
                'generatedAt' => now('Asia/Qatar')->format('d M Y h:i A'),
            ])->render();

            return Pdf::loadHTML($html)->setPaper('a4', 'landscape')->download($basename.'.pdf');
        }

        return response()->streamDownload(function () use ($headings, $rows) {
            $stream = fopen('php://output', 'wb');
            fputcsv($stream, $headings);
            foreach ($rows as $row) {
                fputcsv($stream, $row);
            }
            fclose($stream);
        }, $basename.'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function data(string $type, array $companyIds, array $filters): array
    {
        return match ($type) {
            'employees' => $this->employeeRows($companyIds, $filters),
            'vehicles' => $this->vehicleRows($companyIds, $filters),
            'notifications', 'failed-notifications' => $this->notificationRows($companyIds, $filters, $type),
            'renewals' => $this->renewalRows($companyIds, $filters),
            default => $this->documentRows($companyIds, $filters, $type),
        };
    }

    private function employeeRows(array $companyIds, array $filters): array
    {
        $query = Employee::query()
            ->with(['company', 'department', 'designation'])
            ->whereIn('company_id', $companyIds);
        $query->when(!empty($filters['departmentId']), fn ($q) => $q->where('department_id', $filters['departmentId']))
            ->when(!empty($filters['employeeStatus']), fn ($q) => $q->where('status', $filters['employeeStatus']))
            ->when(!empty($filters['nationality']), fn ($q) => $q->where('nationality', $filters['nationality']));

        return [
            ['Company', 'Employee Code', 'Name', 'Department', 'Designation', 'Mobile', 'Email', 'Nationality', 'Status', 'Joining Date'],
            $query->orderBy('full_name')->get()->map(fn (Employee $employee) => [
                $employee->company?->name,
                $employee->employee_code,
                $employee->full_name,
                $employee->department?->name,
                $employee->designation?->name,
                $employee->mobile,
                $employee->email,
                $employee->nationality,
                $employee->status,
                $employee->joining_date?->format('Y-m-d'),
            ])->all(),
        ];
    }

    private function vehicleRows(array $companyIds, array $filters): array
    {
        $query = Vehicle::query()->with(['company'])->whereIn('company_id', $companyIds);
        $query->when(!empty($filters['vehicleStatus']), fn ($q) => $q->where('status', $filters['vehicleStatus']));

        return [
            ['Company', 'Internal ID', 'Vehicle Number', 'Plate Number', 'Make', 'Model', 'Year', 'Ownership', 'Status'],
            $query->orderBy('plate_number')->get()->map(fn (Vehicle $vehicle) => [
                $vehicle->company?->name,
                $vehicle->internal_vehicle_id,
                $vehicle->vehicle_number,
                $vehicle->plate_number,
                $vehicle->make,
                $vehicle->model,
                $vehicle->year,
                $vehicle->ownership_type,
                $vehicle->status,
            ])->all(),
        ];
    }

    private function documentRows(array $companyIds, array $filters, string $type): array
    {
        $today = CarbonImmutable::now('Asia/Qatar')->startOfDay();
        $query = Document::query()
            ->with(['company', 'documentType'])
            ->whereIn('company_id', $companyIds);
        $query->when(!empty($filters['documentTypeId']), fn ($q) => $q->where('document_type_id', $filters['documentTypeId']))
            ->when(!empty($filters['ownerType']), fn ($q) => $q->where('owner_type', $filters['ownerType']))
            ->when(!empty($filters['dateFrom']), fn ($q) => $q->whereDate('expiry_date', '>=', $filters['dateFrom']))
            ->when(!empty($filters['dateTo']), fn ($q) => $q->whereDate('expiry_date', '<=', $filters['dateTo']));
        if (!empty($filters['departmentId'])) {
            $query->where('owner_type', 'employee')->whereExists(fn ($employees) => $employees
                ->selectRaw('1')->from('employees')
                ->whereColumn('employees.id', 'documents.owner_id')
                ->where('employees.department_id', $filters['departmentId'])
                ->whereNull('employees.deleted_at'));
        }
        match ($type) {
            'expired-documents' => $query->whereNotNull('expiry_date')->whereDate('expiry_date', '<', $today),
            'expiring-today' => $query->whereDate('expiry_date', $today),
            'expiring-7' => $this->expiryWindow($query, $today, 7),
            'expiring-15' => $this->expiryWindow($query, $today, 15),
            'expiring-30' => $this->expiryWindow($query, $today, 30),
            'vehicle-documents' => $query->where('owner_type', 'vehicle'),
            'company-documents' => $query->where('owner_type', 'company'),
            default => null,
        };
        if (!empty($filters['expiryStatus'])) {
            $this->applyExpiryStatus($query, $filters['expiryStatus'], $today);
        }

        $documents = $query->orderByRaw('expiry_date IS NULL')->orderBy('expiry_date')->get();
        $employeeNames = Employee::withTrashed()->whereIn('id', $documents->where('owner_type', 'employee')->pluck('owner_id'))->pluck('full_name', 'id');
        $vehicleNames = Vehicle::withTrashed()->whereIn('id', $documents->where('owner_type', 'vehicle')->pluck('owner_id'))->pluck('vehicle_number', 'id');
        $companyNames = Company::withTrashed()->whereIn('id', $documents->where('owner_type', 'company')->pluck('owner_id'))->pluck('name', 'id');

        return [
            ['Company', 'Owner Type', 'Owner', 'Document Type', 'Document Number', 'Issue Date', 'Expiry Date', 'Days Remaining'],
            $documents->map(function (Document $document) use ($today, $employeeNames, $vehicleNames, $companyNames) {
                $owner = match ($document->owner_type) {
                    'employee' => $employeeNames[$document->owner_id] ?? 'Unknown employee',
                    'vehicle' => $vehicleNames[$document->owner_id] ?? 'Unknown vehicle',
                    'company' => $companyNames[$document->owner_id] ?? 'Unknown company',
                    default => 'Unknown owner',
                };
                return [
                    $document->company?->name,
                    $document->owner_type,
                    $owner,
                    $document->documentType?->name,
                    $document->document_number,
                    $document->issue_date?->format('Y-m-d'),
                    $document->expiry_date?->format('Y-m-d'),
                    $document->expiry_date
                        ? $today->diffInDays(CarbonImmutable::parse($document->expiry_date, 'Asia/Qatar'), false)
                        : null,
                ];
            })->all(),
        ];
    }

    private function notificationRows(array $companyIds, array $filters, string $type): array
    {
        $query = NotificationLog::query()
            ->with(['company', 'documentType'])
            ->whereIn('company_id', $companyIds);
        $query->when($type === 'failed-notifications', fn ($q) => $q->whereIn('status', ['failed', 'rejected']))
            ->when(!empty($filters['notificationStatus']), fn ($q) => $q->where('status', $filters['notificationStatus']))
            ->when(!empty($filters['documentTypeId']), fn ($q) => $q->where('document_type_id', $filters['documentTypeId']))
            ->when(!empty($filters['dateFrom']), fn ($q) => $q->whereDate('created_at', '>=', $filters['dateFrom']))
            ->when(!empty($filters['dateTo']), fn ($q) => $q->whereDate('created_at', '<=', $filters['dateTo']));

        return [
            ['Company', 'Recipient', 'Contact', 'Document Type', 'Channel', 'Provider', 'Provider ID', 'Status', 'Queued', 'Sent', 'Delivered', 'Failure'],
            $query->latest()->get()->map(fn (NotificationLog $log) => [
                $log->company?->name,
                $log->recipient_name,
                $log->recipient_contact,
                $log->documentType?->name,
                $log->channel,
                $log->provider,
                $log->provider_message_id,
                $log->status,
                $log->queued_at?->toIso8601String(),
                $log->sent_at?->toIso8601String(),
                $log->delivered_at?->toIso8601String(),
                $log->failure_reason,
            ])->all(),
        ];
    }

    private function renewalRows(array $companyIds, array $filters): array
    {
        $query = DocumentRenewal::query()
            ->with(['company', 'document.documentType', 'renewedBy'])
            ->whereIn('company_id', $companyIds);
        $query->when(!empty($filters['documentTypeId']), fn ($q) => $q->whereHas(
            'document',
            fn ($documents) => $documents->where('document_type_id', $filters['documentTypeId'])
        ))->when(!empty($filters['dateFrom']), fn ($q) => $q->whereDate('renewed_at', '>=', $filters['dateFrom']))
            ->when(!empty($filters['dateTo']), fn ($q) => $q->whereDate('renewed_at', '<=', $filters['dateTo']));

        return [
            ['Company', 'Document Type', 'Previous Number', 'Previous Expiry', 'New Number', 'New Expiry', 'Renewed At', 'Renewed By', 'Reason'],
            $query->latest('renewed_at')->get()->map(fn (DocumentRenewal $renewal) => [
                $renewal->company?->name,
                $renewal->document?->documentType?->name,
                $renewal->previous_document_number,
                $renewal->previous_expiry_date?->format('Y-m-d'),
                $renewal->new_document_number,
                $renewal->new_expiry_date?->format('Y-m-d'),
                $renewal->renewed_at?->toIso8601String(),
                $renewal->renewedBy?->name,
                $renewal->change_reason,
            ])->all(),
        ];
    }

    private function expiryWindow(Builder $query, CarbonImmutable $today, int $days): void
    {
        $query->whereBetween('expiry_date', [
            $today->addDay()->toDateString(),
            $today->addDays($days)->toDateString(),
        ]);
    }

    private function applyExpiryStatus(Builder $query, string $status, CarbonImmutable $today): void
    {
        match ($status) {
            'expired' => $query->whereNotNull('expiry_date')->whereDate('expiry_date', '<', $today),
            'expires_today' => $query->whereDate('expiry_date', $today),
            'critical' => $query->whereBetween('expiry_date', [$today->addDay(), $today->addDays(10)]),
            'warning' => $query->whereBetween('expiry_date', [$today->addDays(11), $today->addDays(30)]),
            'valid' => $query->whereDate('expiry_date', '>', $today->addDays(30)),
            'no_expiry' => $query->whereNull('expiry_date'),
            default => null,
        };
    }
}
