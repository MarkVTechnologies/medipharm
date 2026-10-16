<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Drug;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The single most important piece of code in the product (spec §7.2).
 * Atomic across sale header, lines, batch deductions, customer stats and
 * stock movements. Totals are always recomputed server-side.
 */
class CheckoutService
{
    public function __construct(
        private readonly FefoAllocator $fefo,
        private readonly ReferenceGenerator $references,
        private readonly TenantLock $tenantLock,
    ) {}

    /**
     * @param  array{items: array<int, array{drug_id: int, quantity: int}>, customer_id?: int|null,
     *               payment_method: string, amount_tendered?: float|string|null}  $data
     */
    public function checkout(User $user, array $data): Sale
    {
        // Validate and load everything we can BEFORE opening the transaction.
        $lines = collect($data['items'])
            ->groupBy('drug_id')
            ->map(fn ($group, $drugId) => ['drug_id' => (int) $drugId, 'quantity' => (int) $group->sum('quantity')])
            ->values();

        $drugs = Drug::query()->active()->whereIn('id', $lines->pluck('drug_id'))->get()->keyBy('id');
        $missing = $lines->pluck('drug_id')->diff($drugs->keys());
        if ($missing->isNotEmpty()) {
            throw ValidationException::withMessages(['items' => ['One or more items are no longer in the catalogue.']]);
        }

        $customer = isset($data['customer_id']) && $data['customer_id']
            ? Customer::query()->where('is_active', true)->findOrFail($data['customer_id'])
            : null;

        $sale = DB::transaction(function () use ($user, $data, $lines, $drugs, $customer) {
            $tenant = $this->tenantLock->acquire($user->tenant_id);
            $discountPercent = $customer ? $tenant->tierDiscount($customer->tier) : 0.0;

            $sale = Sale::create([
                'reference' => $this->references->next(Sale::class, 'reference', 'SAL'),
                'customer_id' => $customer?->id,
                'user_id' => $user->id,
                'payment_method' => $data['payment_method'],
                'status' => 'completed',
            ]);

            $subtotal = $discount = $vat = 0;

            foreach ($lines as $line) {
                /** @var Drug $drug */
                $drug = $drugs[$line['drug_id']];
                $unitPrice = Money::toKobo($drug->selling_price);
                $taxRate = $drug->tax_rate !== null ? (float) $drug->tax_rate : (float) $tenant->vat_rate;

                // FEFO: oldest expiry first, row-locked against concurrent sales.
                foreach ($this->fefo->allocate($drug, $line['quantity']) as $allocation) {
                    $batch = $allocation['batch'];
                    $take = $allocation['quantity'];

                    $gross = $unitPrice * $take;
                    $lineDiscount = Money::percent($gross, $discountPercent);
                    $lineTax = Money::percent($gross - $lineDiscount, $taxRate);

                    $batch->decrement('quantity_remaining', $take);

                    SaleItem::create([
                        'sale_id' => $sale->id,
                        'drug_id' => $drug->id,
                        'batch_id' => $batch->id,
                        'quantity' => $take,
                        'unit_price' => Money::toNaira($unitPrice),
                        'unit_cost' => $batch->cost_price,
                        'line_total' => Money::toNaira($gross),
                        'tax_amount' => Money::toNaira($lineTax),
                    ]);

                    StockMovement::create([
                        'drug_id' => $drug->id,
                        'batch_id' => $batch->id,
                        'type' => 'sale',
                        'quantity' => -$take,
                        'reference_type' => 'sale',
                        'reference_id' => $sale->id,
                        'user_id' => $user->id,
                    ]);

                    $subtotal += $gross;
                    $discount += $lineDiscount;
                    $vat += $lineTax;
                }
            }

            $total = $subtotal - $discount + $vat;
            $tendered = null;
            $change = 0;

            if ($data['payment_method'] === 'cash') {
                $tendered = Money::toKobo($data['amount_tendered'] ?? 0);
                if ($tendered < $total) {
                    throw ValidationException::withMessages([
                        'amount_tendered' => ['Amount tendered ('.Money::toNaira($tendered).') is less than the total ('.Money::toNaira($total).').'],
                    ]);
                }
                $change = $tendered - $total;
            }

            $sale->update([
                'subtotal' => Money::toNaira($subtotal),
                'discount' => Money::toNaira($discount),
                'vat' => Money::toNaira($vat),
                'total' => Money::toNaira($total),
                'amount_tendered' => $tendered === null ? null : Money::toNaira($tendered),
                'change_given' => Money::toNaira($change),
            ]);

            // Customer stats update inside the sale transaction, never as a follow-up write (FR-4.3).
            if ($customer) {
                $locked = Customer::query()->whereKey($customer->id)->lockForUpdate()->first();
                $lifetime = Money::toKobo($locked->lifetime_spend) + $total;
                $locked->update([
                    'visit_count' => $locked->visit_count + 1,
                    'lifetime_spend' => Money::toNaira($lifetime),
                    'last_visit_at' => now(),
                    'tier' => $tenant->tierFor($lifetime / 100),
                ]);
            }

            return $sale;
        }, attempts: 3); // retry on deadlock

        DashboardService::forget($user->tenant_id);

        return $sale->load(['items.drug', 'items.batch', 'customer', 'user']);
    }

    /**
     * Void / refund: restores quantities to the originating batches (FR-3.9).
     */
    public function void(Sale $sale, User $user, ?string $reason = null): Sale
    {
        DB::transaction(function () use ($sale, $user, $reason) {
            $this->tenantLock->acquire($user->tenant_id);
            $locked = Sale::query()->whereKey($sale->id)->lockForUpdate()->firstOrFail();

            if ($locked->isVoided()) {
                throw ValidationException::withMessages(['sale' => ['This sale has already been voided.']]);
            }

            foreach ($locked->items()->with('batch')->get() as $item) {
                $item->batch->increment('quantity_remaining', $item->quantity);

                StockMovement::create([
                    'drug_id' => $item->drug_id,
                    'batch_id' => $item->batch_id,
                    'type' => 'return',
                    'quantity' => $item->quantity,
                    'reference_type' => 'sale',
                    'reference_id' => $locked->id,
                    'user_id' => $user->id,
                    'note' => $reason ? mb_substr('Void: '.$reason, 0, 255) : 'Void',
                ]);
            }

            if ($locked->customer_id) {
                $customer = Customer::query()->whereKey($locked->customer_id)->lockForUpdate()->first();
                if ($customer) {
                    $customer->update([
                        'visit_count' => max(0, $customer->visit_count - 1),
                        'lifetime_spend' => Money::toNaira(max(0, Money::toKobo($customer->lifetime_spend) - Money::toKobo($locked->total))),
                    ]);
                }
            }

            $locked->update([
                'status' => 'voided',
                'voided_at' => now(),
                'voided_by' => $user->id,
                'void_reason' => $reason,
            ]);
        }, attempts: 3);

        DashboardService::forget($user->tenant_id);

        return $sale->refresh()->load(['items.drug', 'items.batch', 'customer', 'user', 'voider']);
    }
}
