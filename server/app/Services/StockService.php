<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Drug;
use App\Models\PurchaseOrder;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Every path by which stock enters or leaves outside a sale. Each one
 * writes a stock_movements row.
 */
class StockService
{
    public function __construct(private readonly TenantLock $tenantLock) {}

    /**
     * @param  array{batch_number: string, expiry_date: string, quantity: int, cost_price?: float|string|null, supplier_id?: int|null}  $data
     */
    public function receiveBatch(Drug $drug, User $user, array $data, ?PurchaseOrder $po = null): Batch
    {
        $batch = Batch::create([
            'drug_id' => $drug->id,
            'batch_number' => $data['batch_number'],
            'expiry_date' => $data['expiry_date'],
            'quantity_received' => (int) $data['quantity'],
            'quantity_remaining' => (int) $data['quantity'],
            'cost_price' => $data['cost_price'] ?? $drug->cost_price,
            'supplier_id' => $data['supplier_id'] ?? $po?->supplier_id,
            'purchase_order_id' => $po?->id,
            'received_at' => now(),
        ]);

        StockMovement::create([
            'drug_id' => $drug->id,
            'batch_id' => $batch->id,
            'type' => 'receipt',
            'quantity' => $batch->quantity_received,
            'reference_type' => $po ? 'purchase_order' : 'manual',
            'reference_id' => $po?->id,
            'user_id' => $user->id,
        ]);

        return $batch;
    }

    public function addBatch(Drug $drug, User $user, array $data): Batch
    {
        $batch = DB::transaction(fn () => $this->receiveBatch($drug, $user, $data));
        DashboardService::forget($user->tenant_id);

        return $batch;
    }

    /**
     * Receiving a PO creates batches — the primary path by which stock enters (FR-5.3).
     *
     * @param  array<int, array{item_id: int, batch_number: string, expiry_date: string, quantity: int, unit_cost?: float|string|null}>  $lines
     */
    public function receivePurchaseOrder(PurchaseOrder $po, User $user, array $lines): PurchaseOrder
    {
        DB::transaction(function () use ($po, $user, $lines) {
            $this->tenantLock->acquire($user->tenant_id);
            $po = PurchaseOrder::query()->whereKey($po->id)->lockForUpdate()->firstOrFail();

            if (! $po->isReceivable()) {
                throw ValidationException::withMessages(['status' => ["A {$po->status} purchase order cannot be received."]]);
            }

            $items = $po->items()->with('drug')->get()->keyBy('id');

            foreach ($lines as $index => $line) {
                $item = $items->get($line['item_id']);
                if (! $item) {
                    throw ValidationException::withMessages(["lines.{$index}.item_id" => ['Item is not on this purchase order.']]);
                }

                $unitCost = $line['unit_cost'] ?? $item->unit_cost;

                $this->receiveBatch($item->drug, $user, [
                    'batch_number' => $line['batch_number'],
                    'expiry_date' => $line['expiry_date'],
                    'quantity' => (int) $line['quantity'],
                    'cost_price' => $unitCost,
                ], $po);

                $item->increment('quantity_received', (int) $line['quantity']);
                $item->drug->update(['cost_price' => $unitCost]);
            }

            $items = $po->items()->get();
            $complete = $items->every(fn ($i) => $i->quantity_received >= $i->quantity_ordered);
            $po->update(['status' => $complete ? 'received' : 'partial']);
        }, attempts: 3);

        DashboardService::forget($user->tenant_id);

        return $po->refresh()->load(['items.drug', 'supplier']);
    }

    /**
     * Manual count correction. Positive adds, negative removes.
     */
    public function adjust(Batch $batch, User $user, int $change, string $reason): Batch
    {
        DB::transaction(function () use ($batch, $user, $change, $reason) {
            $locked = Batch::query()->whereKey($batch->id)->lockForUpdate()->firstOrFail();

            if ($locked->quantity_remaining + $change < 0) {
                throw ValidationException::withMessages(['quantity' => ['Adjustment would take the batch below zero.']]);
            }

            $locked->update(['quantity_remaining' => $locked->quantity_remaining + $change]);

            StockMovement::create([
                'drug_id' => $locked->drug_id,
                'batch_id' => $locked->id,
                'type' => 'adjustment',
                'quantity' => $change,
                'reference_type' => 'manual',
                'user_id' => $user->id,
                'note' => mb_substr($reason, 0, 255),
            ]);
        });

        DashboardService::forget($user->tenant_id);

        return $batch->refresh();
    }

    /**
     * One-click write-off of an expired (or damaged) batch. Explicit owner/pharmacist
     * action — the nightly sweep only flags (spec §13).
     */
    public function writeOff(Batch $batch, ?User $user, string $note = 'Expired'): Batch
    {
        DB::transaction(function () use ($batch, $user, $note) {
            $locked = Batch::query()->whereKey($batch->id)->lockForUpdate()->firstOrFail();
            if ($locked->written_off_at) {
                return;
            }

            $quantity = $locked->quantity_remaining;
            $locked->update(['quantity_remaining' => 0, 'written_off_at' => now()]);

            StockMovement::create([
                'tenant_id' => $locked->tenant_id,
                'drug_id' => $locked->drug_id,
                'batch_id' => $locked->id,
                'type' => 'expiry_writeoff',
                'quantity' => -$quantity,
                'reference_type' => 'batch',
                'reference_id' => $locked->id,
                'user_id' => $user?->id,
                'note' => mb_substr($note, 0, 255),
            ]);
        });

        DashboardService::forget($batch->tenant_id);

        return $batch->refresh();
    }

    public static function valueAtCost(Batch $batch): float
    {
        return Money::toKobo($batch->cost_price) * $batch->quantity_remaining / 100;
    }
}
