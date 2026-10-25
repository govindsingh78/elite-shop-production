<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminAllowlistTest extends TestCase
{
    use RefreshDatabase;

    private const OWNER = 'govindsingh78@gmail.com';
    private const OWNER_ALT = 'er.govindsingh.444@gmail.com';

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

    private function owner(string $email = self::OWNER): User
    {
        return User::create(['name' => 'Govind Singh', 'email' => $email, 'password' => 'secret123', 'role' => 'admin']);
    }

    public function test_only_the_two_owner_addresses_are_approved(): void
    {
        $this->assertSame([self::OWNER, self::OWNER_ALT], config('admin.emails'));
        $this->assertTrue(User::isApprovedAdminEmail('  GovindSingh78@Gmail.com '));
        $this->assertFalse(User::isApprovedAdminEmail('govindsingh78@gmail.com.evil.test'));
        $this->assertFalse(User::isApprovedAdminEmail(null));
    }

    public function test_the_admin_panel_can_give_admin_roles_only_to_approved_addresses(): void
    {
        $this->actingAs($this->owner(), 'sanctum');
        $user = fn (array $overrides) => array_merge(['name' => 'Staff', 'email' => 'staff@example.com', 'role' => 'admin', 'password' => 'secret123', 'password_confirmation' => 'secret123'], $overrides);

        foreach (['admin', 'superadmin'] as $role) {
            $this->postJson('/api/admin/users', $user(['role' => $role]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['role' => 'approved email addresses']);
        }
        $this->assertDatabaseMissing('users', ['email' => 'staff@example.com']);

        // Other roles work with any address, and admin works with an approved one.
        $this->postJson('/api/admin/users', $user(['role' => 'seller']))->assertCreated();
        $this->postJson('/api/admin/users', $user(['email' => 'Er.GovindSingh.444@gmail.com']))->assertCreated()->assertJsonPath('data.role', 'admin');

        // Promoting an existing account, or moving an admin to another address, is refused too.
        $seller = User::where('email', 'staff@example.com')->first();
        $this->putJson("/api/admin/users/{$seller->id}", $user(['role' => 'admin', 'password' => null, 'password_confirmation' => null]))
            ->assertJsonValidationErrors('role');
        $this->assertSame('seller', $seller->fresh()->role);
        $alt = User::where('email', 'Er.GovindSingh.444@gmail.com')->first();
        $this->putJson("/api/admin/users/{$alt->id}", $user(['email' => 'moved@example.com', 'password' => null, 'password_confirmation' => null]))
            ->assertJsonValidationErrors('role');
    }

    public function test_admin_accounts_with_other_addresses_are_shut_out(): void
    {
        $legacy = User::create(['name' => 'Old admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $token = $legacy->createToken('admin_auth_token')->plainTextToken;

        $this->postJson('/api/admin/login', ['email' => 'admin@example.com', 'password' => 'secret123'])->assertForbidden();
        // A session it already had stops working too.
        $this->withToken($token)->getJson('/api/admin/users')->assertForbidden();

        $this->owner();
        $session = $this->postJson('/api/admin/login', ['email' => self::OWNER, 'password' => 'secret123'])->assertOk()->json();
        $this->app['auth']->forgetGuards();
        $this->withToken($session['token'])->getJson('/api/admin/users')->assertOk();
    }

    public function test_grant_command_makes_an_approved_address_an_admin(): void
    {
        $this->artisan('admin:grant', ['email' => 'someone@example.com'])
            ->expectsOutputToContain("isn't an approved admin address")
            ->assertFailed();

        $this->artisan('admin:grant', ['email' => self::OWNER])
            ->expectsQuestion('New password for ' . self::OWNER . ' (at least 8 characters)', 'new-secret-1')
            ->expectsQuestion('Type the password again', 'new-secret-1')
            ->expectsQuestion('Name for the new admin account', 'Govind Singh')
            ->assertSuccessful();
        $created = User::where('email', self::OWNER)->firstOrFail();
        $this->assertSame('admin', $created->role);
        $this->assertTrue(Hash::check('new-secret-1', $created->password));

        // An existing account with the address (e.g. registered by someone else) is promoted with a new
        // password, and its old sessions end.
        $squatter = User::create(['name' => 'Someone', 'email' => self::OWNER_ALT, 'password' => 'their-pass', 'role' => 'customer']);
        $squatter->createToken('customer_auth_token');
        $this->artisan('admin:grant', ['email' => strtoupper(self::OWNER_ALT)])
            ->expectsQuestion('New password for ' . self::OWNER_ALT . ' (at least 8 characters)', 'owner-pass-2')
            ->expectsQuestion('Type the password again', 'owner-pass-2')
            ->assertSuccessful();
        $squatter->refresh();
        $this->assertSame('admin', $squatter->role);
        $this->assertFalse(Hash::check('their-pass', $squatter->password));
        $this->assertSame(0, $squatter->tokens()->count());

        // A short password is refused before anything changes.
        $this->artisan('admin:grant', ['email' => self::OWNER])
            ->expectsQuestion('New password for ' . self::OWNER . ' (at least 8 characters)', 'short')
            ->assertFailed();
        $this->assertTrue(Hash::check('new-secret-1', $created->fresh()->password));
    }
}
