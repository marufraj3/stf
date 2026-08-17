<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeMessage extends Model
{
    protected $guarded = [];
    public function company(): BelongsTo { return $this->belongsTo(Company::class); }
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
    public function sender(): BelongsTo { return $this->belongsTo(User::class,'created_by'); }
}
