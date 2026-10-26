<?php

namespace App\Services\Monitoring;

use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * How fast the store is: every API call's time (per route, per hour) and how quickly the website's pages load
 * for real visitors (per page, per day). Slow ones come with a plain-language hint about the likely cause.
 */
class Speed
{
    /** An API call taking at least this long counts as slow. */
    public const SLOW_MS = 1000;

    /** Largest contentful paint: under 2.5 s is good and over 4 s is poor (Google's Core Web Vitals). */
    public const LCP_GOOD = 2500;
    public const LCP_POOR = 4000;

    /** Database queries run during the current request (counted in AppServiceProvider). */
    public static int $queries = 0;

    /** What shoppers, sellers and admins know each API call as. */
    private const LABELS = [
        'GET storefront/products' => 'Shop, search & category listings',
        'GET storefront/products/{handle}' => 'Product page',
        'GET storefront/products/{product}/reviews' => 'Product reviews',
        'GET storefront/categories' => 'Menu categories',
        'GET storefront/shipping-methods' => 'Delivery options at checkout',
        'GET storefront/payment-methods' => 'Payment options at checkout',
        'GET storefront/policies/{policy}' => 'Policy pages (returns, terms, privacy)',
        'POST orders' => 'Checkout: placing an order',
        'POST orders/{order}/payment/start' => 'Checkout: starting an online payment',
        'POST orders/{order}/payment/verify' => 'Checkout: confirming a payment',
        'POST orders/{order}/payment/cod' => 'Checkout: cash on delivery',
        'POST customer/login' => 'Shopper sign-in',
        'POST vendor/login' => 'Seller sign-in',
        'POST admin/login' => 'Admin sign-in',
        'POST register' => 'Shopper sign-up',
        'POST customer/register' => 'Shopper sign-up',
        'POST vendor/register' => 'Seller sign-up',
        'GET customer/dashboard' => 'Shopper account home',
        'GET customer/orders' => 'Shopper: my orders',
        'GET customer/orders/{order}' => 'Shopper: order details',
        'GET customer/wishlist' => 'Wishlist',
        'GET vendor/dashboard' => 'Seller hub',
        'GET vendor/products' => 'Seller: my products',
        'GET vendor/orders' => 'Seller: my orders',
        'GET vendor/earnings' => 'Seller: earnings',
        'POST temp-images' => 'Photo upload',
        'GET admin/orders' => 'Admin: orders list',
        'GET admin/orders/{order}' => 'Admin: order details',
        'GET admin/products' => 'Admin: products list',
        'GET admin/users' => 'Admin: users list',
        'GET admin/sellers' => 'Admin: sellers',
        'GET admin/commissions' => 'Admin: commissions',
        'GET invoices' => 'Invoices list',
        'GET sitemap.xml' => 'Sitemap (for Google)',
    ];

    private const PAGE_LABELS = [
        '/' => 'Home page',
        '/shop' => 'Shop',
        '/shop/:category' => 'Category page',
        '/product/:handle' => 'Product page',
        '/cart' => 'Cart',
        '/checkout' => 'Checkout',
        '/wishlist' => 'Wishlist',
        '/order-confirmation/:id' => 'Order confirmation',
        '/about' => 'About us',
        '/return-refund-policy' => 'Returns & refunds policy',
        '/terms-and-conditions' => 'Terms & conditions',
        '/privacy-policy' => 'Privacy policy',
        '/customer/login' => 'Shopper sign-in',
        '/customer/register' => 'Shopper sign-up',
        '/customer/dashboard' => 'Shopper account',
        '/customer/orders' => 'Shopper: my orders',
        '/customer/orders/:id' => 'Shopper: order details',
        '/vendor/login' => 'Seller sign-in',
        '/vendor/register' => 'Seller sign-up',
        '/vendor/dashboard' => 'Seller hub',
        '/vendor/products' => 'Seller: my products',
        '/vendor/orders' => 'Seller: my orders',
    ];

