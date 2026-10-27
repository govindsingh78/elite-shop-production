<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Sent from Server & health (or `php artisan mail:test`) to check the store's emails get through. */
class TestEmail extends Mailable
{
    private const SUBJECT = 'Test email from Elitezaar';

    public function envelope(): Envelope
    {
        return new Envelope(subject: self::SUBJECT);
    }

    public function content(): Content
    {
        $mailer = config('mail.default');

        // The same look as the store's other emails.
        return new Content(view: BrandedMail::VIEWS[0], text: BrandedMail::VIEWS[1], with: BrandedMail::data(self::SUBJECT, 'Your emails are working', [
            'eyebrow' => 'Server & health',
            'paragraphs' => ['This is a test email from Server & health. If you’re reading it, the store’s emails — order confirmations, shipping updates, password resets and seller messages — are getting through.'],
            'sections' => [[
                'type' => 'facts',
                'title' => 'Sent with',
                'rows' => [
                    ['label' => 'Mail service', 'value' => config("mail.mailers.{$mailer}.host") ?: $mailer],
                    ['label' => 'Port', 'value' => (string) config("mail.mailers.{$mailer}.port")],
                    ['label' => 'From', 'value' => trim(config('mail.from.name') . ' <' . config('mail.from.address') . '>')],
                    ['label' => 'Sent', 'value' => now()->timezone('Asia/Kolkata')->format('j M Y, g:i a') . ' (India time)'],
                ],
            ]],
            'audience' => 'admin',
        ]));
    }
}
