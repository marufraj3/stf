<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\ImportBatch;
use App\Models\ImportRow;
use App\Models\Vehicle;
use App\Services\AuditService;
use App\Services\CompanyScope;
use App\Services\ErpResourceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Throwable;

class ImportController extends Controller
{
    public function __construct(
        private readonly CompanyScope $companies,
        private readonly ErpResourceService $resources,
        private readonly AuditService $audit,
    ) {
    }

    public function inspect(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('imports.create'), 403);
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt,xlsx,xls', 'max:10240'],
        ]);
        $sheet = $this->readRows(
            $request->file('file')->getRealPath(),
            $request->file('file')->getClientOriginalExtension(),
        );

        return response()->json([
            'data' => [
                'headers' => $sheet['headers'],
                'sample' => array_slice($sheet['rows'], 0, 3),
                'rowCount' => count($sheet['rows']),
            ],
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('imports.create'), 403);
        $validated = $request->validate([
            'type' => ['required', 'in:employees,documents,vehicles'],
            'companyId' => ['required', 'integer', 'exists:companies,id'],
            'file' => ['required', 'file', 'mimes:csv,txt,xlsx,xls', 'max:10240'],
            'columnMapping' => ['nullable', 'json'],
            'updateExisting' => ['nullable', 'boolean'],
        ]);
        $this->companies->authorize($user, $validated['companyId']);
        $mapping = json_decode((string) ($validated['columnMapping'] ?? '{}'), true) ?: [];
        $updateExisting = (bool) ($validated['updateExisting'] ?? false);
        $sheet = $this->readRows(
            $request->file('file')->getRealPath(),
            $request->file('file')->getClientOriginalExtension(),
            $mapping,
        );
        $rows = $sheet['rows'];

        $batch = DB::transaction(function () use ($rows, $validated, $user, $mapping, $updateExisting) {
            $batch = ImportBatch::create([
                'company_id' => $validated['companyId'],
                'user_id' => $user->id,
                'type' => $validated['type'],
                'status' => 'preview',
                'total_rows' => count($rows),
                'column_mapping' => [
                    'fields' => $mapping,
                    'updateExisting' => $updateExisting,
                ],
            ]);
            $validCount = 0;
            foreach ($rows as $index => $raw) {
                [$normalized, $errors] = $this->normalize(
                    $validated['type'],
                    $raw,
                    (int) $validated['companyId'],
                    $rows,
                    $updateExisting,
                );
                if ($errors === []) $validCount++;
                ImportRow::create([
                    'import_batch_id' => $batch->id,
                    'row_number' => $index + 2,
                    'raw_data' => $raw,
                    'normalized_data' => $normalized,
                    'errors' => $errors,
                    'status' => $errors === [] ? 'valid' : 'invalid',
                ]);
            }
            $batch->update([
                'valid_rows' => $validCount,
                'invalid_rows' => count($rows) - $validCount,
            ]);

            return $batch;
        });

        return response()->json([
            'data' => [
                'batchId' => (string) $batch->id,
                'total' => $batch->total_rows,
                'valid' => $batch->valid_rows,
                'invalid' => $batch->invalid_rows,
                'rows' => ImportRow::where('import_batch_id', $batch->id)->orderBy('row_number')->get()
                    ->map(fn ($row) => [
                        'rowNumber' => $row->row_number,
                        'data' => $row->normalized_data,
                        'errors' => $row->errors ?? [],
                        'status' => $row->status,
                    ]),
            ],
        ], 201);
    }

    public function commit(Request $request, ImportBatch $batch): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('imports.create'), 403);
        abort_unless($batch->user_id === $user->id || $user->isSuperAdmin(), 403);
        $this->companies->authorize($user, $batch->company_id);
        abort_unless($batch->status === 'preview', 422, 'This import batch has already been processed.');

        $created = 0;
        $updated = 0;
        $failed = 0;
        $skippedInvalid = $batch->invalid_rows;
        DB::transaction(function () use ($batch, $user, &$created, &$updated, &$failed) {
            $rows = ImportRow::where('import_batch_id', $batch->id)->where('status', 'valid')->orderBy('row_number')->lockForUpdate()->get();
            foreach ($rows as $row) {
                try {
                    $data = $row->normalized_data;
                    $existingId = Arr::pull($data, '_existingId');
                    if ($existingId) {
                        $model = $this->resources->findModel($batch->type, (int) $existingId);
                        $this->resources->update($batch->type, $model, $user, $data);
                        $updated++;
                    } else {
                        $this->resources->store($batch->type, $user, $data);
                        $created++;
                    }
                    $row->update(['status' => 'imported']);
                } catch (Throwable $exception) {
                    $row->update([
                        'status' => 'failed',
                        'errors' => [mb_substr($exception->getMessage(), 0, 1000)],
                    ]);
                    $failed++;
                }
            }
            $batch->update([
                'status' => $failed > 0 ? 'completed_with_errors' : 'completed',
                'created_rows' => $created,
                'updated_rows' => $updated,
                'invalid_rows' => $batch->invalid_rows + $failed,
            ]);
        });
        $this->audit->record($user, 'IMPORT', 'Import', $batch->id, $batch->company_id, null, [
            'type' => $batch->type,
            'created' => $created,
            'updated' => $updated,
            'failed' => $failed,
        ]);

        return response()->json(['data' => [
            'created' => $created,
            'updated' => $updated,
            'failed' => $failed,
            'skippedInvalid' => $skippedInvalid,
        ]]);
    }

    public function errors(Request $request, ImportBatch $batch): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('imports.view'), 403);
        abort_unless($batch->user_id === $user->id || $user->isSuperAdmin(), 403);
        $this->companies->authorize($user, $batch->company_id);

        return response()->streamDownload(function () use ($batch) {
            $stream = fopen('php://output', 'wb');
            fputcsv($stream, ['Row', 'Status', 'Errors', 'Raw Data']);
            ImportRow::query()
                ->where('import_batch_id', $batch->id)
                ->whereIn('status', ['invalid', 'failed'])
                ->orderBy('row_number')
                ->each(fn (ImportRow $row) => fputcsv($stream, [
                    $row->row_number,
                    $row->status,
                    implode(' | ', $row->errors ?? []),
                    json_encode($row->raw_data, JSON_UNESCAPED_UNICODE),
                ]));
            fclose($stream);
        }, "import-{$batch->id}-errors.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** @return array{headers:array<int,string>,rows:array<int,array<string,mixed>>} */
    private function readRows(string $path, string $extension, array $mapping = []): array
    {
        if (in_array(strtolower($extension), ['xlsx', 'xls'], true)) {
            $sheet = IOFactory::load($path)->getActiveSheet()->toArray(null, true, true, false);
        } else {
            $stream = fopen($path, 'rb');
            $sheet = [];
            while (($row = fgetcsv($stream)) !== false) $sheet[] = $row;
            fclose($stream);
        }
        if (count($sheet) < 2) return ['headers' => [], 'rows' => []];
        $headers = array_map(fn ($header) => Str::camel(trim((string) $header)), array_shift($sheet));
        $mappedHeaders = array_map(
            fn (string $header) => Str::camel((string) ($mapping[$header] ?? $header)),
            $headers,
        );
        $result = [];
        foreach ($sheet as $values) {
            if (count(array_filter($values, fn ($value) => trim((string) $value) !== '')) === 0) continue;
            $values = array_pad($values, count($headers), null);
            $result[] = array_combine($mappedHeaders, array_slice($values, 0, count($mappedHeaders)));
        }

        return ['headers' => $headers, 'rows' => $result];
    }

    private function normalize(
        string $type,
        array $row,
        int $companyId,
        array $allRows,
        bool $updateExisting = false,
    ): array
    {
        $errors = [];
        $required = match ($type) {
            'employees' => ['fullName', 'employeeCode'],
            'vehicles' => ['internalVehicleId', 'vehicleNumber', 'plateNumber'],
            default => ['ownerType', 'ownerId', 'documentTypeId', 'documentNumber'],
        };
        foreach ($required as $field) {
            if (trim((string) ($row[$field] ?? '')) === '') $errors[] = "{$field} is required.";
        }
        if ($type === 'employees') {
            if (!empty($row['email']) && !filter_var($row['email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'Email is invalid.';
            $existing = !empty($row['employeeCode'])
                ? Employee::withTrashed()
                    ->where('company_id', $companyId)
                    ->where('employee_code', trim((string) $row['employeeCode']))
                    ->first()
                : null;
            if ($existing?->trashed()) {
                $errors[] = 'Employee code belongs to an archived employee; restore it before importing.';
            } elseif ($existing && !$updateExisting) {
                $errors[] = 'Employee code already exists in this company.';
            }
            if ($this->duplicateCount($allRows, 'employeeCode', $row['employeeCode'] ?? null) > 1) {
                $errors[] = 'Employee code is duplicated in this import file.';
            }
            $normalized = [
                ...$row,
                'companyId' => $companyId,
                'fullName' => trim((string) ($row['fullName'] ?? '')),
                'employeeCode' => trim((string) ($row['employeeCode'] ?? '')),
                'status' => $row['status'] ?? 'active',
                ...($existing && $updateExisting ? ['_existingId' => $existing->id] : []),
            ];
        } elseif ($type === 'vehicles') {
            $existing = !empty($row['internalVehicleId'])
                ? Vehicle::withTrashed()
                    ->where('company_id', $companyId)
                    ->where('internal_vehicle_id', trim((string) $row['internalVehicleId']))
                    ->first()
                : null;
            if ($existing?->trashed()) {
                $errors[] = 'Internal vehicle ID belongs to an archived vehicle; restore it before importing.';
            } elseif ($existing && !$updateExisting) {
                $errors[] = 'Internal vehicle ID already exists in this company.';
            }
            if ($this->duplicateCount($allRows, 'internalVehicleId', $row['internalVehicleId'] ?? null) > 1) {
                $errors[] = 'Internal vehicle ID is duplicated in this import file.';
            }
            $normalized = [
                ...$row,
                'companyId' => $companyId,
                'status' => $row['status'] ?? 'active',
                'ownershipType' => $row['ownershipType'] ?? 'owned',
                ...($existing && $updateExisting ? ['_existingId' => $existing->id] : []),
            ];
        } else {
            $ownerType = strtolower((string) ($row['ownerType'] ?? ''));
            if (!in_array($ownerType, ['employee', 'vehicle', 'company'], true)) $errors[] = 'Owner type must be employee, vehicle, or company.';
            $typeModel = DocumentType::find($row['documentTypeId'] ?? null);
            if (!$typeModel) $errors[] = 'Document type does not exist.';
            if ($typeModel && $typeModel->owner_type !== $ownerType) $errors[] = 'Document type does not match owner type.';
            $ownerId = (int) ($row['ownerId'] ?? 0);
            $ownerValid = match ($ownerType) {
                'employee' => Employee::query()->whereKey($ownerId)->where('company_id', $companyId)->exists(),
                'vehicle' => Vehicle::query()->whereKey($ownerId)->where('company_id', $companyId)->exists(),
                'company' => Company::query()->whereKey($ownerId)->whereKey($companyId)->exists(),
                default => false,
            };
            if (!$ownerValid) $errors[] = 'Owner does not exist in the selected company.';
            $existing = $ownerValid && $typeModel
                ? \App\Models\Document::withTrashed()
                    ->where('company_id', $companyId)
                    ->where('owner_type', $ownerType)
                    ->where('owner_id', $ownerId)
                    ->where('document_type_id', $typeModel->id)
                    ->when(
                        trim((string) ($row['documentNumber'] ?? '')) !== '',
                        fn ($query) => $query->where('document_number', trim((string) $row['documentNumber'])),
                        fn ($query) => $query->whereNull('document_number'),
                    )
                    ->first()
                : null;
            if ($existing?->trashed()) {
                $errors[] = 'The matching document is archived; restore it before importing.';
            } elseif ($existing && !$updateExisting) {
                $errors[] = 'The matching owner document already exists.';
            }
            $normalized = [
                ...$row,
                'companyId' => $companyId,
                'ownerType' => $ownerType,
                'ownerId' => (int) ($row['ownerId'] ?? 0),
                'documentTypeId' => (int) ($row['documentTypeId'] ?? 0),
                'reminderEnabled' => true,
                ...($existing && $updateExisting ? ['_existingId' => $existing->id] : []),
            ];
        }

        return [$normalized, array_values(array_unique($errors))];
    }

    private function duplicateCount(array $rows, string $field, mixed $value): int
    {
        $needle = mb_strtolower(trim((string) $value));
        if ($needle === '') {
            return 0;
        }

        return count(array_filter(
            $rows,
            fn (array $candidate) => mb_strtolower(trim((string) ($candidate[$field] ?? ''))) === $needle,
        ));
    }
}
