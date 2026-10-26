<?php

namespace App\Notifications\Channels;

use App\Services\ExpoPush;
use Illuminate\Notifications\Notification;

/** Laravel notification channel: a push notification on every phone the user is signed in on. */
class ExpoPushChannel
{
    public function __construct(private ExpoPush $push)
    {
    }

    public function send(object $notifiable, Notification $notification): void
    {
        if (!method_exists($notification, 'toPush') || !method_exists($notifiable, 'deviceTokens')) {
            return;
        }
        $tokens = $notifiable->deviceTokens()->pluck('token')->all();
        if (!$tokens) {
            return;
        }
        $message = $notification->toPush($notifiable);
        $this->push->send($tokens, $message['title'], $message['body'], $message['data'] ?? []);
    }
}
