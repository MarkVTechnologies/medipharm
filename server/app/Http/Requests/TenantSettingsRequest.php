<?php

namespace App\Http\Requests;

class TenantSettingsRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:190'],
            'licence_number' => ['nullable', 'string', 'max:64'],
            'receipt_footer' => ['nullable', 'string', 'max:500'],
            'vat_rate' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'logo' => ['sometimes', 'nullable', 'image', 'max:1024'],
            'tiers' => ['sometimes', 'array', 'size:4'],
            'tiers.*.tier' => ['required', 'in:bronze,silver,gold,platinum'],
            'tiers.*.min_spend' => ['required', 'numeric', 'min:0'],
            'tiers.*.discount' => ['required', 'numeric', 'min:0', 'max:50'],
        ];
    }
}
