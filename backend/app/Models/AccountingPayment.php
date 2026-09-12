<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountingPayment extends Model
{
    protected $guarded = [];
    protected function casts(): array { return ['payment_date'=>'date:Y-m-d','due_date'=>'date:Y-m-d','amount_due'=>'decimal:2','amount_paid'=>'decimal:2']; }
    public function account(): BelongsTo { return $this->belongsTo(AccountingAccount::class, 'accounting_account_id'); }
}
