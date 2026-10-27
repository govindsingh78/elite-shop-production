<?php

namespace App\Notifications;

use App\Models\User;

/** To the store admins: someone opened a seller account and needs approving. */
class SellerJoined extends StoreMessage
{
    /** @param list<string> $categoryRequests categories they asked for on the sign-up form ("Kids › Footwear") */
    public function __construct(public User $seller, public array $categoryRequests = [])
    {
    }

    public function kind(): string
    {
        return 'seller';
    }

    public function title(): string
    {
        return "New seller to approve: {$this->seller->name}";
    }

    public function body(): string
    {
        $asked = $this->categoryRequests
            ? ' They also asked for new categories: ' . implode(', ', $this->categoryRequests) . ' (see Category requests).'
            : '';

        return "{$this->seller->email} just opened a seller account and is waiting for your approval. They can’t list products until you approve them.{$asked}";
    }

    public function webPath(): ?string
    {
        return '/admin/sellers';
    }

    public function appPath(): ?string
    {
        return '/admin/sellers';
    }

    protected function actionLabel(): string
    {
        return 'Review the application';
    }
}
