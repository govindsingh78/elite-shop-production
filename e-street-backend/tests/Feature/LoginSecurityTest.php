<?php

namespace Tests\Feature;

use App\Models\LoginAttempt;
use App\Models\LoginBlock;
use App\Models\TempImage;
use App\Models\User;
use App\Notifications\AccountLocked;
use App\Notifications\NewAdminSignIn;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class LoginSecurityTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $customer;

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
        $this->withoutDefer();
        Notification::fake();
        config(['admin.emails' => ['owner@example.com'], 'logging.default' => 'null']);
        $this->admin = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->customer = User::create(['name' => 'Asha', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
    }

    private function signIn(string $email, string $password, string $portal = 'customer', string $ip = '127.0.0.1')
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])->postJson("/api/{$portal}/login", ['email' => $email, 'password' => $password]);
    }

    public function test_three_wrong_passwords_lock_the_account_for_24_hours(): void
    {
        $this->signIn('asha@example.com', 'wrong-1')->assertUnauthorized()->assertJsonPath('attempts_left', 2)
            ->assertJsonPath('message', 'Wrong email or password. 2 attempts left before this account is locked for 24 hours.');
        $this->signIn('ASHA@example.com ', 'wrong-2')->assertUnauthorized()->assertJsonPath('attempts_left', 1);
        $this->signIn('asha@example.com', 'wrong-3')->assertStatus(423)
            ->assertJsonPath('message', fn ($message) => str_starts_with($message, 'This account is locked after too many wrong passwords'));
        Notification::assertSentTo($this->customer, AccountLocked::class, fn (AccountLocked $notice) => $notice->webPath() === '/forgot-password');

        // Even the right password waits, on every portal.
        $this->signIn('asha@example.com', 'secret123')->assertStatus(423);
        $this->signIn('asha@example.com', 'secret123', 'vendor')->assertStatus(423);
        $this->travel(24)->hours();
        $this->travel(1)->minutes();
        $this->signIn('asha@example.com', 'secret123')->assertOk();

        $this->assertSame(['blocked' => 2, 'failed' => 3, 'success' => 1], LoginAttempt::query()->where('email', 'asha@example.com')
            ->selectRaw('outcome, COUNT(*) as total')->groupBy('outcome')->pluck('total', 'outcome')->map(fn ($total) => (int) $total)->sortKeys()->all());
    }

    public function test_only_wrong_passwords_in_a_row_count(): void
    {
        $this->signIn('asha@example.com', 'wrong-1')->assertUnauthorized();
        $this->signIn('asha@example.com', 'wrong-2')->assertUnauthorized();
        $this->signIn('asha@example.com', 'secret123')->assertOk();
        $this->signIn('asha@example.com', 'wrong-3')->assertUnauthorized()->assertJsonPath('attempts_left', 2);
        $this->signIn('asha@example.com', 'wrong-4')->assertUnauthorized()->assertJsonPath('attempts_left', 1);
    }

    public function test_resetting_the_password_unlocks_the_account(): void
    {
        foreach (range(1, 3) as $try) {
            $this->signIn('asha@example.com', "wrong-{$try}");
        }
        $this->signIn('asha@example.com', 'secret123')->assertStatus(423);

        $token = Password::createToken($this->customer);
        $this->postJson('/api/reset-password', ['token' => $token, 'email' => 'asha@example.com', 'password' => 'brand-new-9', 'password_confirmation' => 'brand-new-9'])->assertOk();
        $this->signIn('asha@example.com', 'brand-new-9')->assertOk();
        $this->assertSame('Password reset by the account owner', LoginBlock::sole()->unblock_reason);
    }

    public function test_unknown_emails_behave_like_real_ones(): void
    {
        $this->signIn('nobody@example.com', 'guess-1')->assertUnauthorized()->assertJsonPath('attempts_left', 2);
        $this->signIn('nobody@example.com', 'guess-2')->assertUnauthorized();
        $this->signIn('nobody@example.com', 'guess-3')->assertStatus(423);
        Notification::assertNothingSent();
    }

    public function test_an_address_making_many_wrong_attempts_is_blocked_from_signing_in(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        foreach (range(1, 5) as $person) {
            foreach (range(1, 2) as $try) {
                $this->signIn("person{$person}@example.com", "guess-{$try}", 'customer', '198.51.100.7');
            }
        }

        $this->signIn('asha@example.com', 'secret123', 'customer', '198.51.100.7')->assertStatus(423)
            ->assertJsonPath('message', fn ($message) => str_starts_with($message, 'Too many wrong sign-in attempts from your network'));
        $this->signIn('asha@example.com', 'secret123', 'customer', '198.51.100.8')->assertOk();
        // Blocked from signing in only: shopping still works.
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7'])->getJson('/api/storefront/categories')->assertOk();
    }

    public function test_admins_see_the_log_and_can_unblock_and_block(): void
    {
        foreach (range(1, 3) as $try) {
            $this->signIn('asha@example.com', "wrong-{$try}", 'customer', '203.0.113.5');
        }
        $this->actingAs($this->admin, 'sanctum');
        $overview = $this->getJson('/api/admin/security')->assertOk()
            ->assertJsonPath('stats.failed', 3)
            ->assertJsonPath('stats.blocked_now', 1)
            ->assertJsonPath('rules.max_failures', 3)
            ->assertJsonPath('blocks.0.type', 'account')
            ->assertJsonPath('blocks.0.value', 'asha@example.com');
        $this->getJson('/api/admin/security/attempts?outcome=failed')->assertOk()->assertJsonPath('total', 3)
            ->assertJsonPath('data.0.ip', '203.0.113.5');

        $this->deleteJson('/api/admin/security/blocks/' . $overview->json('blocks.0.id'))->assertOk()
            ->assertJsonPath('message', 'asha@example.com can sign in again.');
        $this->app['auth']->forgetGuards();
        $this->signIn('asha@example.com', 'secret123')->assertOk();

        // Blocking an address by hand shuts it out of the whole store.
        $this->actingAs($this->admin, 'sanctum');
        $this->postJson('/api/admin/security/blocks', ['ip' => '203.0.113.5', 'hours' => 168, 'reason' => 'Scraping'])->assertCreated()
            ->assertJsonPath('message', '203.0.113.5 is blocked from the whole store for 7 days.');
        $this->postJson('/api/admin/security/blocks', ['ip' => '127.0.0.1'])->assertUnprocessable()->assertJsonValidationErrors('ip');
        $this->app['auth']->forgetGuards();
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.5'])->getJson('/api/storefront/categories')->assertForbidden();

        $this->artisan('security:unblock', ['value' => '203.0.113.5'])->assertExitCode(0);
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.5'])->getJson('/api/storefront/categories')->assertOk();

        $this->actingAs($this->customer, 'sanctum')->getJson('/api/admin/security')->assertForbidden();
    }

    public function test_an_admin_signing_in_from_a_new_address_is_told(): void
    {
        $this->signIn('owner@example.com', 'secret123', 'admin', '10.0.0.1')->assertOk();
        $this->signIn('owner@example.com', 'secret123', 'admin', '10.0.0.2')->assertOk();
        $this->signIn('owner@example.com', 'secret123', 'admin', '10.0.0.2')->assertOk();

        Notification::assertSentToTimes($this->admin, NewAdminSignIn::class, 1);
        Notification::assertSentTo($this->admin, NewAdminSignIn::class, fn (NewAdminSignIn $notice) => str_contains($notice->body(), 'IP address 10.0.0.2'));

        // A locked admin account is urgent on Server & health.
        foreach (range(1, 3) as $try) {
            $this->signIn('owner@example.com', "wrong-{$try}", 'admin', '10.0.0.3');
        }
        $attention = collect($this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/server')->json('attention'))->keyBy('key');
        $this->assertSame('critical', $attention['admin-locked:owner@example.com']['severity']);
        $this->assertSame('/admin/security', $attention['admin-locked:owner@example.com']['link']);
    }

    public function test_a_wrong_current_password_counts_too(): void
    {
        $this->actingAs($this->customer, 'sanctum');
        $change = fn (string $current) => $this->postJson('/api/change-password', ['current_password' => $current, 'password' => 'N3w-Passw0rd!', 'password_confirmation' => 'N3w-Passw0rd!']);

        $change('wrong-1')->assertUnprocessable()->assertJsonPath('errors.current_password.0', 'Current password is incorrect. 2 attempts left before your account is locked for 24 hours.');
        $change('wrong-2')->assertUnprocessable();
        $change('wrong-3')->assertUnprocessable()->assertJsonPath('errors.current_password.0', fn ($message) => str_starts_with($message, 'This account is locked'));
        $change('secret123')->assertUnprocessable();
        $this->app['auth']->forgetGuards();
        $this->signIn('asha@example.com', 'secret123')->assertStatus(423);
    }

    public function test_sign_ins_expire_and_responses_carry_security_headers(): void
    {
        $response = $this->signIn('owner@example.com', 'secret123', 'admin')->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY');
        $this->assertEqualsWithDelta(now()->addDays(7)->getTimestamp(), $this->admin->tokens()->sole()->expires_at->getTimestamp(), 5);
        $this->assertNotEmpty($response->json('token'));

        $this->signIn('asha@example.com', 'secret123')->assertOk();
        $this->assertEqualsWithDelta(now()->addDays(90)->getTimestamp(), $this->customer->tokens()->sole()->expires_at->getTimestamp(), 5);
    }

    public function test_uploaded_photos_never_keep_the_uploaders_file_name(): void
    {
        $sandbox = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ez-upload-' . uniqid();
        $this->app->usePublicPath($sandbox);
        try {
            $this->actingAs($this->admin, 'sanctum')
                ->post('/api/temp-images', ['image' => UploadedFile::fake()->image('evil.php.jpg', 40, 40)], ['Accept' => 'application/json'])
                ->assertCreated();
            $name = TempImage::sole()->name;
            $this->assertStringNotContainsString('evil', $name);
            $this->assertMatchesRegularExpression('/^\d+_[A-Za-z0-9]{12}\.jpg$/', $name);
            $this->assertFileExists(public_path("uploads/temp/original/{$name}"));
        } finally {
            File::deleteDirectory($sandbox);
        }
    }
}
