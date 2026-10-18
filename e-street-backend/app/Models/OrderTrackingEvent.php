<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderTrackingEvent extends Model
{
    /** Tracking milestone => the order status it puts the order into. */
    public const STATUS_TO_ORDER_STATUS = [
        'order_placed' => 'pending',
        'confirmed' => 'processing',
        'packed' => 'processing',
        'dispatched' => 'shipped',
        'in_transit' => 'shipped',
        'out_for_delivery' => 'shipped',
        'delivery_attempted' => 'shipped',
        'delivered' => 'delivered',
        'cancelled' => 'cancelled',
    ];

    /** Order status => the milestone logged when an admin changes the status directly. */
    public const ORDER_STATUS_TO_STATUS = [
        'pending' => 'order_placed',
        'processing' => 'confirmed',
        'shipped' => 'dispatched',
        'delivered' => 'delivered',
        'cancelled' => 'cancelled',
    ];

    protected $fillable = ['order_id', 'status', 'location', 'description', 'event_at', 'created_by'];

    protected $hidden = ['created_by'];

    protected $casts = [
        'event_at' => 'datetime',
    ];

    public static function statuses(): array
    {
        return array_keys(self::STATUS_TO_ORDER_STATUS);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
