<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Issues invoices when an order ships: one per supplier (each seller for their products, Elitezaar for its own
 * products and the delivery charge), numbered in sequence per supplier and financial year, e.g. EZ/2627/0001.
 */
class Invoices
{
    /** SAC code for courier and delivery services. */
    private const DELIVERY_SAC = '996812';

    /** Issues any invoices the order doesn't have yet. Safe to call more than once. */
    public static function issue(Order $order): Collection
    {
        $order->loadMissing(['items.product.category.parent']);
        $existing = Invoice::query()->where('order_id', $order->id)->get();

        $groups = $order->items->groupBy(fn (OrderItem $item) => (string) ($item->vendor_id ?? ''));
        if ((float) $order->shipping_amount > 0 && !$groups->has('')) {
            $groups->put('', collect());
        }

        foreach ($groups as $vendorKey => $items) {
            $vendorId = $vendorKey === '' ? null : (int) $vendorKey;
            if ($existing->contains(fn (Invoice $invoice) => $invoice->vendor_id === $vendorId)) {
                continue;
            }
            $existing->push(self::create($order, $vendorId, $items));
        }

        return $existing;
    }

    /** The order's invoices for its pages; a seller sees only their own. */
    public static function linksFor(Order $order, ?int $vendorId = null): array
    {
        return Invoice::query()->where('order_id', $order->id)
            ->when($vendorId, fn ($query) => $query->where('vendor_id', $vendorId))
            ->orderBy('id')->get()
            ->map(fn (Invoice $invoice) => $invoice->summary())->all();
    }

