<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id', 'product_id', 'size_id', 'size', 'vendor_id', 'product_title', 'sku', 'quantity', 'unit_price', 'line_total',
        'commission_rate', 'commission_amount',
    ];

    // Customers see order items too; the commission is between Elitezaar and the seller.
    protected $hidden = ['commission_rate', 'commission_amount'];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'line_total' => 'decimal:2',
        'commission_rate' => 'decimal:2',
        'commission_amount' => 'decimal:2',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
