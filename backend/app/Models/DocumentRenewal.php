<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentRenewal extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'previous_issue_date' => 'date:Y-m-d',
            'previous_expiry_date' => 'date:Y-m-d',
            'new_issue_date' => 'date:Y-m-d',
            'new_expiry_date' => 'date:Y-m-d',
            'renewed_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function previousFile(): BelongsTo
    {
        return $this->belongsTo(StoredFile::class, 'previous_file_id');
    }

    public function newFile(): BelongsTo
    {
        return $this->belongsTo(StoredFile::class, 'new_file_id');
    }

    public function renewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'renewed_by');
    }
}
