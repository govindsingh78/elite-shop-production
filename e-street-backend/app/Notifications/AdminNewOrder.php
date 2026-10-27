<?php

namespace App\Notifications;

use App\Models\Order;

/** To the store admins: a new order has been confirmed. */
class AdminNewOrder extends StoreMessage
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
        return "New order #{$this->order->id} · " . self::inr($this->order->total);
    }

    public function body(): string
    {
        $count = (int) $this->order->items->sum('quantity');

        return "{$this->order->customer_name} ordered {$count} " . ($count === 1 ? 'item' : 'items') . ' · '
            . ($this->order->payment_status === 'paid' ? 'paid online' : 'cash on delivery') . '.';
    }

    public function webPath(): ?string
    {
        return "/admin/manage-orders/{$this->order->id}";
    }

    public function appPath(): ?string
    {
        return "/admin/order/{$this->order->id}";
    }

    protected function actionLabel(): string
    {
        return 'Open the order';
    }

    protected function mailSections(): array
    {
        $order = $this->order;

        return [
            [
                'type' => 'items',
                'title' => "Order #{$order->id}",
                'items' => self::itemRows($order->items),
                'totals' => [...self::couponTotal($order->coupon_code, (float) $order->discount_amount), ['label' => 'Total', 'value' => self::inr($order->total), 'strong' => true]],
            ],
            [
                'type' => 'facts',
                'rows' => [
                    ['label' => 'Customer', 'value' => $order->customer_name],
                    ['label' => 'Payment', 'value' => $order->payment_status === 'paid' ? 'Paid online' : 'Cash on delivery'],
                    ['label' => 'Delivering to', 'value' => $order->city . ($order->state ? ", {$order->state}" : '')],
                ],
            ],
        ];
    }
}
