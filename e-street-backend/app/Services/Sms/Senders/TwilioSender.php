<?php

namespace App\Services\Sms\Senders;

use App\Services\Sms\SmsSender;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Twilio's Messages API (twilio.com). For Indian numbers, the sender must be registered for DLT with Twilio.
 * .env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM.
 */
class TwilioSender extends SmsSender
{
    public function __construct(private array $config)
    {
    }

    public function configured(): bool
    {
        return filled($this->config['sid'] ?? null) && filled($this->config['token'] ?? null)
            && (filled($this->config['messaging_service_sid'] ?? null) || filled($this->config['from'] ?? null));
    }

    public function sendOtp(string $phone, string $code, int $minutes): void
    {
        $sender = filled($this->config['messaging_service_sid'] ?? null)
            ? ['MessagingServiceSid' => $this->config['messaging_service_sid']]
            : ['From' => $this->config['from']];
        $response = Http::timeout(10)->asForm()->withBasicAuth($this->config['sid'], $this->config['token'])
            ->post("https://api.twilio.com/2010-04-01/Accounts/{$this->config['sid']}/Messages.json", [
                'To' => $phone,
                'Body' => self::message($code, $minutes),
                ...$sender,
            ]);

        if (!$response->successful()) {
            throw new RuntimeException('Twilio refused the SMS: ' . ($response->json('message') ?: "HTTP {$response->status()}"));
        }
    }
}
