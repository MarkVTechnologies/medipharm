<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PurchaseOrderRequest;
use App\Http\Requests\ReceivePurchaseOrderRequest;
use App\Http\Resources\Paginated;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\Drug;
use App\Models\PurchaseOrder;
use App\Services\ReferenceGenerator;
use App\Services\StockService;
use App\Services\TenantLock;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseOrderController extends Controller
{
    public function __construct(
        private readonly ReferenceGenerator $references,
        private readonly TenantLock $lock,
        private readonly StockService $stock,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate(['status' => ['nullable', 'in:'.implode(',', PurchaseOrder::STATUSES).',open']]);

        $query = PurchaseOrder::query()
            ->with(['supplier:id,name', 'creator:id,name'])
            ->withCount('items')
            ->when($request->query('status') === 'open', fn ($q) => $q->whereIn('status', ['draft', 'sent', 'partial']))
            ->when($request->query('status') && $request->query('status') !== 'open', fn ($q) => $q->where('status', $request->query('status')))
            ->when($request->query('supplier_id'), fn ($q, $id) => $q->where('supplier_id', $id))
            ->latest('id');

        return Paginated::response($query->paginate(Paginated::perPage($request))->withQueryString(), PurchaseOrderResource::class);
    }

    public function store(PurchaseOrderRequest $request): JsonResponse
    {
        $data = $request->validated();

        $po = DB::transaction(function () use ($data, $request) {
            $this->lock->acquire($request->user()->tenant_id);

            $po = PurchaseOrder::create([
                'supplier_id' => $data['supplier_id'],
                'reference' => $this->references->next(PurchaseOrder::class, 'reference', 'PO'),
                'status' => $data['status'] ?? 'draft',
                'expected_date' => $data['expected_date'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);
            $this->syncItems($po, $data['items']);

            return $po;
        });

        return (new PurchaseOrderResource($this->loaded($po)))->response()->setStatusCode(201);
    }

    public function show(PurchaseOrder $purchaseOrder): PurchaseOrderResource
    {
        return new PurchaseOrderResource($this->loaded($purchaseOrder));
    }

    public function update(PurchaseOrderRequest $request, PurchaseOrder $purchaseOrder): PurchaseOrderResource
    {
        $data = $request->validated();

        if (isset($data['items']) && $purchaseOrder->status !== 'draft') {
            throw ValidationException::withMessages(['items' => ['Only draft purchase orders can change their items.']]);
        }
        if (in_array($purchaseOrder->status, ['received', 'cancelled'], true)) {
            throw ValidationException::withMessages(['status' => ["A {$purchaseOrder->status} purchase order cannot be changed."]]);
        }

        DB::transaction(function () use ($purchaseOrder, $data) {
            $purchaseOrder->update(collect($data)->except('items')->all());
            if (isset($data['items'])) {
                $purchaseOrder->items()->delete();
                $this->syncItems($purchaseOrder, $data['items']);
            }
        });

        return new PurchaseOrderResource($this->loaded($purchaseOrder));
    }

    /**
     * Creates batches — the primary path by which stock enters the system (FR-5.3).
     */
    public function receive(ReceivePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder): PurchaseOrderResource
    {
        $po = $this->stock->receivePurchaseOrder($purchaseOrder, $request->user(), $request->validated()['lines']);

        return new PurchaseOrderResource($this->loaded($po));
    }

    /**
     * Reorder suggestions: items at or below reorder level, grouped by
     * preferred supplier (FR-5.4).
     */
    public function suggestions(): JsonResponse
    {
        $drugs = Drug::query()
            ->active()
            ->select(['drugs.id', 'drugs.name', 'drugs.strength', 'drugs.pack_size', 'drugs.reorder_level', 'drugs.cost_price', 'drugs.preferred_supplier_id'])
            ->withStock()
            ->with('preferredSupplier:id,name')
            ->get()
            ->filter(fn ($d) => (int) $d->stock_on_hand <= $d->reorder_level);

        $groups = $drugs->groupBy(fn ($d) => $d->preferred_supplier_id ?? 0)->map(fn ($items, $supplierId) => [
            'supplier' => $supplierId ? $items->first()->preferredSupplier?->only(['id', 'name']) : null,
            'items' => $items->map(fn ($d) => [
                'drug_id' => $d->id,
                'name' => $d->name,
                'strength' => $d->strength,
                'pack_size' => $d->pack_size,
                'stock_on_hand' => (int) $d->stock_on_hand,
                'reorder_level' => $d->reorder_level,
                // Bring stock back to twice the reorder level.
                'suggested_quantity' => max(1, $d->reorder_level * 2 - (int) $d->stock_on_hand),
                'unit_cost' => Money::float($d->cost_price),
            ])->values(),
        ])->values();

        return response()->json(['data' => $groups]);
    }

    private function syncItems(PurchaseOrder $po, array $items): void
    {
        $drugs = Drug::query()->whereIn('id', collect($items)->pluck('drug_id'))->get()->keyBy('id');
        $total = 0;

        foreach ($items as $item) {
            $unitCost = $item['unit_cost'] ?? $drugs[$item['drug_id']]->cost_price;
            $po->items()->create([
                'drug_id' => $item['drug_id'],
                'quantity_ordered' => $item['quantity_ordered'],
                'unit_cost' => $unitCost,
            ]);
            $total += Money::toKobo($unitCost) * (int) $item['quantity_ordered'];
        }

        $po->update(['total' => Money::toNaira($total)]);
    }

    private function loaded(PurchaseOrder $po): PurchaseOrder
    {
        return $po->refresh()->load(['supplier:id,name,phone,email', 'creator:id,name', 'items.drug:id,name,strength,pack_size']);
    }
}
