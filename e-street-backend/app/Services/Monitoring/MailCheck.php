<?php

namespace App\Services\Monitoring;

use App\Mail\TestEmail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

/** Sends a test email and, if it fails, says why in plain words (covering Amazon SES's usual answers). */
class MailCheck
{
    /** @return array{sent: bool, message: string, error?: string} */
    public static function send(string $to): array
    {
        if (config('mail.default') === 'log') {
            return ['sent' => false, 'message' => 'Emails aren’t being sent: MAIL_MAILER is “log”, so they only go into the log file. Add the SMTP details to the backend’s .env, then run php artisan config:cache.'];
        }

        try {
            Mail::to($to)->send(new TestEmail());
        } catch (Throwable $exception) {
            return ['sent' => false, 'message' => self::explain($exception->getMessage()), 'error' => Str::limit($exception->getMessage(), 500)];
        }

        return ['sent' => true, 'message' => "Test email sent to {$to} from " . config('mail.from.address') . '. Check the inbox, and the spam folder if it isn’t there in a minute.'];
    }

    private static function explain(string $error): string
    {
        return match (true) {
            str_contains($error, '535') => 'The mail server refused the username or password. For Amazon SES, use the SMTP credentials SES created (not your AWS access keys), from the same region as MAIL_HOST.',
            str_contains($error, 'not verified') => 'Amazon SES refused it because an address isn’t verified. Verify elitezaar.com in SES (in the same region as MAIL_HOST) and send from an @elitezaar.com address. Until SES gives you production access, it only delivers to addresses you’ve verified too.',
            str_contains($error, 'quota') || str_contains($error, 'sending rate') => 'Amazon SES’s sending limit was reached. Ask for a higher limit in the SES console.',
            str_contains($error, 'Connection could not be established') || stripos($error, 'timed out') !== false => 'Couldn’t connect to the mail server. Check MAIL_HOST and MAIL_PORT (587 for Amazon SES), and that the server can make outgoing connections on that port.',
            default => 'The email couldn’t be sent: ' . Str::limit($error, 300),
        };
    }
}
