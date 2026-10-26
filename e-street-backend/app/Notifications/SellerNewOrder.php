<?php

namespace App\Notifications;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Collection;

/** To a seller: a confirmed order includes their products, so it's time to pack. */
class SellerNewOrder extends StoreMessage
{
    /** @param Collection<int, OrderItem> $items this seller's lines in the order */
    public function __construct(public Order $order, public Collection $items)
    {
    }

    public function kind(): string
    {
        return 'order';
    }

    public function title(): string
    {
        return "New order #{$this->order->id} · " . self::inr($this->items->sum('line_total'));
    }

    public function body(): string
    {
        $count = (int) $this->items->sum('quantity');
        $list = $this->items->take(3)->map(fn (OrderItem $item) => self::itemLine($item))->implode(', ');

        return "You have {$count} " . ($count === 1 ? 'item' : 'items') . " to pack: {$list}"
            . ($this->items->count() > 3 ? ' and more.' : '.');
    }

    public function webPath(): ?string
    {
        return "/vendor/orders/{$this->order->id}";
    }

    public function appPath(): ?string
    {
        return "/vendor/order/{$this->order->id}";
    }

    protected function actionLabel(): string
    {
        return 'View the order';
    }

    protected function mailDetails(MailMessage $mail): MailMessage
    {
        foreach ($this->items as $item) {
            $mail->line(self::itemLine($item, true));
        }

        return $mail->line("Ship to: {$this->order->city}" . ($this->order->state ? ", {$this->order->state}" : '')
            . ' · ' . ($this->order->payment_method === 'cod' ? 'Cash on delivery' : 'Paid online'));
    }
}
