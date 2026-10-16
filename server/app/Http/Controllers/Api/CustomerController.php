<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\Paginated;
use App\Models\Customer;
use App\Services\ReferenceGenerator;
use App\Services\TenantLock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['tier' => ['nullable', 'in:'.implode(',', Customer::TIERS)]]);

        $query = Customer::query()
            ->where('is_active', ! $request->boolean('inactive'))
            ->search($request->query('search'))
            ->when($request->query('tier'), fn ($q, $tier) => $q->where('tier', $tier))
            ->when(
                $request->query('sort') === 'spend',
                fn ($q) => $q->orderByDesc('lifetime_spend'),
                fn ($q) => $request->query('sort') === 'recent' ? $q->orderByDesc('last_visit_at') : $q->orderBy('name'),
            );

        $tierCounts = Customer::query()->where('is_active', true)->groupBy('tier')
            ->selectRaw('tier, COUNT(*) as count')->pluck('count', 'tier');

        return Paginated::response($query->paginate(Paginated::perPage($request))->withQueryString(), CustomerResource::class, [
            'tier_counts' => collect(Customer::TIERS)->mapWithKeys(fn ($t) => [$t => (int) ($tierCounts[$t] ?? 0)]),
        ]);
    }

    public function store(CustomerRequest $request, ReferenceGenerator $references, TenantLock $lock): JsonResponse
    {
        $customer = DB::transaction(function () use ($request, $references, $lock) {
            $lock->acquire($request->user()->tenant_id);

            return Customer::create($request->validated() + [
                'code' => $references->next(Customer::class, 'code', 'CUS', 4),
                'tier' => 'bronze',
            ]);
        });

        return (new CustomerResource($customer->refresh()))->response()->setStatusCode(201);
    }

    public function show(Customer $customer): CustomerResource
    {
        $customer->load(['sales' => fn ($q) => $q->with('user:id,name')->withCount('items')->latest('id')->limit(20)]);

        return new CustomerResource($customer);
    }

    public function update(CustomerRequest $request, Customer $customer): CustomerResource
    {
        $customer->update($request->validated());

        return new CustomerResource($customer);
    }
}
