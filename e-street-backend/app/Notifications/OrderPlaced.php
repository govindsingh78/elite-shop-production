<?php

namespace App\Notifications;

use App\Models\Order;

/** To the shopper: their order is confirmed, with what they bought and where it's going. */
class OrderPlaced extends StoreMessage
{
    public function __construct(public Order $order)
    {
    }

    public function kind(): string
    {
        return 'order';
    }

    public function title(): string
    {
        return "Order #{$this->order->id} confirmed";
    }

    public function subject(): string
    {
        return "Your Elitezaar order #{$this->order->id} is confirmed";
    }

    public function body(): string
    {
        return 'Thank you for shopping with Elitezaar! We’ve received your order of ' . self::inr($this->order->total)
            . ' and will let you know as soon as it’s on its way.';
    }

    /** Guests have no account to view the order in, so their email carries all the details instead. */
    public function webPath(): ?string
    {
        return $this->order->user_id ? "/customer/orders/{$this->order->id}" : null;
    }

    public function appPath(): ?string
    {
        return $this->order->user_id ? "/customer/orders/{$this->order->id}" : null;
    }

    protected function actionLabel(): string
    {
        return 'Track your order';
    }

    protected function greetingName(object $notifiable): ?string
    {
        return $this->order->customer_name;
    }

    protected function mailSections(): array
    {
        $order = $this->order;
        $address = implode(', ', array_filter([$order->address, $order->city, $order->state, $order->postal_code]));

        return [
            [
                'type' => 'items',
                'title' => "Order #{$order->id}",
                'items' => self::itemRows($order->items),
                'totals' => [
                    ['label' => 'Subtotal', 'value' => self::inr($order->subtotal ?? $order->items->sum('line_total'))],
                    ...self::couponTotal($order->coupon_code, (float) $order->discount_amount),
                    ['label' => 'Delivery', 'value' => (float) $order->shipping_amount > 0 ? self::inr($order->shipping_amount) : 'Free'],
                    ['label' => 'Total', 'value' => self::inr($order->total), 'strong' => true],
                ],
            ],
            [
                'type' => 'facts',
                'rows' => [
                    ['label' => 'Payment', 'value' => $order->payment_status === 'paid' ? 'Paid online' : 'Cash on delivery'],
                    ['label' => 'Delivering to', 'value' => "{$order->customer_name}, {$address}"],
                    ['label' => 'Ordered on', 'value' => $order->created_at?->copy()->timezone('Asia/Kolkata')->format('j M Y, g:i a')],
                ],
            ],
        ];
    }
}
