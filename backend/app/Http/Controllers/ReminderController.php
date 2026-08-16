<?php

namespace App\Http\Controllers;

use App\Models\NotificationLog;
use App\Services\ApiPresenter;
use App\Services\CompanyScope;
use App\Services\ReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReminderController extends Controller
{
    public function __construct(
        private readonly ReminderService $reminders,
        private readonly CompanyScope $companies,
        private readonly ApiPresenter $presenter,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('notifications.view'), 403);
        $query = NotificationLog::query()->whereIn('company_id', $this->companies->ids($user));
        foreach (['channel', 'status'] as $filter) {
            if ($request->filled($filter) && $request->input($filter) !== 'all') {
                $query->where($filter, $request->input($filter));
            }
        }
        if ($request->filled('company_id')) {
            $companyId = $request->integer('company_id');
            $this->companies->authorize($user, $companyId);
            $query->where('company_id', $companyId);
        }
        if ($request->filled('document_type_id')) {
            $query->where('document_type_id', $request->integer('document_type_id'));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date('date_to'));
        }
        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(fn ($nested) => $nested
                ->where('recipient_name', 'like', "%{$search}%")
                ->orWhere('recipient_contact', 'like', "%{$search}%")
                ->orWhere('message_body', 'like', "%{$search}%"));
        }
        $sort = in_array($request->input('sort_by'), ['created_at', 'queued_at', 'sent_at', 'status', 'channel'], true)
            ? $request->input('sort_by')
            : 'created_at';
        $direction = $request->input('direction') === 'asc' ? 'asc' : 'desc';
        $paginator = $query->orderBy($sort, $direction)
            ->paginate(min(100, max(1, $request->integer('per_page', 20))));
        $paginator->setCollection($paginator->getCollection()->map(fn ($item) => $this->presenter->notification($item)));

        return response()->json($paginator);
    }

    public function scan(Request $request): JsonResponse
    {
        $validated = $request->validate(['companyId' => ['nullable', 'integer', 'exists:companies,id']]);

        return response()->json($this->reminders->scan($request->user(), $validated['companyId'] ?? null));
    }

    public function retry(Request $request, NotificationLog $notification): JsonResponse
    {
        return response()->json([
            'data' => $this->presenter->notification($this->reminders->retry($notification, $request->user())),
        ]);
    }
}
