<?php

namespace App\Services;

use App\Models\StoredFile;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FileStorageService
{
    private const MIME_EXTENSIONS = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ];

    /**
     * @param array<string>|null $allowedMimes
     */
    public function storeDataUrl(
        ?string $dataUrl,
        ?int $companyId,
        User $user,
        ?string $originalName = null,
        ?array $allowedMimes = null,
    ): ?StoredFile {
        if (!$dataUrl || !str_starts_with($dataUrl, 'data:')) {
            return null;
        }
        abort_unless($user->isSuperAdmin() || $user->can('files.upload'), 403, 'You do not have permission to upload files.');

        if (!preg_match('#^data:([^;]+);base64,(.+)$#s', $dataUrl, $matches)) {
            throw ValidationException::withMessages(['file' => 'Invalid file encoding.']);
        }

        $mime = strtolower($matches[1]);
        if (!isset(self::MIME_EXTENSIONS[$mime])) {
            throw ValidationException::withMessages([
                'file' => 'Only PDF, JPG, JPEG and PNG files are allowed.',
            ]);
        }

        $bytes = base64_decode($matches[2], true);
        if ($bytes === false) {
            throw ValidationException::withMessages(['file' => 'The uploaded file is corrupted.']);
        }
        $detectedMime = strtolower((new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes) ?: '');
        if (!isset(self::MIME_EXTENSIONS[$detectedMime]) || $detectedMime !== $mime) {
            throw ValidationException::withMessages(['file' => 'The file content does not match its declared type.']);
        }
        if ($allowedMimes !== null && !in_array($detectedMime, $allowedMimes, true)) {
            throw ValidationException::withMessages(['file' => 'This file type is not allowed here.']);
        }

        $setting = SystemSetting::query()
            ->whereNull('company_id')
            ->where('key', 'application')
            ->first()?->value ?? [];
        $maxMb = (int) (($setting['defaultFileMaxSizeMb'] ?? null) ?: 5);
        if (strlen($bytes) > $maxMb * 1024 * 1024) {
            throw ValidationException::withMessages([
                'file' => "The file may not be larger than {$maxMb} MB.",
            ]);
        }

        $extension = self::MIME_EXTENSIONS[$detectedMime];
        $safeName = basename(str_replace('\\', '/', $originalName ?: 'document.'.$extension));
        $safeName = preg_replace('/[^\pL\pN._ -]+/u', '_', $safeName) ?: 'document.'.$extension;
        if (strtolower(pathinfo($safeName, PATHINFO_EXTENSION)) !== $extension) {
            $safeName .= '.'.$extension;
        }
        $safeName = mb_substr($safeName, 0, 255);
        $path = sprintf(
            'erp/%s/%s/%s.%s',
            $companyId ?: 'global',
            now('Asia/Qatar')->format('Y/m'),
            Str::uuid(),
            $extension
        );

        $disk = (string) config('erp.private_disk', 'local');
        if (!array_key_exists($disk, config('filesystems.disks', []))) {
            throw ValidationException::withMessages(['file' => 'The configured private storage disk is unavailable.']);
        }
        if (!Storage::disk($disk)->put($path, $bytes)) {
            throw ValidationException::withMessages([
                'file' => 'The file could not be saved. Check private storage permissions.',
            ]);
        }

        return StoredFile::create([
            'company_id' => $companyId,
            'disk' => $disk,
            'path' => $path,
            'original_name' => $safeName,
            'mime_type' => $detectedMime,
            'size_bytes' => strlen($bytes),
            'sha256' => hash('sha256', $bytes),
            'uploaded_by' => $user->id,
        ]);
    }
}
