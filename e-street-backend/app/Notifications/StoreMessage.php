<?php

namespace App\Notifications;

use App\Mail\BrandedMail;
use App\Models\OrderItem;
use App\Notifications\Channels\ExpoPushChannel;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A message from Elitezaar to a shopper, seller or admin: an email, a push notification on the phones
 * they use the app on, and an entry in their in-app inbox. Guests (an order's email address) get the email.
 */
abstract class StoreMessage extends Notification
{
    /** "order", "listing", "payout" or "seller": picks the icon in the app's inbox. */
    abstract public function kind(): string;

    /** Short headline, for push, the inbox and (unless subject() differs) the email subject. */
    abstract public function title(): string;

    /** One or two sentences. */
    abstract public function body(): string;

    /** Where the message leads on the website, e.g. /customer/orders/12; null for no link. */
    abstract public function webPath(): ?string;

    /** Where it leads in the app (an app route such as /customer/orders/12); null for no link. */
    abstract public function appPath(): ?string;

    public function via(object $notifiable): array
    {
        return $notifiable instanceof AnonymousNotifiable ? ['mail'] : ['database', ExpoPushChannel::class, 'mail'];
    }

    public function subject(): string
    {
        return $this->title();
    }

    protected function actionLabel(): string
    {
        return 'View details';
    }

    /** The small label above the email's headline. */
    protected function eyebrow(): string
    {
        return match ($this->kind()) {
            'order' => 'Order update',
            'listing' => 'Catalogue',
            'payout' => 'Payouts',
            'seller' => 'Seller account',
            'server' => 'Server & health',
            'security' => 'Account security',
            default => 'Elitezaar',
        };
    }

    /** Details below the message (items, totals, addresses…), as sections of App\Mail\BrandedMail. */
    protected function mailSections(): array
    {
        return [];
    }

    protected function greetingName(object $notifiable): ?string
    {
        return $notifiable->name ?? null;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $name = trim(explode(' ', (string) $this->greetingName($notifiable))[0] ?? '');
        $path = $this->webPath();

        return BrandedMail::message($this->subject(), $this->title(), [
            'eyebrow' => $this->eyebrow(),
            'greeting' => $name !== '' ? "Hello {$name}," : 'Hello,',
            'paragraphs' => [$this->body()],
            'sections' => $this->mailSections(),
            'action' => $path ? ['label' => $this->actionLabel(), 'url' => self::siteUrl($path)] : null,
            'audience' => BrandedMail::audience($notifiable),
        ]);
    }

    /**
     * Order lines for an "items" section: the product, its size and quantity, and the line total.
     *
     * @param iterable<OrderItem> $items
     */
    protected static function itemRows(iterable $items, bool $withAmounts = true): array
    {
        return collect($items)->map(fn (OrderItem $item) => [
            'name' => $item->product_title,
            'meta' => implode(' · ', array_filter([$item->size ? "Size {$item->size}" : null, "Qty {$item->quantity}"])),
            'amount' => $withAmounts ? self::inr($item->line_total) : null,
        ])->values()->all();
    }

    /** Kept for the in-app inbox. */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind(),
            'title' => $this->title(),
            'body' => $this->body(),
            'url' => $this->webPath(),
            'app_url' => $this->appPath(),
        ];
    }

    public function toPush(object $notifiable): array
    {
        return [
            'title' => $this->title(),
            'body' => $this->body(),
            // The app opens `url` when the notification is tapped, and marks the inbox entry read.
            'data' => array_filter(['url' => $this->appPath(), 'notification_id' => $this->id]),
        ];
    }

    /** "Classic Linen Shirt (size M) × 2", optionally with the line total. */
    protected static function itemLine(OrderItem $item, bool $withTotal = false): string
    {
        $size = $item->size ? " (size {$item->size})" : '';

        return "{$item->product_title}{$size} × {$item->quantity}" . ($withTotal ? ' — ' . self::inr($item->line_total) : '');
    }

    public static function siteUrl(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/') . $path;
    }

    /** 152500.5 → "₹1,52,500.50", grouped the Indian way like the website. */
    public static function inr(float|int|string|null $amount): string
    {
        [$whole, $paise] = explode('.', number_format((float) $amount, 2, '.', ''));
        if (strlen($whole) > 3) {
            $whole = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', substr($whole, 0, -3)) . ',' . substr($whole, -3);
        }

        return "₹{$whole}.{$paise}";
    }
}
