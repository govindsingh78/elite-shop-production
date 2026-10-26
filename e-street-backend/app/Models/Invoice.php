<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\URL;

/**
 * A GST invoice (or, from a supplier without a GSTIN, a bill of supply) for one supplier's part of an order.
 * Supplier, buyer and lines are frozen copies, so the invoice reads the same after anything changes.
 */
class Invoice extends Model
{
    public const TAX_INVOICE = 'tax_invoice';
    public const BILL_OF_SUPPLY = 'bill_of_supply';

    protected $fillable = [
        'order_id', 'vendor_id', 'number', 'financial_year', 'sequence', 'type', 'status', 'supplier', 'buyer', 'lines',
        'place_of_supply', 'taxable_total', 'cgst_total', 'sgst_total', 'igst_total', 'grand_total', 'issued_at', 'cancelled_at',
    ];

    protected $casts = [
        'supplier' => 'array',
        'buyer' => 'array',
        'lines' => 'array',
        'taxable_total' => 'decimal:2',
        'cgst_total' => 'decimal:2',
        'sgst_total' => 'decimal:2',
        'igst_total' => 'decimal:2',
        'grand_total' => 'decimal:2',
        'issued_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function taxTotal(): float
    {
        return round((float) $this->cgst_total + (float) $this->sgst_total + (float) $this->igst_total, 2);
    }

    /**
     * A link to the printable invoice that works without signing in (from the app, an email or a new tab),
     * valid for 30 days. Relative: callers put the site address in front.
     */
    public function printPath(): string
    {
        return URL::temporarySignedRoute('invoices.print', now()->addDays(30), ['invoice' => $this->id], absolute: false);
    }

    /** What the order pages and lists show. */
    public function summary(): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'type' => $this->type,
            'status' => $this->status,
            'order_id' => $this->order_id,
            'supplier_name' => $this->supplier['name'] ?? '',
            'buyer_name' => $this->buyer['name'] ?? '',
            'issued_at' => $this->issued_at,
            'taxable_total' => (float) $this->taxable_total,
            'tax_total' => $this->taxTotal(),
            'grand_total' => (float) $this->grand_total,
            'print_url' => $this->printPath(),
        ];
    }
}
