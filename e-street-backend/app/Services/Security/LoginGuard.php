<?php

namespace App\Services\Security;

use App\Models\LoginAttempt;
use App\Models\LoginBlock;
use App\Models\User;
use App\Notifications\AccountLocked;
use App\Notifications\NewAdminSignIn;
use App\Services\Messenger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Throwable;

/**
 * Stops password guessing. Every sign-in attempt is logged; 3 wrong passwords in a row for an email lock that
 * account for 24 hours (resetting the password unlocks it straight away), and an address making many wrong
 * attempts across accounts is blocked from signing in for 24 hours. Admins see it all under Admin › Security.
 */
class LoginGuard
{
    /** Wrong passwords in a row before an account is locked. */
    public const MAX_FAILURES = 3;

    /**
     * Wrong passwords from one IP address within an hour (any accounts) before it's blocked from signing in.
     * Higher than for one account: mobile networks share one address between many people.
     */
    public const IP_MAX_FAILURES = 10;

    public const BLOCK_HOURS = 24;

    /** Times in messages are shown in Indian time. */
    private const TIMEZONE = 'Asia/Kolkata';

    private const BLOCKED_IPS_CACHE = 'security.blocked-ips';

    public static function normalise(?string $email): string
    {
        return Str::lower(trim((string) $email));
    }

    /** What stops this sign-in, if anything: a locked account, or a blocked address. */
    public static function blockFor(?string $email, ?string $ip): ?LoginBlock
    {
        $email = self::normalise($email);

        return LoginBlock::query()->active()
            ->where(fn ($query) => $query
                ->where(fn ($account) => $account->where('type', LoginBlock::ACCOUNT)->where('value', $email))
                ->orWhere(fn ($address) => $address->where('type', LoginBlock::IP)->where('value', (string) $ip)))
            ->orderByDesc('blocked_until')
            ->first();
    }

    /**
     * A wrong password: logged, and once there are 3 in a row the account is locked (and its owner told).
     *
     * @return array{remaining: int, block: ?LoginBlock}
     */
    public static function failed(Request $request, ?string $email, ?string $portal, ?User $user, string $method = 'password'): array
    {
        $email = self::normalise($email);
        $ip = (string) $request->ip();
        self::log($request, $email, $portal, $user, $method, LoginAttempt::FAILED);

        // In a row: since the last successful sign-in (by order, as several can happen within a second)…
        $lastSuccess = (int) LoginAttempt::query()->where('email', $email)->where('outcome', LoginAttempt::SUCCESS)->max('id');
        $failures = LoginAttempt::query()->where('email', $email)->where('outcome', LoginAttempt::FAILED)
            ->where('id', '>', $lastSuccess)->where('created_at', '>=', self::streakStart($email))->count();
        $block = null;
        if ($failures >= self::MAX_FAILURES) {
            $block = LoginBlock::query()->create([
                'type' => LoginBlock::ACCOUNT,
                'value' => $email,
                'reason' => "{$failures} wrong passwords in a row",
                'attempts' => $failures,
                'blocked_until' => now()->addHours(self::BLOCK_HOURS),
            ]);
            if ($user) {
                Messenger::send($user, new AccountLocked($block, $ip, self::device($request)));
            }
        }

        $ipBlocked = LoginBlock::query()->active()->where('type', LoginBlock::IP)->where('value', $ip)->exists();
        $ipFailures = LoginAttempt::query()->where('ip', $ip)->where('outcome', LoginAttempt::FAILED)
            ->where('created_at', '>=', self::ipStreakStart($ip))->count();
        if (!$ipBlocked && $ip !== '' && $ipFailures >= self::IP_MAX_FAILURES) {
            $ipBlock = LoginBlock::query()->create([
                'type' => LoginBlock::IP,
                'value' => $ip,
                'reason' => "{$ipFailures} wrong passwords within an hour",
                'attempts' => $ipFailures,
                'blocked_until' => now()->addHours(self::BLOCK_HOURS),
            ]);
            $block ??= $ipBlock;
        }

        return ['remaining' => max(0, self::MAX_FAILURES - $failures), 'block' => $block];
    }

    /** A sign-in turned away because of a block (logged; it doesn't make the block longer). */
    public static function refused(Request $request, ?string $email, ?string $portal, ?User $user, string $method = 'password'): void
    {
        self::log($request, self::normalise($email), $portal, $user, $method, LoginAttempt::BLOCKED);
    }

    /** A successful sign-in: logged, and an admin signing in from a new address is told about it. */
    public static function succeeded(Request $request, User $user, string $portal, string $method = 'password'): void
    {
        $ip = (string) $request->ip();
        $knownAddress = LoginAttempt::query()->where('user_id', $user->id)->where('outcome', LoginAttempt::SUCCESS)
            ->where('ip', $ip)->where('created_at', '>=', now()->subDays(90))->exists();
        $signedInBefore = LoginAttempt::query()->where('user_id', $user->id)->where('outcome', LoginAttempt::SUCCESS)->exists();
        self::log($request, self::normalise($user->email), $portal, $user, $method, LoginAttempt::SUCCESS);

        if ($portal === 'admin' && $signedInBefore && !$knownAddress) {
            Messenger::send($user, new NewAdminSignIn($ip, self::device($request), $method));
        }
    }

