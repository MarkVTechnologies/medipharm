<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/** @mixin \App\Models\Tenant */
class TenantResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'address' => $this->address,
            'phone' => $this->phone,
            'email' => $this->email,
            'licence_number' => $this->licence_number,
            'logo_url' => $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null,
            'vat_rate' => $this->money($this->vat_rate),
            'currency' => $this->currency,
            'receipt_footer' => $this->receipt_footer,
            'tiers' => collect($this->tiers())->map(fn ($t, $name) => [
                'tier' => $name,
                'min_spend' => (float) $t['min_spend'],
                'discount' => (float) $t['discount'],
            ])->values(),
            'plan' => $this->plan,
            'status' => $this->status,
            'trial_ends_at' => $this->date($this->trial_ends_at),
            'read_only' => $this->isReadOnly(),
        ];
    }
}
