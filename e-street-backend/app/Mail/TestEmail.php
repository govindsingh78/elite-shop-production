<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Notifications\Messages\MailMessage;

/** Sent from Server & health (or `php artisan mail:test`) to check the store's emails get through. */
class TestEmail extends Mailable
{
    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Test email from Elitezaar');
    }

    public function content(): Content
    {
        $mailer = config('mail.default');
        $via = config("mail.mailers.{$mailer}.host") ?: $mailer;
        // The same look as the store's other emails.
        $message = (new MailMessage())
            ->greeting('Hello,')
            ->line('This is a test email from Server & health. If you’re reading it, the store’s emails — order confirmations, shipping updates, password resets and seller messages — are getting through.')
            ->line("Sent through {$via} from " . config('mail.from.address') . ' on ' . now()->format('j M Y \a\t g:i a') . '.')
            ->salutation('Warm regards, Team Elitezaar');

        return new Content(htmlString: (string) $message->render());
    }
}
