<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Drug;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PosController extends Controller
{
    /**
     * Lean payload with the FEFO batch attached (spec §7.1). An exact barcode
     * match is flagged so the client can add it to the cart with no confirmation.
     */
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if ($q === '') {
            return response()->json(['data' => [], 'meta' => ['barcode_match' => false]]);
        }

        $tenantVat = (float) $request->user()->tenant->vat_rate;

        $barcodeMatch = Drug::query()->active()->where('barcode', $q)->select('drugs.*')->withStock()->first();
        $drugs = $barcodeMatch
            ? collect([$barcodeMatch])
            : Drug::query()->active()->select('drugs.*')->withStock()->search($q)->orderBy('name')->limit(12)->get();

        // One query for the next FEFO batch of every result.
        $nextBatches = Batch::query()
            ->whereIn('drug_id', $drugs->pluck('id'))
            ->sellable()
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->get(['id', 'drug_id', 'batch_number', 'expiry_date', 'quantity_remaining'])
            ->groupBy('drug_id')
            ->map->first();

        return response()->json([
            'data' => $drugs->map(function (Drug $d) use ($nextBatches, $tenantVat) {
                $batch = $nextBatches->get($d->id);

                return [
                    'id' => $d->id,
                    'name' => $d->name,
                    'generic_name' => $d->generic_name,
                    'brand' => $d->brand,
                    'strength' => $d->strength,
                    'form' => $d->form,
                    'pack_size' => $d->pack_size,
                    'barcode' => $d->barcode,
                    'selling_price' => Money::float($d->selling_price),
                    'tax_rate' => $d->tax_rate !== null ? (float) $d->tax_rate : $tenantVat,
                    'stock_on_hand' => (int) $d->stock_on_hand,
                    'stock_status' => Drug::stockStatus((int) $d->stock_on_hand, $d->reorder_level),
                    'fefo_batch' => $batch ? [
                        'id' => $batch->id,
                        'batch_number' => $batch->batch_number,
                        'expiry_date' => $batch->expiry_date->toDateString(),
                        'quantity_remaining' => $batch->quantity_remaining,
                    ] : null,
                ];
            })->values(),
            'meta' => ['barcode_match' => (bool) $barcodeMatch],
        ]);
    }
}
