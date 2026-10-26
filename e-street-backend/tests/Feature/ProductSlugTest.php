<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductSlug;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductSlugTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
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
        config(['admin.emails' => ['owner@example.com']]);
        $this->admin = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->category = Category::create(['name' => 'Men', 'status' => 1]);
        $this->brand = Brand::create(['name' => 'Levis', 'status' => 1]);
    }

    private function product(string $title, string $sku): Product
    {
        return Product::create([
            'title' => $title, 'price' => 999, 'category_id' => $this->category->id, 'brand_id' => $this->brand->id,
            'sku' => $sku, 'barcode' => '', 'qty' => 5, 'status' => 1, 'is_featured' => 'no', 'approval_status' => Product::APPROVED,
        ]);
    }

    public function test_products_get_readable_unique_addresses_from_their_titles(): void
    {
        $this->assertSame('classic-linen-shirt-blue', $this->product('Classic Linen Shirt (Blue)', 'A')->slug);
        $this->assertSame('classic-linen-shirt-blue-2', $this->product('Classic linen shirt — blue', 'B')->slug);
        $this->assertSame('product-1999', $this->product('1999', 'C')->slug, 'an all-number address would read as an id');
        $long = $this->product(str_repeat('handwoven silk ', 12), 'D')->slug;
        $this->assertLessThanOrEqual(80, strlen($long));
        $this->assertStringEndsNotWith('-', $long);

        // Created through the API too.
        $this->actingAs($this->admin)->postJson('/api/admin/products', [
            'title' => 'Indigo Kurta', 'price' => 1499, 'category_id' => $this->category->id, 'brand_id' => $this->brand->id,
            'sku' => 'KURTA', 'qty' => 3, 'status' => 1, 'is_featured' => 'no', 'gallery' => [],
        ])->assertCreated()->assertJsonPath('data.slug', 'indigo-kurta');
    }

    public function test_shoppers_open_a_product_by_its_address_and_old_links_still_work(): void
    {
        $shirt = $this->product('Classic Linen Shirt', 'SHIRT');

        $this->getJson('/api/storefront/products/classic-linen-shirt')->assertOk()->assertJsonPath('data.id', $shirt->id);
        $this->getJson('/api/storefront/products/Classic-Linen-Shirt')->assertOk()->assertJsonPath('data.slug', 'classic-linen-shirt');
        $this->getJson("/api/storefront/products/{$shirt->id}")->assertOk()->assertJsonPath('data.slug', 'classic-linen-shirt');
        $this->getJson('/api/storefront/products/no-such-shirt')->assertNotFound();
        $this->getJson('/api/storefront/products')->assertOk()->assertJsonPath('products.data.0.slug', 'classic-linen-shirt');

        // A small edit keeps the address; a rename gets a new one, and the old address still finds the product.
        $shirt->update(['title' => 'Classic linen shirt']);
        $this->assertSame('classic-linen-shirt', $shirt->refresh()->slug);
        $shirt->update(['title' => 'Breezy Linen Shirt']);
        $this->assertSame('breezy-linen-shirt', $shirt->refresh()->slug);
        $this->getJson('/api/storefront/products/classic-linen-shirt')->assertOk()->assertJsonPath('data.slug', 'breezy-linen-shirt');

        // The old address stays this product's: a new product with that title is numbered instead.
        $this->assertSame('classic-linen-shirt-2', $this->product('Classic Linen Shirt', 'SHIRT-2')->slug);

        // Renaming back reuses its own old address rather than numbering it.
        $shirt->update(['title' => 'Classic Linen Shirt']);
        $this->assertSame('classic-linen-shirt', $shirt->refresh()->slug);
        $this->assertSame(['breezy-linen-shirt'], ProductSlug::where('product_id', $shirt->id)->pluck('slug')->all());

        // Hidden products aren't found by any address.
        $shirt->update(['status' => 0]);
        $this->getJson('/api/storefront/products/classic-linen-shirt')->assertNotFound();
        $this->getJson('/api/storefront/products/breezy-linen-shirt')->assertNotFound();
    }
}
