@php
    $supplier = $invoice->supplier;
    $buyer = $invoice->buyer;
    $taxInvoice = $invoice->type === \App\Models\Invoice::TAX_INVOICE;
    $interState = (float) $invoice->igst_total > 0 || ($taxInvoice && ($supplier['state_code'] ?? null) !== $invoice->place_of_supply);
    $money = fn ($amount) => \App\Notifications\StoreMessage::inr($amount);
    $rate = fn ($value) => rtrim(rtrim(number_format((float) $value, 2), '0'), '.') . '%';
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>{{ $taxInvoice ? 'Tax invoice' : 'Bill of supply' }} {{ $invoice->number }} · Elitezaar</title>
    <style>
        :root { --ink: #13291f; --muted: #66756c; --line: #dfe5e1; --brand: #18372e; --soft: #f4f7f5; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 24px 12px; color: var(--ink); background: #eef1ee; font: 13px/1.45 "Segoe UI", Roboto, Arial, sans-serif; }
        .sheet { position: relative; max-width: 820px; margin: 0 auto; border-radius: 10px; padding: 32px 36px; background: #fff; box-shadow: 0 10px 30px rgba(16, 39, 32, .1); overflow: hidden; }
        .toolbar { max-width: 820px; margin: 0 auto 14px; display: flex; justify-content: flex-end; gap: 10px; }
        .toolbar button { border: 0; border-radius: 8px; padding: 10px 18px; color: #fff; background: var(--brand); font: 600 14px/1 inherit; cursor: pointer; }
        header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid var(--brand); padding-bottom: 16px; }
        .brand { color: var(--brand); font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
        .brand small { display: block; color: var(--muted); font-size: 12px; font-weight: 500; letter-spacing: 0; }
        h1 { margin: 0; color: var(--brand); font-size: 18px; text-align: right; text-transform: uppercase; letter-spacing: .08em; }
        .meta { margin-top: 6px; text-align: right; }
        .meta div { white-space: nowrap; }
        .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 18px 0; }
        .party h2 { margin: 0 0 4px; color: var(--muted); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
        .party strong { font-size: 14px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid var(--line); padding: 7px 6px; vertical-align: top; text-align: right; }
        th { color: var(--muted); background: var(--soft); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
        th:nth-child(2), td:nth-child(2) { text-align: left; }
        td small { color: var(--muted); }
        .totals { display: flex; justify-content: space-between; gap: 24px; margin-top: 16px; }
        .words { max-width: 380px; color: var(--muted); }
        .words strong { color: var(--ink); }
        .sums { min-width: 280px; }
        .sums div { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; }
        .sums .grand { margin-top: 6px; border-top: 2px solid var(--brand); padding-top: 8px; font-size: 15px; font-weight: 800; }
        footer { display: flex; justify-content: space-between; gap: 24px; margin-top: 28px; border-top: 1px solid var(--line); padding-top: 14px; color: var(--muted); font-size: 12px; }
        .sign { min-width: 220px; text-align: right; }
        .sign strong { display: block; margin-bottom: 34px; color: var(--ink); }
        .stamp { position: absolute; top: 42%; left: 50%; border: 4px solid rgba(180, 72, 58, .55); border-radius: 10px; padding: 6px 20px; color: rgba(180, 72, 58, .55); font-size: 46px; font-weight: 800; letter-spacing: .12em; transform: translate(-50%, -50%) rotate(-18deg); pointer-events: none; }
        @media (max-width: 640px) { .sheet { padding: 20px 16px; } header, .parties, .totals, footer { display: block; } h1, .meta, .sign { text-align: left; } .sums { margin-top: 12px; } table { font-size: 11px; } }
        @media print { body { padding: 0; background: #fff; } .sheet { max-width: none; border-radius: 0; box-shadow: none; padding: 0; } .toolbar { display: none; } @page { size: A4; margin: 14mm; } }
    </style>
</head>
<body>
    <div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
    <main class="sheet">
        @if ($invoice->status === 'cancelled')
            <div class="stamp" aria-label="Cancelled">CANCELLED</div>
        @endif
        <header>
            <div>
                <div class="brand">{{ $supplier['name'] }}@if (!empty($supplier['trade_name']) && $supplier['trade_name'] !== $supplier['name'])<small>Trading as {{ $supplier['trade_name'] }}</small>@endif</div>
                @if (!empty($supplier['address']))<div>{{ $supplier['address'] }}</div>@endif
                @if (!empty($supplier['state']))<div>State: {{ $supplier['state'] }} ({{ $supplier['state_code'] }})</div>@endif
                <div>{{ $supplier['gstin'] ? 'GSTIN: ' . $supplier['gstin'] : 'Not registered under GST' }}</div>
            </div>
            <div>
                <h1>{{ $taxInvoice ? 'Tax invoice' : 'Bill of supply' }}</h1>
                <div class="meta">
                    <div>Invoice no. <strong>{{ $invoice->number }}</strong></div>
                    <div>Date: {{ $invoice->issued_at->format('d M Y') }}</div>
                    @if ($invoice->order_id)<div>Order: #{{ $invoice->order_id }}</div>@endif
                    <div>Place of supply: {{ $buyer['state'] ?? '—' }}{{ $invoice->place_of_supply ? " ({$invoice->place_of_supply})" : '' }}</div>
                </div>
            </div>
        </header>

        <section class="parties">
            <div class="party">
                <h2>Bill to</h2>
                <strong>{{ $buyer['name'] }}</strong>
                @if (!empty($buyer['gstin']))<div>GSTIN: {{ $buyer['gstin'] }}</div>@endif
                <div>{{ $buyer['address'] }}</div>
                @if (!empty($buyer['phone']))<div>{{ $buyer['phone'] }}</div>@endif
            </div>
            <div class="party">
                <h2>Ship to</h2>
                <strong>{{ $buyer['contact'] ?? $buyer['name'] }}</strong>
                <div>{{ $buyer['address'] }}</div>
            </div>
        </section>

        <table>
            <thead>
                <tr>
                    <th>#</th><th>Item</th><th>HSN/SAC</th><th>Qty</th><th>Price</th><th>Taxable value</th>
                    @if ($taxInvoice)
                        <th>GST</th>
                        @if ($interState)<th>IGST</th>@else<th>CGST</th><th>SGST</th>@endif
                    @endif
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($invoice->lines as $index => $line)
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td>{{ $line['description'] }}@if (!empty($line['sku']))<br><small>SKU {{ $line['sku'] }}</small>@endif</td>
                        <td>{{ $line['hsn_code'] ?? '—' }}</td>
                        <td>{{ $line['quantity'] }}</td>
                        <td>{{ $money($line['unit_price']) }}</td>
                        <td>{{ $money($line['taxable_value']) }}</td>
                        @if ($taxInvoice)
                            <td>{{ $rate($line['gst_rate']) }}</td>
                            @if ($interState)<td>{{ $money($line['igst']) }}</td>@else<td>{{ $money($line['cgst']) }}</td><td>{{ $money($line['sgst']) }}</td>@endif
                        @endif
                        <td>{{ $money($line['total']) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <section class="totals">
            <div class="words">
                Amount in words:<br><strong>{{ $words }}</strong>
                @if ($taxInvoice)<p>Prices include GST.</p>@else<p>The supplier is not registered under GST, so no GST is charged.</p>@endif
            </div>
            <div class="sums">
                <div><span>Taxable value</span><span>{{ $money($invoice->taxable_total) }}</span></div>
                @if ($taxInvoice)
                    @if ($interState)
                        <div><span>IGST</span><span>{{ $money($invoice->igst_total) }}</span></div>
                    @else
                        <div><span>CGST</span><span>{{ $money($invoice->cgst_total) }}</span></div>
                        <div><span>SGST</span><span>{{ $money($invoice->sgst_total) }}</span></div>
                    @endif
                @endif
                <div class="grand"><span>Total</span><span>{{ $money($invoice->grand_total) }}</span></div>
            </div>
        </section>

        <footer>
            <div>
                @if (!empty($supplier['marketplace']))Sold by {{ $supplier['trade_name'] ?? $supplier['name'] }} through Elitezaar.com (marketplace).<br>@endif
                Whether tax is payable on reverse charge: No.<br>
                This is a computer-generated invoice and needs no signature.
            </div>
            <div class="sign"><strong>For {{ $supplier['name'] }}</strong>Authorised signatory</div>
        </footer>
    </main>
</body>
</html>
