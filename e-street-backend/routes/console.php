<?php

use App\Models\User;
use Illuminate\Foundation\Console\ClosureCommand;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    /** @var ClosureCommand $this */
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Makes an approved address (config/admin.php) a store admin, creating the account if needed, e.g. to get
 * back into the admin portal. It always sets a new password and signs out every existing session, so an
 * account someone else registered with that address can't keep its access.
 */
Artisan::command('admin:grant {email}', function (string $email) {
    /** @var ClosureCommand $this */
    $email = strtolower(trim($email));
    if (!User::isApprovedAdminEmail($email)) {
        $this->error("{$email} isn't an approved admin address. Approved: " . implode(', ', config('admin.emails')));

        return 1;
    }

    $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
    $password = (string) $this->secret("New password for {$email} (at least 8 characters)");
    if (strlen($password) < 8 || $password !== (string) $this->secret('Type the password again')) {
        $this->error('The passwords must match and be at least 8 characters. Nothing was changed.');

        return 1;
    }

    $user ??= new User(['name' => $this->ask('Name for the new admin account', 'Govind Singh'), 'email' => $email]);
    $user->forceFill(['role' => 'admin', 'password' => $password])->save();
    $user->tokens()->delete();

    $this->info("{$email} is now an admin. Sign in at /admin/login with the new password.");

    return 0;
})->purpose('Make an approved email address a store admin and set its password');
