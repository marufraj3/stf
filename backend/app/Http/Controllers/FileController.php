<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\StoredFile;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FileController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function show(Request $request, StoredFile $file): StreamedResponse
    {
        $user = $request->user();
        // Company logos are branding assets shown across the UI, so viewing
        // them only requires company visibility - not document download rights.
        $isCompanyLogo = Company::query()->where('logo_path', $file->id)->exists();
        abort_unless(
            $user->isSuperAdmin()
                || $user->can('files.download')
                || ($isCompanyLogo && $user->can('companies.view')),
            403,
        );
        abort_unless($user->canAccessCompany($file->company_id), 403);
        abort_unless(Storage::disk($file->disk)->exists($file->path), 404);
        if (!$isCompanyLogo) {
            $this->audit->record(
                $user,
                'DOWNLOAD',
                'File',
                $file->id,
                $file->company_id,
                null,
                ['originalName' => $file->original_name, 'mimeType' => $file->mime_type],
                $request,
            );
        }

        return Storage::disk($file->disk)->response(
            $file->path,
            $file->original_name,
            [
                'Content-Type' => $file->mime_type,
                'Content-Disposition' => 'inline; filename="'.addslashes($file->original_name).'"',
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'private, max-age=300',
            ],
        );
    }
}
