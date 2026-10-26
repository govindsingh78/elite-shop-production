<?php

namespace App\Notifications;

use App\Models\LoginBlock;
use Illuminate\Notifications\Messages\MailMessage;

/** To the account's owner: 3 wrong passwords locked their account, and how to unlock it. */
class AccountLocked extends StoreMessage
{
    public function __construct(public LoginBlock $block, public string $ip, public ?string $device)
    {
    }

    public function kind(): string
    {
        return 'security';
    }

    public function title(): string
    {
        return 'Your Elitezaar account was locked';
    }

    public function body(): string
    {
        $until = $this->block->blocked_until->copy()->timezone('Asia/Kolkata')->format('j M, g:i a');

        return "Someone entered the wrong password for your account {$this->block->attempts} times, so signing in with a password is blocked until {$until} (India time). If it was you, reset your password to unlock it now. If it wasn’t, your account is safe — but choose a password you don’t use anywhere else.";
    }

    protected function mailDetails(MailMessage $mail): MailMessage
    {
        return $mail->line('Last attempt from: ' . ($this->device ? "{$this->device}, " : '') . "IP address {$this->ip}.");
    }

    public function webPath(): ?string
    {
        return '/forgot-password';
    }

    public function appPath(): ?string
    {
        return '/forgot-password';
    }

    protected function actionLabel(): string
    {
        return 'Reset your password';
    }
}
