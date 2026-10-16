<?php

namespace App\Http\Resources;

use App\Models\Drug;
use Illuminate\Http\Request;

/** @mixin \App\Models\Drug */
class DrugResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        $onHand = $this->stock_on_hand !== null ? (int) $this->stock_on_hand : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'generic_name' => $this->generic_name,
            'brand' => $this->brand,
            'nafdac_number' => $this->nafdac_number,
            'category' => $this->category,
            'form' => $this->form,
            'strength' => $this->strength,
            'pack_size' => $this->pack_size,
            'barcode' => $this->barcode,
            'cost_price' => $this->money($this->cost_price),
            'selling_price' => $this->money($this->selling_price),
            'tax_rate' => $this->money($this->tax_rate),
            'reorder_level' => $this->reorder_level,
            'preferred_supplier_id' => $this->preferred_supplier_id,
            'preferred_supplier' => $this->whenLoaded('preferredSupplier', fn () => $this->preferredSupplier?->only(['id', 'name'])),
            'is_active' => $this->is_active,
            'stock_on_hand' => $onHand,
            // Derived, never stored (FR-2.5).
            'stock_status' => $onHand !== null ? Drug::stockStatus($onHand, $this->reorder_level) : null,
            'batches' => BatchResource::collection($this->whenLoaded('batches')),
            'created_at' => $this->date($this->created_at),
            'updated_at' => $this->date($this->updated_at),
        ];
    }
}
