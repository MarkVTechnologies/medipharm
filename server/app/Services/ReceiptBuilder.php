<?php

namespace App\Services;

use App\Http\Resources\SaleResource;
use App\Http\Resources\TenantResource;
use App\Models\Sale;
use App\Models\Tenant;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\URL;

/**
 * Receipts (FR-7): print-stylesheet HTML for the common case, dompdf for
 * email/archive, and a signed 30-day link for WhatsApp sharing.
 */
class ReceiptBuilder
{
    public function load(Sale $sale): Sale
    {
        return $sale->loadMissing(['items.drug:id,name,strength', 'items.batch:id,batch_number,expiry_date', 'customer', 'user:id,name', 'voider:id,name']);
    }

    /**
     * Every query parameter is covered by the signature, so the PDF variant
     * is signed separately rather than appended afterwards.
     */
    public function shareUrl(Sale $sale, ?string $format = null): string
    {
        return URL::temporarySignedRoute(
            'receipts.shared',
            now()->addDays(config('medipharm.receipt_link_days')),
            array_filter(['sale' => $sale->id, 'format' => $format]),
        );
    }

    public function payload(Sale $sale): array
    {
        $sale = $this->load($sale);
        $tenant = Tenant::query()->findOrFail($sale->tenant_id);

        return [
            'sale' => (new SaleResource($sale))->resolve(),
            'tenant' => (new TenantResource($tenant))->resolve(),
            'share_url' => $this->shareUrl($sale),
            'pdf_url' => $this->shareUrl($sale, 'pdf'),
        ];
    }

    public function html(Sale $sale, bool $autoPrint = false, ?string $pdfUrl = null): Response
    {
        return response()->view('receipts.show', $this->viewData($sale) + [
            'autoPrint' => $autoPrint,
            'pdfUrl' => $pdfUrl ?? request()->fullUrlWithQuery(['format' => 'pdf', 'print' => null]),
        ]);
    }

    public function pdf(Sale $sale): Response
    {
        $data = $this->viewData($sale) + ['autoPrint' => false, 'pdf' => true];

        return Pdf::loadView('receipts.show', $data)
            ->setPaper([0, 0, 226.77, 841.89]) // 80mm wide roll
            ->download("receipt-{$sale->reference}.pdf");
    }

    private function viewData(Sale $sale): array
    {
        $sale = $this->load($sale);

        return [
            'sale' => $sale,
            'tenant' => Tenant::query()->findOrFail($sale->tenant_id),
        ];
    }
}
