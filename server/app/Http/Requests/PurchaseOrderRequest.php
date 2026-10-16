<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class PurchaseOrderRequest extends ApiRequest
{
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'supplier_id' => [$required, 'integer', $this->tenantExists('suppliers')],
            'status' => ['sometimes', Rule::in(['draft', 'sent', 'cancelled'])],
            'expected_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
            'items' => [$required, 'array', 'min:1', 'max:200'],
            'items.*.drug_id' => ['required', 'integer', $this->tenantExists('drugs')],
            'items.*.quantity_ordered' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
