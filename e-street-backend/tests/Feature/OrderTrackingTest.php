<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderTrackingTest extends TestCase
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

    private function setUpOrder(): array
    {
        config(['admin.emails' => ['admin@example.com']]); // admin roles need an approved address (config/admin.php)
        $admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $customer = User::create(['name' => 'Asha', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $order = Order::create(['user_id' => $customer->id, 'customer_name' => 'Asha', 'customer_email' => $customer->email, 'address' => 'x', 'city' => 'Jaipur', 'total' => 500]);
        $order->recordTrackingEvent('order_placed');

        return [$admin, $customer, $order];
    }

    public function test_admin_tracking_update_moves_order_status_and_customer_sees_it(): void
    {
        [$admin, $customer, $order] = $this->setUpOrder();

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/orders/{$order->id}/tracking", [
            'status' => 'in_transit',
            'location' => 'Delhi sorting hub',
            'description' => 'Departed facility.',
        ])->assertCreated()->assertJsonPath('data.status', 'shipped');

        $this->actingAs($customer, 'sanctum')->getJson("/api/customer/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('status', 'shipped')
            ->assertJsonPath('tracking_events.0.status', 'in_transit')
            ->assertJsonPath('tracking_events.0.location', 'Delhi sorting hub')
            ->assertJsonMissingPath('tracking_events.0.created_by');

        $this->getJson('/api/customer/orders')->assertJsonPath('data.0.latest_tracking_event.location', 'Delhi sorting hub');
    }

    public function test_changing_status_directly_logs_a_tracking_event(): void
    {
        [$admin, , $order] = $this->setUpOrder();

        $this->actingAs($admin, 'sanctum')->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'processing', 'courier_name' => 'BlueDart', 'estimated_delivery_date' => '2026-10-25',
        ])->assertOk()->assertJsonPath('data.tracking_events.0.status', 'confirmed')
            ->assertJsonPath('data.estimated_delivery_date', '2026-10-25');
    }

    public function test_removing_latest_update_restores_previous_status(): void
    {
        [$admin, , $order] = $this->setUpOrder();
        $this->actingAs($admin, 'sanctum');

        $eventId = $this->postJson("/api/admin/orders/{$order->id}/tracking", ['status' => 'delivered'])->json('event.id');
        $this->assertSame('delivered', $order->refresh()->status);

        $this->deleteJson("/api/admin/orders/{$order->id}/tracking/{$eventId}")->assertOk();
        $this->assertSame('pending', $order->refresh()->status);
    }

    public function test_customers_cannot_post_tracking_updates_or_use_bad_statuses(): void
    {
        [$admin, $customer, $order] = $this->setUpOrder();

        $this->actingAs($customer, 'sanctum')->postJson("/api/admin/orders/{$order->id}/tracking", ['status' => 'delivered'])->assertForbidden();
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/orders/{$order->id}/tracking", ['status' => 'teleported'])->assertStatus(422);
    }
}
