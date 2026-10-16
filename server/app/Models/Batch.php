<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Batch extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'drug_id', 'batch_number', 'expiry_date', 'quantity_received', 'quantity_remaining',
        'cost_price', 'supplier_id', 'purchase_order_id', 'received_at', 'expired_flagged_at', 'written_off_at',
    ];

    protected function casts(): array
    {
        return [
            'expiry_date' => 'date',
            'quantity_received' => 'integer',
            'quantity_remaining' => 'integer',
            'cost_price' => 'decimal:2',
            'received_at' => 'datetime',
            'expired_flagged_at' => 'datetime',
            'written_off_at' => 'datetime',
        ];
    }

    public function drug(): BelongsTo
    {
        return $this->belongsTo(Drug::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * Unexpired, not written off, with stock remaining. Expired batches are
     * excluded from sellable stock automatically (FR-2.6).
     */
    public function scopeSellable(Builder $query): Builder
    {
        return $query->where('quantity_remaining', '>', 0)
            ->where('expiry_date', '>', now()->toDateString())
            ->whereNull('written_off_at');
    }

    public function isExpired(): bool
    {
        return $this->expiry_date->lte(now()->startOfDay());
    }
}
