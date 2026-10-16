<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\BatchRequest;
use App\Http\Requests\DrugRequest;
use App\Http\Resources\BatchResource;
use App\Http\Resources\DrugResource;
use App\Http\Resources\Paginated;
use App\Models\Batch;
use App\Models\Drug;
use App\Services\DashboardService;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DrugController extends Controller
{
    public function __construct(private readonly StockService $stock) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', 'in:in_stock,low,out,expiring,inactive'],
            'sort' => ['nullable', 'in:name,stock,price,updated'],
        ]);

        $query = Drug::query()
            ->select('drugs.*')
            ->withStock()
            ->with('preferredSupplier:id,name')
            ->search($request->query('search'))
            ->when($request->query('category'), fn ($q, $c) => $q->where('category', $c))
            ->when($request->query('status') === 'inactive', fn ($q) => $q->where('is_active', false), fn ($q) => $q->where('is_active', true));

        if ($request->query('status') === 'expiring') {
            $query->whereHas('batches', fn ($b) => $b->sellable()->where('expiry_date', '<=', now()->addDays(DashboardService::EXPIRY_WINDOW_DAYS)->toDateString()));
        }

        // Status is derived from on-hand stock, so filter on the computed column
        // from an outer query (portable across MySQL/MariaDB, unlike HAVING).
        if (in_array($request->query('status'), ['out', 'low', 'in_stock'], true)) {
            $query = Drug::query()->fromSub($query, 'drugs')->with('preferredSupplier:id,name');
            match ($request->query('status')) {
                'out' => $query->where('stock_on_hand', '<=', 0),
                'low' => $query->where('stock_on_hand', '>', 0)->whereColumn('stock_on_hand', '<=', 'reorder_level'),
                'in_stock' => $query->whereColumn('stock_on_hand', '>', 'reorder_level'),
            };
        }

        match ($request->query('sort', 'name')) {
            'stock' => $query->orderBy('stock_on_hand'),
            'price' => $query->orderByDesc('selling_price'),
            'updated' => $query->latest('updated_at'),
            default => $query->orderBy('name'),
        };

        $categories = Drug::query()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category');

        return Paginated::response(
            $query->paginate(Paginated::perPage($request))->withQueryString(),
            DrugResource::class,
            ['categories' => $categories],
        );
    }

    public function store(DrugRequest $request): JsonResponse
    {
        $data = $request->validated();

        $drug = DB::transaction(function () use ($data, $request) {
            $drug = Drug::create(collect($data)->except('opening_batch')->all());

            if (! empty($data['opening_batch'])) {
                $this->stock->receiveBatch($drug, $request->user(), $data['opening_batch']);
            }

            return $drug;
        });

        DashboardService::forget($request->user()->tenant_id);

        return (new DrugResource($this->withStock($drug)))->response()->setStatusCode(201);
    }

    public function show(Drug $drug): DrugResource
    {
        $drug = $this->withStock($drug);
        $drug->load(['preferredSupplier:id,name', 'batches' => fn ($q) => $q->with('supplier:id,name')->orderBy('expiry_date')]);

        return new DrugResource($drug);
    }

    public function update(DrugRequest $request, Drug $drug): DrugResource
    {
        $drug->update(collect($request->validated())->except('opening_batch')->all());
        DashboardService::forget($request->user()->tenant_id);

        return new DrugResource($this->withStock($drug));
    }

    /**
     * Soft delete: anything referenced by a sale is never hard-deleted (spec §6.3).
     */
    public function destroy(Request $request, Drug $drug): JsonResponse
    {
        $drug->update(['is_active' => false]);
        DashboardService::forget($request->user()->tenant_id);

        return response()->json(null, 204);
    }

    public function batches(Request $request, Drug $drug): JsonResponse
    {
        $batches = $drug->batches()
            ->with('supplier:id,name')
            ->when(! $request->boolean('all'), fn ($q) => $q->where('quantity_remaining', '>', 0)->whereNull('written_off_at'))
            ->orderBy('expiry_date')
            ->get();

        return response()->json(['data' => BatchResource::collection($batches)->resolve()]);
    }

    public function storeBatch(BatchRequest $request, Drug $drug): JsonResponse
    {
        $batch = $this->stock->addBatch($drug, $request->user(), $request->validated());

        return (new BatchResource($batch->load('supplier:id,name')))->response()->setStatusCode(201);
    }

    public function adjustBatch(Request $request, Batch $batch): BatchResource
    {
        $data = $request->validate([
            'quantity' => ['required', 'integer', 'not_in:0', 'min:-1000000', 'max:1000000'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        return new BatchResource($this->stock->adjust($batch, $request->user(), (int) $data['quantity'], $data['reason']));
    }

    public function writeOffBatch(Request $request, Batch $batch): BatchResource
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);

        return new BatchResource($this->stock->writeOff($batch, $request->user(), $data['reason'] ?? 'Expired'));
    }

    private function withStock(Drug $drug): Drug
    {
        return Drug::query()->select('drugs.*')->withStock()->findOrFail($drug->id);
    }
}
