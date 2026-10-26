<?php

namespace App\Notifications;

use App\Models\User;

/** To a seller: an admin approved, declined, deactivated or reactivated their seller account. */
class SellerAccountUpdated extends StoreMessage
{
    /** @param string $previous the account's status before this change */
    public function __construct(public User $seller, public string $previous)
    {
    }

    public function kind(): string
    {
        return 'seller';
    }

    private function reactivated(): bool
    {
        return $this->seller->seller_status === User::SELLER_APPROVED && $this->previous === User::SELLER_DEACTIVATED;
    }

    public function title(): string
    {
        return match (true) {
            $this->reactivated() => 'Your seller account is active again',
            $this->seller->seller_status === User::SELLER_APPROVED => 'Your seller account is approved',
            $this->seller->seller_status === User::SELLER_REJECTED => 'Your seller application wasn’t approved',
            default => 'Your seller account has been deactivated',
        };
    }

    public function body(): string
    {
        $reason = $this->seller->seller_status_note ? ' Reason: ' . rtrim($this->seller->seller_status_note, '. ') . '.' : '';

        return match (true) {
            $this->reactivated() => 'You can list products and handle orders again, and your approved products are back in the store.',
            $this->seller->seller_status === User::SELLER_APPROVED => 'Welcome to Elitezaar! You can now list your products. Each listing goes live once our team reviews it.',
            $this->seller->seller_status === User::SELLER_REJECTED => "We couldn’t approve your seller account.{$reason} Contact Elitezaar support if you have questions.",
            default => "Your products are hidden from the store and you can’t change products or orders for now.{$reason} You can still see your orders, earnings and invoices. Contact Elitezaar support if you have questions.",
        };
    }

    public function webPath(): ?string
    {
        return $this->seller->seller_status === User::SELLER_APPROVED && !$this->reactivated() ? '/vendor/products/create' : '/vendor/dashboard';
    }

    public function appPath(): ?string
    {
        return $this->seller->seller_status === User::SELLER_APPROVED && !$this->reactivated() ? '/vendor/product-form' : '/vendor';
    }

    protected function actionLabel(): string
    {
        return $this->seller->seller_status === User::SELLER_APPROVED && !$this->reactivated() ? 'List your first product' : 'Open your seller hub';
    }
}
