<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\TempImage;
use App\Models\User;
use App\Services\CategoryBanners;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class CategoryBannerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Brand $brand;
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
        config(['admin.emails' => ['admin@example.com']]);
        $this->admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->brand = Brand::create(['name' => 'Levis', 'status' => 1]);
    }

    protected function tearDown(): void
    {
        File::delete($this->files);
        parent::tearDown();
    }

    /** A photo as /temp-images leaves it. The bytes aren't a real image, so it's copied rather than resized. */
    private function tempImage(): TempImage
    {
        $name = 'test_' . uniqid() . '.jpg';
        $path = public_path('uploads/temp/original/' . $name);
        File::ensureDirectoryExists(dirname($path));
        File::put($path, 'fake image bytes');
        $this->files[] = $path;

        return TempImage::create(['name' => $name, 'original_path' => "uploads/temp/original/{$name}", 'thumb_path' => "uploads/temp/thumb/{$name}"]);
    }

    private function bannerPath(Category $category): string
    {
        $path = public_path(CategoryBanners::FOLDER . '/' . $category->banner);
        $this->files[] = $path;

        return $path;
    }

    private function product(string $title, Category $category, array $extra = []): Product
    {
        static $sku = 0;
        $sku++;

        return Product::create([
            'title' => $title, 'price' => 999, 'category_id' => $category->id, 'brand_id' => $this->brand->id, 'description' => 'A long description.',
            'sku' => "BANNER-{$sku}", 'barcode' => (string) $sku, 'qty' => 5, 'status' => 1, 'is_featured' => 'no', 'approval_status' => Product::APPROVED, ...$extra,
        ]);
    }

    public function test_an_admin_adds_replaces_and_removes_a_banner(): void
    {
        $this->actingAs($this->admin);

        // Added with a new category.
        $id = $this->postJson('/api/categories', ['name' => 'Men', 'banner_temp_id' => $this->tempImage()->id])->assertCreated()->json('data.id');
        $category = Category::findOrFail($id);
        $first = $this->bannerPath($category);
        $this->assertFileExists($first);
        $this->assertStringStartsWith("{$id}-", $category->banner);

        // Saving without touching it keeps it.
        $this->putJson("/api/categories/{$id}", ['name' => 'Menswear'])->assertOk();
        $this->assertSame($category->banner, $category->fresh()->banner);

        // A new one replaces it, and the old file goes.
        $this->putJson("/api/categories/{$id}", ['name' => 'Menswear', 'banner_temp_id' => $this->tempImage()->id])->assertOk();
        $category->refresh();
        $this->assertFileDoesNotExist($first);
        $second = $this->bannerPath($category);
        $this->assertFileExists($second);

        // Taken off.
        $this->putJson("/api/categories/{$id}", ['name' => 'Menswear', 'remove_banner' => true])->assertOk();
        $this->assertNull($category->fresh()->banner);
        $this->assertFileDoesNotExist($second);

        // Deleting a category removes its banner too.
        $this->putJson("/api/categories/{$id}", ['name' => 'Menswear', 'banner_temp_id' => $this->tempImage()->id])->assertOk();
        $third = $this->bannerPath($category->fresh());
        $this->deleteJson("/api/categories/{$id}")->assertOk();
        $this->assertFileDoesNotExist($third);
    }

    public function test_a_failed_banner_leaves_nothing_half_done(): void
    {
        $this->actingAs($this->admin);

        $this->postJson('/api/categories', ['name' => 'Men', 'banner_temp_id' => 999999])->assertUnprocessable()->assertJsonValidationErrors('banner_temp_id');

        // The record exists but its file has gone: no category is left behind, so asking again can't make a second.
        $temp = $this->tempImage();
        File::delete(public_path("uploads/temp/original/{$temp->name}"));
        $this->postJson('/api/categories', ['name' => 'Men', 'banner_temp_id' => $temp->id])->assertUnprocessable()->assertJsonValidationErrors('banner_temp_id');
        $this->assertSame(0, Category::query()->where('name', 'Men')->count());
    }

    public function test_only_admins_can_change_a_banner(): void
    {
        $category = Category::create(['name' => 'Men', 'status' => 1]);
        $seller = User::forceCreate(['name' => 'Loom', 'email' => 'loom@example.com', 'password' => 'secret123', 'role' => 'seller', 'seller_status' => User::SELLER_APPROVED]);

        $this->actingAs($seller)->putJson("/api/categories/{$category->id}", ['name' => 'Men', 'banner_temp_id' => $this->tempImage()->id])->assertForbidden();
        $this->assertNull($category->fresh()->banner);
    }

    public function test_the_home_page_gets_every_main_collection_with_its_newest_pieces(): void
    {
        $men = Category::create(['name' => 'Men', 'status' => 1]);
        $shirts = Category::create(['name' => 'Shirts', 'status' => 1, 'parent_id' => $men->id]);
        $hiddenSub = Category::create(['name' => 'Old stock', 'status' => 0, 'parent_id' => $men->id]);
        $women = Category::create(['name' => 'Women', 'status' => 1]);
        Category::create(['name' => 'Hidden', 'status' => 0]);
        $men->forceFill(['banner' => 'men.jpg'])->save();

        $this->product('In the collection', $men);
        $this->product('In a subcategory', $shirts);
        foreach (range(1, 8) as $number) {
            $this->product("Newer {$number}", $men);
        }
        // None of these are for sale, so none should count or show.
        $this->product('In a hidden subcategory', $hiddenSub);
        $this->product('Switched off', $men, ['status' => 0]);
        $this->product('Awaiting review', $men, ['approval_status' => Product::PENDING]);
        $seller = User::forceCreate(['name' => 'Gone', 'email' => 'gone@example.com', 'password' => 'secret123', 'role' => 'seller', 'seller_status' => User::SELLER_DEACTIVATED]);
        $this->product('Deactivated seller', $men, ['vendor_id' => $seller->id]);

        $response = $this->getJson('/api/storefront/home-categories')->assertOk();
        $categories = $response->json('categories');

        // Main collections only, including one with nothing in it yet, so the page can decide what to do with it.
        $this->assertSame(['Men', 'Women'], array_column($categories, 'name'));
        $this->assertSame($women->slug, $categories[1]['slug']);
        $this->assertSame([0, []], [$categories[1]['total'], $categories[1]['products']]);

        // Everything for sale counts; the newest eight come along, newest first, ready for product cards.
        $this->assertSame('men.jpg', $categories[0]['banner']);
        $this->assertSame(10, $categories[0]['total']);
        $this->assertSame(['Newer 8', 'Newer 7'], array_slice(array_column($categories[0]['products'], 'title'), 0, 2));
        $this->assertCount(8, $categories[0]['products']);
        $this->assertSame('Levis', $categories[0]['products'][0]['brand']['name']);
        $this->assertArrayHasKey('sizes', $categories[0]['products'][0]);
        $this->assertArrayHasKey('reviews_count', $categories[0]['products'][0]);
        // The long description isn't needed on a card.
        $this->assertArrayNotHasKey('description', $categories[0]['products'][0]);
    }
}
