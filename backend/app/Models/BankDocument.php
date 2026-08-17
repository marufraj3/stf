<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class BankDocument extends Model
{
    use SoftDeletes;
    protected $guarded = [];
    protected function casts(): array
    {
        return [
            'bank_card_expiry_date' => 'date:Y-m-d',
            'account_phone_expiry_date' => 'date:Y-m-d',
        ];
    }
    public function company(): BelongsTo { return $this->belongsTo(Company::class); }
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
    public function bankFile(): BelongsTo { return $this->belongsTo(StoredFile::class,'bank_file_id'); }
}
