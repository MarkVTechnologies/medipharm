<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\SaleItem */
class SaleItemResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'drug_id' => $this->drug_id,
            'drug_name' => $this->whenLoaded('drug', fn () => $this->drug?->name),
            'strength' => $this->whenLoaded('drug', fn () => $this->drug?->strength),
            'batch_id' => $this->batch_id,
            'batch_number' => $this->whenLoaded('batch', fn () => $this->batch?->batch_number),
            'expiry_date' => $this->whenLoaded('batch', fn () => $this->batch?->expiry_date?->toDateString()),
            'quantity' => $this->quantity,
            'unit_price' => $this->money($this->unit_price),
            'line_total' => $this->money($this->line_total),
            'tax_amount' => $this->money($this->tax_amount),
        ];
    }
}
