<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderTrackingEvent;
use App\Models\User;
use App\Notifications\AdminNewOrder;
use App\Notifications\OrderPlaced;
use App\Notifications\OrderProgress;
use App\Notifications\SellerNewOrder;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification as Notifications;
use Throwable;

use function Illuminate\Support\defer;

/**
 * Sends store messages (email, push and inbox; see App\Notifications\StoreMessage). Messages go out once the
 * data is saved and after the reply has been sent, so nobody waits on email, and a failed email never
 * breaks the request.
 */
class Messenger
{
    /** @param mixed $recipients a user, an on-demand route (guest email), or a list of them */
    public static function send(mixed $recipients, Notification $message): void
    {
        $recipients = collect($recipients instanceof Collection || is_array($recipients) ? $recipients : [$recipients])->filter()->values();
        if ($recipients->isEmpty()) {
            return;
        }

        DB::afterCommit(fn () => defer(function () use ($recipients, $message) {
            foreach ($recipients as $recipient) {
                try {
                    $recipient->notify($message);
                } catch (Throwable $exception) {
                    Log::warning('Message not sent', ['message' => $message::class, 'error' => $exception->getMessage()]);
                }
            }
        }));
    }

    /**
     * An order is confirmed: cash on delivery at checkout, online orders once paid. Tells the shopper, each
     * seller with products in it, and the admins, once per order however many times it's called.
     */
    public static function orderPlaced(Order $order): void
    {
        $claimed = Order::query()->whereKey($order->id)->whereNull('confirmation_sent_at')->update(['confirmation_sent_at' => now()]);
        if (!$claimed) {
            return;
        }
        $order->load(['items', 'user']);

        self::send(self::shopper($order), new OrderPlaced($order));
        $order->items->whereNotNull('vendor_id')->groupBy('vendor_id')->each(
            fn (Collection $items, $vendorId) => self::send(User::find($vendorId), new SellerNewOrder($order, $items->values())),
        );
        self::send(User::storeAdmins(), new AdminNewOrder($order));
    }

    /** A tracking milestone worth telling the shopper about (see OrderProgress::MILESTONES). */
    public static function orderProgress(Order $order, OrderTrackingEvent $event): void
    {
        if (!OrderProgress::covers($event->status)) {
            return;
        }
        $order->loadMissing(['items', 'user']);
        self::send(self::shopper($order), new OrderProgress($order, $event->status));
    }

    /** The shopper's account, or for a guest order the email address they gave. */
    private static function shopper(Order $order): mixed
    {
        return $order->user ?? Notifications::route('mail', $order->customer_email);
    }
}
