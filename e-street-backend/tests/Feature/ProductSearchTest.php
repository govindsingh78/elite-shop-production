<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Services\ProductSearch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductSearchTest extends TestCase
{
    use RefreshDatabase;

    private Category $men;
    private Category $women;
    private Category $toys;
    private Brand $levis;

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
        $this->men = Category::create(['name' => 'Men', 'slug' => 'men', 'status' => 1]);
        $this->women = Category::create(['name' => 'Women', 'slug' => 'women', 'status' => 1]);
        $kids = Category::create(['name' => 'Kids', 'slug' => 'kids', 'status' => 1]);
        $this->toys = Category::create(['name' => 'Toys', 'slug' => 'kids-toys', 'status' => 1, 'parent_id' => $kids->id]);
        $house = Brand::create(['name' => 'Elitezaar Basics', 'status' => 1]);
        $this->levis = Brand::create(['name' => 'Levis', 'status' => 1]);

        $this->product('Classic Linen Shirt', 1899, $this->men, $house, 'Breathable linen for summer days.');
        $this->product('Handwoven Silk Saree', 5000, $this->women, $house, 'Pure silk with a zari border.');
        $this->product('Everyday Slim Jeans', 2499, $this->men, $this->levis, 'Stretch denim.');
        $this->product('Wooden Stacking Rainbow', 799, $this->toys, $house, 'A calming wooden toy.');
        $this->product('Cotton Kurta', 1299, $this->men, $house, 'Soft cotton, with a linen-look weave.');
        // A "Shirts" subcategory under Men, while the linen shirt is filed under Men itself.
        $shirts = Category::create(['name' => 'Shirts', 'slug' => 'men-shirts', 'status' => 1, 'parent_id' => $this->men->id]);
        $this->product('Oxford Shirt', 1599, $shirts, $house, 'Crisp cotton oxford.');
    }

    private function product(string $title, float $price, Category $category, Brand $brand, string $short): Product
    {
        static $sku = 0;
        $sku++;

        return Product::create([
            'title' => $title, 'price' => $price, 'category_id' => $category->id, 'brand_id' => $brand->id, 'short_description' => $short,
            'sku' => "EZ-{$sku}", 'barcode' => (string) $sku, 'qty' => 5, 'status' => 1, 'is_featured' => 'no', 'approval_status' => Product::APPROVED,
        ]);
    }

    private function search(string $query, array $extra = [])
    {
        return $this->getJson('/api/storefront/products?' . http_build_query(['search' => $query, ...$extra]))->assertOk();
    }

    private function titles($response): array
    {
        return array_column($response->json('products.data'), 'title');
    }

    public function test_spoken_phrases_are_understood(): void
    {
        $shirts = ProductSearch::interpret('Show me linen shirts for men under 2,000 rupees');
        $this->assertSame(['linen', 'shirt'], $shirts['terms']);
        $this->assertSame('Men', $shirts['category']->name);
        $this->assertSame(2000.0, $shirts['max_price']);

        $jeans = ProductSearch::interpret("Levi's jeans between ₹1000 and 3k");
        $this->assertSame('Levis', $jeans['brand']->name);
        $this->assertSame(['jean'], $jeans['terms']);
        $this->assertSame([1000.0, 3000.0], [$jeans['min_price'], $jeans['max_price']]);

        $toys = ProductSearch::interpret('kids toys above 500');
        $this->assertSame('Kids', $toys['category']->name);
        $this->assertSame(['toy'], $toys['terms'], 'subcategory names stay as words (they match the category name)');
        $this->assertSame(500.0, $toys['min_price']);

        $both = ProductSearch::interpret('kurtas for men and women');
        $this->assertNull($both['category'], 'two collections: neither');
        $this->assertSame(['kurta'], $both['terms']);

        $this->assertSame(['t-shirt'], ProductSearch::interpret('T-Shirt')['terms']);
        $this->assertSame('Women', ProductSearch::interpret("ladies' dresses")['category']->name);
    }

    public function test_the_storefront_returns_what_was_asked_for(): void
    {
        $response = $this->search('show me linen shirts for men under 2000');
        $this->assertSame(['Classic Linen Shirt'], $this->titles($response));
        $response->assertJsonPath('search.category.name', 'Men')
            ->assertJsonPath('search.max_price', 2000)
            ->assertJsonPath('search.terms', ['linen', 'shirt'])
            ->assertJsonPath('search.match', 'all');

        // Plurals find singular titles, and brands work by name.
        // Filed under Men or under its Shirts subcategory, both are shirts (equally good matches: newest first).
        $this->assertSame(['Oxford Shirt', 'Classic Linen Shirt'], $this->titles($this->search('shirts')));
        $this->assertSame(['Oxford Shirt'], $this->titles($this->search('shirts for men under 1800')));
        $this->assertSame(['Everyday Slim Jeans'], $this->titles($this->search('levis jeans')));
        $this->assertSame(['Wooden Stacking Rainbow'], $this->titles($this->search('toys for kids')));
        $this->assertSame(['Handwoven Silk Saree'], $this->titles($this->search('saree above 1000')));
        $sku = Product::query()->where('title', 'Everyday Slim Jeans')->value('sku');
        $this->assertSame(['Everyday Slim Jeans'], $this->titles($this->search($sku)), 'SKU searches still work');
    }

    public function test_best_matches_come_first_and_close_matches_beat_nothing(): void
    {
        // "linen" is in the shirt's title but only the kurta's description: the shirt comes first.
        $this->assertSame(['Classic Linen Shirt', 'Cotton Kurta'], $this->titles($this->search('linen')));

        // Nothing is a blue linen shirt: show what matches some of the words instead of nothing.
        $response = $this->search('blue linen shirt');
        $response->assertJsonPath('search.match', 'any');
        $this->assertSame('Classic Linen Shirt', $this->titles($response)[0]);

        // The shopper's own choices win over what the search says.
        $this->assertSame([], $this->titles($this->search('shirt under 1000', ['max_price' => 900])));
        $this->assertSame(['Oxford Shirt', 'Classic Linen Shirt'], $this->titles($this->search('shirt under 1000', ['max_price' => 2000])));
        $this->assertSame([], $this->titles($this->getJson('/api/storefront/products?category_slug=women&search=shirt')->assertOk()));
        $this->assertSame([2499, 1899, 1599, 1299], array_map('intval', array_column($this->search('men', ['sort' => 'price_desc'])->json('products.data'), 'price')));
    }
}
