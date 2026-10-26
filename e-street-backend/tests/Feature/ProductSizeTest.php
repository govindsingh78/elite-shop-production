<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductSize;
use App\Models\Size;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductSizeTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $seller;
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
        $this->seller = User::create(['name' => 'Loom Studio', 'email' => 'loom@example.com', 'password' => 'secret123', 'role' => 'seller']);
        $this->category = Category::create(['name' => 'Men', 'status' => 1]);
        $this->brand = Brand::create(['name' => 'Levis', 'status' => 1]);
    }

    private function sizeNamed(string $name): Size
    {
        return Size::query()->where('name', $name)->firstOrFail();
    }

    private function productPayload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Linen shirt', 'price' => 1499, 'compare_price' => null, 'description' => '', 'short_description' => '',
            'category_id' => $this->category->id, 'brand_id' => $this->brand->id, 'sku' => 'SHIRT-1', 'barcode' => '',
            'qty' => 99, 'status' => 1, 'is_featured' => 'no', 'gallery' => [],
        ], $overrides);
    }

    private function order(array $items)
    {
        return $this->postJson('/api/orders', [
            'customer_name' => 'Asha', 'customer_email' => 'asha@example.com', 'customer_phone' => '9876543210',
            'address' => '12 MG Road', 'city' => 'Jaipur', 'payment_method' => 'cod', 'accept_policy' => true,
            'items' => $items,
        ]);
    }

    public function test_the_size_list_starts_with_the_usual_clothing_sizes_and_admins_manage_it(): void
    {
        $this->assertSame(['Free Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'], Size::query()->ordered()->pluck('name')->all());

        $this->actingAs($this->seller)->getJson('/api/sizes')->assertForbidden();
        $this->actingAs($this->admin)->postJson('/api/sizes', ['name' => 'UK 8'])
            ->assertCreated()->assertJsonPath('data.name', 'UK 8');
        $this->assertSame('UK 8', Size::query()->ordered()->get()->last()->name, 'new sizes go to the end');
        $this->actingAs($this->admin)->postJson('/api/sizes', ['name' => 'M'])->assertUnprocessable()->assertJsonValidationErrors('name');

        $xs = $this->sizeNamed('XS');
        $this->actingAs($this->admin)->putJson("/api/sizes/{$xs->id}", ['name' => 'XS', 'sort_order' => 1])->assertOk();
        $this->assertSame('XS', Size::query()->ordered()->first()->name);
        $this->actingAs($this->admin)->putJson("/api/sizes/{$xs->id}", ['name' => 'XS', 'sort_order' => null])->assertOk();
        $this->assertSame(1, $xs->refresh()->sort_order, 'a blank position keeps the size where it is');

        // Sizes in use can't be deleted; unused ones can.
        $product = Product::create($this->productPayload(['vendor_id' => null, 'approval_status' => Product::APPROVED]));
        $product->syncSizes([['size_id' => $xs->id, 'qty' => 3]]);
        $this->actingAs($this->admin)->deleteJson("/api/sizes/{$xs->id}")->assertUnprocessable()
            ->assertJsonPath('message', 'XS is used by 1 product. Remove it from those products first.');
        $this->actingAs($this->admin)->getJson('/api/sizes')->assertOk()->assertJsonPath('0.products_count', 1);
        $uk8 = $this->sizeNamed('UK 8');
        $this->actingAs($this->admin)->deleteJson("/api/sizes/{$uk8->id}")->assertOk();
        $this->assertNull(Size::find($uk8->id));
    }

    public function test_a_seller_lists_a_product_in_sizes_and_its_stock_is_the_total_of_the_sizes(): void
    {
        $options = $this->actingAs($this->seller)->getJson('/api/vendor/product-options')->assertOk();
        $this->assertSame('Free Size', $options->json('sizes.0.name'));

        $s = $this->sizeNamed('S');
        $m = $this->sizeNamed('M');
        $l = $this->sizeNamed('L');
        $response = $this->actingAs($this->seller)->postJson('/api/vendor/products', $this->productPayload([
            'sizes' => [['size_id' => $l->id, 'qty' => 0], ['size_id' => $s->id, 'qty' => 4], ['size_id' => $m->id, 'qty' => 6]],
        ]))->assertCreated();

        // Sizes come back in size order, and the qty field was ignored in favour of the sizes' total.
        $this->assertSame(['S', 'M', 'L'], array_column($response->json('data.sizes'), 'name'));
        $this->assertSame([4, 6, 0], array_column($response->json('data.sizes'), 'qty'));
        $this->assertSame([true, true, false], array_column($response->json('data.sizes'), 'in_stock'));
        $this->assertSame(10, $response->json('data.qty'));
        $id = $response->json('data.id');

        // Size changes don't send an approved listing back for review, just like stock changes.
        Product::whereKey($id)->update(['approval_status' => Product::APPROVED]);
        $this->actingAs($this->seller)->putJson("/api/vendor/products/{$id}", $this->productPayload([
            'sizes' => [['size_id' => $m->id, 'qty' => 2], ['size_id' => $l->id, 'qty' => null]],
        ]))->assertOk()->assertJsonPath('data.approval_status', Product::APPROVED);
        $product = Product::with('sizes')->find($id);
        $this->assertSame(['M', 'L'], $product->sizes->pluck('name')->all());
        $this->assertNull($product->qty, 'an untracked size makes the product untracked');

        // Leaving sizes out (older apps) keeps them; an empty list makes it a one-size product again.
        $this->actingAs($this->seller)->putJson("/api/vendor/products/{$id}", $this->productPayload(['qty' => 7]))->assertOk();
        $this->assertCount(2, Product::with('sizes')->find($id)->sizes);
        $this->actingAs($this->seller)->putJson("/api/vendor/products/{$id}", $this->productPayload(['qty' => 7, 'sizes' => []]))
            ->assertOk()->assertJsonPath('data.qty', 7)->assertJsonCount(0, 'data.sizes');

        $this->actingAs($this->seller)->putJson("/api/vendor/products/{$id}", $this->productPayload([
            'sizes' => [['size_id' => $m->id, 'qty' => 2], ['size_id' => $m->id, 'qty' => 3]],
        ]))->assertUnprocessable()->assertJsonPath('errors', fn ($errors) => in_array('Each size can only be added once.', array_merge(...array_values($errors)), true));
    }

    public function test_shoppers_see_sizes_and_buy_in_one_of_them(): void
    {
        $product = Product::create($this->productPayload(['qty' => null, 'approval_status' => Product::APPROVED]));
        $s = $this->sizeNamed('S');
        $m = $this->sizeNamed('M');
        $product->syncSizes([['size_id' => $s->id, 'qty' => 1], ['size_id' => $m->id, 'qty' => 5]]);

        $this->getJson("/api/storefront/products/{$product->id}")->assertOk()
            ->assertJsonPath('data.sizes.0', ['size_id' => $s->id, 'qty' => 1, 'name' => 'S', 'in_stock' => true])
            ->assertJsonPath('data.qty', 6);
        $this->getJson('/api/storefront/products')->assertOk()->assertJsonPath('products.data.0.sizes.1.name', 'M');

        // A size is required, must be one of the product's, and must have stock.
        $this->order([['product_id' => $product->id, 'quantity' => 1]])->assertUnprocessable()
            ->assertJsonPath('message', 'Please choose a size for Linen shirt.');
        $this->order([['product_id' => $product->id, 'quantity' => 1, 'size_id' => $this->sizeNamed('XL')->id]])->assertUnprocessable();
        $this->order([['product_id' => $product->id, 'quantity' => 2, 'size_id' => $s->id]])->assertUnprocessable()
            ->assertJsonPath('message', 'Only 1 left of Linen shirt in size S.');

        $orderId = $this->order([
            ['product_id' => $product->id, 'quantity' => 1, 'size_id' => $s->id],
            ['product_id' => $product->id, 'quantity' => 2, 'size_id' => $m->id],
        ])->assertCreated()->assertJsonPath('data.items.0.size', 'S')->json('data.id');

        $this->assertSame(['S', 'M'], Order::find($orderId)->items()->orderBy('id')->pluck('size')->all());
        $this->assertSame(0, ProductSize::where('product_id', $product->id)->where('size_id', $s->id)->value('qty'));
        $this->assertSame(3, ProductSize::where('product_id', $product->id)->where('size_id', $m->id)->value('qty'));
        $this->assertSame(3, $product->refresh()->qty, 'the product total follows its sizes');

        $this->order([['product_id' => $product->id, 'quantity' => 1, 'size_id' => $s->id]])->assertUnprocessable()
            ->assertJsonPath('message', 'Linen shirt is sold out in size S.');

        // One-size products don't need (and ignore) a size.
        $socks = Product::create($this->productPayload(['sku' => 'SOCKS', 'title' => 'Socks', 'qty' => 5, 'approval_status' => Product::APPROVED]));
        $this->order([['product_id' => $socks->id, 'quantity' => 1, 'size_id' => $s->id]])->assertCreated()->assertJsonPath('data.items.0.size', null);
    }

    public function test_bulk_upload_sets_sizes_from_the_sizes_column(): void
    {
        $row = fn (array $overrides) => array_merge([
            'sku' => 'KURTA-1', 'title' => 'Cotton kurta', 'category' => 'Men', 'brand' => 'Levis', 'price' => '999',
            'qty' => '', 'sizes' => 'S:4, m:6, free-size', 'show_in_store' => 'Yes', 'images' => '', '_row' => 2,
        ], $overrides);

        $template = $this->actingAs($this->seller)->getJson('/api/vendor/bulk-products/template')->assertOk();
        $this->assertContains('Free Size', $template->json('sizes'));

        $check = $this->actingAs($this->seller)->postJson('/api/vendor/bulk-products/check', ['rows' => [
            $row([]),
            $row(['sku' => 'KURTA-2', 'sizes' => 'S, Huge, M:abc, S', '_row' => 3]),
            $row(['sku' => 'KURTA-3', 'qty' => '5', 'sizes' => 'L:2', '_row' => 4]),
        ], 'image_names' => []])->assertOk();
        $this->assertSame([], $check->json('rows.0.errors'));
        $this->assertSame([
            'Size “Huge” isn’t on Elitezaar. Use one of: Free Size, XS, S, M, L, XL, XXL, 3XL.',
            'Stock for size M must be a whole number, like M:10.',
            'Size S is listed twice.',
        ], $check->json('rows.1.errors'));
        $this->assertContains('Stock is worked out from the sizes, so the Stock column is ignored.', $check->json('rows.2.warnings'));

        $this->actingAs($this->seller)->postJson('/api/vendor/bulk-products/import', ['rows' => [$row([])], 'images' => []])
            ->assertOk();
        $kurta = Product::with('sizes')->where('sku', 'KURTA-1')->firstOrFail();
        $this->assertSame(['Free Size', 'S', 'M'], $kurta->sizes->pluck('name')->all());
        $this->assertNull($kurta->qty, 'Free Size has no stock number, so stock isn’t tracked');

        $export = $this->actingAs($this->seller)->getJson('/api/vendor/bulk-products/export')->assertOk();
        $this->assertSame('Free Size, S:4, M:6', $export->json('rows.0.sizes'));
    }
}
