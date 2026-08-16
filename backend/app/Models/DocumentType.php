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
            'alert_lead_days' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Lead time, in days, before expiry that dashboards should raise a yellow
     * warning for this document type (QID 15, Passport 90, Istimara 30…).
     */
    public function alertLeadDays(): int
    {
        $days = (int) ($this->alert_lead_days ?? 0);

        return $days > 0 ? $days : 30;
    }
}
