<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleSignInTest extends TestCase
{
    use RefreshDatabase;

    private const CLIENT_ID = 'test-client.apps.googleusercontent.com';
    private const SITE_RETURN = 'http://localhost:5173/auth/google/callback';
    private const APP_RETURN = 'elitezaar://auth/google';

    /** What the faked Google token endpoint puts in the ID token. */
    private array $claims = [];

    /** Skip the two early migrations that duplicate later tables, so a fresh schema can be built. */
    protected function migrateFreshUsing()
    {
        $stale = ['2025_03_17_082921_create_personal_access_tokens_table.php', '2025_03_17_083746_create_products_table.php'];
        $paths = array_values(array_filter(
            glob(database_path('migrations/*.php')),
            fn ($path) => !in_array(basename($path), $stale, true),
        ));

        return ['--drop-views' => false, '--drop-types' => false, '--seed' => false, '--path' => $paths, '--realpath' => true];
    }

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'app.frontend_url' => 'http://localhost:5173',
            'services.google.client_id' => self::CLIENT_ID,
            'services.google.client_secret' => 'test-secret',
            'services.google.return_urls' => [self::SITE_RETURN, self::APP_RETURN],
        ]);
        $this->fakeGoogleTokenEndpoint();
    }

    /** Google's token endpoint answers with an ID token carrying these claims. */
    private function googleReturns(array $claims): void
    {
        $this->claims = array_merge([
            'iss' => 'https://accounts.google.com',
            'aud' => self::CLIENT_ID,
            'sub' => '1100000000000000001',
            'email' => 'asha@gmail.com',
            'email_verified' => true,
            'name' => 'Asha Verma',
            'exp' => time() + 3600,
        ], $claims);
    }

    private function fakeGoogleTokenEndpoint(): void
    {
        $encode = fn (array $part) => rtrim(strtr(base64_encode(json_encode($part)), '+/', '-_'), '=');

        Http::fake(['oauth2.googleapis.com/*' => fn () => Http::response([
            'access_token' => 'ya29.test',
            'id_token' => $encode(['alg' => 'RS256', 'kid' => 'test']) . '.' . $encode($this->claims) . '.signature',
            'expires_in' => 3599,
        ])]);
    }

    /**
     * Runs the browser part of the flow: our redirect, Google's account chooser, then our callback.
     *
     * @return array{0: array<string, string>, 1: string} the query string sent back to the site or app, and the PKCE verifier
     */
    private function signInThroughGoogle(string $portal, string $returnTo = self::SITE_RETURN, array $googleParams = ['code' => 'google-code']): array
    {
        $verifier = str_repeat('v', 30) . bin2hex(random_bytes(10));
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

        $toGoogle = $this->get('/api/auth/google/redirect?' . http_build_query(['portal' => $portal, 'return_to' => $returnTo, 'code_challenge' => $challenge]))
            ->assertRedirect()
            ->headers->get('Location');
        $this->assertStringStartsWith('https://accounts.google.com/o/oauth2/v2/auth?', $toGoogle);
        parse_str(parse_url($toGoogle, PHP_URL_QUERY), $googleQuery);
        $this->assertSame(self::CLIENT_ID, $googleQuery['client_id']);
        $this->assertSame('openid email profile', $googleQuery['scope']);
        $this->assertStringEndsWith('/api/auth/google/callback', $googleQuery['redirect_uri']);

        $back = $this->get('/api/auth/google/callback?' . http_build_query([...$googleParams, 'state' => $googleQuery['state']]))
            ->assertRedirect()
            ->headers->get('Location');
        $this->assertStringStartsWith($returnTo . '?', $back);
        parse_str(parse_url($back, PHP_URL_QUERY), $returned);

        return [$returned, $verifier];
    }

    public function test_buttons_are_offered_only_once_google_is_configured(): void
    {
        $this->getJson('/api/auth/providers')->assertOk()->assertExactJson(['google' => true]);

        config(['services.google.client_secret' => null]);
        $this->getJson('/api/auth/providers')->assertOk()->assertExactJson(['google' => false]);
    }

    public function test_new_shopper_signs_up_with_google(): void
    {
        $this->googleReturns([]);
        [$returned, $verifier] = $this->signInThroughGoogle('customer');
        $this->assertArrayHasKey('code', $returned);

        $session = $this->postJson('/api/auth/google/exchange', ['code' => $returned['code'], 'code_verifier' => $verifier])
            ->assertCreated()
            ->assertJsonPath('portal', 'customer')
            ->assertJsonPath('user.email', 'asha@gmail.com')
            ->assertJsonPath('user.name', 'Asha Verma')
            ->assertJsonPath('user.role', 'customer')
            ->assertJsonMissingPath('user.google_id')
            ->json();

        $user = User::where('email', 'asha@gmail.com')->firstOrFail();
        $this->assertSame('1100000000000000001', $user->google_id);
        $this->assertNotNull($user->email_verified_at);
        $this->withToken($session['token'])->getJson('/api/customer/wishlist')->assertOk();

        Http::assertSent(fn ($request) => $request['code'] === 'google-code' && $request['client_secret'] === 'test-secret');
    }

    public function test_existing_account_is_linked_and_signed_in(): void
    {
        $existing = User::create(['name' => 'Asha', 'email' => 'Asha@Gmail.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->googleReturns([]);
        [$returned, $verifier] = $this->signInThroughGoogle('customer', self::APP_RETURN);

        $this->postJson('/api/auth/google/exchange', ['code' => $returned['code'], 'code_verifier' => $verifier])
            ->assertOk()
            ->assertJsonPath('user.id', $existing->id);
        $this->assertSame(1, User::count());
        $this->assertSame('1100000000000000001', $existing->fresh()->google_id);

        // Next time the Google account alone identifies them, even after an email change on Google's side.
        $this->googleReturns(['email' => 'asha.verma@gmail.com']);
        [$returned, $verifier] = $this->signInThroughGoogle('customer');
        $this->postJson('/api/auth/google/exchange', ['code' => $returned['code'], 'code_verifier' => $verifier])
            ->assertOk()
            ->assertJsonPath('user.id', $existing->id);
    }

    public function test_code_needs_the_matching_verifier_and_works_once(): void
    {
        $this->googleReturns([]);
        [$returned, $verifier] = $this->signInThroughGoogle('customer');

        $this->postJson('/api/auth/google/exchange', ['code' => $returned['code'], 'code_verifier' => str_repeat('x', 43)])
            ->assertStatus(422);
        // A wrong verifier also uses the code up.
        $this->postJson('/api/auth/google/exchange', ['code' => $returned['code'], 'code_verifier' => $verifier])
            ->assertStatus(422);

        [$returned, $verifier] = $this->signInThroughGoogle('customer');
        $this->postJson('/api/auth/google/exchange', ['code' => $returned['code'], 'code_verifier' => $verifier])->assertOk();
        $this->postJson('/api/auth/google/exchange', ['code' => $returned['code'], 'code_verifier' => $verifier])->assertStatus(422);
    }

    public function test_new_seller_signs_up_from_the_seller_portal(): void
    {
        $this->googleReturns(['email' => 'studio@gmail.com', 'name' => 'Studio Loom']);
        [$returned, $verifier] = $this->signInThroughGoogle('vendor');

        $this->postJson('/api/auth/google/exchange', ['code' => $returned['code'], 'code_verifier' => $verifier])
            ->assertCreated()
            ->assertJsonPath('portal', 'vendor')
            ->assertJsonPath('user.role', 'seller');
    }

    public function test_admin_sign_in_only_matches_existing_admins(): void
    {
        $this->googleReturns(['email' => 'stranger@gmail.com']);
        [$returned] = $this->signInThroughGoogle('admin');
        $this->assertSame('There’s no admin account for stranger@gmail.com.', $returned['error']);
        $this->assertSame(0, User::count());

        $admin = User::create(['name' => 'Meera', 'email' => 'meera@elitezaar.com', 'password' => 'secret123', 'role' => 'superadmin']);
        $this->googleReturns(['email' => 'meera@elitezaar.com', 'sub' => '1100000000000000002']);
        [$returned, $verifier] = $this->signInThroughGoogle('admin');
        $this->postJson('/api/auth/google/exchange', ['code' => $returned['code'], 'code_verifier' => $verifier])
            ->assertOk()
            ->assertJsonPath('portal', 'admin')
            ->assertJsonPath('user.id', $admin->id);
    }

    public function test_accounts_stay_on_their_own_portal(): void
    {
        User::create(['name' => 'Studio', 'email' => 'studio@gmail.com', 'password' => 'secret123', 'role' => 'seller']);
        $this->googleReturns(['email' => 'studio@gmail.com']);

        [$returned] = $this->signInThroughGoogle('customer');
        $this->assertSame('studio@gmail.com is a seller account. Please use the seller sign-in.', $returned['error']);

        [$returned] = $this->signInThroughGoogle('admin');
        $this->assertSame('studio@gmail.com doesn’t have admin access.', $returned['error']);
    }

    public function test_untrusted_google_answers_are_refused(): void
    {
        $this->googleReturns(['email_verified' => false]);
        [$returned] = $this->signInThroughGoogle('customer');
        $this->assertStringContainsString('isn’t verified', $returned['error']);

        $this->googleReturns(['aud' => 'someone-elses-client.apps.googleusercontent.com']);
        [$returned] = $this->signInThroughGoogle('customer');
        $this->assertSame('Google couldn’t confirm the sign-in. Please try again.', $returned['error']);

        $this->googleReturns(['exp' => time() - 10]);
        [$returned] = $this->signInThroughGoogle('customer');
        $this->assertArrayHasKey('error', $returned);

        User::create(['name' => 'Asha', 'email' => 'asha@gmail.com', 'password' => 'secret123', 'role' => 'customer'])
            ->forceFill(['google_id' => 'another-google-account'])->save();
        $this->googleReturns([]);
        [$returned] = $this->signInThroughGoogle('customer');
        $this->assertSame('asha@gmail.com is already linked to a different Google account.', $returned['error']);
        $this->assertSame(1, User::count());
    }

    public function test_closing_googles_screen_returns_quietly(): void
    {
        [$returned] = $this->signInThroughGoogle('customer', self::SITE_RETURN, ['error' => 'access_denied']);
        $this->assertSame(['cancelled' => '1'], $returned);
    }

    public function test_sign_in_can_only_return_to_the_site_or_the_app(): void
    {
        $challenge = str_repeat('a', 43);
        foreach (['https://evil.example/auth/google/callback', 'http://localhost:5173/auth/google/callback.evil.example', 'exp://192.168.1.5:8081/--/auth/google'] as $returnTo) {
            $this->get('/api/auth/google/redirect?' . http_build_query(['portal' => 'customer', 'return_to' => $returnTo, 'code_challenge' => $challenge]))
                ->assertStatus(422);
        }
        $this->get('/api/auth/google/redirect?' . http_build_query(['portal' => 'owner', 'return_to' => self::SITE_RETURN, 'code_challenge' => $challenge]))
            ->assertStatus(422);

        // Expo Go addresses work once allowed for development.
        config(['services.google.return_urls' => [self::SITE_RETURN, 'exp://']]);
        $this->get('/api/auth/google/redirect?' . http_build_query(['portal' => 'customer', 'return_to' => 'exp://192.168.1.5:8081/--/auth/google', 'code_challenge' => $challenge]))
            ->assertRedirect();
    }

    public function test_sign_in_is_not_held_up_by_other_rate_limited_requests(): void
    {
        // Address lookups have a higher limit than most routes but share the default per-IP count.
        for ($i = 0; $i < 25; $i++) {
            $this->getJson('/api/geo/countries')->assertOk();
        }

        $this->googleReturns([]);
        [$returned, $verifier] = $this->signInThroughGoogle('customer');
        $this->postJson('/api/auth/google/exchange', ['code' => $returned['code'], 'code_verifier' => $verifier])->assertCreated();
    }

    public function test_stale_or_unconfigured_sign_ins_explain_themselves(): void
    {
        $this->get('/api/auth/google/callback?state=unknown&code=google-code')
            ->assertRedirect('http://localhost:5173/auth/google/callback?' . http_build_query(['error' => 'That Google sign-in took too long. Please try again.']));

        config(['services.google.client_id' => null]);
        $this->get('/api/auth/google/redirect?' . http_build_query(['portal' => 'customer', 'return_to' => self::SITE_RETURN, 'code_challenge' => str_repeat('a', 43)]))
            ->assertRedirect(self::SITE_RETURN . '?' . http_build_query(['error' => 'Google sign-in isn’t available right now.']));
    }
}
