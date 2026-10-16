<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The audit trail. Written for EVERY quantity change.
 */
class StockMovement extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    public const TYPES = ['receipt', 'sale', 'adjustment', 'return', 'expiry_writeoff'];

    protected $fillable = [
        'tenant_id', 'drug_id', 'batch_id', 'type', 'quantity', 'reference_type', 'reference_id', 'user_id', 'note',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'integer'];
    }

    public function drug(): BelongsTo
    {
        return $this->belongsTo(Drug::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
