<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\GoogleSignIn;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * "Continue with Google" on the shopper, seller and admin sign-in screens of the website and the app.
 *
 * 1. redirect: the browser goes to Google's account chooser.
 * 2. callback: Google returns here; the account is found (or created) and the browser goes back to the
 *    site or app with a one-time code, or with `error` (a message to show) or `cancelled=1`.
 * 3. exchange: the site or app trades that code, plus the PKCE verifier only it knows, for an API token.
 *
 * Shoppers and sellers can sign up this way, as they can with a password. Admin sign-in only matches
 * existing admin accounts.
 */
class GoogleAuthController extends Controller
{
    private const PORTALS = ['customer', 'vendor', 'admin'];
    private const STATE_TTL = 600;
    private const CODE_TTL = 120;

    public function __construct(private GoogleSignIn $google)
    {
    }

    /** Which sign-in options the login screens may offer. */
    public function providers()
    {
        return response()->json(['google' => $this->google->configured()]);
    }

    public function redirect(Request $request)
    {
        $validator = Validator::make($request->query(), [
            'portal' => ['required', Rule::in(self::PORTALS)],
            'return_to' => ['required', 'string', 'max:500'],
            // base64url(SHA-256(verifier)), as in PKCE (RFC 7636).
            'code_challenge' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{43}$/'],
        ]);
        if ($validator->fails() || !$this->allowedReturn($request->query('return_to'))) {
            return response()->json(['message' => 'This Google sign-in link is not valid.'], 422);
        }

        $pending = $validator->validated();
        if (!$this->google->configured()) {
            return $this->sendBack($pending['return_to'], ['error' => 'Google sign-in isn’t available right now.']);
        }

        $state = Str::random(40);
        Cache::put("google-signin:state:{$state}", $pending, self::STATE_TTL);

        return redirect()->away($this->google->authorizationUrl($state));
    }

    public function callback(Request $request)
    {
        $state = (string) $request->query('state');
        $pending = $state !== '' ? Cache::pull("google-signin:state:{$state}") : null;
        if (!is_array($pending)) {
            return $this->sendBack(
                rtrim((string) config('app.frontend_url'), '/') . '/auth/google/callback',
                ['error' => 'That Google sign-in took too long. Please try again.'],
            );
        }

        // The person closed or declined Google's screen.
        if ($request->filled('error') || !$request->filled('code')) {
            return $this->sendBack($pending['return_to'], ['cancelled' => 1]);
        }

        try {
            $profile = $this->google->profile((string) $request->query('code'));
            [$user, $created] = $this->resolveAccount($profile, $pending['portal']);
        } catch (RuntimeException $exception) {
            return $this->sendBack($pending['return_to'], ['error' => $exception->getMessage()]);
        }

        $code = Str::random(48);
        Cache::put("google-signin:code:{$code}", [
            'user_id' => $user->id,
            'portal' => $pending['portal'],
            'challenge' => $pending['code_challenge'],
            'created' => $created,
        ], self::CODE_TTL);

        return $this->sendBack($pending['return_to'], ['code' => $code]);
    }

    public function exchange(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:100'],
            'code_verifier' => ['required', 'string', 'min:43', 'max:128'],
        ]);

        // One attempt per code, whether or not the verifier matches.
        $pending = Cache::pull("google-signin:code:{$validated['code']}");
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $validated['code_verifier'], true)), '+/', '-_'), '=');
        $user = is_array($pending) && hash_equals($pending['challenge'], $challenge) ? User::find($pending['user_id']) : null;

        if (!$user || !$user->canUsePortal($pending['portal'])) {
            return response()->json(['message' => 'This Google sign-in has expired. Please try again.'], 422);
        }

        return $pending['created']
            ? AuthController::sessionResponse($user, $pending['portal'], 'Your account has been created with Google.', 201)
            : AuthController::sessionResponse($user, $pending['portal']);
    }

    /**
     * The account for this Google profile on this portal, linking or creating it as needed.
     *
     * @return array{0: User, 1: bool} the account, and whether it was just created
     */
    private function resolveAccount(array $profile, string $portal): array
    {
        $user = User::where('google_id', $profile['sub'])->first()
            ?? User::whereRaw('LOWER(email) = ?', [$profile['email']])->first();

        if ($user) {
            if ($user->google_id && $user->google_id !== $profile['sub']) {
                throw new RuntimeException("{$profile['email']} is already linked to a different Google account.");
            }
            if (!$user->canUsePortal($portal)) {
                throw new RuntimeException($this->wrongPortalMessage($user, $portal, $profile['email']));
            }
            $user->forceFill(['google_id' => $profile['sub'], 'email_verified_at' => $user->email_verified_at ?? now()])->save();

            return [$user, false];
        }

        if ($portal === 'admin') {
            throw new RuntimeException("There’s no admin account for {$profile['email']}.");
        }

        $user = User::create([
            'name' => $profile['name'],
            'email' => $profile['email'],
            // Never used: they sign in with Google, or set a password with "Forgot password".
            'password' => Str::random(40),
            'role' => $portal === 'vendor' ? 'seller' : 'customer',
        ]);
        $user->forceFill(['google_id' => $profile['sub'], 'email_verified_at' => now()])->save();

        return [$user, true];
    }

    private function wrongPortalMessage(User $user, string $portal, string $email): string
    {
        if ($portal === 'admin') {
            return "{$email} doesn’t have admin access.";
        }

        return match (true) {
            $user->hasAdminRole() => "{$email} is a staff account. Please use the admin sign-in.",
            $user->canUsePortal('vendor') => "{$email} is a seller account. Please use the seller sign-in.",
            default => "{$email} is a shopper account. Please use the shopper sign-in.",
        };
    }

    /** Only the website's callback page and the app may receive sign-in codes. */
    private function allowedReturn(mixed $url): bool
    {
        if (!is_string($url) || $url === '') {
            return false;
        }
        $base = preg_split('/[?#]/', $url, 2)[0];

        foreach (config('services.google.return_urls', []) as $allowed) {
            // A bare scheme such as "exp://" allows any address with it (development only).
            if (str_ends_with($allowed, '://') ? str_starts_with($url, $allowed) : $base === $allowed) {
                return true;
            }
        }

        return false;
    }

    private function sendBack(string $url, array $params)
    {
        return redirect()->away($url . (str_contains($url, '?') ? '&' : '?') . http_build_query($params));
    }
}
