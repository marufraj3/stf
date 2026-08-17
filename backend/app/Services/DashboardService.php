<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\BankDocument;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\EmployeeMessage;
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
        // Eager load so presenting eight documents costs three queries, not 24.
        $urgent->with(['documentType', 'currentFile'])
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<=', $today->addDays(90)->toDateString())
            ->orderBy('expiry_date')
            ->limit(8);

        // One aggregate round-trip each for documents, employees and
        // notifications instead of ~20 separate COUNT(*) statements. This is
        // what keeps the dashboard fast on a database with 300+ employees.
        $todayString = $today->toDateString();
        $tomorrow = $today->addDay()->toDateString();
        $documentTotals = (clone $documents)->selectRaw(
            'COUNT(*) as total_documents,'
            .' SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date < ? THEN 1 ELSE 0 END) as expired_documents,'
            .' SUM(CASE WHEN expiry_date = ? THEN 1 ELSE 0 END) as expiring_today,'
            .' SUM(CASE WHEN expiry_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as expiring_seven,'
            .' SUM(CASE WHEN expiry_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as expiring_fifteen,'
            .' SUM(CASE WHEN expiry_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as expiring_thirty,'
            .' SUM(CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END) as without_expiry',
            [
                $todayString,
                $todayString,
                $tomorrow, $today->addDays(7)->toDateString(),
                $tomorrow, $today->addDays(15)->toDateString(),
                $tomorrow, $today->addDays(30)->toDateString(),
            ],
        )->first();

        $employeeTotals = (clone $employees)->selectRaw(
            'COUNT(*) as total_employees,'
            .' SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active_employees,'
            .' SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as cancelled_employees',
            ['active', 'cancelled'],
        )->first();

        $notificationTotals = (clone $notifications)->selectRaw(
            'SUM(CASE WHEN channel = ? AND created_at >= ? THEN 1 ELSE 0 END) as today_sms,'
            .' SUM(CASE WHEN channel = ? AND created_at >= ? THEN 1 ELSE 0 END) as today_whatsapp,'
            .' SUM(CASE WHEN channel = ? AND created_at >= ? THEN 1 ELSE 0 END) as today_email,'
            .' SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as queued,'
            .' SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as sent,'
            .' SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as delivered,'
            .' SUM(CASE WHEN status IN (?, ?) THEN 1 ELSE 0 END) as failed',
            [
                'sms', $todayString.' 00:00:00',
                'whatsapp', $todayString.' 00:00:00',
                'email', $todayString.' 00:00:00',
                'queued', 'sent', 'delivered', 'failed', 'rejected',
            ],
        )->first();

        $number = static fn (mixed $value): int => (int) ($value ?? 0);

        $trackedAlerts = $this->trackedTypeAlerts($documents, $today);

        $bankDocs = $this->companyQuery(BankDocument::query(), $user, $companyId);
        $todayMessages = $this->companyQuery(EmployeeMessage::query(), $user, $companyId)->whereDate('created_at', $today->toDateString());
        $todayAudit = AuditLog::query()->whereDate('created_at',$today->toDateString())
            ->where(fn($q)=>$q->whereNull('company_id')->orWhereIn('company_id',$this->companies->ids($user)))
            ->orderBy('created_at','desc')->limit(15)->get()->map(fn($l)=>$this->presenter->audit($l))->values();

        return [
            'documentTypeAlerts' => $trackedAlerts,
            'todayHistory' => $todayAudit,
            'stats' => [
                'expiringQid' => $trackedAlerts['qid']['expiringCount'] ?? 0,
                'expiredQid' => $trackedAlerts['qid']['expiredCount'] ?? 0,
                'expiringPassport' => $trackedAlerts['passport']['expiringCount'] ?? 0,
                'expiredPassport' => $trackedAlerts['passport']['expiredCount'] ?? 0,
                'expiringIstimara' => $trackedAlerts['istimara']['expiringCount'] ?? 0,
                'expiredIstimara' => $trackedAlerts['istimara']['expiredCount'] ?? 0,
                'totalEmployees' => $number($employeeTotals?->total_employees),
                'activeEmployees' => $number($employeeTotals?->active_employees),
                'cancelledEmployees' => $number($employeeTotals?->cancelled_employees),
                'archivedEmployees' => $archivedEmployees->count(),
                'totalVehicles' => $vehicles->count(),
                'totalDocuments' => $number($documentTotals?->total_documents),
                'expiredDocuments' => $number($documentTotals?->expired_documents),
                'expiringToday' => $number($documentTotals?->expiring_today),
                'expiringIn7Days' => $number($documentTotals?->expiring_seven),
                'expiringIn15Days' => $number($documentTotals?->expiring_fifteen),
                'expiringIn30Days' => $number($documentTotals?->expiring_thirty),
                'documentsWithoutExpiry' => $number($documentTotals?->without_expiry),
                'todaySmsCount' => $number($notificationTotals?->today_sms),
                'todayWhatsappCount' => $number($notificationTotals?->today_whatsapp),
                'todayEmailCount' => $number($notificationTotals?->today_email),
                'queuedNotifications' => $number($notificationTotals?->queued),
                'sentNotifications' => $number($notificationTotals?->sent),
                'deliveredNotifications' => $number($notificationTotals?->delivered),
                'failedNotifications' => $number($notificationTotals?->failed),
                'totalBankDocuments' => (clone $bankDocs)->count(),
                'expiredBankCards' => (clone $bankDocs)->whereNotNull('bank_card_expiry_date')->whereDate('bank_card_expiry_date','<',$today->toDateString())->count(),
                'todayMessages' => (clone $todayMessages)->count(),
                'todayDistinctMessagedEmployees' => (clone $todayMessages)->distinct()->count('employee_id'),
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

}
