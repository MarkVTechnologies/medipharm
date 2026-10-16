<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Batch;
use App\Models\Drug;
use Illuminate\Support\Collection;

/**
 * First-Expiry-First-Out allocation. Must be called inside a transaction:
 * the batches it returns are row-locked against concurrent sales.
 */
class FefoAllocator
{
    /**
     * @return Collection<int, array{batch: Batch, quantity: int}>
     */
    public function allocate(Drug $drug, int $quantity): Collection
    {
        $batches = Batch::query()
            ->where('drug_id', $drug->id)
            ->sellable()
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $available = (int) $batches->sum('quantity_remaining');
        if ($available < $quantity) {
            throw new InsufficientStockException($drug->id, $drug->name, $available);
        }

        $allocations = collect();
        $needed = $quantity;

        foreach ($batches as $batch) {
            if ($needed <= 0) {
                break;
            }

            $take = min($needed, $batch->quantity_remaining);
            $allocations->push(['batch' => $batch, 'quantity' => $take]);
            $needed -= $take;
        }

        return $allocations;
    }

    /**
     * The batch FEFO would draw from next — shown on POS search results.
     */
    public function peek(Drug $drug): ?Batch
    {
        return Batch::query()
            ->where('drug_id', $drug->id)
            ->sellable()
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->first();
    }
}
