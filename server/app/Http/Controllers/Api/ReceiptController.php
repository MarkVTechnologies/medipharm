<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Services\ReceiptBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ReceiptController extends Controller
{
    public function __construct(private readonly ReceiptBuilder $receipts) {}

    /**
     * JSON for the SPA's /receipts/{reference} page.
     */
    public function byReference(string $reference): JsonResponse
    {
        $sale = Sale::query()->where('reference', $reference)->firstOrFail();

        return response()->json(['data' => $this->receipts->payload($sale)]);
    }

    /**
     * GET /api/sales/{sale}/receipt — HTML (print) | ?format=pdf
     */
    public function show(Request $request, Sale $sale): Response
    {
        return $request->query('format') === 'pdf'
            ? $this->receipts->pdf($sale)
            : $this->receipts->html($sale, $request->boolean('print'));
    }

    /**
     * Public, signed, 30-day link for WhatsApp (FR-7.5). The signature is the
     * authorisation — no session, so no tenant scope is applied here.
     */
    public function shared(Request $request, int $sale): Response
    {
        $model = Sale::withoutGlobalScopes()->findOrFail($sale);

        return $request->query('format') === 'pdf'
            ? $this->receipts->pdf($model)
            : $this->receipts->html($model, false, $this->receipts->shareUrl($model, 'pdf'));
    }
}