    /** Unlocks an account, e.g. after its password was reset, which proves the email's owner is asking. */
    public static function release(?string $email, string $reason): int
    {
        return LoginBlock::query()->active()->where('type', LoginBlock::ACCOUNT)->where('value', self::normalise($email))
            ->update(['unblocked_at' => now(), 'unblock_reason' => $reason]);
    }

    /** What the person trying to sign in is told. */
    public static function message(LoginBlock $block): string
    {
        $until = $block->blocked_until?->copy()->timezone(self::TIMEZONE)->format('j M, g:i a');

        if ($block->type === LoginBlock::ACCOUNT) {
            return "This account is locked after too many wrong passwords, until {$until} (India time). Reset your password to unlock it now, or contact Elitezaar support.";
        }

        return $until
            ? "Too many wrong sign-in attempts from your network, so signing in is blocked until {$until} (India time). Contact Elitezaar support if this is a mistake."
            : 'Signing in from your network has been blocked. Contact Elitezaar support if this is a mistake.';
    }

    /** The message for a wrong password, saying how many tries are left before the account locks. */
    public static function wrongPasswordMessage(int $remaining): string
    {
        return $remaining === 1
            ? 'Wrong email or password. 1 more wrong attempt will lock this account for 24 hours.'
            : "Wrong email or password. {$remaining} attempts left before this account is locked for 24 hours.";
    }

    /** IP addresses an admin has blocked from the whole store (checked on every request, so kept in cache). */
    public static function blockedIps(): array
    {
        try {
            return Cache::remember(self::BLOCKED_IPS_CACHE, 60, fn () => LoginBlock::query()->active()
                ->where('type', LoginBlock::IP)->where('scope', LoginBlock::ALL)->pluck('value')->all());
        } catch (Throwable) {
            // The list can't be read (e.g. mid-deploy): let everyone through rather than take the store down.
            return [];
        }
    }

    public static function forgetBlockedIps(): void
    {
        Cache::forget(self::BLOCKED_IPS_CACHE);
    }

    /** …and since the account was last locked or unlocked, and only within a day. */
    private static function streakStart(string $email): Carbon
    {
        $times = [
            now()->subHours(self::BLOCK_HOURS),
            LoginBlock::query()->where('type', LoginBlock::ACCOUNT)->where('value', $email)->max('created_at'),
            LoginBlock::query()->where('type', LoginBlock::ACCOUNT)->where('value', $email)->max('unblocked_at'),
        ];

        return collect($times)->filter()->map(fn ($time) => Carbon::parse($time))->max();
    }

    private static function ipStreakStart(string $ip): Carbon
    {
        $times = [
            now()->subHour(),
            LoginBlock::query()->where('type', LoginBlock::IP)->where('value', $ip)->max('created_at'),
            LoginBlock::query()->where('type', LoginBlock::IP)->where('value', $ip)->max('unblocked_at'),
        ];

        return collect($times)->filter()->map(fn ($time) => Carbon::parse($time))->max();
    }

    private static function log(Request $request, string $email, ?string $portal, ?User $user, string $method, string $outcome): void
    {
        LoginAttempt::query()->create([
            'email' => $email !== '' ? Str::limit($email, 250, '') : null,
            'user_id' => $user?->id,
            'portal' => $portal,
            'method' => $method,
            'outcome' => $outcome,
            'ip' => $request->ip(),
            'device' => self::device($request),
        ]);
    }

    /** "Chrome 141 · Windows", "Android app"… from the browser's or app's user agent. */
    public static function device(Request $request): ?string
    {
        $agent = (string) $request->userAgent();
        if ($agent === '') {
            return null;
        }
        if (preg_match('/okhttp|Dalvik/i', $agent)) {
            return 'Android app';
        }
        if (preg_match('/CFNetwork|Darwin/i', $agent)) {
            return 'iPhone app';
        }
        $browser = collect(['/Edg\/(\d+)/' => 'Edge', '/SamsungBrowser\/(\d+)/' => 'Samsung Internet', '/Chrome\/(\d+)/' => 'Chrome', '/Firefox\/(\d+)/' => 'Firefox', '/Version\/(\d+).*Safari/' => 'Safari'])
            ->map(fn ($name, $pattern) => preg_match($pattern, $agent, $match) ? "{$name} {$match[1]}" : null)->filter()->first();
        $system = collect(['/Android/' => 'Android', '/iPhone|iPad/' => 'iOS', '/Windows/' => 'Windows', '/Mac OS/' => 'macOS', '/Linux/' => 'Linux'])
            ->map(fn ($name, $pattern) => preg_match($pattern, $agent) ? $name : null)->filter()->first();

        return Str::limit(implode(' · ', array_filter([$browser ?? 'Other', $system])) ?: $agent, 115, '…');
    }
}
