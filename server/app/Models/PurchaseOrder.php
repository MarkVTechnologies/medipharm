<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseOrder extends Model
{
    use BelongsToTenant, HasFactory;

    public const STATUSES = ['draft', 'sent', 'partial', 'received', 'cancelled'];

    protected $fillable = [
        'supplier_id', 'reference', 'status', 'expected_date', 'total', 'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'expected_date' => 'date',
            'total' => 'decimal:2',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isReceivable(): bool
    {
        return in_array($this->status, ['draft', 'sent', 'partial'], true);
    }
}
