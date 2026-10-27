<?php

namespace App\Notifications;

use App\Mail\BrandedMail;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly string $token)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim((string) config('app.frontend_url'), '/')
            . '/reset-password?token=' . urlencode($this->token)
            . '&email=' . urlencode($notifiable->getEmailForPasswordReset());

        $name = trim(explode(' ', (string) $notifiable->name)[0] ?? '');

        return BrandedMail::message('Reset your Elitezaar password', 'Reset your password', [
            'eyebrow' => 'Account security',
            'greeting' => $name !== '' ? "Hello {$name}," : 'Hello,',
            'paragraphs' => ['We received a request to reset the password for your Elitezaar account. Choose a new one with the button below.'],
            'sections' => [['type' => 'note', 'tone' => 'info', 'text' => 'This link works for ' . config('auth.passwords.users.expire') . ' minutes and can be used once.']],
            'action' => ['label' => 'Reset password', 'url' => $url],
            'after' => ['Didn’t ask for this? You can ignore this email — your password stays the same. If you keep getting these, contact us.'],
            'audience' => BrandedMail::audience($notifiable),
        ]);
    }
}
