<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Messages\MailMessage;

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

    protected function mailDetails(MailMessage $mail): MailMessage
    {
        $order = $this->order;
        $mail->line('**Your order**');
        foreach ($order->items as $item) {
            $mail->line(self::itemLine($item, true));
        }
        $mail->line('Delivery: ' . ((float) $order->shipping_amount > 0 ? self::inr($order->shipping_amount) : 'Free'))
            ->line('**Total: ' . self::inr($order->total) . '** · ' . ($order->payment_status === 'paid' ? 'Paid online' : 'Cash on delivery'));

        $address = implode(', ', array_filter([$order->address, $order->city, $order->state, $order->postal_code]));

        return $mail->line("Delivering to: {$order->customer_name}, {$address}");
    }
}
