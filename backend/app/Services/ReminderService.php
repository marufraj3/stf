<?php

namespace App\Services;

use App\Jobs\SendExpiryNotification;
use App\Models\Company;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\NotificationLog;
use App\Models\NotificationTemplate;
use App\Models\ReminderRule;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReminderService
{
    public function __construct(
        private readonly CompanyScope $companyScope,
        private readonly AuditService $audit,
    ) {
    }

    /** @return array{scannedCount:int,generatedCount:int,duplicateCount:int,skippedCount:int} */
    public function scan(?User $actor = null, ?int $companyId = null): array
    {
        if ($actor) {
            abort_unless($actor->isSuperAdmin() || $actor->can('notifications.run'), 403);
            if ($companyId) {
                $this->companyScope->authorize($actor, $companyId);
            }
        }

        $today = CarbonImmutable::now('Asia/Qatar')->startOfDay();
        $query = Document::query()
            ->where('reminder_enabled', true)
            ->whereNotNull('expiry_date')
            ->where('status', 'active');
        if ($companyId) {
            $query->where('company_id', $companyId);
        }
        if ($actor && !$actor->isSuperAdmin() && !$actor->all_companies) {
            $query->whereIn('company_id', $this->companyScope->ids($actor));
        }

        $result = ['scannedCount' => 0, 'generatedCount' => 0, 'duplicateCount' => 0, 'skippedCount' => 0];

        $query->orderBy('id')->chunkById(200, function ($documents) use (&$result, $today) {
            foreach ($documents as $document) {
                $result['scannedCount']++;
                $days = (int) $today->diffInDays(
                    CarbonImmutable::parse($document->expiry_date, 'Asia/Qatar')->startOfDay(),
                    false,
                );
                $rule = $this->resolveRule($document);
                if (!$rule['active'] || !in_array($days, $rule['days'], true)) {
                    $result['skippedCount']++;
                    continue;
                }
                $channels = $this->enabledChannels($rule['channels']);
                if ($channels === []) {
                    $result['skippedCount']++;
                    continue;
                }

                $recipients = $this->resolveRecipients($document, $rule['recipients']);
                if ($recipients === []) {
                    $result['skippedCount']++;
                    continue;
                }

                foreach ($channels as $channel) {
                    foreach ($recipients as $recipient) {
                        $contact = $channel === 'email' ? $recipient['email'] : $recipient['phone'];
                        if (!$contact) {
                            continue;
                        }

                        $idempotencyKey = hash('sha256', implode('|', [
                            $document->id,
                            $channel,
                            strtolower(trim($contact)),
                            $days,
                            $today->toDateString(),
                        ]));
                        $template = $this->resolveTemplate($document, $channel);
                        $variables = $this->templateVariables($document, $recipient, $days);
                        $body = $this->render(
                            $template?->message_body ?? $this->fallbackBody(),
                            $variables,
                        );
                        $subject = $channel === 'email'
                            ? $this->render($template?->email_subject ?? '{DocumentType} expiry reminder', [
                                ...$variables,
                            ])
                            : null;

                        [$log, $created] = $this->createLog($document, $recipient, $contact, $channel, $subject, $body, $days, $today, $idempotencyKey);
                        if (!$created) {
                            $result['duplicateCount']++;
                            continue;
                        }

                        SendExpiryNotification::dispatch($log->id);
                        $result['generatedCount']++;
                    }
                }
            }
        });

        SystemSetting::query()->updateOrCreate(
            ['company_id' => null, 'key' => 'application'],
            ['value' => array_replace(
                SystemSetting::whereNull('company_id')->where('key', 'application')->first()?->value ?? [],
                ['lastExpiryScanAt' => now('Asia/Qatar')->toIso8601String()],
            )]
        );

        $this->audit->record($actor, 'EXPIRY_SCAN', 'Notifications', null, $companyId, null, $result);

        return $result;
    }

    public function retry(NotificationLog $log, User $actor): NotificationLog
    {
        abort_unless($actor->isSuperAdmin() || $actor->can('notifications.retry'), 403);
        $this->companyScope->authorize($actor, $log->company_id);
        if (!in_array($log->status, ['failed', 'rejected'], true)) {
            throw ValidationException::withMessages(['notification' => 'Only failed or rejected notifications can be retried.']);
        }
        if ($log->retry_count >= 3) {
            throw ValidationException::withMessages(['notification' => 'Maximum retry limit reached.']);
        }

        $log->update([
            'status' => 'queued',
            'failure_reason' => null,
            'queued_at' => now('Asia/Qatar'),
        ]);
        SendExpiryNotification::dispatch($log->id);
        $this->audit->record($actor, 'RETRY', 'Notifications', $log->id, $log->company_id);

        return $log->fresh();
    }

    /** @return array{active:bool,days:array<int>,channels:array<string>,recipients:array<string>} */
    private function resolveRule(Document $document): array
    {
        $rule = ReminderRule::query()
            ->where('is_active', true)
            ->where(function ($query) use ($document) {
                $query->where('company_id', $document->company_id)->orWhereNull('company_id');
            })
            ->where(function ($query) use ($document) {
                $query->where('document_type_id', $document->document_type_id)->orWhereNull('document_type_id');
            })
            ->orderByRaw('company_id IS NULL')
            ->orderByRaw('document_type_id IS NULL')
            ->first();
        $type = DocumentType::query()->find($document->document_type_id);
        $company = Company::query()->find($document->company_id);
        $global = SystemSetting::whereNull('company_id')->where('key', 'application')->first()?->value ?? [];

        return [
            'active' => (bool) ($type?->reminder_enabled ?? true),
            'days' => array_map('intval', Arr::wrap(
                $rule?->reminder_days
                ?? $type?->custom_reminder_days
                ?? $company?->reminder_days
                ?? $global['globalReminderDays']
                ?? [30, 15, 10, 7, 3, 1, 0]
            )),
            'channels' => Arr::wrap($rule?->channels ?? ['email', 'sms', 'whatsapp']),
            'recipients' => Arr::wrap($rule?->recipients ?? ['owner']),
        ];
    }

    /** @return array<int,array{name:string,email:?string,phone:?string,type:string}> */
    private function resolveRecipients(Document $document, array $configured): array
    {
        $recipients = [];
        $configured = $configured ?: ['owner'];
        foreach ($configured as $definition) {
            $type = is_array($definition) ? ($definition['type'] ?? 'custom') : $definition;
            if ($type === 'owner') {
                $owner = $this->ownerRecipient($document);
                if ($owner) {
                    $recipients[] = $owner;
                }
            } elseif ($type === 'assigned_hr') {
                $recipients = [...$recipients, ...$this->roleRecipients('HR', $document->company_id, 'assigned_hr')];
            } elseif ($type === 'company_manager') {
                $managerIds = Department::query()
                    ->where('company_id', $document->company_id)
                    ->whereNotNull('manager_user_id')
                    ->pluck('manager_user_id');
                $managers = User::query()
                    ->where('status', 'active')
                    ->where(function ($query) use ($managerIds) {
                        $query->whereIn('id', $managerIds)
                            ->orWhereHas('roles', fn ($roles) => $roles->where('name', 'Manager'));
                    })
                    ->get();
                foreach ($managers as $manager) {
                    if ($manager->canAccessCompany($document->company_id)) {
                        $recipients[] = $this->userRecipient($manager, 'company_manager');
                    }
                }
            } elseif ($type === 'super_admin') {
                foreach (User::role('Super Admin')->where('status', 'active')->get() as $admin) {
                    $recipients[] = $this->userRecipient($admin, 'super_admin');
                }
            } elseif ($type === 'custom' && is_array($definition)) {
                $recipients[] = [
                    'name' => trim((string) ($definition['name'] ?? 'Custom recipient')),
                    'email' => $definition['email'] ?? null,
                    'phone' => $definition['phone'] ?? null,
                    'type' => 'custom',
                ];
            }
        }

        return collect($recipients)
            ->filter(fn ($recipient) => !empty($recipient['email']) || !empty($recipient['phone']))
            ->unique(fn ($recipient) => strtolower((string) ($recipient['email'] ?: $recipient['phone'])))
            ->values()
            ->all();
    }

    private function ownerRecipient(Document $document): ?array
    {
        if ($document->owner_type === 'employee') {
            $employee = Employee::query()->find($document->owner_id);
            if (!$employee || !in_array($employee->status, ['active', 'on_leave'], true)) {
                return null;
            }

            return [
                'name' => $employee->full_name,
                'email' => $employee->email,
                'phone' => $employee->mobile,
                'type' => 'owner',
            ];
        }
        if ($document->owner_type === 'vehicle') {
            $vehicle = Vehicle::query()->find($document->owner_id);
            if (!$vehicle || in_array($vehicle->status, ['inactive', 'sold', 'cancelled'], true)) {
                return null;
            }
            $driver = $vehicle->assigned_driver_id
                ? Employee::query()->find($vehicle->assigned_driver_id)
                : null;
            if (!$driver || !in_array($driver->status, ['active', 'on_leave'], true)) {
                return null;
            }

            return [
                'name' => $driver->full_name,
                'email' => $driver->email,
                'phone' => $driver->mobile,
                'type' => 'owner',
            ];
        }

        $company = Company::query()->where('is_active', true)->find($document->company_id);
        if (!$company) {
            return null;
        }

        return [
            'name' => $company->name,
            'email' => $company->email,
            'phone' => $company->phone,
            'type' => 'owner',
        ];
    }

    private function roleRecipients(string $role, int $companyId, string $type): array
    {
        return User::role($role)
            ->where('status', 'active')
            ->get()
            ->filter(fn (User $user) => $user->canAccessCompany($companyId))
            ->map(fn (User $user) => $this->userRecipient($user, $type))
            ->values()
            ->all();
    }

    private function userRecipient(User $user, string $type): array
    {
        return [
            'name' => $user->name,
            'email' => $user->email,
            'phone' => null,
            'type' => $type,
        ];
    }

    private function templateVariables(Document $document, array $recipient, int $days): array
    {
        $employee = $document->owner_type === 'employee'
            ? Employee::query()->find($document->owner_id)
            : null;
        $vehicle = $document->owner_type === 'vehicle'
            ? Vehicle::query()->find($document->owner_id)
            : null;

        return [
            'EmployeeName' => $employee?->full_name ?? $recipient['name'],
            'EmployeeCode' => $employee?->employee_code ?? '',
            'OwnerName' => $employee?->full_name ?? $vehicle?->vehicle_number ?? Company::whereKey($document->company_id)->value('name') ?? '',
            'DocumentType' => DocumentType::whereKey($document->document_type_id)->value('name') ?? 'Document',
            'DocumentNumber' => $document->document_number ?? '',
            'ExpiryDate' => $document->expiry_date?->format('Y-m-d') ?? '',
            'DaysRemaining' => (string) $days,
            'CompanyName' => Company::whereKey($document->company_id)->value('name') ?? 'Trust Group',
            'VehicleNumber' => $vehicle?->vehicle_number ?? '',
            'HRName' => $recipient['type'] === 'assigned_hr' ? $recipient['name'] : '',
            'ContactNumber' => $recipient['phone'] ?? $recipient['email'] ?? '',
        ];
    }

    private function resolveTemplate(Document $document, string $channel): ?NotificationTemplate
    {
        return NotificationTemplate::query()
            ->where('channel', $channel)
            ->where('is_active', true)
            ->where(function ($query) use ($document) {
                $query->where('company_id', $document->company_id)->orWhereNull('company_id');
            })
            ->where(function ($query) use ($document) {
                $query->where('document_type_id', $document->document_type_id)->orWhereNull('document_type_id');
            })
            ->orderByRaw('company_id IS NULL')
            ->orderByRaw('document_type_id IS NULL')
            ->first();
    }

    private function createLog(
        Document $document,
        array $recipient,
        string $contact,
        string $channel,
        ?string $subject,
        string $body,
        int $days,
        CarbonImmutable $today,
        string $key,
    ): array {
        return DB::transaction(function () use ($document, $recipient, $contact, $channel, $subject, $body, $days, $today, $key) {
            $log = NotificationLog::query()->firstOrCreate(
                ['idempotency_key' => $key],
                [
                    'company_id' => $document->company_id,
                    'document_id' => $document->id,
                    'owner_type' => $document->owner_type,
                    'owner_id' => $document->owner_id,
                    'document_type_id' => $document->document_type_id,
                    'recipient_name' => $recipient['name'],
                    'recipient_contact' => $contact,
                    'channel' => $channel,
                    'email_subject' => $subject,
                    'message_body' => $body,
                    'expiry_date' => $document->expiry_date,
                    'reminder_day' => $days,
                    'scheduled_date' => $today->toDateString(),
                    'status' => 'queued',
                    'queued_at' => now('Asia/Qatar'),
                ]
            );

            return [$log, $log->wasRecentlyCreated];
        });
    }

    private function render(string $template, array $variables): string
    {
        foreach ($variables as $key => $value) {
            $template = str_replace('{'.$key.'}', (string) $value, $template);
        }

        return $template;
    }

    /** @return array<string> */
    private function enabledChannels(array $channels): array
    {
        $value = SystemSetting::whereNull('company_id')->where('key', 'application')->first()?->value ?? [];
        $provider = $value['providerConfig'] ?? $value;
        $keys = [
            'email' => 'emailEnabled',
            'sms' => 'smsEnabled',
            'whatsapp' => 'whatsappEnabled',
        ];

        return array_values(array_filter(
            $channels,
            fn (string $channel) => isset($keys[$channel]) && ($provider[$keys[$channel]] ?? false) === true,
        ));
    }

    private function fallbackBody(): string
    {
        return 'Dear {EmployeeName}, your {DocumentType} will expire on {ExpiryDate}. Please renew it before expiry. Trust Group HR Department';
    }
}
