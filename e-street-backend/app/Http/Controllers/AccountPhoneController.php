<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Security\PhoneOtp;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * The signed-in user's sign-in phone number (shoppers, sellers and admins alike): confirming it with a code so
 * it can be used to sign in, or turning that off.
 */
class AccountPhoneController extends Controller
{
    public function show(Request $request)
    {
        return response()->json($this->state($request->user()));
    }

    public function send(Request $request)
    {
        $user = $request->user();
        $phone = $this->phone($request);
        abort_unless(PhoneOtp::enabled(), 503, 'Signing in with a mobile number isn’t available right now.');
        $this->ensureFree($phone, $user);

        $result = PhoneOtp::send($phone, 'verify', $user, null, $request);
        if (!$result['sent']) {
            return response()->json(['message' => $result['message'], 'retry_after' => $result['retry_after'] ?? null], isset($result['retry_after']) ? 429 : 503);
        }

        return response()->json([
            'message' => 'We’ve sent a ' . PhoneOtp::LENGTH . '-digit code to ' . PhoneOtp::display($phone) . '. It works for ' . PhoneOtp::MINUTES . ' minutes.',
            'resend_in' => PhoneOtp::RESEND_SECONDS,
        ]);
    }

    public function verify(Request $request)
    {
        $user = $request->user();
        $phone = $this->phone($request);
        $code = $request->validate(['code' => ['required', 'string', 'regex:/^\s*\d{' . PhoneOtp::LENGTH . '}\s*$/']], ['code.regex' => 'Enter the ' . PhoneOtp::LENGTH . '-digit code from the SMS.'])['code'];

        $result = PhoneOtp::check($phone, 'verify', null, $code);
        if (!$result['ok'] || $result['user_id'] !== $user->id) {
            throw ValidationException::withMessages(['code' => $result['error'] ?? 'That code isn’t right.']);
        }
        $this->ensureFree($phone, $user);
        $user->forceFill(['phone' => PhoneOtp::display($phone), 'phone_verified_at' => now()])->save();

        return response()->json([
            'message' => 'Your number is confirmed. You can now sign in with it and a code.',
            ...$this->state($user->fresh()),
        ]);
    }

    /** Turns off signing in with the phone (the number stays on the account for deliveries). */
    public function destroy(Request $request)
    {
        $request->user()->forceFill(['phone_verified_at' => null])->save();

        return response()->json(['message' => 'Signing in with your mobile number is off.', ...$this->state($request->user()->fresh())]);
    }

    private function state(User $user): array
    {
        return [
            'phone' => $user->phone_e164 ? PhoneOtp::display($user->phone_e164) : $user->phone,
            'verified' => $user->phone_verified_at !== null && $user->phone_e164 !== null,
            'verified_at' => $user->phone_verified_at?->toIso8601String(),
            'available' => PhoneOtp::enabled(),
        ];
    }

    private function phone(Request $request): string
    {
        $phone = PhoneOtp::normalise($request->validate(['phone' => ['required', 'string', 'max:20']])['phone']);
        if (!$phone) {
            throw ValidationException::withMessages(['phone' => 'Enter a 10-digit Indian mobile number.']);
        }

        return $phone;
    }

    /** A number signs in to one account per portal, so it can't already be confirmed by another one there. */
    private function ensureFree(string $phone, User $user): void
    {
        $portals = array_filter(['customer', 'vendor', 'admin'], fn (string $portal) => $user->canUsePortal($portal));
        $taken = User::query()->where('phone_e164', $phone)->whereNotNull('phone_verified_at')->where('id', '!=', $user->id)->get()
            ->contains(fn (User $other) => collect($portals)->contains(fn (string $portal) => $other->canUsePortal($portal)));
        if ($taken) {
            throw ValidationException::withMessages(['phone' => 'This number already signs in to another account. Use a different number, or contact Elitezaar support.']);
        }
    }
}
