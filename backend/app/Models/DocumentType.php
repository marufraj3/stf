<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentType extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'document_number_required' => 'boolean',
            'issue_date_required' => 'boolean',
            'expiry_date_required' => 'boolean',
            'file_required' => 'boolean',
            'reminder_enabled' => 'boolean',
            'custom_reminder_days' => 'array',
            'is_active' => 'boolean',
        ];
    }
}
