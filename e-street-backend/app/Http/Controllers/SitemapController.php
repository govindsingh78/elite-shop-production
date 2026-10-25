<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Support\Carbon;

/**
 * sitemap.xml for search engines: the website's public pages, every live collection and every product
 * on the storefront, with product photos. robots.txt on the website points here.
 */
class SitemapController extends Controller
{
    private const STATIC_PAGES = [
        ['/', 'daily', '1.0'],
        ['/shop', 'daily', '0.9'],
        ['/about', 'monthly', '0.6'],
        ['/return-refund-policy', 'yearly', '0.3'],
        ['/terms-and-conditions', 'yearly', '0.3'],
        ['/privacy-policy', 'yearly', '0.3'],
        ['/vendor/register', 'monthly', '0.4'],
    ];

    public function index()
    {
        $site = rtrim((string) config('app.frontend_url'), '/');
        $entries = [];

        foreach (self::STATIC_PAGES as [$path, $frequency, $priority]) {
            $entries[] = ['loc' => $site . $path, 'changefreq' => $frequency, 'priority' => $priority];
        }

        // Live collections; a subcategory is hidden along with its parent.
        Category::query()
            ->where('status', 1)
            ->where(fn ($query) => $query->whereNull('parent_id')->orWhereHas('parent', fn ($parent) => $parent->where('status', 1)))
            ->whereNotNull('slug')
            ->orderBy('id')
            ->get(['id', 'slug', 'updated_at'])
            ->each(function (Category $category) use (&$entries, $site) {
                $entries[] = ['loc' => "{$site}/shop/{$category->slug}", 'lastmod' => $category->updated_at, 'changefreq' => 'daily', 'priority' => '0.8'];
            });

        Product::query()
            ->onStorefront()
            ->orderBy('id')
            ->get(['id', 'title', 'image', 'updated_at'])
            ->each(function (Product $product) use (&$entries, $site) {
                $entries[] = [
                    'loc' => "{$site}/product/{$product->id}",
                    'lastmod' => $product->updated_at,
                    'changefreq' => 'weekly',
                    'priority' => '0.7',
                    'image' => $product->image ? ['loc' => url('uploads/products/large/' . rawurlencode($product->image)), 'title' => $product->title] : null,
                ];
            });

        return response($this->render($entries), 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    private function render(array $entries): string
    {
        $xml = ['<?xml version="1.0" encoding="UTF-8"?>'];
        $xml[] = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">';

        foreach ($entries as $entry) {
            $xml[] = '  <url>';
            $xml[] = '    <loc>' . e($entry['loc']) . '</loc>';
            if (!empty($entry['lastmod'])) {
                $xml[] = '    <lastmod>' . Carbon::parse($entry['lastmod'])->toAtomString() . '</lastmod>';
            }
            $xml[] = "    <changefreq>{$entry['changefreq']}</changefreq>";
            $xml[] = "    <priority>{$entry['priority']}</priority>";
            if (!empty($entry['image'])) {
                $xml[] = '    <image:image><image:loc>' . e($entry['image']['loc']) . '</image:loc><image:title>' . e($entry['image']['title']) . '</image:title></image:image>';
            }
            $xml[] = '  </url>';
        }

        $xml[] = '</urlset>';

        return implode("\n", $xml) . "\n";
    }
}
