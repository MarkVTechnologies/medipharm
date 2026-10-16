<?php

namespace App\Http\Requests;

class BatchRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'batch_number' => ['required', 'string', 'max:64'],
            'expiry_date' => ['required', 'date', 'after:today'],
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'supplier_id' => ['nullable', $this->tenantExists('suppliers')],
        ];
    }
}
