<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VehicleAssignment extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'assigned_date' => 'date:Y-m-d',
            'unassigned_date' => 'date:Y-m-d',
        ];
    }
}
