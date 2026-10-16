<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Drug extends Model
{
    use BelongsToTenant, HasFactory;

    protected $attributes = ['is_active' => true, 'reorder_level' => 10];

    protected $fillable = [
        'name', 'generic_name', 'brand', 'nafdac_number', 'category', 'form', 'strength',
        'pack_size', 'barcode', 'cost_price', 'selling_price', 'tax_rate', 'reorder_level',
        'preferred_supplier_id', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'cost_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'reorder_level' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    public function sellableBatches(): HasMany
    {
        return $this->batches()->sellable()->orderBy('expiry_date');
    }

    public function preferredSupplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'preferred_supplier_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Adds a `stock_on_hand` column: sellable (unexpired) quantity remaining.
     */
    public function scopeWithStock(Builder $query): Builder
    {
        return $query->addSelect([
            'stock_on_hand' => Batch::query()
                ->withoutGlobalScopes()
                ->selectRaw('COALESCE(SUM(quantity_remaining), 0)')
                ->whereColumn('batches.drug_id', 'drugs.id')
                ->where('expiry_date', '>', now()->toDateString())
                ->whereNull('written_off_at'),
        ]);
    }

    /**
     * Name / generic / brand / barcode search. FULLTEXT on MySQL, LIKE elsewhere.
     */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);
        if ($term === '') {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $q->where('barcode', $term);

            if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true) && mb_strlen($term) >= 3) {
                $boolean = collect(preg_split('/\s+/', preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $term)))
                    ->filter()
                    ->map(fn ($word) => '+'.$word.'*')
                    ->implode(' ');
                if ($boolean !== '') {
                    $q->orWhereFullText(['name', 'generic_name', 'brand'], $boolean, ['mode' => 'boolean']);
                }
            }

            // Prefix match keeps the index usable and catches short queries.
            $q->orWhere('name', 'like', $term.'%')
                ->orWhere('generic_name', 'like', $term.'%')
                ->orWhere('brand', 'like', $term.'%');
        });
    }

    public static function stockStatus(int $onHand, int $reorderLevel): string
    {
        if ($onHand <= 0) {
            return 'out';
        }

        return $onHand <= $reorderLevel ? 'low' : 'in_stock';
    }
}
