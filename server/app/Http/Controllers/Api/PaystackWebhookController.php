<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PaystackService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaystackWebhookController extends Controller
{
    /**
     * Unauthenticated; the signature is verified before any state change.
     */
    public function __invoke(Request $request, PaystackService $paystack): JsonResponse
    {
        $payload = $request->getContent();

        if (! $paystack->validSignature($payload, $request->header('x-paystack-signature'))) {
            Log::warning('Paystack webhook rejected: bad signature', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $event = json_decode($payload, true) ?? [];

        if (($event['event'] ?? null) === 'charge.success') {
            $paystack->applyCharge($event['data'] ?? []);
        }

        return response()->json(['received' => true]);
    }
}
