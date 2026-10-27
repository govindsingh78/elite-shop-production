<?php

namespace App\Services\Sms;

use App\Services\Sms\Senders\LogSender;
use App\Services\Sms\Senders\Msg91Sender;
use App\Services\Sms\Senders\TwilioSender;
use App\Services\Sms\Senders\TwoFactorSender;
use RuntimeException;

/**
 * Sends sign-in codes by SMS through the provider chosen in .env (SMS_DRIVER): msg91 or 2factor (Indian
 * providers that handle the TRAI DLT rules with a registered template), twilio, or log (development: the code
 * is only written to the log).
 */
abstract class SmsSender
{
    public const DRIVERS = ['msg91', '2factor', 'twilio', 'log'];

    /** Sends `$code` to `$phone` (+91…); throws a RuntimeException when the provider refuses it. */
    abstract public function sendOtp(string $phone, string $code, int $minutes): void;

    /** Whether the provider's keys are set. */
    abstract public function configured(): bool;

    public static function driver(): string
    {
        return (string) config('services.sms.driver', 'log');
    }

    /** Tests: SMS go to a FakeSender that keeps them, instead of a provider. */
    private static ?FakeSender $fake = null;

    public static function fake(): FakeSender
    {
        return self::$fake = new FakeSender();
    }

    public static function stopFaking(): void
    {
        self::$fake = null;
    }

    public static function make(): self
    {
        if (self::$fake) {
            return self::$fake;
        }

        return match (self::driver()) {
            'msg91' => new Msg91Sender(config('services.sms.msg91', [])),
            '2factor' => new TwoFactorSender(config('services.sms.2factor', [])),
            'twilio' => new TwilioSender(config('services.sms.twilio', [])),
            'log' => new LogSender(),
            default => throw new RuntimeException('Unknown SMS_DRIVER "' . self::driver() . '". Use one of: ' . implode(', ', self::DRIVERS) . '.'),
        };
    }

    /** The text, for providers that send our own wording (Twilio, the log). */
    protected static function message(string $code, int $minutes): string
    {
        return "{$code} is your Elitezaar sign-in code. It expires in {$minutes} minutes. Never share it with anyone, even Elitezaar staff.";
    }
}
