<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Support\Money;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Paystack server-to-server REST. The webhook is the source of truth;
 * verify() covers the redirect-back path when the webhook is late.
 */
class PaystackService
{
    private const BASE = 'https://api.paystack.co';

    public function plans(): array
    {
        return config('medipharm.plans');
    }

    public function initialize(Tenant $tenant, string $email, string $plan): array
    {
        $config = $this->plans()[$plan] ?? throw new RuntimeException('Unknown plan.');
        $reference = 'MP-'.$tenant->id.'-'.Str::upper(Str::random(12));

        Payment::create([
            'tenant_id' => $tenant->id,
            'plan' => $plan,
            'amount' => $config['price'],
            'reference' => $reference,
            'status' => 'pending',
        ]);

        $response = Http::withToken(config('services.paystack.secret_key'))
            ->acceptJson()
            ->timeout(20)
            ->post(self::BASE.'/transaction/initialize', [
                'email' => $email,
                'amount' => Money::toKobo($config['price']),
                'currency' => 'NGN',
                'reference' => $reference,
                'callback_url' => rtrim(config('app.frontend_url'), '/').'/settings/billing?reference='.$reference,
                'metadata' => ['tenant_id' => $tenant->id, 'plan' => $plan],
            ]);

        if (! $response->successful() || ! $response->json('status')) {
            throw new RuntimeException($response->json('message') ?: 'Could not reach Paystack. Please try again.');
        }

        return [
            'authorization_url' => $response->json('data.authorization_url'),
            'reference' => $reference,
        ];
    }

    public function verify(string $reference): ?Payment
    {
        $response = Http::withToken(config('services.paystack.secret_key'))
            ->acceptJson()
            ->timeout(20)
            ->get(self::BASE.'/transaction/verify/'.rawurlencode($reference));

        if (! $response->successful()) {
            return null;
        }

        return $this->applyCharge($response->json('data') ?? []);
    }

    public function validSignature(string $payload, ?string $signature): bool
    {
        $secret = (string) config('services.paystack.secret_key');
        if ($secret === '' || ! $signature) {
            return false;
        }

        return hash_equals(hash_hmac('sha512', $payload, $secret), $signature);
    }

    /**
     * Idempotent: applying the same successful charge twice extends nothing.
     */
    public function applyCharge(array $data): ?Payment
    {
        $reference = $data['reference'] ?? null;
        if (! $reference) {
            return null;
        }

        return DB::transaction(function () use ($data, $reference) {
            $payment = Payment::withoutGlobalScopes()->where('reference', $reference)->lockForUpdate()->first();
            if (! $payment || $payment->status === 'success') {
                return $payment;
            }

            if (($data['status'] ?? null) !== 'success') {
                $payment->update(['status' => 'failed', 'raw_response' => $data]);

                return $payment;
            }

            if (Money::toKobo($payment->amount) !== (int) ($data['amount'] ?? 0)) {
                $payment->update(['status' => 'failed', 'raw_response' => $data]);

                return $payment;
            }

            return app(TenantContext::class)->run($payment->tenant_id, function () use ($payment, $data) {
                $tenant = Tenant::query()->lockForUpdate()->findOrFail($payment->tenant_id);
                $subscription = Subscription::query()->latest('id')->first();

                $from = $subscription?->renews_at?->isFuture() ? $subscription->renews_at : now();
                $renews = $from->copy()->addMonth();

                $subscription = Subscription::updateOrCreate(
                    ['id' => $subscription?->id],
                    [
                        'tenant_id' => $tenant->id,
                        'plan' => $payment->plan,
                        'status' => 'active',
                        'starts_at' => $subscription?->starts_at ?? now(),
                        'renews_at' => $renews,
                        'paystack_customer_code' => $data['customer']['customer_code'] ?? $subscription?->paystack_customer_code,
                    ],
                );

                $payment->update([
                    'status' => 'success',
                    'paid_at' => now(),
                    'subscription_id' => $subscription->id,
                    'raw_response' => $data,
                ]);

                $tenant->update(['status' => 'active', 'plan' => $payment->plan]);

                return $payment;
            });
        });
    }
}
