<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Messages\MailMessage;

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

    protected function mailDetails(MailMessage $mail): MailMessage
    {
        foreach ($this->order->items as $item) {
            $mail->line(self::itemLine($item, true));
        }

        return $mail->line("Delivering to {$this->order->city}" . ($this->order->state ? ", {$this->order->state}" : '') . '.');
    }
}
