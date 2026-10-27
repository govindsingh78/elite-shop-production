<?php

namespace App\Notifications;

use App\Models\Order;

/** To the shopper: their order reached a milestone worth hearing about (dispatched, out for delivery…). */
class OrderProgress extends StoreMessage
{
    /** The tracking milestones that send a message. Packing and transit scans don't, to keep it to what matters. */
    public const MILESTONES = ['confirmed', 'dispatched', 'out_for_delivery', 'delivery_attempted', 'delivered', 'cancelled'];

    public function __construct(public Order $order, public string $milestone)
    {
    }

    public static function covers(string $milestone): bool
    {
        return in_array($milestone, self::MILESTONES, true);
    }

    public function kind(): string
    {
        return 'order';
    }

    public function title(): string
    {
        $id = $this->order->id;

        return match ($this->milestone) {
            'confirmed' => "Order #{$id} is being prepared",
            'dispatched' => "Order #{$id} is on its way",
            'out_for_delivery' => "Order #{$id} arrives today",
            'delivery_attempted' => "We missed you — order #{$id}",
            'delivered' => "Order #{$id} delivered",
            'cancelled' => "Order #{$id} cancelled",
        };
    }

    public function body(): string
    {
        $order = $this->order;
        $cod = $order->payment_method === 'cod' && $order->payment_status !== 'paid';

        return match ($this->milestone) {
            'confirmed' => 'Good news: your order is confirmed and we’re getting it ready to ship.',
            'dispatched' => 'Your order has left us' . ($order->courier_name ? " with {$order->courier_name}" : '')
                . ($order->tracking_number ? " (tracking number {$order->tracking_number})" : '') . '. We’ll tell you when it’s out for delivery.',
            'out_for_delivery' => 'Your order is out for delivery and should reach you today. Please keep your phone handy'
                . ($cod ? ' and ' . self::inr($order->total) . ' ready for cash on delivery.' : '.'),
            'delivery_attempted' => 'Our delivery partner tried to deliver your order but couldn’t reach you. They’ll try again soon; call us if you’d like a different time.',
            'delivered' => 'Your order has been delivered. We hope you love it! A quick rating helps other shoppers too.',
            'cancelled' => 'Your order has been cancelled.' . ($order->payment_status === 'paid' ? ' As you paid online, our team will arrange your refund.' : '')
                . ' If this is a surprise, just reply or call us.',
        };
    }

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
        return $this->milestone === 'delivered' ? 'Rate your purchase' : 'Track your order';
    }

    protected function greetingName(object $notifiable): ?string
    {
        return $this->order->customer_name;
    }

    protected function mailSections(): array
    {
        $order = $this->order;
        $sections = [['type' => 'items', 'title' => "Order #{$order->id}", 'items' => self::itemRows($order->items, false)]];
        if (in_array($this->milestone, ['dispatched', 'out_for_delivery', 'delivery_attempted'], true) && ($order->courier_name || $order->tracking_number)) {
            $sections[] = ['type' => 'facts', 'rows' => [
                ['label' => 'Courier', 'value' => $order->courier_name],
                ['label' => 'Tracking number', 'value' => $order->tracking_number],
            ]];
        }
        // Invoices are issued when the order ships.
        if (in_array($this->milestone, ['dispatched', 'delivered'], true)) {
            $invoices = $order->invoices()->where('status', 'issued')->orderBy('id')->get();
            if ($invoices->isNotEmpty()) {
                $sections[] = ['type' => 'links', 'title' => $invoices->count() === 1 ? 'Your invoice' : 'Your invoices', 'links' => $invoices->map(fn ($invoice) => [
                    'label' => "Invoice {$invoice->number}",
                    'url' => self::siteUrl($invoice->printPath()),
                    'hint' => "from {$invoice->supplier['name']}",
                ])->all()];
            }
        }

        return $sections;
    }
}
