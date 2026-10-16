<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\Customer */
class CustomerResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'tier' => $this->tier,
            'discount' => $request->user()?->tenant?->tierDiscount($this->tier) ?? 0.0,
            'visit_count' => $this->visit_count,
            'lifetime_spend' => $this->money($this->lifetime_spend),
            'last_visit_at' => $this->date($this->last_visit_at),
            'is_active' => $this->is_active,
            'recent_sales' => SaleResource::collection($this->whenLoaded('sales')),
            'created_at' => $this->date($this->created_at),
        ];
    }
}
