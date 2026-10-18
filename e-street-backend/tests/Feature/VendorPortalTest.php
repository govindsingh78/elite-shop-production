<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VendorPortalTest extends TestCase
{
    use RefreshDatabase;

    private User $vendor;
    private User $otherVendor;
    private Category $category;
    private Brand $brand;

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
        $this->vendor = User::create(['name' => 'Vendor One', 'email' => 'v1@example.com', 'password' => 'secret123', 'role' => 'seller']);
        $this->otherVendor = User::create(['name' => 'Vendor Two', 'email' => 'v2@example.com', 'password' => 'secret123', 'role' => 'seller']);
        $this->category = Category::create(['name' => 'Men', 'status' => 1]);
        $this->brand = Brand::create(['name' => 'Acme', 'status' => 1]);
    }

    private function product(?User $vendor, string $sku, int $qty = 10): Product
    {
        return Product::create([
            'vendor_id' => $vendor?->id, 'title' => "Product {$sku}", 'price' => 100, 'category_id' => $this->category->id,
            'brand_id' => $this->brand->id, 'qty' => $qty, 'sku' => $sku, 'barcode' => '', 'status' => 1,
        ]);
    }

    private function checkout(array $products): Order
    {
        $response = $this->postJson('/api/orders', [
            'customer_name' => 'Asha', 'customer_email' => 'asha@example.com', 'address' => '12 MG Road', 'city' => 'Jaipur',
            'payment_method' => 'cod',
            'items' => array_map(fn ($product) => ['product_id' => $product->id, 'quantity' => 2], $products),
        ])->assertCreated();

        return Order::findOrFail($response->json('data.id'));
    }

    public function test_vendor_creates_products_owned_by_them_and_cannot_feature_them(): void
    {
        $this->actingAs($this->vendor, 'sanctum')->postJson('/api/vendor/products', [
            'title' => 'Linen shirt', 'price' => 1499, 'category_id' => $this->category->id, 'brand_id' => $this->brand->id,
            'sku' => 'LIN-1', 'qty' => 4, 'status' => 1, 'is_featured' => 'yes',
        ])->assertCreated()->assertJsonPath('data.vendor_id', $this->vendor->id)->assertJsonPath('data.is_featured', 'no');
    }

    public function test_vendor_only_sees_and_edits_own_products(): void
    {
        $own = $this->product($this->vendor, 'OWN-1');
        $foreign = $this->product($this->otherVendor, 'FOREIGN-1');
        $store = $this->product(null, 'STORE-1');
        $this->actingAs($this->vendor, 'sanctum');

        $this->getJson('/api/vendor/products')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $own->id);
        $this->getJson("/api/vendor/products/{$foreign->id}")->assertNotFound();
        $this->deleteJson("/api/vendor/products/{$store->id}")->assertNotFound();
        $this->deleteJson("/api/vendor/products/{$own->id}")->assertOk();
    }

    public function test_vendor_cannot_bypass_scoping_through_the_generic_catalog_routes(): void
    {
        $foreign = $this->product($this->otherVendor, 'FOREIGN-1');
        $this->actingAs($this->vendor, 'sanctum');

        $this->deleteJson("/api/products/{$foreign->id}")->assertForbidden();
        $this->postJson('/api/categories', ['name' => 'Hacked', 'status' => 1])->assertForbidden();
        $this->assertModelExists($foreign);
    }

    public function test_vendor_sees_only_their_lines_and_manages_shipping_for_single_vendor_orders(): void
    {
        $own = $this->product($this->vendor, 'OWN-1');
        $foreign = $this->product($this->otherVendor, 'FOREIGN-1');
        $mixed = $this->checkout([$own, $foreign]);
        $solo = $this->checkout([$own]);
        $this->actingAs($this->vendor, 'sanctum');

        $this->getJson('/api/vendor/orders')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.1.vendor_subtotal', 200)
            ->assertJsonPath('data.1.items_count', 1);

        $this->getJson("/api/vendor/orders/{$mixed->id}")->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('can_manage_shipping', false)
            ->assertJsonMissingPath('total');
        $this->putJson("/api/vendor/orders/{$mixed->id}", ['status' => 'shipped'])->assertForbidden();
        $this->postJson("/api/vendor/orders/{$mixed->id}/tracking", ['status' => 'dispatched'])->assertForbidden();

        $this->getJson("/api/vendor/orders/{$solo->id}")->assertJsonPath('can_manage_shipping', true);
        $this->postJson("/api/vendor/orders/{$solo->id}/tracking", ['status' => 'in_transit', 'location' => 'Jaipur hub'])
            ->assertCreated()->assertJsonPath('data.status', 'shipped');
    }

    public function test_vendor_cannot_open_orders_without_their_products(): void
    {
        $order = $this->checkout([$this->product($this->otherVendor, 'FOREIGN-1')]);

        $this->actingAs($this->vendor, 'sanctum')->getJson("/api/vendor/orders/{$order->id}")->assertNotFound();
    }

    public function test_dashboard_reports_vendor_stats(): void
    {
        $own = $this->product($this->vendor, 'OWN-1', 3);
        $this->product($this->otherVendor, 'FOREIGN-1');
        $this->checkout([$own]);

        $this->actingAs($this->vendor, 'sanctum')->getJson('/api/vendor/dashboard')->assertOk()
            ->assertJsonPath('stats.total_products', 1)
            ->assertJsonPath('stats.total_orders', 1)
            ->assertJsonPath('stats.units_sold', 2)
            ->assertJsonPath('stats.revenue', 200)
            ->assertJsonPath('stats.low_stock', 1);
    }

    public function test_customers_cannot_use_vendor_routes(): void
    {
        $customer = User::create(['name' => 'C', 'email' => 'c@example.com', 'password' => 'secret123', 'role' => 'customer']);

        $this->actingAs($customer, 'sanctum')->getJson('/api/vendor/dashboard')->assertForbidden();
    }
}
