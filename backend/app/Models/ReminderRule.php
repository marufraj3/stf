<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReminderRule extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'reminder_days' => 'array',
            'channels' => 'array',
            'recipients' => 'array',
            'is_active' => 'boolean',
        ];
    }
}
