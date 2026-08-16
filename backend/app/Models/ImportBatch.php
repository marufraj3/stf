<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImportBatch extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['column_mapping' => 'array'];
    }
}
