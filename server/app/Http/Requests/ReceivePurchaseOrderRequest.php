<?php

namespace App\Http\Requests;

/**
 * Each received line requires batch number, expiry date, quantity and unit cost (FR-5.3).
 */
class ReceivePurchaseOrderRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'lines' => ['required', 'array', 'min:1', 'max:200'],
            'lines.*.item_id' => ['required', 'integer'],
            'lines.*.batch_number' => ['required', 'string', 'max:64'],
            'lines.*.expiry_date' => ['required', 'date', 'after:today'],
            'lines.*.quantity' => ['required', 'integer', 'min:1'],
            'lines.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ];
    }
}
