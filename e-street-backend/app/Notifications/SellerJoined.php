<?php

namespace App\Notifications;

use App\Models\User;

/** To the store admins: someone opened a seller account and needs approving. */
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
        return "New seller to approve: {$this->seller->name}";
    }

    public function body(): string
    {
        return "{$this->seller->email} just opened a seller account and is waiting for your approval. They can’t list products until you approve them.";
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
