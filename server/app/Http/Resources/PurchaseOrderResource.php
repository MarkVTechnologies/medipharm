<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\PurchaseOrder */
class PurchaseOrderResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'supplier_id' => $this->supplier_id,
            'supplier' => $this->whenLoaded('supplier', fn () => $this->supplier?->only(['id', 'name', 'phone', 'email'])),
            'status' => $this->status,
            'expected_date' => $this->expected_date?->toDateString(),
            'total' => $this->money($this->total),
            'notes' => $this->notes,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->only(['id', 'name'])),
            'items_count' => $this->whenCounted('items'),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'drug_id' => $item->drug_id,
                'drug_name' => $item->drug?->name,
                'strength' => $item->drug?->strength,
                'pack_size' => $item->drug?->pack_size,
                'quantity_ordered' => $item->quantity_ordered,
                'quantity_received' => $item->quantity_received,
                'quantity_outstanding' => max(0, $item->quantity_ordered - $item->quantity_received),
                'unit_cost' => $this->money($item->unit_cost),
                'line_total' => round($item->quantity_ordered * (float) $item->unit_cost, 2),
            ])),
            'created_at' => $this->date($this->created_at),
            'updated_at' => $this->date($this->updated_at),
        ];
    }
}
