<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'plan', 'status', 'starts_at', 'renews_at', 'paystack_customer_code', 'paystack_subscription_code',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'renews_at' => 'datetime',
        ];
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
