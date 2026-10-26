<?php

namespace App\Notifications;

use App\Models\SellerPayout;

/** To a seller: Elitezaar recorded a payment to them. */
class PayoutSent extends StoreMessage
{
    private const METHODS = ['upi' => 'UPI', 'bank_transfer' => 'bank transfer', 'cash' => 'cash', 'other' => 'another method'];

    public function __construct(public SellerPayout $payout)
    {
    }

    public function kind(): string
    {
        return 'payout';
    }

    public function title(): string
    {
        return 'Payment sent: ' . self::inr($this->payout->amount);
    }

    public function body(): string
    {
        $method = self::METHODS[$this->payout->method] ?? null;

        return 'We’ve paid you ' . self::inr($this->payout->amount)
            . ($method ? " by {$method}" : '')
            . ' on ' . $this->payout->paid_on->format('j M Y') . '.'
            . ($this->payout->reference ? " Reference: {$this->payout->reference}." : '');
    }

    public function webPath(): ?string
    {
        return '/vendor/earnings';
    }

    public function appPath(): ?string
    {
        return '/vendor/earnings';
    }

    protected function actionLabel(): string
    {
        return 'See your earnings';
    }
}
