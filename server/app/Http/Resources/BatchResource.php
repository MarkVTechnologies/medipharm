<?php

namespace App\Http\Resources;

use App\Services\StockService;
use Illuminate\Http\Request;

/** @mixin \App\Models\Batch */
class BatchResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'drug_id' => $this->drug_id,
            'drug' => $this->whenLoaded('drug', fn () => $this->drug?->only(['id', 'name', 'strength', 'form'])),
            'batch_number' => $this->batch_number,
            'expiry_date' => $this->expiry_date?->toDateString(),
            'days_to_expiry' => (int) now()->startOfDay()->diffInDays($this->expiry_date, false),
            'is_expired' => $this->isExpired(),
            'quantity_received' => $this->quantity_received,
            'quantity_remaining' => $this->quantity_remaining,
            'cost_price' => $this->money($this->cost_price),
            'value_at_cost' => StockService::valueAtCost($this->resource),
            'supplier_id' => $this->supplier_id,
            'supplier' => $this->whenLoaded('supplier', fn () => $this->supplier?->only(['id', 'name'])),
            'purchase_order_id' => $this->purchase_order_id,
            'received_at' => $this->date($this->received_at),
            'expired_flagged_at' => $this->date($this->expired_flagged_at),
            'written_off_at' => $this->date($this->written_off_at),
        ];
    }
}
