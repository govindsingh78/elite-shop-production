<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryTreeTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Category $kids;
    private Category $toys;
    private Category $clothing;
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
        $this->kids = Category::create(['name' => 'Kids', 'status' => 1]);
        $this->toys = Category::create(['name' => 'Toys', 'status' => 1, 'parent_id' => $this->kids->id]);
        $this->clothing = Category::create(['name' => 'Clothing', 'status' => 1, 'parent_id' => $this->kids->id]);
        $this->brand = Brand::create(['name' => 'Acme', 'status' => 1]);
    }

    private function product(Category $category, string $sku): Product
    {
        return Product::create([
            'title' => "Product {$sku}", 'price' => 500, 'category_id' => $category->id, 'brand_id' => $this->brand->id,
            'qty' => 5, 'sku' => $sku, 'barcode' => '', 'status' => 1,
        ]);
    }

    private function titles(string $slug): array
    {
        return collect($this->getJson("/api/storefront/products?category_slug={$slug}")->assertOk()->json('products.data'))
            ->pluck('title')->sort()->values()->all();
    }

    public function test_subcategory_slugs_include_the_parent_and_navigation_nests_active_children(): void
    {
        Category::create(['name' => 'Hidden', 'status' => 0, 'parent_id' => $this->kids->id]);
        $this->assertSame('kids-toys', $this->toys->slug);

        $this->getJson('/api/storefront/categories')->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.slug', 'kids')
            ->assertJsonCount(2, '0.children')
            ->assertJsonPath('0.children.0.name', 'Clothing')
            ->assertJsonPath('0.children.1.slug', 'kids-toys');
    }

    public function test_parent_category_lists_subcategory_products_and_a_subcategory_lists_only_its_own(): void
    {
        $this->product($this->kids, 'KID-1');
        $this->product($this->toys, 'TOY-1');
        $this->product($this->clothing, 'CLO-1');

        $this->assertSame(['Product CLO-1', 'Product KID-1', 'Product TOY-1'], $this->titles('kids'));
        $this->assertSame(['Product TOY-1'], $this->titles('kids-toys'));

        $this->getJson('/api/storefront/products?category_slug=kids-toys')->assertOk()
            ->assertJsonPath('category.name', 'Toys')
            ->assertJsonPath('category.parent.slug', 'kids')
            ->assertJsonCount(2, 'category.subcategories');
        $this->getJson("/api/storefront/products?category_id={$this->kids->id}")->assertOk()->assertJsonPath('products.total', 3);
    }

    public function test_hiding_a_parent_hides_its_subcategory_pages(): void
    {
        $this->kids->update(['status' => 0]);

        $this->getJson('/api/storefront/products?category_slug=kids-toys')->assertNotFound();
    }

    public function test_only_one_level_of_nesting_is_allowed(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $this->postJson('/api/categories', ['name' => 'Lego', 'status' => 1, 'parent_id' => $this->toys->id])
            ->assertStatus(422)->assertJsonValidationErrors('parent_id');
        $this->putJson("/api/categories/{$this->kids->id}", ['name' => 'Kids', 'status' => 1, 'parent_id' => $this->kids->id])
            ->assertStatus(422)->assertJsonValidationErrors('parent_id');

        $women = Category::create(['name' => 'Women', 'status' => 1]);
        $this->putJson("/api/categories/{$this->kids->id}", ['name' => 'Kids', 'status' => 1, 'parent_id' => $women->id])
            ->assertStatus(422)->assertJsonValidationErrors('parent_id');

        $this->postJson('/api/categories', ['name' => 'Footwear', 'status' => 1, 'parent_id' => $this->kids->id])
            ->assertCreated()->assertJsonPath('data.slug', 'kids-footwear');
    }

    public function test_admin_list_is_in_tree_order_and_product_form_labels_show_the_parent(): void
    {
        Category::create(['name' => 'Accessories', 'status' => 1]);
        $this->actingAs($this->admin, 'sanctum');

        $names = collect($this->getJson('/api/categories')->assertOk()->json())->pluck('name')->all();
        $this->assertSame(['Accessories', 'Kids', 'Clothing', 'Toys'], $names);
        $this->getJson('/api/categories')->assertJsonPath('3.parent_name', 'Kids');

        $labels = collect($this->getJson('/api/admin/product-options')->assertOk()->json('categories'))->pluck('label')->all();
        $this->assertSame(['Accessories', 'Kids', 'Kids › Clothing', 'Kids › Toys'], $labels);
    }

    public function test_categories_with_subcategories_or_products_cannot_be_deleted(): void
    {
        $this->product($this->toys, 'TOY-1');
        $this->actingAs($this->admin, 'sanctum');

        $this->deleteJson("/api/categories/{$this->kids->id}")->assertStatus(422);
        $this->deleteJson("/api/categories/{$this->toys->id}")->assertStatus(422)
            ->assertJsonPath('message', 'Move the 1 product in Toys to another category first.');
        $this->deleteJson("/api/categories/{$this->clothing->id}")->assertOk();
        $this->assertModelMissing($this->clothing);
    }
}
