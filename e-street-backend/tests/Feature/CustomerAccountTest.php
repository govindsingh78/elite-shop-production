<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerAccountTest extends TestCase
{
    use RefreshDatabase;

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

    private function registrationPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Asha Verma',
            'email' => 'asha@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'phone' => '+91 98765 43210',
            'address' => '12 MG Road',
            'city' => 'Jaipur',
            'state' => 'Rajasthan',
            'postal_code' => '302001',
        ], $overrides);
    }

    public function test_registration_requires_a_delivery_address(): void
    {
        $this->postJson('/api/customer/register', $this->registrationPayload(['address' => '', 'city' => '']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['address', 'city']);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_customer_can_register_and_gets_a_default_address_and_token(): void
    {
        $response = $this->postJson('/api/customer/register', $this->registrationPayload())
            ->assertCreated()
            ->assertJsonPath('portal', 'customer')
            ->assertJsonPath('user.role', 'customer');

        $this->assertNotEmpty($response->json('token'));
        $this->assertDatabaseHas('customer_addresses', ['city' => 'Jaipur', 'is_default' => true, 'country' => 'India']);
    }

    public function test_customer_login_rejects_other_roles(): void
    {
        User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);

        $this->postJson('/api/customer/login', ['email' => 'admin@example.com', 'password' => 'secret123'])->assertForbidden();
    }

    public function test_customer_sees_only_their_own_orders(): void
    {
        $this->postJson('/api/customer/register', $this->registrationPayload())->assertCreated();
        $customer = User::where('email', 'asha@example.com')->first();
        $other = User::create(['name' => 'Other', 'email' => 'other@example.com', 'password' => 'secret123', 'role' => 'customer']);

        $own = Order::create(['user_id' => $customer->id, 'customer_name' => 'Asha', 'customer_email' => $customer->email, 'address' => 'x', 'city' => 'y', 'total' => 500]);
        $guest = Order::create(['customer_name' => 'Asha', 'customer_email' => $customer->email, 'address' => 'x', 'city' => 'y', 'total' => 250]);
        $foreign = Order::create(['user_id' => $other->id, 'customer_name' => 'Other', 'customer_email' => $other->email, 'address' => 'x', 'city' => 'y', 'total' => 900]);

        $this->actingAs($customer, 'sanctum');

        $this->getJson('/api/customer/dashboard')
            ->assertOk()
            ->assertJsonPath('stats.total_orders', 2)
            ->assertJsonPath('stats.saved_addresses', 1);
        $this->assertEquals(750, $this->getJson('/api/customer/dashboard')->json('stats.total_spent'));

        $this->getJson("/api/customer/orders/{$own->id}")->assertOk();
        $this->getJson("/api/customer/orders/{$guest->id}")->assertOk();
        $this->getJson("/api/customer/orders/{$foreign->id}")->assertNotFound();
    }

    public function test_last_address_cannot_be_deleted_and_default_moves(): void
    {
        $this->postJson('/api/customer/register', $this->registrationPayload())->assertCreated();
        $customer = User::where('email', 'asha@example.com')->first();
        $this->actingAs($customer, 'sanctum');
        $first = $customer->addresses()->first();

        $this->deleteJson("/api/customer/addresses/{$first->id}")->assertStatus(422);

        $second = $this->postJson('/api/customer/addresses', [
            'label' => 'Office', 'full_name' => 'Asha Verma', 'phone' => '9876543210', 'address' => '5 Tonk Road',
            'city' => 'Jaipur', 'state' => 'Rajasthan', 'postal_code' => '302015', 'is_default' => true,
        ])->assertCreated()->json('data');

        $this->assertFalse($first->refresh()->is_default);
        $this->deleteJson("/api/customer/addresses/{$second['id']}")->assertOk();
        $this->assertTrue($first->refresh()->is_default);
    }

    public function test_admin_token_cannot_use_customer_endpoints(): void
    {
        $admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);

        $this->actingAs($admin, 'sanctum')->getJson('/api/customer/dashboard')->assertForbidden();
    }
}
