<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\Sale */
class SaleResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'customer_id' => $this->customer_id,
            'customer' => $this->whenLoaded('customer', fn () => $this->customer?->only(['id', 'code', 'name', 'phone', 'tier'])),
            'served_by' => $this->whenLoaded('user', fn () => $this->user?->only(['id', 'name'])),
            'subtotal' => $this->money($this->subtotal),
            'discount' => $this->money($this->discount),
            'vat' => $this->money($this->vat),
            'total' => $this->money($this->total),
            'payment_method' => $this->payment_method,
            'amount_tendered' => $this->money($this->amount_tendered),
            'change_given' => $this->money($this->change_given),
            'status' => $this->status,
            'items_count' => $this->whenCounted('items'),
            'items' => SaleItemResource::collection($this->whenLoaded('items')),
            'voided_at' => $this->date($this->voided_at),
            'voided_by' => $this->whenLoaded('voider', fn () => $this->voider?->only(['id', 'name'])),
            'void_reason' => $this->void_reason,
            'created_at' => $this->date($this->created_at),
        ];
    }
}
