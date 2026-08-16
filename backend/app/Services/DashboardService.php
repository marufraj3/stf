<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\NotificationLog;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

class DashboardService
{
    public function __construct(
        private readonly CompanyScope $companies,
        private readonly ApiPresenter $presenter,
    ) {
    }

    public function summary(User $user, array $filters): array
    {
        $today = CarbonImmutable::now('Asia/Qatar')->startOfDay();
        $companyId = isset($filters['company_id']) ? (int) $filters['company_id'] : null;
        if ($companyId) {
            $this->companies->authorize($user, $companyId);
        }

        $employees = $this->companyQuery(Employee::query(), $user, $companyId);
        if (!empty($filters['department_id'])) {
            $employees->where('department_id', (int) $filters['department_id']);
        }
        if (!empty($filters['employee_status'])) {
            $employees->where('status', $filters['employee_status']);
        }

        $archivedEmployees = $this->companyQuery(Employee::onlyTrashed(), $user, $companyId);
        if (!empty($filters['department_id'])) {
            $archivedEmployees->where('department_id', (int) $filters['department_id']);
        }

        $documents = $this->companyQuery(Document::query(), $user, $companyId);
        $this->applyDocumentFilters($documents, $filters, $today);

        $vehicles = $this->companyQuery(Vehicle::query(), $user, $companyId);
        if (!empty($filters['vehicle_status'])) {
            $vehicles->where('status', $filters['vehicle_status']);
        }

        $notifications = $this->companyQuery(NotificationLog::query(), $user, $companyId);
        if (!empty($filters['document_type_id'])) {
            $notifications->where('document_type_id', (int) $filters['document_type_id']);
        }

        $urgent = clone $documents;
        $urgent->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<=', $today->addDays(90)->toDateString())
            ->orderBy('expiry_date')
            ->limit(8);

        $trackedAlerts = $this->trackedTypeAlerts($documents, $today);

        return [
            'documentTypeAlerts' => $trackedAlerts,
            'stats' => [
                'expiringQid' => $trackedAlerts['qid']['expiringCount'] ?? 0,
                'expiredQid' => $trackedAlerts['qid']['expiredCount'] ?? 0,
                'expiringPassport' => $trackedAlerts['passport']['expiringCount'] ?? 0,
                'expiredPassport' => $trackedAlerts['passport']['expiredCount'] ?? 0,
                'expiringIstimara' => $trackedAlerts['istimara']['expiringCount'] ?? 0,
                'expiredIstimara' => $trackedAlerts['istimara']['expiredCount'] ?? 0,
                'totalEmployees' => (clone $employees)->count(),
                'activeEmployees' => (clone $employees)->where('status', 'active')->count(),
                'cancelledEmployees' => (clone $employees)->where('status', 'cancelled')->count(),
                'archivedEmployees' => $archivedEmployees->count(),
                'totalVehicles' => $vehicles->count(),
                'totalDocuments' => (clone $documents)->count(),
                'expiredDocuments' => (clone $documents)
                    ->whereNotNull('expiry_date')->whereDate('expiry_date', '<', $today->toDateString())->count(),
                'expiringToday' => (clone $documents)->whereDate('expiry_date', $today->toDateString())->count(),
                'expiringIn7Days' => $this->countExpiryWindow($documents, $today, 1, 7),
                'expiringIn15Days' => $this->countExpiryWindow($documents, $today, 1, 15),
                'expiringIn30Days' => $this->countExpiryWindow($documents, $today, 1, 30),
                'documentsWithoutExpiry' => (clone $documents)->whereNull('expiry_date')->count(),
                'todaySmsCount' => (clone $notifications)
                    ->where('channel', 'sms')->whereDate('created_at', $today->toDateString())->count(),
                'todayWhatsappCount' => (clone $notifications)
                    ->where('channel', 'whatsapp')->whereDate('created_at', $today->toDateString())->count(),
                'todayEmailCount' => (clone $notifications)
                    ->where('channel', 'email')->whereDate('created_at', $today->toDateString())->count(),
                'queuedNotifications' => (clone $notifications)->where('status', 'queued')->count(),
                'sentNotifications' => (clone $notifications)->where('status', 'sent')->count(),
                'deliveredNotifications' => (clone $notifications)->where('status', 'delivered')->count(),
                'failedNotifications' => (clone $notifications)
                    ->whereIn('status', ['failed', 'rejected'])->count(),
            ],
            'urgentDocuments' => $urgent->get()
                ->map(fn (Document $document) => $this->presenter->document($document))
                ->values(),
            'employeeCountsByCompany' => Employee::query()
                ->whereIn('company_id', $this->companies->ids($user))
                ->selectRaw('company_id, COUNT(*) as aggregate')
                ->groupBy('company_id')
                ->pluck('aggregate', 'company_id')
                ->map(fn ($count) => (int) $count),
            'appliedFilters' => $filters,
            'generatedAt' => CarbonImmutable::now('Asia/Qatar')->toIso8601String(),
        ];
    }

