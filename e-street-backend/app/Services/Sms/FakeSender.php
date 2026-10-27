<?php

namespace App\Services\Sms;

/** For tests (SmsSender::fake()): keeps each code it's asked to send instead of sending it. */
class FakeSender extends SmsSender
{
    /** @var array<int, array{phone: string, code: string}> */
    public array $sent = [];

    public bool $failing = false;

    public function configured(): bool
    {
        return true;
    }

    public function sendOtp(string $phone, string $code, int $minutes): void
    {
        if ($this->failing) {
            throw new \RuntimeException('The provider is down.');
        }
        $this->sent[] = ['phone' => $phone, 'code' => $code];
    }

    /** The last code sent to `$phone`. */
    public function codeFor(string $phone): ?string
    {
        return collect($this->sent)->where('phone', $phone)->last()['code'] ?? null;
    }
}
