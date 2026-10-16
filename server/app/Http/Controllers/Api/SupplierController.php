<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SupplierRequest;
use App\Http\Resources\Paginated;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Supplier::query()
            ->withCount(['purchaseOrders' => fn ($q) => $q->whereIn('status', ['draft', 'sent', 'partial'])])
            ->where('is_active', ! $request->boolean('inactive'))
            ->when($request->query('search'), fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('name', 'like', '%'.$s.'%')
                ->orWhere('contact_person', 'like', '%'.$s.'%')
                ->orWhere('phone', 'like', $s.'%')))
            ->orderBy('name');

        return Paginated::response($query->paginate(Paginated::perPage($request))->withQueryString(), SupplierResource::class);
    }

    public function store(SupplierRequest $request): JsonResponse
    {
        $supplier = Supplier::create($request->validated());

        return (new SupplierResource($supplier->refresh()))->response()->setStatusCode(201);
    }

    public function show(Supplier $supplier): SupplierResource
    {
        return new SupplierResource($supplier);
    }

    public function update(SupplierRequest $request, Supplier $supplier): SupplierResource
    {
        $supplier->update($request->validated());

        return new SupplierResource($supplier);
    }
}
