<?php

namespace App\Services\Sms\Senders;

use App\Services\Sms\SmsSender;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * 2Factor's OTP SMS API (2factor.in), with our own code, optionally in a named template approved on 2Factor.
 * .env: TWOFACTOR_API_KEY, TWOFACTOR_OTP_TEMPLATE (optional).
 */
class TwoFactorSender extends SmsSender
{
    public function __construct(private array $config)
    {
    }

    public function configured(): bool
    {
        return filled($this->config['api_key'] ?? null);
    }

    public function sendOtp(string $phone, string $code, int $minutes): void
    {
        $url = 'https://2factor.in/API/V1/' . rawurlencode($this->config['api_key']) . '/SMS/' . rawurlencode(substr($phone, -10)) . '/' . rawurlencode($code);
        if (filled($this->config['template'] ?? null)) {
            $url .= '/' . rawurlencode($this->config['template']);
        }
        $response = Http::timeout(10)->acceptJson()->get($url);

        if (!$response->successful() || $response->json('Status') !== 'Success') {
            throw new RuntimeException('2Factor refused the SMS: ' . ($response->json('Details') ?: "HTTP {$response->status()}"));
        }
    }
}
