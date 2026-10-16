<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Http\Resources\TenantResource;
use App\Models\Payment;
use App\Models\Subscription;
use App\Services\PaystackService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class BillingController extends Controller
{
    public function __construct(private readonly PaystackService $paystack) {}

    public function subscription(Request $request): JsonResponse
    {
        $tenant = $request->user()->tenant;
        $subscription = Subscription::query()->latest('id')->first();
        $payments = Payment::query()->latest('id')->limit(24)->get();

        return response()->json(['data' => [
            'tenant' => (new TenantResource($tenant))->resolve(),
            'subscription' => $subscription ? [
                'plan' => $subscription->plan,
                'status' => $subscription->status,
                'starts_at' => $subscription->starts_at?->toIso8601String(),
                'renews_at' => $subscription->renews_at?->toIso8601String(),
            ] : null,
            'plans' => collect($this->paystack->plans())->map(fn ($p, $key) => ['key' => $key] + $p)->values(),
            'payments' => PaymentResource::collection($payments)->resolve(),
            'paystack_configured' => (bool) config('services.paystack.secret_key'),
        ]]);
    }

    public function initialize(Request $request): JsonResponse
    {
        $data = $request->validate(['plan' => ['required', Rule::in(array_keys($this->paystack->plans()))]]);

        try {
            $result = $this->paystack->initialize($request->user()->tenant, $request->user()->email, $data['plan']);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['plan' => [$e->getMessage()]]);
        }

        return response()->json(['data' => $result]);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate(['reference' => ['required', 'string', 'max:64']]);

        // Only this tenant's references (global scope applies).
        Payment::query()->where('reference', $data['reference'])->firstOrFail();
        $payment = $this->paystack->verify($data['reference']);

        return response()->json(['data' => $payment ? (new PaymentResource($payment->refresh()))->resolve() : null]);
    }
}
