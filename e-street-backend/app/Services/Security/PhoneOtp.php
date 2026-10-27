<?php

namespace App\Services\Security;

use App\Models\User;
use App\Services\Sms\SmsSender;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * One-time codes sent by SMS: to sign in with a mobile number, or to confirm a number while signed in. Codes
 * are 6 digits, last 5 minutes, work once, and die after 3 wrong tries. Sending is limited per number and per
 * address, and only ever to Indian mobile numbers on an account, so nobody can run up an SMS bill.
 */
class PhoneOtp
{
    public const LENGTH = 6;
    public const MINUTES = 5;
    public const RESEND_SECONDS = 30;
    public const MAX_TRIES = 3;
    public const MAX_PER_HOUR = 5;
    public const MAX_PER_DAY = 10;
    public const MAX_PER_ADDRESS_HOUR = 15;

    /** "98765 43210", "+91-98765-43210", "09876543210" → "+919876543210"; null unless an Indian mobile number. */
    public static function normalise(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);
        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            $digits = substr($digits, 2);
        } elseif (strlen($digits) === 11 && str_starts_with($digits, '0')) {
            $digits = substr($digits, 1);
        }

        return preg_match('/^[6-9]\d{9}$/', $digits) ? "+91{$digits}" : null;
    }

    /** "+919876543210" → "+91 98765 43210" */
    public static function display(string $phone): string
    {
        $digits = substr($phone, -10);

        return '+91 ' . substr($digits, 0, 5) . ' ' . substr($digits, 5);
    }

    /** "+919876543210" → "+91 98•••••210", for messages shown before anyone has proved they own the number. */
    public static function mask(string $phone): string
    {
        $digits = substr($phone, -10);

        return '+91 ' . substr($digits, 0, 2) . str_repeat('•', 5) . substr($digits, -3);
    }

    /** Whether codes can be sent: a provider is set up, or (away from the live site) they go to the log. */
    public static function enabled(): bool
    {
        try {
            $sender = SmsSender::make();
        } catch (Throwable) {
            return false;
        }

        return $sender->configured() && (SmsSender::driver() !== 'log' || !app()->environment('production'));
    }

    /**
     * Sends a fresh code (any earlier one stops working).
     *
     * @return array{sent: bool, retry_after?: int, message?: string}
     */
    public static function send(string $phone, string $purpose, User $user, ?string $portal, Request $request): array
    {
        $now = now();
        // Limits count every code sent to the number, whatever it was for.
        $recent = DB::table('otp_challenges')->where('phone', $phone);
        $last = (clone $recent)->max('created_at');
        $wait = $last ? self::RESEND_SECONDS - (int) Carbon::parse($last)->diffInSeconds($now) : 0;
        if ($wait > 0) {
            return ['sent' => false, 'retry_after' => $wait, 'message' => "Please wait {$wait} seconds before asking for another code."];
        }
        if ((clone $recent)->where('created_at', '>=', $now->copy()->subHour())->count() >= self::MAX_PER_HOUR
            || (clone $recent)->where('created_at', '>=', $now->copy()->subDay())->count() >= self::MAX_PER_DAY
            || DB::table('otp_challenges')->where('ip', $request->ip())->where('created_at', '>=', $now->copy()->subHour())->count() >= self::MAX_PER_ADDRESS_HOUR) {
            return ['sent' => false, 'retry_after' => 3600, 'message' => 'Too many codes have been sent. Please try again in an hour, or use your email and password.'];
        }

        $code = str_pad((string) random_int(0, 10 ** self::LENGTH - 1), self::LENGTH, '0', STR_PAD_LEFT);
        (clone $recent)->where('purpose', $purpose)->whereNull('consumed_at')->update(['consumed_at' => $now]);
        $id = DB::table('otp_challenges')->insertGetId([
            'purpose' => $purpose,
            'portal' => $portal,
            'phone' => $phone,
            'user_id' => $user->id,
            'code_hash' => self::hash($code),
            'expires_at' => $now->copy()->addMinutes(self::MINUTES),
            'ip' => $request->ip(),
            'created_at' => $now,
        ]);

        try {
            SmsSender::make()->sendOtp($phone, $code, self::MINUTES);
        } catch (Throwable $exception) {
            DB::table('otp_challenges')->where('id', $id)->update(['consumed_at' => $now]);
            Log::warning('Sign-in code not sent', ['driver' => SmsSender::driver(), 'error' => $exception->getMessage()]);

            return ['sent' => false, 'message' => 'We couldn’t send the code just now. Please try again in a minute, or use your email and password.'];
        }

        return ['sent' => true];
    }

    /**
     * Checks a code. On success it's used up and the user it was sent for is returned.
     *
     * @return array{ok: bool, user_id?: int, error?: string}
     */
    public static function check(string $phone, string $purpose, ?string $portal, string $code): array
    {
        $challenge = DB::table('otp_challenges')->where('phone', $phone)->where('purpose', $purpose)
            ->when($portal, fn ($query) => $query->where('portal', $portal))
            ->whereNull('consumed_at')->where('expires_at', '>', now())
            ->orderByDesc('id')->first();
        if (!$challenge) {
            return ['ok' => false, 'error' => 'This code has expired or was already used. Ask for a new one.'];
        }

        if (hash_equals($challenge->code_hash, self::hash(preg_replace('/\D+/', '', $code)))) {
            DB::table('otp_challenges')->where('id', $challenge->id)->update(['consumed_at' => now()]);

            return ['ok' => true, 'user_id' => (int) $challenge->user_id];
        }

        $attempts = $challenge->attempts + 1;
        DB::table('otp_challenges')->where('id', $challenge->id)->update([
            'attempts' => $attempts,
            // Out of tries: this code no longer works.
            'consumed_at' => $attempts >= self::MAX_TRIES ? now() : null,
        ]);

        return ['ok' => false, 'user_id' => (int) $challenge->user_id, 'error' => $attempts >= self::MAX_TRIES
            ? 'That code isn’t right, and it can’t be tried again. Ask for a new one.'
            : 'That code isn’t right. Check the SMS and try again.'];
    }

    /** Codes are stored only as a keyed hash, so the database alone can't reveal them. */
    private static function hash(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }

    /** Clears out old codes. */
    public static function prune(): void
    {
        DB::table('otp_challenges')->where('created_at', '<', now()->subDays(2))->delete();
    }
}