    /**
     * Per-document-type alert buckets for the dashboard notification box.
     *
     * Each tracked type uses its own lead time (QID 15 days, Passport 90 days,
     * Istimara 30 days) so the yellow warning appears exactly when the
     * business expects it.
     *
     * @return array<string,array{code:string,name:string,leadDays:int,expiringCount:int,expiredCount:int}>
     */
    private function trackedTypeAlerts(Builder $documents, CarbonImmutable $today): array
    {
        $types = DocumentType::query()
            ->whereIn('code', ['qid', 'passport', 'istimara'])
            ->get()
            ->keyBy('code');

        $alerts = [];
        foreach (['qid', 'passport', 'istimara'] as $code) {
            $type = $types->get($code);
            if (!$type) {
                continue;
            }

            $leadDays = $type->alertLeadDays();
            $expiring = (clone $documents)
                ->where('document_type_id', $type->id)
                ->whereNotNull('expiry_date')
                ->whereBetween('expiry_date', [
                    $today->toDateString(),
                    $today->addDays($leadDays)->toDateString(),
                ])
                ->count();
            $expired = (clone $documents)
                ->where('document_type_id', $type->id)
                ->whereNotNull('expiry_date')
                ->whereDate('expiry_date', '<', $today->toDateString())
                ->count();

            $alerts[$code] = [
                'code' => $code,
                'name' => $type->name,
                'leadDays' => $leadDays,
                'expiringCount' => $expiring,
                'expiredCount' => $expired,
            ];
        }

        return $alerts;
    }

    private function companyQuery(Builder $query, User $user, ?int $companyId): Builder
    {
        if ($companyId) {
            return $query->where('company_id', $companyId);
        }

        return $this->companies->apply($query, $user);
    }

    private function applyDocumentFilters(Builder $query, array $filters, CarbonImmutable $today): void
    {
        foreach (['document_type_id', 'owner_type'] as $filter) {
            if (!empty($filters[$filter])) {
                $query->where($filter, $filters[$filter]);
            }
        }
        if (!empty($filters['department_id'])) {
            $departmentId = (int) $filters['department_id'];
            $query->where('owner_type', 'employee')
                ->whereExists(fn ($employees) => $employees
                    ->selectRaw('1')
                    ->from('employees')
                    ->whereColumn('employees.id', 'documents.owner_id')
                    ->where('employees.department_id', $departmentId)
                    ->whereNull('employees.deleted_at'));
        }
        if (!empty($filters['expiry_from'])) {
            $query->whereDate('expiry_date', '>=', $filters['expiry_from']);
        }
        if (!empty($filters['expiry_to'])) {
            $query->whereDate('expiry_date', '<=', $filters['expiry_to']);
        }
        if (!empty($filters['expiry_status'])) {
            match ($filters['expiry_status']) {
                'expired' => $query->whereNotNull('expiry_date')->whereDate('expiry_date', '<', $today->toDateString()),
                'expires_today' => $query->whereDate('expiry_date', $today->toDateString()),
                'critical' => $query->whereBetween('expiry_date', [
                    $today->addDay()->toDateString(),
                    $today->addDays(10)->toDateString(),
                ]),
                'warning' => $query->whereBetween('expiry_date', [
                    $today->addDays(11)->toDateString(),
                    $today->addDays(30)->toDateString(),
                ]),
                'valid' => $query->whereDate('expiry_date', '>', $today->addDays(30)->toDateString()),
                'no_expiry' => $query->whereNull('expiry_date'),
                default => null,
            };
        }
    }

    private function countExpiryWindow(Builder $documents, CarbonImmutable $today, int $from, int $to): int
    {
        return (clone $documents)->whereBetween('expiry_date', [
            $today->addDays($from)->toDateString(),
            $today->addDays($to)->toDateString(),
        ])->count();
    }
}
