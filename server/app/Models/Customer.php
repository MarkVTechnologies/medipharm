<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use BelongsToTenant, HasFactory;

    public const TIERS = ['bronze', 'silver', 'gold', 'platinum'];

    protected $attributes = ['is_active' => true, 'tier' => 'bronze', 'visit_count' => 0, 'lifetime_spend' => 0];

    protected $fillable = [
        'code', 'name', 'phone', 'email', 'tier', 'visit_count', 'lifetime_spend', 'last_visit_at', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'visit_count' => 'integer',
            'lifetime_spend' => 'decimal:2',
            'last_visit_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);
        if ($term === '') {
            return $query;
        }

        return $query->where(fn (Builder $q) => $q
            ->where('name', 'like', '%'.$term.'%')
            ->orWhere('phone', 'like', $term.'%')
            ->orWhere('code', $term)
            ->orWhere('email', 'like', $term.'%'));
    }
}
