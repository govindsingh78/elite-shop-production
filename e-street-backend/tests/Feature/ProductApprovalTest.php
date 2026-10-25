<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductApprovalTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $vendor;
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
        config(['admin.emails' => ['admin@example.com']]); // admin roles need an approved address (config/admin.php)
        $this->admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->vendor = User::create(['name' => 'Vendor One', 'email' => 'v1@example.com', 'password' => 'secret123', 'role' => 'seller']);
        $this->category = Category::create(['name' => 'Men', 'slug' => 'men', 'status' => 1]);
        $this->brand = Brand::create(['name' => 'Acme', 'status' => 1]);
    }

    private function listing(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Linen shirt', 'price' => 1499, 'category_id' => $this->category->id, 'brand_id' => $this->brand->id,
            'sku' => 'LIN-1', 'qty' => 4, 'status' => 1, 'is_featured' => 'no',
        ], $overrides);
    }

    private function submitAsVendor(): Product
    {
        $id = $this->actingAs($this->vendor, 'sanctum')->postJson('/api/vendor/products', $this->listing())
            ->assertCreated()
            ->assertJsonPath('data.approval_status', Product::PENDING)
            ->json('data.id');

        return Product::findOrFail($id);
    }

    private function storefrontIds(): array
    {
        return collect($this->getJson("/api/storefront/products?category_slug={$this->category->slug}")->assertOk()->json('products.data'))
            ->pluck('id')->all();
    }

    public function test_seller_listing_stays_off_the_storefront_until_approved(): void
    {
        $product = $this->submitAsVendor();

        $this->assertNotContains($product->id, $this->storefrontIds());
        $this->getJson("/api/storefront/products/{$product->id}")->assertNotFound();
        $this->postJson('/api/orders', [
            'customer_name' => 'Asha', 'customer_email' => 'asha@example.com', 'address' => '12 MG Road', 'city' => 'Jaipur',
            'payment_method' => 'cod', 'accept_policy' => true, 'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(422);

        $this->actingAs($this->admin, 'sanctum')->patchJson("/api/admin/products/{$product->id}/review", ['decision' => 'approved'])
            ->assertOk()->assertJsonPath('data.approval_status', Product::APPROVED);

        $this->assertContains($product->id, $this->storefrontIds());
        $this->getJson("/api/storefront/products/{$product->id}")->assertOk();
    }

    public function test_rejection_needs_a_note_that_the_seller_sees_and_saving_resubmits(): void
    {
        $product = $this->submitAsVendor();
        $this->actingAs($this->admin, 'sanctum');

        $this->patchJson("/api/admin/products/{$product->id}/review", ['decision' => 'rejected'])
            ->assertStatus(422)->assertJsonValidationErrors('note');
        $this->patchJson("/api/admin/products/{$product->id}/review", ['decision' => 'rejected', 'note' => 'Add a clear front photo.'])
            ->assertOk()->assertJsonPath('data.approval_status', Product::REJECTED);

        $this->actingAs($this->vendor, 'sanctum');
        $this->getJson('/api/vendor/products')->assertOk()
            ->assertJsonPath('data.0.review_note', 'Add a clear front photo.')
            ->assertJsonPath('approval_counts.rejected', 1);
        // The apps send an empty barcode as null.
        $this->putJson("/api/vendor/products/{$product->id}", $this->listing(['qty' => 6, 'barcode' => null]))->assertOk()
            ->assertJsonPath('data.approval_status', Product::PENDING)
            ->assertJsonPath('data.review_note', null);
    }

    public function test_only_listing_changes_send_an_approved_product_back_for_review(): void
    {
        $product = $this->submitAsVendor();
        $product->update(['approval_status' => Product::APPROVED]);
        $this->actingAs($this->vendor, 'sanctum');

        $this->putJson("/api/vendor/products/{$product->id}", $this->listing(['qty' => 9, 'price' => 1299]))->assertOk()
            ->assertJsonPath('data.approval_status', Product::APPROVED);
        $this->putJson("/api/vendor/products/{$product->id}", $this->listing(['title' => 'Linen shirt — new season']))->assertOk()
            ->assertJsonPath('data.approval_status', Product::PENDING);
    }

    public function test_admin_listings_are_live_immediately_and_admin_edits_keep_review_state(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $this->postJson('/api/admin/products', $this->listing(['sku' => 'STORE-1']))->assertCreated()
            ->assertJsonPath('data.approval_status', Product::APPROVED);

        $pending = $this->submitAsVendor();
        $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/products/{$pending->id}", $this->listing(['title' => 'Tidied title']))
            ->assertOk()->assertJsonPath('data.approval_status', Product::PENDING);
        $this->getJson('/api/admin/products?approval=pending')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $pending->id)
            ->assertJsonPath('approval_counts.pending', 1);
    }

    public function test_sellers_cannot_review_and_the_dashboard_counts_listings_by_state(): void
    {
        $product = $this->submitAsVendor();

        $this->patchJson("/api/admin/products/{$product->id}/review", ['decision' => 'approved'])->assertForbidden();
        $this->getJson('/api/vendor/dashboard')->assertOk()
            ->assertJsonPath('stats.active_products', 0)
            ->assertJsonPath('stats.pending_review', 1)
            ->assertJsonPath('stats.rejected', 0);
    }
}
