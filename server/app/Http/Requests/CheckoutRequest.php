<?php

namespace App\Http\Requests;

use App\Models\Sale;
use Illuminate\Validation\Rule;

/**
 * Validated BEFORE the checkout transaction opens, never inside it (spec §7.2).
 */
class CheckoutRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.drug_id' => ['required', 'integer', $this->tenantExists('drugs')],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'customer_id' => ['nullable', 'integer', $this->tenantExists('customers')],
            'payment_method' => ['required', Rule::in(Sale::PAYMENT_METHODS)],
            'amount_tendered' => ['required_if:payment_method,cash', 'nullable', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.max' => 'A basket can hold at most 50 lines. Split it into two sales.',
            'amount_tendered.required_if' => 'Enter the cash amount received.',
        ];
    }
}