    public static function recordRequest(string $route, int $ms, int $status, int $queries): void
    {
        $hour = now()->startOfHour();
        $changes = [
            'hits' => DB::raw('hits + 1'),
            'total_ms' => DB::raw('total_ms + ' . $ms),
            'max_ms' => DB::raw("CASE WHEN max_ms < {$ms} THEN {$ms} ELSE max_ms END"),
            'slow_hits' => DB::raw('slow_hits + ' . (int) ($ms >= self::SLOW_MS)),
            'error_hits' => DB::raw('error_hits + ' . (int) ($status >= 500)),
            'queries' => DB::raw('queries + ' . $queries),
        ];

        self::bump('monitor_requests', ['route' => $route, 'hour' => $hour], $changes, [
            'hits' => 1, 'total_ms' => $ms, 'max_ms' => $ms, 'slow_hits' => (int) ($ms >= self::SLOW_MS),
            'error_hits' => (int) ($status >= 500), 'queries' => $queries,
        ]);
    }

    public static function recordPage(string $page, string $device, int $lcp, int $ttfb, int $load): void
    {
        $good = (int) ($lcp > 0 && $lcp <= self::LCP_GOOD);
        $poor = (int) ($lcp > self::LCP_POOR);
        $changes = [
            'hits' => DB::raw('hits + 1'),
            'lcp_total' => DB::raw('lcp_total + ' . $lcp),
            'lcp_good' => DB::raw('lcp_good + ' . $good),
            'lcp_poor' => DB::raw('lcp_poor + ' . $poor),
            'ttfb_total' => DB::raw('ttfb_total + ' . $ttfb),
            'load_total' => DB::raw('load_total + ' . $load),
        ];

        self::bump('monitor_pages', ['page' => $page, 'day' => now()->toDateString(), 'device' => $device], $changes, [
            'hits' => 1, 'lcp_total' => $lcp, 'lcp_good' => $good, 'lcp_poor' => $poor, 'ttfb_total' => $ttfb, 'load_total' => $load,
        ]);
    }

    /** Adds to the bucket's counters, creating the bucket the first time. */
    private static function bump(string $table, array $bucket, array $changes, array $first): void
    {
        if (DB::table($table)->where($bucket)->update($changes)) {
            return;
        }
        try {
            DB::table($table)->insert([...$bucket, ...$first]);
        } catch (QueryException) {
            // Another request created the bucket a moment ago.
            DB::table($table)->where($bucket)->update($changes);
        }
    }

    /** API calls over the last `$days` days, slowest on average first. */
    public static function routes(int $days = 7): Collection
    {
        return DB::table('monitor_requests')
            ->where('hour', '>=', now()->subDays($days)->startOfHour())
            ->groupBy('route')
            ->selectRaw('route, SUM(hits) as hits, SUM(total_ms) as total_ms, MAX(max_ms) as max_ms, SUM(slow_hits) as slow_hits, SUM(error_hits) as error_hits, SUM(queries) as queries')
            ->get()
            ->map(function ($row) {
                $hits = max(1, (int) $row->hits);
                $report = [
                    'route' => $row->route,
                    'label' => self::LABELS[$row->route] ?? null,
                    'hits' => (int) $row->hits,
                    'avg_ms' => (int) round($row->total_ms / $hits),
                    'max_ms' => (int) $row->max_ms,
                    'slow_share' => round($row->slow_hits / $hits * 100, 1),
                    'error_hits' => (int) $row->error_hits,
                    'avg_queries' => round($row->queries / $hits, 1),
                ];

                return [...$report, 'tip' => self::routeTip($report)];
            })
            ->sortByDesc('avg_ms')
            ->values();
    }

