<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    use HasFactory;

    public const DEFAULT_TIERS = [
        'bronze' => ['min_spend' => 0, 'discount' => 0],
        'silver' => ['min_spend' => 100000, 'discount' => 2],
        'gold' => ['min_spend' => 500000, 'discount' => 5],
        'platinum' => ['min_spend' => 1500000, 'discount' => 8],
    ];

    protected $fillable = [
        'name', 'slug', 'address', 'phone', 'email', 'licence_number', 'logo_path',
        'vat_rate', 'currency', 'receipt_footer', 'tier_config', 'plan', 'status', 'trial_ends_at', 'onboarding_dismissed_at',
    ];

    protected function casts(): array
    {
        return [
            'vat_rate' => 'decimal:2',
            'tier_config' => 'array',
            'trial_ends_at' => 'datetime',
            'onboarding_dismissed_at' => 'datetime',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function tiers(): array
    {
        return $this->tier_config ?: self::DEFAULT_TIERS;
    }

    public function tierFor(float $lifetimeSpend): string
    {
        $tier = 'bronze';
        foreach ($this->tiers() as $name => $config) {
            if ($lifetimeSpend >= (float) $config['min_spend']) {
                $tier = $name;
            }
        }

        return $tier;
    }

    public function tierDiscount(string $tier): float
    {
        return (float) ($this->tiers()[$tier]['discount'] ?? 0);
    }

    /**
     * Non-payment means read-only access, never deletion or lockout (FR-9.5).
     */
    public function isReadOnly(): bool
    {
        if ($this->status === 'suspended' || $this->status === 'past_due') {
            return true;
        }

        return $this->status === 'trial' && $this->trial_ends_at !== null && $this->trial_ends_at->isPast();
    }
}
