<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WishlistTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
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
        $this->customer = User::create(['name' => 'Asha', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->category = Category::create(['name' => 'Women', 'status' => 1]);
        $this->brand = Brand::create(['name' => 'Fabindia', 'status' => 1]);
    }

    private function product(string $sku, array $overrides = []): Product
    {
        return Product::create(array_merge([
            'title' => "Kurta {$sku}", 'price' => 1499, 'category_id' => $this->category->id, 'brand_id' => $this->brand->id,
            'qty' => 5, 'sku' => $sku, 'barcode' => '', 'status' => 1,
        ], $overrides));
    }

    public function test_customer_saves_lists_and_removes_products(): void
    {
        $first = $this->product('K-1');
        $second = $this->product('K-2');
        $this->actingAs($this->customer, 'sanctum');

        $this->postJson('/api/customer/wishlist', ['product_id' => $first->id])->assertCreated()
            ->assertJsonPath('data.id', $first->id)
            ->assertJsonPath('data.brand.name', 'Fabindia')
            ->assertJsonPath('data.available', true);
        $this->postJson('/api/customer/wishlist', ['product_id' => $second->id])->assertCreated();
        // Saving twice keeps one entry.
        $this->postJson('/api/customer/wishlist', ['product_id' => $first->id])->assertCreated();

        $this->getJson('/api/customer/wishlist')->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $second->id);

        $this->deleteJson("/api/customer/wishlist/{$second->id}")->assertOk();
        $this->getJson('/api/customer/wishlist')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first->id);
    }

    public function test_hidden_products_cannot_be_saved_and_show_as_unavailable_later(): void
    {
        $pending = $this->product('K-3', ['approval_status' => Product::PENDING]);
        $live = $this->product('K-4');
        $this->actingAs($this->customer, 'sanctum');

        $this->postJson('/api/customer/wishlist', ['product_id' => $pending->id])->assertNotFound();
        $this->postJson('/api/customer/wishlist', ['product_id' => $live->id])->assertCreated();

        $live->update(['status' => 0]);
        $this->getJson('/api/customer/wishlist')->assertJsonPath('data.0.available', false);
    }

    public function test_sign_in_merges_pieces_saved_as_a_guest(): void
    {
        $saved = $this->product('K-5');
        $guestPick = $this->product('K-6');
        $hidden = $this->product('K-7', ['status' => 0]);
        $this->actingAs($this->customer, 'sanctum');
        $this->postJson('/api/customer/wishlist', ['product_id' => $saved->id])->assertCreated();

        $ids = collect($this->postJson('/api/customer/wishlist/sync', ['product_ids' => [$guestPick->id, $saved->id, $hidden->id, 99999]])
            ->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

        $this->assertSame([$saved->id, $guestPick->id], $ids);
        $this->postJson('/api/customer/wishlist/sync', ['product_ids' => []])->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_wishlists_are_private_and_customer_only(): void
    {
        $product = $this->product('K-8');
        $other = User::create(['name' => 'Ravi', 'email' => 'ravi@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $seller = User::create(['name' => 'Seller', 'email' => 'seller@example.com', 'password' => 'secret123', 'role' => 'seller']);

        $this->actingAs($other, 'sanctum')->postJson('/api/customer/wishlist', ['product_id' => $product->id])->assertCreated();
        $this->actingAs($this->customer, 'sanctum')->getJson('/api/customer/wishlist')->assertJsonCount(0, 'data');
        $this->deleteJson("/api/customer/wishlist/{$product->id}")->assertOk();
        $this->actingAs($other, 'sanctum')->getJson('/api/customer/wishlist')->assertJsonCount(1, 'data');

        $this->actingAs($seller, 'sanctum')->getJson('/api/customer/wishlist')->assertForbidden();
    }
}
