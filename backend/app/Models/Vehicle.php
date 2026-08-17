<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vehicle extends Model
{
    use SoftDeletes;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'registration_date' => 'date:Y-m-d',
            'issue_date' => 'date:Y-m-d',
            'expiry_date' => 'date:Y-m-d',
            'renew_date' => 'date:Y-m-d',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function assignedDriver(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'assigned_driver_id')->withTrashed();
    }

    public function secondaryDriver(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'secondary_driver_id')->withTrashed();
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'owner_id')
            ->where('owner_type', 'vehicle');
    }
}