    /** Website pages over the last `$days` days, slowest first. */
    public static function pages(int $days = 7): Collection
    {
        return DB::table('monitor_pages')
            ->where('day', '>=', now()->subDays($days)->toDateString())
            ->groupBy('page')
            ->selectRaw('page, SUM(hits) as hits, SUM(lcp_total) as lcp_total, SUM(lcp_good) as lcp_good, SUM(lcp_poor) as lcp_poor, SUM(ttfb_total) as ttfb_total, SUM(load_total) as load_total')
            ->selectRaw("SUM(CASE WHEN device = 'mobile' THEN hits ELSE 0 END) as mobile_hits")
            ->get()
            ->map(function ($row) {
                $hits = max(1, (int) $row->hits);
                $report = [
                    'page' => $row->page,
                    'label' => self::PAGE_LABELS[$row->page] ?? null,
                    'hits' => (int) $row->hits,
                    'mobile_share' => round($row->mobile_hits / $hits * 100),
                    'avg_lcp' => (int) round($row->lcp_total / $hits),
                    'good_share' => round($row->lcp_good / $hits * 100),
                    'poor_share' => round($row->lcp_poor / $hits * 100),
                    'avg_ttfb' => (int) round($row->ttfb_total / $hits),
                    'avg_load' => (int) round($row->load_total / $hits),
                ];

                return [...$report, 'tip' => self::pageTip($report)];
            })
            ->sortByDesc('avg_lcp')
            ->values();
    }

    public static function label(string $route): string
    {
        return self::LABELS[$route] ?? $route;
    }

    public static function pageLabel(string $page): string
    {
        return self::PAGE_LABELS[$page] ?? $page;
    }

    /** The likely cause of a slow API call, or null when it's quick enough. */
    private static function routeTip(array $report): ?string
    {
        if ($report['error_hits'] > 0 && $report['avg_ms'] < self::SLOW_MS) {
            return "Failed {$report['error_hits']} " . ($report['error_hits'] === 1 ? 'time' : 'times') . ' with a server error — see Problems for the cause.';
        }
        if ($report['avg_ms'] < 600 && $report['max_ms'] < 3000) {
            return null;
        }

        return match (true) {
            str_contains($report['route'], 'temp-images') => 'Photos are uploaded at full size. Ask sellers to upload photos under 5 MB; uploads also get quicker on a faster connection.',
            str_contains($report['route'], 'payment') => 'This waits on Razorpay. If it stays slow, check status.razorpay.com.',
            str_contains($report['route'], 'login') || str_contains($report['route'], 'register') => 'Sign-in checks the password slowly on purpose; over a second usually means the server is busy (see CPU load).',
            $report['avg_queries'] >= 30 => "Runs about {$report['avg_queries']} database queries each time — the code is probably loading related records one at a time. Ask your developer to load them together (eager loading).",
            $report['avg_ms'] >= self::SLOW_MS => 'Slow on average. Check the server’s CPU load and memory, and ask your developer to add database indexes for this page’s filters.',
            default => 'Usually quick but sometimes very slow (' . number_format($report['max_ms'] / 1000, 1) . ' s at worst) — often the server being busy at that moment.',
        };
    }

    private static function pageTip(array $report): ?string
    {
        if ($report['hits'] < 3 || ($report['poor_share'] < 10 && $report['avg_lcp'] <= self::LCP_GOOD)) {
            return null;
        }
        if ($report['avg_ttfb'] >= 800) {
            return 'The server is slow to start answering (' . number_format($report['avg_ttfb'] / 1000, 1) . ' s). Check CPU load and memory under Overview.';
        }
        if (in_array($report['page'], ['/', '/shop', '/shop/:category', '/product/:handle', '/wishlist'], true)) {
            return 'The main photo takes long to show. Optimise product photos under Storage — large photos are the usual cause.';
        }

        return $report['mobile_share'] >= 60
            ? 'Mostly visited on phones, where slow connections make big pages slow. Keep this page’s images and content light.'
            : 'Slow to show its main content. Check this page’s images and the API calls it makes (see the list above).';
    }

    /** Drops old buckets. */
    public static function prune(): void
    {
        DB::table('monitor_requests')->where('hour', '<', now()->subDays(30))->delete();
        DB::table('monitor_pages')->where('day', '<', now()->subDays(60)->toDateString())->delete();
    }
}