    /** A cancelled order's invoices are marked cancelled (they keep their numbers, as GST requires). */
    public static function cancel(Order $order): void
    {
        Invoice::query()->where('order_id', $order->id)->where('status', 'issued')
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);
    }

    /** April to March, e.g. "2026-27". */
    public static function financialYear(Carbon $date): string
    {
        $start = $date->month >= 4 ? $date->year : $date->year - 1;

        return sprintf('%d-%02d', $start, ($start + 1) % 100);
    }

    private static function create(Order $order, ?int $vendorId, Collection $items): Invoice
    {
        $seller = $vendorId ? User::find($vendorId) : null;
        [$registered, $supplierState] = Gst::supplier($seller);
        $sameState = $supplierState !== null && $supplierState === $order->place_of_supply;
        $store = Gst::store();

        $lines = $items->map(function (OrderItem $item) use ($order, $seller, $registered) {
            // Orders from before GST was set up work it out now, the same way checkout does.
            $tax = $item->gst_rate !== null
                ? ['hsn_code' => $item->hsn_code, 'gst_rate' => (float) $item->gst_rate, 'taxable_value' => (float) $item->taxable_value,
                    'cgst' => (float) $item->cgst, 'sgst' => (float) $item->sgst, 'igst' => (float) $item->igst]
                : Gst::forLine($item->product, (float) $item->unit_price, (float) $item->line_total, $seller, $order->place_of_supply);

            return [
                'description' => $item->product_title . ($item->size ? " (size {$item->size})" : ''),
                'sku' => $item->sku,
                'hsn_code' => $tax['hsn_code'],
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                // A coupon's share, taken off before GST (the total is what was paid).
                'discount' => (float) $item->discount_amount,
                'gst_rate' => $registered ? $tax['gst_rate'] : 0.0,
                'taxable_value' => $tax['taxable_value'],
                'cgst' => $tax['cgst'],
                'sgst' => $tax['sgst'],
                'igst' => $tax['igst'],
                'total' => (float) $item->line_total,
            ];
        })->values()->all();

        // Delivery is charged by Elitezaar, so it goes on the store's invoice.
        if ($vendorId === null && (float) $order->shipping_amount > 0) {
            $rate = $registered ? (float) ($order->shipping_gst_rate ?? $store['shipping_rate']) : 0.0;
            $lines[] = [
                'description' => 'Delivery charges', 'sku' => null, 'hsn_code' => self::DELIVERY_SAC, 'quantity' => 1,
                'unit_price' => (float) $order->shipping_amount, 'gst_rate' => $rate,
                ...Gst::split((float) $order->shipping_amount, $rate, $sameState), 'total' => (float) $order->shipping_amount,
            ];
        }

        $sum = fn (string $key) => round(array_sum(array_column($lines, $key)), 2);
        $attributes = [
            'order_id' => $order->id,
            'vendor_id' => $vendorId,
            'type' => $registered ? Invoice::TAX_INVOICE : Invoice::BILL_OF_SUPPLY,
            'status' => $order->status === 'cancelled' ? 'cancelled' : 'issued',
            'supplier' => self::supplierDetails($seller, $store, $supplierState),
            'buyer' => self::buyerDetails($order),
            'lines' => $lines,
            'place_of_supply' => $order->place_of_supply,
            'taxable_total' => $sum('taxable_value'),
            'cgst_total' => $sum('cgst'),
            'sgst_total' => $sum('sgst'),
            'igst_total' => $sum('igst'),
            'grand_total' => $sum('total'),
            'issued_at' => now(),
        ];

        // Numbers follow on per supplier and year; if two invoices race for one, the loser takes the next.
        for ($attempt = 1; ; $attempt++) {
            try {
                return DB::transaction(function () use ($attributes, $vendorId, $store) {
                    $year = self::financialYear(now());
                    $sequence = 1 + (int) Invoice::query()->where('financial_year', $year)
                        ->when($vendorId, fn ($query) => $query->where('vendor_id', $vendorId), fn ($query) => $query->whereNull('vendor_id'))
                        ->max('sequence');
                    $prefix = $vendorId ? "S{$vendorId}" : ($store['invoice_prefix'] ?: 'EZ');

                    return Invoice::create([
                        ...$attributes,
                        'financial_year' => $year,
                        'sequence' => $sequence,
                        'number' => sprintf('%s/%s/%04d', $prefix, str_replace('-', '', substr($year, 2)), $sequence),
                    ]);
                });
            } catch (QueryException $exception) {
                if ($attempt >= 3) {
                    throw $exception;
                }
            }
        }
    }

    private static function supplierDetails(?User $seller, array $store, ?string $state): array
    {
        return [
            'name' => $seller ? ($seller->legal_name ?: $seller->name) : ($store['legal_name'] ?: 'Elitezaar'),
            'trade_name' => $seller?->name,
            'gstin' => $seller ? ($seller->gstin ?: null) : ($store['gstin'] ?: null),
            'address' => $seller ? (string) $seller->business_address : (string) $store['address'],
            'state_code' => $state,
            'state' => Gst::STATES[$state] ?? null,
            'marketplace' => $seller !== null,
        ];
    }

    private static function buyerDetails(Order $order): array
    {
        return [
            'name' => $order->billing_name ?: $order->customer_name,
            'contact' => $order->customer_name,
            'gstin' => $order->billing_gstin,
            'address' => implode(', ', array_filter([$order->address, $order->city, $order->state, $order->postal_code])),
            'state_code' => $order->place_of_supply,
            'state' => Gst::STATES[$order->place_of_supply] ?? $order->state,
            'email' => $order->customer_email,
            'phone' => $order->customer_phone,
        ];
    }

    /** "One lakh twenty-five thousand four hundred rupees and fifty paise", the Indian way. */
    public static function amountInWords(float $amount): string
    {
        $rupees = (int) floor(round($amount, 2));
        $paise = (int) round(($amount - $rupees) * 100);
        $words = ucfirst(self::numberInWords($rupees)) . ' rupee' . ($rupees === 1 ? '' : 's');

        return $words . ($paise ? ' and ' . self::numberInWords($paise) . ' paise' : '') . ' only';
    }

    private static function numberInWords(int $number): string
    {
        $ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
            'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
        $tens = [2 => 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        $belowHundred = fn (int $n) => $n < 20 ? $ones[$n] : $tens[intdiv($n, 10)] . ($n % 10 ? '-' . $ones[$n % 10] : '');
        $belowThousand = fn (int $n) => $n >= 100
            ? $ones[intdiv($n, 100)] . ' hundred' . ($n % 100 ? ' ' . $belowHundred($n % 100) : '')
            : $belowHundred($n);

        if ($number < 1000) {
            return $belowThousand($number);
        }
        $parts = [];
        foreach ([[10000000, 'crore'], [100000, 'lakh'], [1000, 'thousand']] as [$size, $name]) {
            if ($number >= $size) {
                $count = intdiv($number, $size);
                $parts[] = ($count < 1000 ? $belowThousand($count) : self::numberInWords($count)) . " {$name}";
                $number %= $size;
            }
        }
        if ($number) {
            $parts[] = $belowThousand($number);
        }

        return implode(' ', $parts);
    }
}
