<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Security\LoginGuard;
use App\Services\Security\PhoneOtp;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Signing in with a mobile number: a 6-digit code is sent by SMS to the number, if it's a confirmed number on
 * an account for that portal, and the code signs in. The same locks as passwords apply (3 wrong codes in a row
 * lock the account for 24 hours), and every attempt is in Admin › Security's sign-in log.
 */
class PhoneLoginController extends Controller
{
    private const PORTALS = ['customer', 'vendor', 'admin'];
    private const NAMES = ['customer' => 'shopper', 'vendor' => 'seller', 'admin' => 'admin'];

    public function send(Request $request)
    {
        ['portal' => $portal, 'phone' => $phone] = $this->validated($request);
        abort_unless(PhoneOtp::enabled(), 503, 'Signing in with a mobile number isn’t available right now. Please use your email and password.');

        $user = $this->account($phone, $portal);
        if ($block = LoginGuard::blockFor($user?->email, $request->ip())) {
            LoginGuard::refused($request, $user?->email, $portal, $user, 'otp');

            return AuthController::blockedResponse($block);
        }

        // Nobody learns whether a number has an account: the reply is the same, but only real accounts get an SMS.
        if ($user) {
            $result = PhoneOtp::send($phone, 'login', $user, $portal, $request);
            if (!$result['sent']) {
                return response()->json(['message' => $result['message'], 'retry_after' => $result['retry_after'] ?? null], isset($result['retry_after']) ? 429 : 503);
            }
        }

        return response()->json([
            'message' => 'If a ' . self::NAMES[$portal] . ' account has confirmed ' . PhoneOtp::mask($phone) . ' for signing in, a ' . PhoneOtp::LENGTH . '-digit code is on its way. It works for ' . PhoneOtp::MINUTES . ' minutes.',
            'resend_in' => PhoneOtp::RESEND_SECONDS,
            'expires_in' => PhoneOtp::MINUTES * 60,
        ]);
    }

    public function verify(Request $request)
    {
        ['portal' => $portal, 'phone' => $phone] = $this->validated($request);
        $code = $request->validate(['code' => ['required', 'string', 'regex:/^\s*\d{' . PhoneOtp::LENGTH . '}\s*$/']], ['code.regex' => 'Enter the ' . PhoneOtp::LENGTH . '-digit code from the SMS.'])['code'];

        $user = $this->account($phone, $portal);
        if ($block = LoginGuard::blockFor($user?->email, $request->ip())) {
            LoginGuard::refused($request, $user?->email, $portal, $user, 'otp');

            return AuthController::blockedResponse($block);
        }

        $result = $user ? PhoneOtp::check($phone, 'login', $portal, $code) : ['ok' => false, 'error' => 'This code has expired or was already used. Ask for a new one.'];
        if (!$result['ok'] || $result['user_id'] !== $user->id) {
            // A wrong code counts like a wrong password: 3 in a row lock the account for 24 hours.
            if ($user && isset($result['user_id'])) {
                $guard = LoginGuard::failed($request, $user->email, $portal, $user, 'otp');
                if ($guard['block']) {
                    return AuthController::blockedResponse($guard['block']);
                }
            }
            throw ValidationException::withMessages(['code' => $result['error'] ?? 'That code isn’t right.']);
        }

        LoginGuard::succeeded($request, $user, $portal, 'otp');

        return AuthController::sessionResponse($user, $portal, 'Signed in with your mobile number.');
    }

    /** @return array{portal: string, phone: string} */
    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'portal' => ['required', Rule::in(self::PORTALS)],
            'phone' => ['required', 'string', 'max:20'],
        ]);
        $phone = PhoneOtp::normalise($validated['phone']);
        if (!$phone) {
            throw ValidationException::withMessages(['phone' => 'Enter a 10-digit Indian mobile number.']);
        }

        return ['portal' => $validated['portal'], 'phone' => $phone];
    }

    /** The one account for this portal that has confirmed this number for signing in. */
    private function account(string $phone, string $portal): ?User
    {
        $accounts = User::query()->where('phone_e164', $phone)->whereNotNull('phone_verified_at')->get()
            ->filter(fn (User $user) => $user->canUsePortal($portal));

        return $accounts->count() === 1 ? $accounts->first() : null;
    }
}
