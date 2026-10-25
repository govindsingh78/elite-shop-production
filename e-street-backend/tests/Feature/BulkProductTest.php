<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\TempImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class BulkProductTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $seller;
    private User $otherSeller;
    private Category $kids;
    private Category $toys;
    private Brand $brand;
    /** Files these tests write under public/uploads, removed afterwards. */
    private array $files = [];

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
        $this->otherSeller = User::create(['name' => 'Kids Corner', 'email' => 'kids@example.com', 'password' => 'secret123', 'role' => 'seller']);
        $this->kids = Category::create(['name' => 'Kids', 'status' => 1]);
        $this->toys = Category::create(['name' => 'Toys', 'status' => 1, 'parent_id' => $this->kids->id]);
        Category::create(['name' => 'Archive', 'status' => 0]);
        $this->brand = Brand::create(['name' => 'Fabindia', 'status' => 1]);
    }

    protected function tearDown(): void
    {
        foreach (Product::with('images')->get() as $product) {
            foreach ($product->images as $image) {
                $this->files[] = public_path('uploads/products/large/' . $image->image);
                $this->files[] = public_path('uploads/products/small/' . $image->image);
            }
        }
        File::delete($this->files);
        parent::tearDown();
    }

    private function tempImage(string $name): TempImage
    {
        $stored = 'bulk-test-' . uniqid() . '-' . $name;
        $path = public_path('uploads/temp/original/' . $stored);
        File::ensureDirectoryExists(dirname($path));
        File::put($path, 'fake image bytes');
        $this->files[] = $path;

        return TempImage::create(['name' => $stored, 'original_path' => 'uploads/temp/original/' . $stored, 'thumb_path' => 'uploads/temp/thumb/' . $stored]);
    }

    private function row(array $overrides = []): array
    {
        return array_merge([
            'sku' => 'TOY-1', 'title' => 'Wooden train', 'category' => 'Kids › Toys', 'brand' => 'fabindia', 'price' => '₹1,299.50',
            'compare_price' => '1599', 'qty' => '12', 'short_description' => 'Hand-painted.', 'description' => '', 'barcode' => '',
            'show_in_store' => 'Yes', 'images' => 'train-front.jpg, train-side.JPG',
        ], $overrides);
    }

    public function test_template_lists_categories_with_subcategories_and_brands_for_the_signed_in_user(): void
    {
        $this->actingAs($this->seller, 'sanctum');
        $this->getJson('/api/vendor/bulk-products/template')->assertOk()
            ->assertJsonPath('portal', 'vendor')
            ->assertJsonPath('owner.name', 'Loom Studio')
            ->assertJsonPath('categories', ['Kids', 'Kids › Toys'])
            ->assertJsonPath('brands', ['Fabindia'])
            ->assertJsonPath('max_rows', 500);

        $this->actingAs($this->admin, 'sanctum');
        $this->getJson('/api/admin/bulk-products/template')->assertOk()->assertJsonPath('portal', 'admin');
    }

    public function test_check_reports_each_row_without_saving(): void
    {
        Product::create(['vendor_id' => $this->otherSeller->id, 'title' => 'Their kurta', 'price' => 900, 'category_id' => $this->kids->id, 'brand_id' => $this->brand->id, 'qty' => 3, 'sku' => 'THEIRS-1', 'barcode' => '', 'status' => 1]);
        $this->actingAs($this->seller, 'sanctum');

        $result = $this->postJson('/api/vendor/bulk-products/check', [
            'rows' => [
                $this->row(['_row' => 2]),
                $this->row(['_row' => 3, 'sku' => 'TOY-1']),
                $this->row(['_row' => 4, 'sku' => 'THEIRS-1']),
                $this->row(['_row' => 5, 'sku' => 'TOY-2', 'category' => 'Toys', 'brand' => 'Nike', 'price' => 'free', 'qty' => '2.5', 'show_in_store' => 'maybe', 'images' => 'missing.png']),
                $this->row(['_row' => 6, 'sku' => '', 'title' => '']),
                $this->row(['_row' => 7, 'sku' => 'TOY-3', 'category' => 'kids>toys', 'compare_price' => '999', 'qty' => '0', 'images' => '']),
            ],
            'image_names' => ['train-front.jpg', 'Train-Side.jpg'],
        ])->assertOk()->json();

        $rows = collect($result['rows'])->keyBy('row');
        $this->assertSame([], $rows[2]['errors']);
        $this->assertSame('create', $rows[2]['action']);
        $this->assertSame(['train-front.jpg', 'train-side.JPG'], $rows[2]['images']);
        $this->assertStringContainsString('already used on row 2', $rows[3]['errors'][0]);
        $this->assertStringContainsString('belongs to another product', $rows[4]['errors'][0]);
        $this->assertEqualsCanonicalizing([
            'Brand “Nike” isn’t on Elitezaar. Pick one from the drop-down list.',
            'Price must be a number, like 1499 or 1499.50.',
            'Stock must be a whole number, like 25. Leave it blank if you don’t track stock.',
            'Show in store must be Yes or No.',
            'Photo not among the files you selected: missing.png.',
        ], $rows[5]['errors'], 'A plain category name matches when only one category has it.');
        $this->assertContains('SKU is required.', $rows[6]['errors']);
        $this->assertSame([], $rows[7]['errors'], 'Categories match however the arrow is typed.');
        $this->assertEqualsCanonicalizing(['MRP is lower than the price, so no discount will show.', 'Stock is 0, so it shows as sold out.', 'No photos. Products with photos sell much better.'], $rows[7]['warnings']);
        $this->assertEquals(['total' => 6, 'create' => 2, 'update' => 0, 'errors' => 4, 'images' => 2], $result['summary']);
        $this->assertSame(1, Product::count(), 'Checking saves nothing.');
    }

    public function test_seller_import_creates_listings_for_review_with_photos_and_updates_stock(): void
    {
        $front = $this->tempImage('train-front.jpg');
        $side = $this->tempImage('train-side.jpg');
        $mine = Product::create(['vendor_id' => $this->seller->id, 'title' => 'Rag doll', 'price' => 500, 'category_id' => $this->toys->id, 'brand_id' => $this->brand->id, 'qty' => 2, 'sku' => 'DOLL-1', 'barcode' => '', 'status' => 1, 'approval_status' => Product::APPROVED]);
        $this->actingAs($this->seller, 'sanctum');

        $report = $this->postJson('/api/vendor/bulk-products/import', [
            'rows' => [
                $this->row(['_row' => 2, 'featured' => 'Yes']),
                // Updating only price and stock keeps an approved listing live; blank cells keep their values.
                ['_row' => 3, 'sku' => 'DOLL-1', 'price' => '549', 'qty' => '40'],
                $this->row(['_row' => 4, 'sku' => 'BAD-1', 'brand' => 'Unknown']),
            ],
            'images' => [['name' => 'train-front.jpg', 'id' => $front->id], ['name' => 'train-side.jpg', 'id' => $side->id]],
        ])->assertOk()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('updated', 1)
            ->assertJsonCount(1, 'skipped')
            ->assertJsonPath('skipped.0.row', 4)
            ->json();
        $this->assertStringContainsString('go live once our team approves them', $report['message']);

        $train = Product::where('sku', 'TOY-1')->firstOrFail();
        $this->assertSame($this->seller->id, (int) $train->vendor_id);
        $this->assertSame(Product::PENDING, $train->approval_status);
        $this->assertSame('no', $train->is_featured, 'Sellers can’t feature products.');
        $this->assertSame('1299.50', (string) $train->price);
        $this->assertSame($this->toys->id, (int) $train->category_id);
        $this->assertCount(2, $train->images);
        $this->assertNotNull($train->image);

        $mine->refresh();
        $this->assertSame(40, (int) $mine->qty);
        $this->assertSame('549.00', (string) $mine->price);
        $this->assertSame('Rag doll', $mine->title);
        $this->assertSame(Product::APPROVED, $mine->approval_status);

        // Changing what shoppers see sends it back to review.
        $this->postJson('/api/vendor/bulk-products/import', ['rows' => [['sku' => 'DOLL-1', 'title' => 'Rag doll, large']]])->assertOk();
        $this->assertSame(Product::PENDING, $mine->fresh()->approval_status);
    }

    public function test_admin_import_publishes_and_can_feature_and_update_any_product(): void
    {
        $theirs = Product::create(['vendor_id' => $this->seller->id, 'title' => 'Rag doll', 'price' => 500, 'category_id' => $this->toys->id, 'brand_id' => $this->brand->id, 'qty' => 2, 'sku' => 'DOLL-1', 'barcode' => '', 'status' => 1, 'approval_status' => Product::APPROVED]);
        $this->actingAs($this->admin, 'sanctum');

        $this->postJson('/api/admin/bulk-products/import', [
            'rows' => [
                $this->row(['featured' => 'yes', 'images' => '']),
                ['sku' => 'DOLL-1', 'qty' => '0', 'show_in_store' => 'No'],
            ],
        ])->assertOk()->assertJsonPath('created', 1)->assertJsonPath('updated', 1)->assertJsonPath('message', '1 product added, 1 updated.');

        $train = Product::where('sku', 'TOY-1')->firstOrFail();
        $this->assertSame(Product::APPROVED, $train->approval_status);
        $this->assertSame('yes', $train->is_featured);
        $this->assertNull($train->vendor_id);
        $this->assertSame(0, (int) $theirs->fresh()->qty);
        $this->assertSame(0, (int) $theirs->fresh()->status);
    }

    public function test_export_gives_each_user_their_own_products_as_sheet_rows(): void
    {
        Product::create(['vendor_id' => $this->seller->id, 'title' => 'Rag doll', 'price' => 500, 'compare_price' => 650, 'category_id' => $this->toys->id, 'brand_id' => $this->brand->id, 'qty' => 2, 'sku' => 'DOLL-1', 'barcode' => '', 'status' => 1]);
        Product::create(['vendor_id' => $this->otherSeller->id, 'title' => 'Kite', 'price' => 200, 'category_id' => $this->kids->id, 'brand_id' => $this->brand->id, 'qty' => null, 'sku' => 'KITE-1', 'barcode' => '', 'status' => 0]);

        $this->actingAs($this->seller, 'sanctum');
        $rows = $this->getJson('/api/vendor/bulk-products/export')->assertOk()->json('rows');
        $this->assertCount(1, $rows);
        $this->assertEquals(['sku' => 'DOLL-1', 'category' => 'Kids › Toys', 'brand' => 'Fabindia', 'price' => 500, 'compare_price' => 650, 'qty' => 2, 'show_in_store' => 'Yes'],
            collect($rows[0])->only(['sku', 'category', 'brand', 'price', 'compare_price', 'qty', 'show_in_store'])->all());
        $this->assertArrayNotHasKey('featured', $rows[0]);

        $this->actingAs($this->admin, 'sanctum');
        $rows = collect($this->getJson('/api/admin/bulk-products/export')->json('rows'))->keyBy('sku');
        $this->assertCount(2, $rows);
        $this->assertSame('No', $rows['KITE-1']['featured']);
        $this->assertSame('', $rows['KITE-1']['qty']);
    }

    public function test_only_admins_and_sellers_can_use_their_own_bulk_upload(): void
    {
        $customer = User::create(['name' => 'Asha', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->actingAs($customer, 'sanctum');
        $this->getJson('/api/vendor/bulk-products/template')->assertForbidden();
        $this->getJson('/api/admin/bulk-products/template')->assertForbidden();

        $this->actingAs($this->seller, 'sanctum');
        $this->postJson('/api/admin/bulk-products/import', ['rows' => [$this->row()]])->assertForbidden();
        $this->postJson('/api/vendor/bulk-products/check', ['rows' => array_fill(0, 501, $this->row())])->assertJsonValidationErrors('rows');
        $this->postJson('/api/vendor/bulk-products/check', ['rows' => []])->assertJsonValidationErrors('rows');
    }
}
