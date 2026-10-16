<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CheckoutRequest;
use App\Http\Resources\Paginated;
use App\Http\Resources\SaleResource;
use App\Models\Sale;
use App\Services\CheckoutService;
use App\Services\ReceiptBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SaleController extends Controller
{
    public function __construct(
        private readonly CheckoutService $checkout,
        private readonly ReceiptBuilder $receipts,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'customer_id' => ['nullable', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:completed,voided'],
            'payment_method' => ['nullable', 'in:cash,card,transfer'],
        ]);

        $user = $request->user();

        $query = Sale::query()
            ->with(['customer:id,code,name,phone,tier', 'user:id,name'])
            ->withCount('items')
            // Assistants see their own sales only.
            ->when($user->role === 'assistant', fn ($q) => $q->where('user_id', $user->id))
            ->when($request->query('from'), fn ($q, $from) => $q->where('created_at', '>=', Carbon::parse($from, 'Africa/Lagos')->startOfDay()->utc()))
            ->when($request->query('to'), fn ($q, $to) => $q->where('created_at', '<=', Carbon::parse($to, 'Africa/Lagos')->endOfDay()->utc()))
            ->when($request->query('customer_id'), fn ($q, $id) => $q->where('customer_id', $id))
            ->when($request->query('user_id'), fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->query('payment_method'), fn ($q, $m) => $q->where('payment_method', $m))
            ->when($request->query('search'), fn ($q, $s) => $q->where('reference', 'like', '%'.$s.'%'))
            ->latest('id');

        return Paginated::response($query->paginate(Paginated::perPage($request))->withQueryString(), SaleResource::class);
    }

    /**
     * Atomic checkout (spec §7.2).
     */
    public function store(CheckoutRequest $request): JsonResponse
    {
        $sale = $this->checkout->checkout($request->user(), $request->validated());

        return response()->json([
            'data' => (new SaleResource($sale))->resolve(),
            'receipt_url' => $this->receipts->shareUrl($sale),
        ], 201);
    }

    public function show(Request $request, Sale $sale): JsonResponse
    {
        $this->ensureVisible($request, $sale);

        return response()->json(['data' => (new SaleResource($this->receipts->load($sale)))->resolve()]);
    }

    public function void(Request $request, Sale $sale): SaleResource
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']]);

        return new SaleResource($this->checkout->void($sale, $request->user(), $data['reason']));
    }

    private function ensureVisible(Request $request, Sale $sale): void
    {
        $user = $request->user();
        if ($user->role === 'assistant' && $sale->user_id !== $user->id && $sale->created_at->lt(now()->subDay())) {
            abort(404);
        }
    }
}
