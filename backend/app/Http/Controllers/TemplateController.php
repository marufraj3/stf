<?php

namespace App\Http\Controllers;

use App\Jobs\SendExpiryNotification;
use App\Models\NotificationLog;
use App\Models\NotificationTemplate;
use App\Services\AuditService;
use App\Services\CompanyScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TemplateController extends Controller
{
    private const SAMPLE_VALUES = [
        'EmployeeName' => 'Sample Employee',
        'EmployeeCode' => 'EMP-001',
        'CompanyName' => 'Trust Group',
        'DocumentType' => 'QID',
        'DocumentNumber' => '28400000000',
        'ExpiryDate' => '31 Dec 2026',
        'DaysRemaining' => '30',
        'VehicleNumber' => 'VEH-001',
        'HRName' => 'HR Team',
        'ContactNumber' => '+974 5000 0000',
    ];

    public function __construct(
        private readonly CompanyScope $companies,
        private readonly AuditService $audit,
    ) {
    }

    public function preview(Request $request, NotificationTemplate $template): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('templates.view'), 403);
        if ($template->company_id) {
            $this->companies->authorize($user, $template->company_id);
        }
        $values = array_replace(self::SAMPLE_VALUES, $request->validate([
            'variables' => ['nullable', 'array'],
            'variables.*' => ['nullable', 'string', 'max:255'],
        ])['variables'] ?? []);

        return response()->json([
            'data' => [
                'subject' => $this->render($template->email_subject, $values),
                'message' => $this->render($template->message_body, $values),
                'variables' => $values,
            ],
        ]);
    }

    public function test(Request $request, NotificationTemplate $template): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user->isSuperAdmin() || ($user->can('templates.manage') && $user->can('notifications.manage')),
            403,
        );
        $validated = $request->validate([
            'companyId' => ['required', 'integer', 'exists:companies,id'],
            'recipientName' => ['required', 'string', 'max:255'],
            'recipientContact' => [
                'required',
                'string',
                'max:255',
                $template->channel === 'email' ? 'email' : 'regex:/^\+?[0-9 ()-]{7,30}$/',
            ],
            'variables' => ['nullable', 'array'],
            'variables.*' => ['nullable', 'string', 'max:255'],
        ]);
        $companyId = (int) $validated['companyId'];
        $this->companies->authorize($user, $companyId);
        abort_if($template->company_id && (int) $template->company_id !== $companyId, 422, 'This template belongs to another company.');

        $values = array_replace(self::SAMPLE_VALUES, $validated['variables'] ?? []);
        $log = NotificationLog::create([
            'company_id' => $companyId,
            'document_id' => null,
            'owner_type' => 'test',
            'owner_id' => null,
            'document_type_id' => $template->document_type_id,
            'recipient_name' => $validated['recipientName'],
            'recipient_contact' => $validated['recipientContact'],
            'channel' => $template->channel,
            'email_subject' => $this->render($template->email_subject, $values),
            'message_body' => $this->render($template->message_body, $values),
            'status' => 'queued',
            'queued_at' => now('Asia/Qatar'),
            'scheduled_date' => now('Asia/Qatar')->toDateString(),
            'idempotency_key' => hash('sha256', 'template-test|'.$template->id.'|'.Str::uuid()),
            'provider_payload' => [
                'test' => true,
                'templateId' => $template->id,
                'subject' => $this->render($template->email_subject, $values),
            ],
        ]);
        SendExpiryNotification::dispatch($log->id);
        $this->audit->record($user, 'TEST', 'Template', $template->id, $companyId, null, [
            'notificationLogId' => $log->id,
            'channel' => $template->channel,
            'recipient' => $validated['recipientContact'],
        ], $request);

        return response()->json([
            'message' => 'Test notification queued.',
            'data' => ['notificationLogId' => (string) $log->id, 'status' => 'queued'],
        ], 201);
    }

    private function render(?string $content, array $variables): string
    {
        if (!$content) {
            return '';
        }

        return strtr($content, collect($variables)
            ->mapWithKeys(fn ($value, $key) => ['{'.$key.'}' => (string) $value])
            ->all());
    }
}
