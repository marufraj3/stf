<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountingAccount extends Model
{
    use SoftDeletes;
    protected $guarded = [];
    protected function casts(): array { return ['start_date'=>'date:Y-m-d','end_date'=>'date:Y-m-d','amount'=>'decimal:2','total_amount'=>'decimal:2','down_payment_percent'=>'decimal:2','interest_percent'=>'decimal:2','details'=>'array']; }
    public function company(): BelongsTo { return $this->belongsTo(Company::class); }
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
    public function vehicle(): BelongsTo { return $this->belongsTo(Vehicle::class); }
    public function payments(): HasMany { return $this->hasMany(AccountingPayment::class); }
}
