<?php

namespace App\Http\Requests;

class DrugRequest extends ApiRequest
{
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:255'],
            'nafdac_number' => ['nullable', 'string', 'max:64'],
            'category' => ['nullable', 'string', 'max:64'],
            'form' => ['nullable', 'string', 'max:32'],
            'strength' => ['nullable', 'string', 'max:64'],
            'pack_size' => ['nullable', 'string', 'max:64'],
            'barcode' => ['nullable', 'string', 'max:64'],
            'cost_price' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'selling_price' => [$required, 'numeric', 'min:0', 'max:9999999999'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'reorder_level' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'preferred_supplier_id' => ['nullable', $this->tenantExists('suppliers')],
            'is_active' => ['sometimes', 'boolean'],
            // Optional opening batch when creating.
            'opening_batch' => ['sometimes', 'nullable', 'array'],
            'opening_batch.batch_number' => ['required_with:opening_batch', 'string', 'max:64'],
            'opening_batch.expiry_date' => ['required_with:opening_batch', 'date', 'after:today'],
            'opening_batch.quantity' => ['required_with:opening_batch', 'integer', 'min:1'],
            'opening_batch.cost_price' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
