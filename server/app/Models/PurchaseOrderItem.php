<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * No tenant_id: always reached through its PurchaseOrder, which is tenant-scoped.
 */
class PurchaseOrderItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'purchase_order_id', 'drug_id', 'quantity_ordered', 'quantity_received', 'unit_cost',
    ];

    protected function casts(): array
    {
        return [
            'quantity_ordered' => 'integer',
            'quantity_received' => 'integer',
            'unit_cost' => 'decimal:2',
        ];
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function drug(): BelongsTo
    {
        return $this->belongsTo(Drug::class);
    }
}
