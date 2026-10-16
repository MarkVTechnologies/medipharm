<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Drug;
use App\Support\Money;
use App\Support\Sql;
use App\Support\TenantContext;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Aggregation happens in SQL, never in PHP loops. Every report returns a
 * definition: a summary, column labels, a row query and a row mapper.
 * The controller either pages through the query as JSON, or streams it
 * to CSV via cursor() so memory stays flat (FR-8.2).
 */
class ReportBuilder
{
    private Carbon $from;

    private Carbon $to;

    // Resolved lazily: controllers (and their dependencies) are built before
    // route middleware sets the tenant context.
    public function __construct(private readonly TenantContext $context) {}

    private function tenantId(): int
    {
        return (int) $this->context->id();
    }

    /**
     * Inclusive Lagos-local date range, converted to UTC instants.
     */
    public function between(?string $from, ?string $to): static
    {
        $this->from = Carbon::parse($from ?: now('Africa/Lagos')->subDays(29)->toDateString(), 'Africa/Lagos')->startOfDay()->utc();
        $this->to = Carbon::parse($to ?: now('Africa/Lagos')->toDateString(), 'Africa/Lagos')->endOfDay()->utc();

        return $this;
    }

    public function range(): array
    {
        return [
            'from' => $this->from->copy()->setTimezone('Africa/Lagos')->toDateString(),
            'to' => $this->to->copy()->setTimezone('Africa/Lagos')->toDateString(),
        ];
    }

    private function sales(): QueryBuilder
    {
        return DB::table('sales')
            ->where('sales.tenant_id', $this->tenantId())
            ->where('sales.status', 'completed')
            ->whereBetween('sales.created_at', [$this->from, $this->to]);
    }

    private function saleItems(): QueryBuilder
    {
        return $this->sales()->join('sale_items', 'sale_items.sale_id', '=', 'sales.id');
    }

    // ── Sales ───────────────────────────────────────────────────────────

