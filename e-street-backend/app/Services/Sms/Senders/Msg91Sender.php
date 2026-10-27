<?php

namespace App\Services\Sms\Senders;

use App\Services\Sms\SmsSender;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * MSG91's OTP API (msg91.com), with our own code in a DLT-approved template that has an ##OTP## variable.
 * .env: MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID.
 */
class Msg91Sender extends SmsSender
{
    public function __construct(private array $config)
    {
    }

    public function configured(): bool
    {
        return filled($this->config['authkey'] ?? null) && filled($this->config['template_id'] ?? null);
    }

    public function sendOtp(string $phone, string $code, int $minutes): void
    {
        $response = Http::timeout(10)->acceptJson()->get('https://api.msg91.com/api/v5/otp', [
            'authkey' => $this->config['authkey'],
            'template_id' => $this->config['template_id'],
            'mobile' => ltrim($phone, '+'),
            'otp' => $code,
            'otp_expiry' => $minutes,
        ]);

        if (!$response->successful() || $response->json('type') !== 'success') {
            throw new RuntimeException('MSG91 refused the SMS: ' . ($response->json('message') ?: "HTTP {$response->status()}"));
        }
    }
}
