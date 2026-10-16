@php
    $fmt = fn ($v) => '₦'.number_format((float) $v, 2);
    $ts = $sale->created_at->copy()->setTimezone('Africa/Lagos');
    $methods = ['cash' => 'Cash', 'card' => 'Card / POS', 'transfer' => 'Bank transfer'];
    $isPdf = $pdf ?? false;
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Receipt {{ $sale->reference }} — {{ $tenant->name }}</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #f5f7fa; color: #11151a; font-family: {{ $isPdf ? 'DejaVu Sans, sans-serif' : '"Inter", -apple-system, "Segoe UI", system-ui, sans-serif' }}; font-size: 12px; }
        .receipt { width: 80mm; max-width: 100%; margin: 16px auto; background: #fff; padding: 14px 12px; {{ $isPdf ? '' : 'box-shadow: 0 1px 3px rgb(15 23 42 / .08);' }} }
        .center { text-align: center; }
        h1 { font-size: 15px; margin: 0 0 2px; }
        .muted { color: #66707d; font-size: 11px; }
        hr { border: 0; border-top: 1px dashed #b9c1cc; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .r { text-align: right; white-space: nowrap; }
        .item-name { font-weight: 600; }
        .total td { font-size: 14px; font-weight: 700; padding-top: 4px; }
        .void { border: 2px solid #dc2626; color: #dc2626; text-align: center; font-weight: 700; padding: 4px; margin-bottom: 8px; letter-spacing: .1em; }
        .actions { width: 80mm; max-width: 100%; margin: 0 auto 24px; display: flex; gap: 8px; }
        .actions a, .actions button { flex: 1; height: 40px; border-radius: 8px; border: 1px solid #d5dbe3; background: #fff; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; color: #11151a; display: flex; align-items: center; justify-content: center; }
        .actions .primary { background: #1976d2; border-color: #1976d2; color: #fff; }
        @media print {
            body { background: #fff; }
            .receipt { margin: 0; box-shadow: none; width: auto; }
            .actions { display: none; }
            @page { margin: 4mm; }
        }
        @media print and (min-width: 150mm) {
            .receipt { width: 120mm; margin: 0 auto; font-size: 13px; }
        }
    </style>
</head>
<body>
<div class="receipt">
    @if ($sale->status === 'voided')
        <div class="void">VOIDED</div>
    @endif
    <div class="center">
        <h1>{{ $tenant->name }}</h1>
        @if ($tenant->address)<div class="muted">{{ $tenant->address }}</div>@endif
        @if ($tenant->phone)<div class="muted">Tel: {{ $tenant->phone }}</div>@endif
        @if ($tenant->licence_number)<div class="muted">Premises licence: {{ $tenant->licence_number }}</div>@endif
    </div>
    <hr>
    <table>
        <tr><td>Receipt</td><td class="r"><strong>{{ $sale->reference }}</strong></td></tr>
        <tr><td>Date</td><td class="r">{{ $ts->format('d M Y, H:i') }}</td></tr>
        <tr><td>Served by</td><td class="r">{{ $sale->user?->name }}</td></tr>
        @if ($sale->customer)
            <tr><td>Customer</td><td class="r">{{ $sale->customer->name }} ({{ $sale->customer->code }})</td></tr>
        @endif
    </table>
    <hr>
    <table>
        @foreach ($sale->items as $item)
            <tr><td colspan="2" class="item-name">{{ $item->drug?->name }} {{ $item->drug?->strength }}</td></tr>
            <tr>
                <td class="muted">{{ $item->quantity }} × {{ $fmt($item->unit_price) }} · Batch {{ $item->batch?->batch_number }}</td>
                <td class="r">{{ $fmt($item->line_total) }}</td>
            </tr>
        @endforeach
    </table>
    <hr>
    <table>
        <tr><td>Subtotal</td><td class="r">{{ $fmt($sale->subtotal) }}</td></tr>
        @if ((float) $sale->discount > 0)
            <tr><td>Discount</td><td class="r">−{{ $fmt($sale->discount) }}</td></tr>
        @endif
        <tr><td>VAT</td><td class="r">{{ $fmt($sale->vat) }}</td></tr>
        <tr class="total"><td>TOTAL</td><td class="r">{{ $fmt($sale->total) }}</td></tr>
        <tr><td>Paid by</td><td class="r">{{ $methods[$sale->payment_method] ?? $sale->payment_method }}</td></tr>
        @if ($sale->payment_method === 'cash')
            <tr><td>Tendered</td><td class="r">{{ $fmt($sale->amount_tendered) }}</td></tr>
            <tr><td>Change</td><td class="r">{{ $fmt($sale->change_given) }}</td></tr>
        @endif
    </table>
    <hr>
    @if ($tenant->receipt_footer)
        <div class="center muted">{{ $tenant->receipt_footer }}</div>
    @endif
    <div class="center muted" style="margin-top:6px">Powered by MediPharm</div>
</div>
@unless ($isPdf)
    <div class="actions">
        <button class="primary" onclick="window.print()">Print</button>
        <a href="{{ $pdfUrl }}">Download PDF</a>
    </div>
    @if ($autoPrint)
        <script>window.addEventListener('load', () => window.print());</script>
    @endif
@endunless
</body>
</html>
