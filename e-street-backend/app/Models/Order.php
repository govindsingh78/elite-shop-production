<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = [
        'user_id', 'customer_name', 'customer_email', 'customer_phone', 'address',
        'city', 'state', 'postal_code', 'country', 'subtotal', 'shipping_amount',
        'shipping_method_id', 'total', 'payment_method', 'payment_status', 'status', 'tracking_number', 'notes',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'shipping_amount' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function shippingMethod()
    {
        return $this->belongsTo(ShippingMethod::class);
    }
}
