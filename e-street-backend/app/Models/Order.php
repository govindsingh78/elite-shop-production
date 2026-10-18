<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = [
        'user_id', 'customer_name', 'customer_email', 'customer_phone', 'address',
        'city', 'state', 'postal_code', 'country', 'subtotal', 'shipping_amount',
        'shipping_method_id', 'total', 'payment_method', 'payment_status', 'status', 'tracking_number', 'courier_name', 'estimated_delivery_date', 'notes',
    ];

    // Payment fields are only ever set by the payment flow, never mass-assigned.
    protected $hidden = ['payment_token'];

    protected $casts = [
        'paid_at' => 'datetime',
        'estimated_delivery_date' => 'date:Y-m-d',
        'subtotal' => 'decimal:2',
        'shipping_amount' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function markPaid(string $razorpayPaymentId): void
    {
        if ($this->payment_status === 'paid') {
            return;
        }

        $this->forceFill([
            'payment_status' => 'paid',
            'razorpay_payment_id' => $razorpayPaymentId,
            'paid_at' => now(),
            'payment_token' => null,
        ])->save();
    }

    /** Newest first, so the first event is the current position of the parcel. */
    public function trackingEvents()
    {
        return $this->hasMany(OrderTrackingEvent::class)->orderByDesc('event_at')->orderByDesc('id');
    }

    public function latestTrackingEvent()
    {
        return $this->hasOne(OrderTrackingEvent::class)->ofMany(['event_at' => 'max', 'id' => 'max']);
    }

    /** Record a tracking milestone and move the order into the matching status. */
    public function recordTrackingEvent(string $status, array $attributes = [], ?int $userId = null): OrderTrackingEvent
    {
        $event = $this->trackingEvents()->create([
            'status' => $status,
            'location' => $attributes['location'] ?? null,
            'description' => $attributes['description'] ?? null,
            'event_at' => $attributes['event_at'] ?? now(),
            'created_by' => $userId,
        ]);

        $this->syncStatusWithTracking();

        return $event;
    }

    /** The order status follows the most recent tracking milestone. */
    public function syncStatusWithTracking(): void
    {
        $latest = $this->latestTrackingEvent()->first();
        $status = $latest ? OrderTrackingEvent::STATUS_TO_ORDER_STATUS[$latest->status] ?? null : null;
        if ($status && $this->status !== $status) {
            $this->forceFill(['status' => $status])->save();
        }
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
