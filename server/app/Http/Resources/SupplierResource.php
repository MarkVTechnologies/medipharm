<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\Supplier */
class SupplierResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'contact_person' => $this->contact_person,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'payment_terms' => $this->payment_terms,
            'is_active' => $this->is_active,
            'open_orders_count' => $this->whenCounted('purchaseOrders'),
            'created_at' => $this->date($this->created_at),
        ];
    }
}
