<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SitemapTest extends TestCase
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

    public function test_sitemap_lists_public_pages_live_collections_and_storefront_products(): void
    {
        config(['app.frontend_url' => 'https://elitezaar.com/']);
        $kids = Category::create(['name' => 'Kids', 'status' => 1]);
        $toys = Category::create(['name' => 'Toys', 'status' => 1, 'parent_id' => $kids->id]);
        $hidden = Category::create(['name' => 'Archive', 'status' => 0]);
        $orphan = Category::create(['name' => 'Old', 'status' => 1, 'parent_id' => $hidden->id]);
        $brand = Brand::create(['name' => 'Fabindia', 'status' => 1]);
        $make = fn (string $sku, array $overrides = []) => Product::create(array_merge([
            'title' => "Kurta & Co {$sku}", 'price' => 999, 'category_id' => $toys->id, 'brand_id' => $brand->id,
            'qty' => 3, 'sku' => $sku, 'barcode' => '', 'status' => 1, 'image' => "{$sku}.jpg",
        ], $overrides));
        $live = $make('LIVE');
        $draft = $make('DRAFT', ['status' => 0]);
        $pending = $make('PENDING', ['approval_status' => Product::PENDING]);

        $response = $this->get('/api/sitemap.xml')->assertOk()
            ->assertHeader('Content-Type', 'application/xml; charset=UTF-8');
        $xml = simplexml_load_string($response->getContent());
        $this->assertNotFalse($xml, 'The sitemap must be well-formed XML.');
        $urls = array_map('strval', $xml->xpath('//*[local-name()="loc" and namespace-uri()="http://www.sitemaps.org/schemas/sitemap/0.9"]'));

        foreach (['/', '/shop', '/about', '/return-refund-policy', '/terms-and-conditions', '/privacy-policy'] as $path) {
            $this->assertContains('https://elitezaar.com' . $path, $urls);
        }
        $this->assertContains("https://elitezaar.com/shop/{$kids->slug}", $urls);
        $this->assertContains("https://elitezaar.com/shop/{$toys->slug}", $urls);
        $this->assertNotContains("https://elitezaar.com/shop/{$hidden->slug}", $urls);
        $this->assertNotContains("https://elitezaar.com/shop/{$orphan->slug}", $urls);

        $this->assertContains("https://elitezaar.com/product/{$live->id}", $urls);
        $this->assertNotContains("https://elitezaar.com/product/{$draft->id}", $urls);
        $this->assertNotContains("https://elitezaar.com/product/{$pending->id}", $urls);

        // Product photos are listed, with "&" escaped in titles.
        $this->assertStringContainsString('<image:loc>' . url('uploads/products/large/LIVE.jpg') . '</image:loc>', $response->getContent());
        $this->assertStringContainsString('<image:title>Kurta &amp; Co LIVE</image:title>', $response->getContent());
    }
}
