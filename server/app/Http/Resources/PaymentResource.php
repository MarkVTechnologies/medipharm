<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\Payment */
class PaymentResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'plan' => $this->plan,
            'amount' => $this->money($this->amount),
            'reference' => $this->reference,
            'status' => $this->status,
            'paid_at' => $this->date($this->paid_at),
            'created_at' => $this->date($this->created_at),
        ];
    }
}
