<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReturnPolicyTest extends TestCase
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

    private function orderPayload(array $overrides = []): array
    {
        $category = Category::create(['name' => 'Men', 'status' => 1]);
        $brand = Brand::create(['name' => 'Acme', 'status' => 1]);
        $product = Product::create([
            'title' => 'Linen shirt', 'price' => 999, 'category_id' => $category->id, 'brand_id' => $brand->id,
            'qty' => 5, 'sku' => 'LIN-1', 'barcode' => '', 'status' => 1,
        ]);

        return array_merge([
            'customer_name' => 'Asha', 'customer_email' => 'asha@example.com', 'address' => '12 MG Road', 'city' => 'Jaipur',
            'payment_method' => 'cod', 'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ], $overrides);
    }

    public function test_the_policy_is_served_with_its_version_and_sections(): void
    {
        $policy = $this->getJson('/api/storefront/policies/return-refund')->assertOk()
            ->assertJsonPath('title', 'Return & Refund Policy')
            ->assertJsonStructure(['version', 'updated', 'intro', 'highlights' => [['title', 'text']], 'sections' => [['id', 'title', 'blocks']]])
            ->json();

        $this->assertGreaterThanOrEqual(10, count($policy['sections']));
        $this->getJson('/api/storefront/policies/privacy')->assertNotFound();
        $this->getJson('/api/storefront/policies/..%2F..%2F.env')->assertNotFound();
    }

    public function test_orders_need_the_policy_accepted(): void
    {
        $this->postJson('/api/orders', $this->orderPayload())
            ->assertStatus(422)
            ->assertJsonValidationErrors(['accept_policy' => 'Please read and accept the Return & Refund Policy to place your order.']);
        $this->assertSame(0, Order::count());
    }

    public function test_the_accepted_policy_version_is_recorded_on_the_order(): void
    {
        $version = json_decode(file_get_contents(resource_path('policies/return-refund.json')), true)['version'];

        $id = $this->postJson('/api/orders', $this->orderPayload(['accept_policy' => true]))->assertCreated()->json('data.id');

        $order = Order::findOrFail($id);
        $this->assertSame($version, $order->policy_version);
        $this->assertNotNull($order->policy_accepted_at);
    }
}