    public function salesReport(string $group): array
    {
        $summary = $this->sales()->selectRaw(
            'COUNT(*) as transactions, COALESCE(SUM(subtotal),0) as subtotal, COALESCE(SUM(discount),0) as discount, '.
            'COALESCE(SUM(vat),0) as vat, COALESCE(SUM(total),0) as revenue'
        )->first();

        $itemsSold = (int) $this->saleItems()->sum('sale_items.quantity');

        $definition = match ($group) {
            'drug' => [
                'columns' => ['drug' => 'Drug', 'quantity' => 'Qty sold', 'revenue' => 'Revenue', 'cogs' => 'COGS', 'margin' => 'Margin'],
                'query' => $this->saleItems()
                    ->join('drugs', 'drugs.id', '=', 'sale_items.drug_id')
                    ->groupBy('drugs.id', 'drugs.name', 'drugs.strength')
                    ->selectRaw("drugs.name as drug, drugs.strength, SUM(sale_items.quantity) as quantity,
                        SUM(sale_items.line_total) as revenue, SUM(sale_items.unit_cost * sale_items.quantity) as cogs")
                    ->orderByDesc('revenue'),
                'map' => fn ($r) => [
                    'drug' => trim($r->drug.' '.($r->strength ?? '')),
                    'quantity' => (int) $r->quantity,
                    'revenue' => Money::float($r->revenue),
                    'cogs' => Money::float($r->cogs),
                    'margin' => Money::float($r->revenue - $r->cogs),
                ],
            ],
            'category' => [
                'columns' => ['category' => 'Category', 'quantity' => 'Qty sold', 'revenue' => 'Revenue'],
                'query' => $this->saleItems()
                    ->join('drugs', 'drugs.id', '=', 'sale_items.drug_id')
                    ->groupBy('drugs.category')
                    ->selectRaw('drugs.category as category, SUM(sale_items.quantity) as quantity, SUM(sale_items.line_total) as revenue')
                    ->orderByDesc('revenue'),
                'map' => fn ($r) => [
                    'category' => $r->category ?: 'Uncategorised',
                    'quantity' => (int) $r->quantity,
                    'revenue' => Money::float($r->revenue),
                ],
            ],
            'staff' => [
                'columns' => ['staff' => 'Staff', 'transactions' => 'Transactions', 'revenue' => 'Revenue'],
                'query' => $this->sales()
                    ->join('users', 'users.id', '=', 'sales.user_id')
                    ->groupBy('users.id', 'users.name')
                    ->selectRaw('users.name as staff, COUNT(*) as transactions, SUM(sales.total) as revenue')
                    ->orderByDesc('revenue'),
                'map' => fn ($r) => [
                    'staff' => $r->staff,
                    'transactions' => (int) $r->transactions,
                    'revenue' => Money::float($r->revenue),
                ],
            ],
            'payment_method' => [
                'columns' => ['payment_method' => 'Payment method', 'transactions' => 'Transactions', 'revenue' => 'Revenue'],
                'query' => $this->sales()
                    ->groupBy('sales.payment_method')
                    ->selectRaw('sales.payment_method as payment_method, COUNT(*) as transactions, SUM(sales.total) as revenue')
                    ->orderByDesc('revenue'),
                'map' => fn ($r) => [
                    'payment_method' => $r->payment_method,
                    'transactions' => (int) $r->transactions,
                    'revenue' => Money::float($r->revenue),
                ],
            ],
            default => [
                'columns' => ['date' => 'Date', 'transactions' => 'Transactions', 'discount' => 'Discount', 'vat' => 'VAT', 'revenue' => 'Revenue'],
                'query' => $this->sales()
                    ->selectRaw(Sql::localDate('sales.created_at').' as date, COUNT(*) as transactions, SUM(discount) as discount, SUM(vat) as vat, SUM(total) as revenue')
                    ->groupBy('date')
                    ->orderBy('date'),
                'map' => fn ($r) => [
                    'date' => (string) $r->date,
                    'transactions' => (int) $r->transactions,
                    'discount' => Money::float($r->discount),
                    'vat' => Money::float($r->vat),
                    'revenue' => Money::float($r->revenue),
                ],
            ],
        };

        return $definition + ['summary' => [
            'transactions' => (int) $summary->transactions,
            'items_sold' => $itemsSold,
            'subtotal' => Money::float($summary->subtotal),
            'discount' => Money::float($summary->discount),
            'vat' => Money::float($summary->vat),
            'revenue' => Money::float($summary->revenue),
            'average_basket' => $summary->transactions ? round($summary->revenue / $summary->transactions, 2) : 0.0,
        ]];
    }

    // ── Inventory ───────────────────────────────────────────────────────

    public function inventoryReport(string $view): array
    {
        $today = now()->toDateString();

        $stockByDrug = DB::table('batches')
            ->where('tenant_id', $this->tenantId())
            ->where('quantity_remaining', '>', 0)
            ->whereNull('written_off_at')
            ->where('expiry_date', '>', $today)
            ->groupBy('drug_id')
            ->selectRaw('drug_id, SUM(quantity_remaining) as qty, SUM(quantity_remaining * cost_price) as cost_value');

        $valuation = DB::query()->fromSub($stockByDrug, 's')
            ->join('drugs', 'drugs.id', '=', 's.drug_id')
            ->selectRaw('COALESCE(SUM(s.cost_value),0) as at_cost, COALESCE(SUM(s.qty * drugs.selling_price),0) as at_retail, COALESCE(SUM(s.qty),0) as units')
            ->first();

        $summary = [
            'value_at_cost' => Money::float($valuation->at_cost),
            'value_at_retail' => Money::float($valuation->at_retail),
            'potential_margin' => Money::float($valuation->at_retail - $valuation->at_cost),
            'units_on_hand' => (int) $valuation->units,
            'sku_count' => Drug::query()->active()->count(),
        ];

        $definition = match ($view) {
            'movement' => [
                'columns' => ['date' => 'Date', 'drug' => 'Drug', 'batch' => 'Batch', 'type' => 'Type', 'quantity' => 'Qty', 'user' => 'User', 'note' => 'Note'],
                'query' => DB::table('stock_movements')
                    ->where('stock_movements.tenant_id', $this->tenantId())
                    ->whereBetween('stock_movements.created_at', [$this->from, $this->to])
                    ->join('drugs', 'drugs.id', '=', 'stock_movements.drug_id')
                    ->leftJoin('batches', 'batches.id', '=', 'stock_movements.batch_id')
                    ->leftJoin('users', 'users.id', '=', 'stock_movements.user_id')
                    ->select(['stock_movements.created_at', 'drugs.name as drug', 'batches.batch_number as batch',
                        'stock_movements.type', 'stock_movements.quantity', 'users.name as user', 'stock_movements.note'])
                    ->orderByDesc('stock_movements.id'),
                'map' => fn ($r) => [
                    'date' => Carbon::parse($r->created_at, 'UTC')->toIso8601String(),
                    'drug' => $r->drug,
                    'batch' => $r->batch,
                    'type' => $r->type,
                    'quantity' => (int) $r->quantity,
                    'user' => $r->user,
                    'note' => $r->note,
                ],
            ],
            'dead_stock' => [
                'columns' => ['drug' => 'Drug', 'quantity' => 'On hand', 'value_at_cost' => 'Value at cost', 'last_sold' => 'Last sold'],
                'query' => DB::query()->fromSub($stockByDrug, 's')
                    ->join('drugs', 'drugs.id', '=', 's.drug_id')
                    ->whereNotExists(fn ($q) => $q->from('sale_items')
                        ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                        ->whereColumn('sale_items.drug_id', 'drugs.id')
                        ->where('sales.status', 'completed')
                        ->whereBetween('sales.created_at', [$this->from, $this->to]))
                    ->selectRaw('drugs.name as drug, drugs.strength, s.qty, s.cost_value, (SELECT MAX(sales.created_at) FROM sale_items
                        JOIN sales ON sales.id = sale_items.sale_id WHERE sale_items.drug_id = drugs.id) as last_sold')
                    ->orderByDesc('s.cost_value'),
                'map' => fn ($r) => [
                    'drug' => trim($r->drug.' '.($r->strength ?? '')),
                    'quantity' => (int) $r->qty,
                    'value_at_cost' => Money::float($r->cost_value),
                    'last_sold' => $r->last_sold ? Carbon::parse($r->last_sold, 'UTC')->toIso8601String() : null,
                ],
            ],
            'expiry' => [
                'columns' => ['drug' => 'Drug', 'batch' => 'Batch', 'expiry_date' => 'Expiry', 'days_left' => 'Days left', 'quantity' => 'Qty', 'value_at_cost' => 'Value at cost'],
                'query' => DB::table('batches')
                    ->where('batches.tenant_id', $this->tenantId())
                    ->where('batches.quantity_remaining', '>', 0)
                    ->whereNull('batches.written_off_at')
                    ->where('batches.expiry_date', '<=', now()->addDays(180)->toDateString())
                    ->join('drugs', 'drugs.id', '=', 'batches.drug_id')
                    ->select(['drugs.name as drug', 'drugs.strength', 'batches.batch_number', 'batches.expiry_date',
                        'batches.quantity_remaining', 'batches.cost_price'])
                    ->orderBy('batches.expiry_date'),
                'map' => fn ($r) => [
                    'drug' => trim($r->drug.' '.($r->strength ?? '')),
                    'batch' => $r->batch_number,
                    'expiry_date' => Carbon::parse($r->expiry_date)->toDateString(),
                    'days_left' => (int) now()->startOfDay()->diffInDays(Carbon::parse($r->expiry_date), false),
                    'quantity' => (int) $r->quantity_remaining,
                    'value_at_cost' => round($r->quantity_remaining * (float) $r->cost_price, 2),
                ],
            ],
            default => [
                'columns' => ['drug' => 'Drug', 'category' => 'Category', 'quantity' => 'On hand', 'value_at_cost' => 'Value at cost', 'value_at_retail' => 'Value at retail'],
                'query' => DB::query()->fromSub($stockByDrug, 's')
                    ->join('drugs', 'drugs.id', '=', 's.drug_id')
                    ->selectRaw('drugs.name as drug, drugs.strength, drugs.category, s.qty, s.cost_value, s.qty * drugs.selling_price as retail_value')
                    ->orderByDesc('s.cost_value'),
                'map' => fn ($r) => [
                    'drug' => trim($r->drug.' '.($r->strength ?? '')),
                    'category' => $r->category,
                    'quantity' => (int) $r->qty,
                    'value_at_cost' => Money::float($r->cost_value),
                    'value_at_retail' => Money::float($r->retail_value),
                ],
            ],
        };

        return $definition + ['summary' => $summary];
    }

    // ── Financial ───────────────────────────────────────────────────────

    public function financialReport(): array
    {
        $totals = $this->sales()->selectRaw(
            'COALESCE(SUM(subtotal),0) as gross, COALESCE(SUM(discount),0) as discount, COALESCE(SUM(vat),0) as vat, COALESCE(SUM(total),0) as collected'
        )->first();
        $cogs = (float) $this->saleItems()->sum(DB::raw('sale_items.unit_cost * sale_items.quantity'));
        $net = $totals->gross - $totals->discount;

        $cogsByDay = $this->saleItems()
            ->selectRaw(Sql::localDate('sales.created_at').' as date, SUM(sale_items.unit_cost * sale_items.quantity) as cogs')
            ->groupBy('date');

        return [
            'summary' => [
                'gross_sales' => Money::float($totals->gross),
                'discounts' => Money::float($totals->discount),
                'net_sales' => Money::float($net),
                'vat_collected' => Money::float($totals->vat),
                'total_collected' => Money::float($totals->collected),
                'cogs' => Money::float($cogs),
                'gross_margin' => Money::float($net - $cogs),
                'gross_margin_percent' => $net > 0 ? round(($net - $cogs) / $net * 100, 1) : 0.0,
            ],
            'columns' => ['date' => 'Date', 'net_sales' => 'Net sales', 'vat' => 'VAT', 'cogs' => 'COGS', 'gross_margin' => 'Gross margin'],
            'query' => $this->sales()
                ->selectRaw(Sql::localDate('sales.created_at').' as date, SUM(subtotal - discount) as net_sales, SUM(vat) as vat')
                ->groupBy('date')
                ->orderBy('date'),
            'map' => function ($r) use (&$cogsMap, $cogsByDay) {
                $cogsMap ??= $cogsByDay->get()->pluck('cogs', 'date');
                $cogs = (float) ($cogsMap[$r->date] ?? 0);

                return [
                    'date' => (string) $r->date,
                    'net_sales' => Money::float($r->net_sales),
                    'vat' => Money::float($r->vat),
                    'cogs' => Money::float($cogs),
                    'gross_margin' => Money::float($r->net_sales - $cogs),
                ];
            },
        ];
    }

    // ── Customers ───────────────────────────────────────────────────────

    public function customerReport(): array
    {
        $active = $this->sales()->whereNotNull('customer_id')
            ->groupBy('customer_id')
            ->selectRaw('customer_id, COUNT(*) as visits');
        $activity = DB::query()->fromSub($active, 'a')
            ->selectRaw('COUNT(*) as active, SUM(CASE WHEN visits > 1 THEN 1 ELSE 0 END) as returning_count')
            ->first();

        $tiers = Customer::query()->where('is_active', true)
            ->groupBy('tier')->selectRaw('tier, COUNT(*) as count')->pluck('count', 'tier');

        $newCustomers = Customer::query()->whereBetween('created_at', [$this->from, $this->to])->count();

        return [
            'summary' => [
                'total_customers' => Customer::query()->where('is_active', true)->count(),
                'new_customers' => $newCustomers,
                'active_customers' => (int) $activity->active,
                'returning_customers' => (int) $activity->returning_count,
                'retention_rate' => $activity->active ? round($activity->returning_count / $activity->active * 100, 1) : 0.0,
                'tier_distribution' => collect(Customer::TIERS)->mapWithKeys(fn ($t) => [$t => (int) ($tiers[$t] ?? 0)]),
            ],
            'columns' => ['code' => 'Code', 'name' => 'Customer', 'tier' => 'Tier', 'visits' => 'Visits', 'spend' => 'Spend (period)', 'lifetime_spend' => 'Lifetime spend'],
            'query' => $this->sales()
                ->join('customers', 'customers.id', '=', 'sales.customer_id')
                ->groupBy('customers.id', 'customers.code', 'customers.name', 'customers.tier', 'customers.lifetime_spend')
                ->selectRaw('customers.code, customers.name, customers.tier, customers.lifetime_spend, COUNT(*) as visits, SUM(sales.total) as spend')
                ->orderByDesc('spend'),
            'map' => fn ($r) => [
                'code' => $r->code,
                'name' => $r->name,
                'tier' => $r->tier,
                'visits' => (int) $r->visits,
                'spend' => Money::float($r->spend),
                'lifetime_spend' => Money::float($r->lifetime_spend),
            ],
        ];
    }
}
