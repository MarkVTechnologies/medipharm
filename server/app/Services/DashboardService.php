<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Drug;
use App\Models\Sale;
use App\Support\Money;
use App\Support\Sql;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Collection;

/**
 * One aggregated payload (FR-6.5). Shared hosting entry-process limits
 * punish fan-out, so the dashboard is never six parallel calls.
 */
class DashboardService
{
    public const EXPIRY_WINDOW_DAYS = 60;

    public const RANGES = ['day', 'week', 'month'];

    private ?Collection $levels = null;

    public static function forget(int $tenantId): void
    {
        foreach (self::RANGES as $range) {
            Cache::forget("dashboard:{$tenantId}:{$range}");
        }
    }

    public function build(int $tenantId, string $range): array
    {
        return Cache::remember("dashboard:{$tenantId}:{$range}", 60, fn () => [
            'today' => $this->today(),
            'stock' => $this->stockSummary(),
            'trend' => $this->trend($range),
            'low_stock' => $this->lowStock(),
            'expiring' => $this->expiring(),
            'recent_sales' => $this->recentSales(),
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    private function today(): array
    {
        $start = Sql::lagosDayStartUtc();
        $row = Sale::query()
            ->where('status', 'completed')
            ->where('created_at', '>=', $start)
            ->selectRaw('COALESCE(SUM(total), 0) as revenue, COUNT(*) as transactions')
            ->first();

        $yesterday = Sale::query()
            ->where('status', 'completed')
            ->whereBetween('created_at', [$start->copy()->subDay(), $start])
            ->sum('total');

        return [
            'revenue' => Money::float($row->revenue),
            'transactions' => (int) $row->transactions,
            'average_basket' => $row->transactions ? round($row->revenue / $row->transactions, 2) : 0.0,
            'yesterday_revenue' => Money::float($yesterday),
        ];
    }

    private function stockSummary(): array
    {
        $stock = $this->stockLevels();

        $expiring = Batch::query()
            ->sellable()
            ->where('expiry_date', '<=', now()->addDays(self::EXPIRY_WINDOW_DAYS)->toDateString())
            ->selectRaw('COUNT(*) as batches, COALESCE(SUM(quantity_remaining * cost_price), 0) as value')
            ->first();

        $expired = Batch::query()
            ->where('quantity_remaining', '>', 0)
            ->whereNull('written_off_at')
            ->where('expiry_date', '<=', now()->toDateString())
            ->selectRaw('COUNT(*) as batches, COALESCE(SUM(quantity_remaining * cost_price), 0) as value')
            ->first();

        return [
            'low_stock_count' => $stock->where('status', 'low')->count(),
            'out_of_stock_count' => $stock->where('status', 'out')->count(),
            'expiring_count' => (int) $expiring->batches,
            'expiring_value' => Money::float($expiring->value),
            'expired_count' => (int) $expired->batches,
            'expired_value' => Money::float($expired->value),
            'sku_count' => $stock->count(),
        ];
    }

    private function trend(string $range): array
    {
        if ($range === 'day') {
            $start = Sql::lagosDayStartUtc();
            $rows = Sale::query()
                ->where('status', 'completed')
                ->where('created_at', '>=', $start)
                ->selectRaw(Sql::localHour('created_at').' as bucket, SUM(total) as revenue, COUNT(*) as transactions')
                ->groupBy('bucket')
                ->get()
                ->keyBy(fn ($r) => (int) $r->bucket);

            return collect(range(0, 23))->map(fn ($h) => [
                'label' => str_pad((string) $h, 2, '0', STR_PAD_LEFT).':00',
                'revenue' => Money::float($rows[$h]->revenue ?? 0),
                'transactions' => (int) ($rows[$h]->transactions ?? 0),
            ])->all();
        }

        $days = $range === 'week' ? 7 : 30;
        $startLagos = now('Africa/Lagos')->startOfDay()->subDays($days - 1);
        $rows = Sale::query()
            ->where('status', 'completed')
            ->where('created_at', '>=', $startLagos->copy()->utc())
            ->selectRaw(Sql::localDate('created_at').' as bucket, SUM(total) as revenue, COUNT(*) as transactions')
            ->groupBy('bucket')
            ->get()
            ->keyBy('bucket');

        return collect(range(0, $days - 1))->map(function ($i) use ($startLagos, $rows) {
            $date = $startLagos->copy()->addDays($i)->toDateString();

            return [
                'label' => $date,
                'revenue' => Money::float($rows[$date]->revenue ?? 0),
                'transactions' => (int) ($rows[$date]->transactions ?? 0),
            ];
        })->all();
    }

    private function lowStock(): array
    {
        return $this->stockLevels()
            ->whereIn('status', ['low', 'out'])
            ->sortBy('stock_on_hand')
            ->take(10)
            ->values()
            ->all();
    }

    private function expiring(): array
    {
        return Batch::query()
            ->with('drug:id,name,strength,form')
            ->where('quantity_remaining', '>', 0)
            ->whereNull('written_off_at')
            ->where('expiry_date', '<=', now()->addDays(self::EXPIRY_WINDOW_DAYS)->toDateString())
            ->orderBy('expiry_date')
            ->limit(10)
            ->get()
            ->map(fn (Batch $b) => [
                'batch_id' => $b->id,
                'drug_id' => $b->drug_id,
                'drug_name' => $b->drug?->name,
                'strength' => $b->drug?->strength,
                'batch_number' => $b->batch_number,
                'expiry_date' => $b->expiry_date->toDateString(),
                'days_left' => (int) now()->startOfDay()->diffInDays($b->expiry_date, false),
                'quantity_remaining' => $b->quantity_remaining,
                'value_at_cost' => StockService::valueAtCost($b),
                'is_expired' => $b->isExpired(),
            ])
            ->all();
    }

    private function recentSales(): array
    {
        return Sale::query()
            ->with(['customer:id,name', 'user:id,name'])
            ->withCount('items')
            ->latest('id')
            ->limit(8)
            ->get()
            ->map(fn (Sale $s) => [
                'id' => $s->id,
                'reference' => $s->reference,
                'customer_name' => $s->customer?->name,
                'served_by' => $s->user?->name,
                'items_count' => $s->items_count,
                'total' => Money::float($s->total),
                'payment_method' => $s->payment_method,
                'status' => $s->status,
                'created_at' => $s->created_at->toIso8601String(),
            ])
            ->all();
    }

    /**
     * On-hand sellable stock per active drug, aggregated in SQL.
     */
    private function stockLevels(): Collection
    {
        if ($this->levels !== null) {
            return $this->levels;
        }

        $rows = Drug::query()
            ->active()
            ->select(['drugs.id', 'drugs.name', 'drugs.strength', 'drugs.form', 'drugs.reorder_level', 'drugs.preferred_supplier_id'])
            ->withStock()
            ->get();

        return $this->levels = $rows->map(fn ($d) => [
            'drug_id' => $d->id,
            'name' => $d->name,
            'strength' => $d->strength,
            'form' => $d->form,
            'reorder_level' => $d->reorder_level,
            'stock_on_hand' => (int) $d->stock_on_hand,
            'preferred_supplier_id' => $d->preferred_supplier_id,
            'status' => Drug::stockStatus((int) $d->stock_on_hand, $d->reorder_level),
        ]);
    }
}
