<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentRenewal;
use App\Models\DocumentType;
use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class DocumentRenewalService
{
    public function __construct(
        private readonly CompanyScope $companyScope,
        private readonly FileStorageService $files,
        private readonly AuditService $audit,
        private readonly ApiPresenter $presenter,
    ) {
    }

    public function renew(int $documentId, User $user, array $data): array
    {
        $validated = Validator::make($data, [
            'newDocNumber' => ['nullable', 'string', 'max:255'],
            'newIssueDate' => ['nullable', 'date'],
            'newExpiryDate' => ['nullable', 'date'],
            'newFileUrl' => ['nullable', 'string'],
            'newFileName' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'changeReason' => ['required', 'string', 'max:2000'],
        ])->validate();
        if (
            !empty($validated['newIssueDate'])
            && !empty($validated['newExpiryDate'])
            && $validated['newExpiryDate'] < $validated['newIssueDate']
        ) {
            throw ValidationException::withMessages(['newExpiryDate' => 'Expiry date cannot be before issue date.']);
        }

        return DB::transaction(function () use ($documentId, $user, $validated) {
            /** @var Document $document */
            $document = Document::query()->lockForUpdate()->findOrFail($documentId);
            abort_unless(
                $user->isSuperAdmin()
                    || $user->can('documents.renew')
                    || (
                        $document->owner_type === 'company'
                        && $user->can('company_documents.manage')
                    ),
                403,
                'You do not have permission to renew this document.',
            );
            $this->companyScope->authorize($user, $document->company_id);
            $type = DocumentType::query()->findOrFail($document->document_type_id);

            if ($type->document_number_required && empty($validated['newDocNumber'])) {
                throw ValidationException::withMessages(['newDocNumber' => 'Document number is required.']);
            }
            if ($type->expiry_date_required && empty($validated['newExpiryDate'])) {
                throw ValidationException::withMessages(['newExpiryDate' => 'Expiry date is required.']);
            }

            $before = $document->toArray();
            $newFile = $this->files->storeDataUrl(
                $validated['newFileUrl'] ?? null,
                $document->company_id,
                $user,
                $validated['newFileName'] ?? null,
            );

            $renewal = DocumentRenewal::create([
                'company_id' => $document->company_id,
                'document_id' => $document->id,
                'previous_document_number' => $document->document_number,
                'previous_issue_date' => $document->issue_date,
                'previous_expiry_date' => $document->expiry_date,
                'previous_file_id' => $document->current_file_id,
                'new_document_number' => $validated['newDocNumber'] ?? null,
                'new_issue_date' => $validated['newIssueDate'] ?? null,
                'new_expiry_date' => $validated['newExpiryDate'] ?? null,
                'new_file_id' => $newFile?->id ?? $document->current_file_id,
                'renewed_at' => now('Asia/Qatar'),
                'renewed_by' => $user->id,
                'notes' => $validated['notes'] ?? null,
                'change_reason' => $validated['changeReason'],
            ]);

            NotificationLog::query()
                ->where('document_id', $document->id)
                ->whereIn('status', ['queued', 'processing'])
                ->update([
                    'status' => 'cancelled',
                    'failure_reason' => 'Cancelled because the document was renewed.',
                ]);

            $document->update([
                'document_number' => $validated['newDocNumber'] ?? null,
                'issue_date' => $validated['newIssueDate'] ?? null,
                'expiry_date' => $validated['newExpiryDate'] ?? null,
                'current_file_id' => $newFile?->id ?? $document->current_file_id,
                'status' => 'active',
                'updated_by' => $user->id,
            ]);

            $this->audit->record(
                $user,
                'RENEW',
                'Document',
                $document->id,
                $document->company_id,
                $before,
                $document->fresh()->toArray(),
            );

            return [
                'document' => $this->presenter->document($document->fresh()),
                'renewal' => $this->presenter->renewal($renewal),
            ];
        });
    }
}
