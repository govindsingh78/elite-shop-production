<?php

namespace App\Services\Sms\Senders;

use App\Services\Sms\SmsSender;
use Illuminate\Support\Facades\Log;

/** Development only: nothing is sent, the code is written to the log (storage/logs) for you to type in. */
class LogSender extends SmsSender
{
    public function configured(): bool
    {
        return true;
    }

    public function sendOtp(string $phone, string $code, int $minutes): void
    {
        Log::info("SMS to {$phone}: " . self::message($code, $minutes));
    }
}
