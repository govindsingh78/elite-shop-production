<?php

namespace App\Notifications;

use App\Models\User;

/** To the store admins: someone opened a seller account. */
class SellerJoined extends StoreMessage
{
    public function __construct(public User $seller)
    {
    }

    public function kind(): string
    {
        return 'seller';
    }

    public function title(): string
    {
        return "New seller: {$this->seller->name}";
    }

    public function body(): string
    {
        return "{$this->seller->email} just opened a seller account. Their listings will come to you for review.";
    }

    public function webPath(): ?string
    {
        return '/admin/manage-users';
    }

    public function appPath(): ?string
    {
        return '/admin/users';
    }

    protected function actionLabel(): string
    {
        return 'See sellers';
    }
}
