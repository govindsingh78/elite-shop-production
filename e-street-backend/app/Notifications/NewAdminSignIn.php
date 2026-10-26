<?php

namespace App\Notifications;

/** To an admin: their account was signed in to from an address it hasn't used lately. */
class NewAdminSignIn extends StoreMessage
{
    public function __construct(public string $ip, public ?string $device, public string $method)
    {
    }

    public function kind(): string
    {
        return 'security';
    }

    public function title(): string
    {
        return 'New sign-in to your admin account';
    }

    public function body(): string
    {
        $how = $this->method === 'google' ? 'with Google' : 'with your password';

        return 'Your Elitezaar admin account was signed in to ' . $how . ' from ' . ($this->device ? "{$this->device}, " : '')
            . "IP address {$this->ip}, at " . now()->timezone('Asia/Kolkata')->format('j M, g:i a') . ' (India time). If this wasn’t you, change your password now and check Admin › Security.';
    }

    public function webPath(): ?string
    {
        return '/admin/security';
    }

    public function appPath(): ?string
    {
        return '/admin/security';
    }

    protected function actionLabel(): string
    {
        return 'Review sign-ins';
    }
}
