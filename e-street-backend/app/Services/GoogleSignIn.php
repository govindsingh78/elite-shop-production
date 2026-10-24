<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Google sign-in with the OAuth 2.0 authorization code flow. The API is the OAuth client and keeps the
 * client secret; the website and the app only ever see our own one-time codes.
 */
class GoogleSignIn
{
    private const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

    public function configured(): bool
    {
        return filled(config('services.google.client_id')) && filled(config('services.google.client_secret'));
    }

    /** Where Google sends the browser back to. It must match an "Authorised redirect URI" on the OAuth client. */
    public function redirectUri(): string
    {
        return config('services.google.redirect') ?: url('/api/auth/google/callback');
    }

    public function authorizationUrl(string $state): string
    {
        return config('services.google.authorize_url') . '?' . http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => $this->redirectUri(),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'prompt' => 'select_account',
        ]);
    }

    /**
     * Trades Google's authorization code for the person's verified Google profile. The ID token comes
     * straight from Google's token endpoint over TLS, so checking who it was issued to and its expiry is enough.
     *
     * @return array{sub: string, email: string, name: string}
     */
    public function profile(string $code): array
    {
        $response = Http::asForm()->acceptJson()->timeout(15)->post(config('services.google.token_url'), [
            'code' => $code,
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'redirect_uri' => $this->redirectUri(),
            'grant_type' => 'authorization_code',
        ]);

        $claims = $response->successful() ? $this->claims((string) $response->json('id_token')) : null;
        if (
            !$claims
            || ($claims['aud'] ?? null) !== config('services.google.client_id')
            || !in_array($claims['iss'] ?? null, self::ISSUERS, true)
            || (int) ($claims['exp'] ?? 0) < time()
            || blank($claims['sub'] ?? null)
        ) {
            throw new RuntimeException('Google couldn’t confirm the sign-in. Please try again.');
        }

        $email = strtolower(trim((string) ($claims['email'] ?? '')));
        if ($email === '' || !filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            throw new RuntimeException('Your Google account’s email address isn’t verified yet. Verify it with Google, then try again.');
        }

        return [
            'sub' => (string) $claims['sub'],
            'email' => $email,
            'name' => trim((string) ($claims['name'] ?? '')) ?: strstr($email, '@', true),
        ];
    }

    /** The payload of a JWT, or null if it isn't one. */
    private function claims(string $jwt): ?array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return null;
        }
        $payload = json_decode((string) base64_decode(strtr($parts[1], '-_', '+/')), true);

        return is_array($payload) ? $payload : null;
    }
}
