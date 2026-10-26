<?php

namespace App\Services\Monitoring;

use App\Models\Category;
use App\Models\MonitorProblem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\ServerAlert;
use App\Services\GoogleSignIn;
use App\Services\Gst;
use App\Services\Messenger;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * Reads the server's health, problems and speed, and says what needs doing: "needs attention" items (alerted
 * to the admins by the scheduled check), and suggestions for running the store better.
 */
class Advisor
{
    private const SEVERITY_ORDER = ['critical' => 0, 'warning' => 1, 'info' => 2];
    private const ALERTED = 'monitor.alerted';

    /** What's wrong (or about to be) with the server, worst first. Each has a `key` so alerts aren't repeated. */
    public static function attention(?array $health = null): array
    {
        $health ??= ServerHealth::snapshot();
        $production = app()->environment('production');
        $items = [];
        $add = function (string $key, string $severity, string $title, string $detail, ?string $tab = null, array $commands = []) use (&$items) {
            $items[] = compact('key', 'severity', 'title', 'detail', 'tab', 'commands');
        };

        if (($disk = $health['disk']) && $disk['status'] !== 'ok') {
            $add('disk', $disk['status'], "Disk {$disk['percent']}% full",
                'Only ' . ServerHealth::bytes($disk['free']) . ' free of ' . ServerHealth::bytes($disk['total']) . '. When it fills up, photo uploads, orders and deploys start failing. Free some space, or make the disk bigger.', 'storage');
        }
        if (($memory = $health['memory']) && $memory['status'] !== 'ok') {
            $add('memory', $memory['status'], "Memory almost used up ({$memory['percent']}% in use)",
                'Only ' . ServerHealth::bytes($memory['available']) . ' left. Pages slow down and PHP can be stopped mid-request.'
                . ($memory['swap_total'] ? '' : ' The server has no swap file, which would give it room to breathe.'), 'overview');
        }
        if (($cpu = $health['cpu']) && $cpu['status'] !== 'ok') {
            $add('cpu', $cpu['status'], 'The server is overloaded',
                "Load averaged {$cpu['load'][1]} over 5 minutes on {$cpu['cores']} CPU " . ($cpu['cores'] === 1 ? 'core' : 'cores') . ', so requests are waiting their turn. Check Speed for slow pages, or move to a bigger server.', 'speed');
        }
        $database = $health['database'];
        if ($database['status'] === 'critical') {
            $add('database', 'critical', 'The database can’t be reached', $database['error'] ?? 'Shoppers can’t browse or order until it’s back.', 'overview');
        } elseif ($database['status'] === 'warning') {
            $add('database', 'warning', "The database is answering slowly ({$database['latency_ms']} ms)", 'A simple check should take a few milliseconds. Check the database server’s CPU and storage in AWS RDS.', 'overview');
        }

        $app = $health['app'];
        if ($production && $app['debug']) {
            $add('debug', 'critical', 'Debug mode is on',
                'Error pages can show passwords and keys to anyone. Set APP_DEBUG=false in the backend’s .env, then run the command below.', 'overview', ['php artisan config:cache']);
        }
        if ($app['opcache'] === false) {
            $add('opcache', 'warning', 'PHP OPcache is off', 'PHP recompiles the code on every request. Turning on OPcache for PHP-FPM makes every page faster.', 'overview',
                ['sudo sed -i "s/^;*opcache.enable=.*/opcache.enable=1/" /etc/php/8.5/fpm/php.ini', 'sudo systemctl reload php8.5-fpm']);
        }
        if ($production && !$app['config_cached']) {
            $add('config-cache', 'info', 'Settings aren’t cached', 'Laravel reads .env on every request. Deploys cache it; run this if you changed .env by hand.', 'overview', ['php artisan config:cache']);
        }
        if ($production && in_array($app['mailer'], ['log', 'array'], true)) {
            $add('mail', 'warning', 'Emails aren’t being sent',
                "MAIL_MAILER is “{$app['mailer']}”, so order, password and seller emails only go into the log. Set up an email service (such as Amazon SES or your domain’s SMTP) in .env.", 'overview');
        }
        if ($production && str_starts_with((string) config('services.razorpay.key_id'), 'rzp_test_')) {
            $add('payments', 'warning', 'Online payments are in test mode', 'Razorpay test keys are set, so shoppers can’t really pay online. Add the live keys to .env.', 'overview');
        }
        if (!$health['background']['running']) {
            $add('background', $production ? 'warning' : 'info', $health['background']['last_check_at'] ? 'Automatic checks stopped running' : 'Automatic checks aren’t running yet',
                'Without them you won’t be alerted about a full disk or new problems, and old uploads aren’t cleared. The next deploy sets them up; to do it now, add this line with “sudo crontab -u www-data -e”:', 'overview', [$health['background']['cron']]);
        }

        $logBytes = array_sum(array_column(ServerHealth::logFiles(), 'size'));
        if ($logBytes > 100 * 1024 * 1024) {
            $add('logs', 'warning', 'Log files are using ' . ServerHealth::bytes($logBytes), 'Old log entries are rarely needed. Clean them up under Storage.', 'storage');
        }

        $recent = MonitorProblem::query()->where('status', MonitorProblem::OPEN)->where('last_seen_at', '>=', now()->subDay());
        if ($count = (clone $recent)->count()) {
            $top = (clone $recent)->orderByDesc('hits')->first();
            $add('problems', $count >= 5 || $top->level === 'critical' ? 'warning' : 'info', $count . ' open ' . ($count === 1 ? 'problem' : 'problems') . ' in the last 24 hours',
                "Most frequent: “{$top->title}” ({$top->hits}×" . (($who = self::mostAffected($top)) ? ", mostly {$who}" : '') . ').', 'problems');
        }

        foreach (Speed::routes(1)->filter(fn ($route) => $route['avg_ms'] >= Speed::SLOW_MS && $route['hits'] >= 5)->take(3) as $route) {
            $add('slow:' . $route['route'], 'warning', 'Slow: ' . ($route['label'] ?? $route['route']) . ' (' . number_format($route['avg_ms'] / 1000, 1) . ' s on average)', $route['tip'] ?? '', 'speed');
        }
        foreach (Speed::pages(7)->filter(fn ($page) => $page['poor_share'] >= 25 && $page['hits'] >= 10)->take(3) as $page) {
            $add('slow-page:' . $page['page'], 'warning', ($page['label'] ?? $page['page']) . ' loads slowly for visitors',
                "{$page['poor_share']}% of visits wait over 4 s for the main content. " . ($page['tip'] ?? ''), 'speed');
        }

        usort($items, fn ($a, $b) => self::SEVERITY_ORDER[$a['severity']] <=> self::SEVERITY_ORDER[$b['severity']]);

        return $items;
    }

    /** Ways to run the store better, from what's in it right now. Each links to where to act. */
    public static function suggestions(): array
    {
        $items = [];
        $add = function (string $key, string $title, string $detail, ?string $link = null, ?string $appLink = null, ?string $tab = null) use (&$items) {
            $items[] = ['key' => $key, 'title' => $title, 'detail' => $detail, 'link' => $link, 'app_link' => $appLink, 'tab' => $tab];
        };
        $plural = fn (int $count, string $one, string $many) => $count . ' ' . ($count === 1 ? $one : $many);

        if ($count = User::query()->where('role', 'seller')->where('seller_status', User::SELLER_PENDING)->count()) {
            $add('sellers', $plural($count, 'seller is', 'sellers are') . ' waiting for approval', 'They can’t list products until you approve them.', '/admin/sellers?status=pending', '/admin/sellers');
        }
        if ($count = Product::query()->where('approval_status', Product::PENDING)->count()) {
            $add('listings', $plural($count, 'listing is', 'listings are') . ' waiting for review', 'Seller products stay hidden from shoppers until you approve them.', '/admin/manage-products?approval=pending', '/admin/products');
        }
        if ($count = Order::query()->whereIn('status', ['pending', 'processing'])->where('created_at', '<', now()->subDays(2))->count()) {
            $add('late-orders', $plural($count, 'order has', 'orders have') . ' waited over 2 days to ship', 'Quick dispatch brings repeat customers; late ones bring cancellations.', '/admin/manage-orders', '/admin/orders');
        }

        $live = Product::query()->onStorefront();
        if ($count = (clone $live)->whereNotNull('qty')->where('qty', '<=', 0)->count()) {
            $add('sold-out', $plural($count, 'live product is', 'live products are') . ' sold out', 'They show in the shop but can’t be bought. Restock them, or switch them off for now.', '/admin/manage-products', '/admin/products');
        }
        if ($count = (clone $live)->where(fn ($query) => $query->whereNull('image')->orWhere('image', ''))->count()) {
            $add('no-photo', $plural($count, 'product has', 'products have') . ' no photo', 'Listings with clear photos sell far better.', '/admin/manage-products', '/admin/products');
        }
        if ($count = (clone $live)->where(fn ($query) => $query->whereNull('description')->orWhere('description', ''))
            ->where(fn ($query) => $query->whereNull('short_description')->orWhere('short_description', ''))->count()) {
            $add('no-description', $plural($count, 'product has', 'products have') . ' no description', 'A few lines on fabric, fit and care help shoppers decide, and help Google show your products.', '/admin/manage-products', '/admin/products');
        }
        try {
            $poorlyRated = ProductReview::query()->published()->select('product_id')->groupBy('product_id')
                ->havingRaw('COUNT(*) >= 3 AND AVG(rating) < 3')->get()->count();
        } catch (Throwable) {
            $poorlyRated = 0;
        }
        if ($poorlyRated) {
            $add('ratings', $plural($poorlyRated, 'product is', 'products are') . ' rated below 3 stars', 'Read what shoppers say: the photos or description may not match what arrives.', '/admin/manage-reviews');
        }

        $storage = ServerHealth::quickStorage();
        $oversized = $storage['photos']['small']['oversized'] + $storage['photos']['large']['oversized'];
        if ($oversized) {
            $add('photos', $plural($oversized, 'product photo is', 'product photos are') . ' bigger than needed',
                'Listing pages download photos averaging ' . ServerHealth::bytes($storage['photos']['small']['average']) . ' each. Optimising them makes the shop load faster and frees disk space.', null, null, 'storage');
        }
        if ($storage['temp_bytes'] > 100 * 1024 * 1024) {
            $add('temp-uploads', 'Old photo uploads are using ' . ServerHealth::bytes($storage['temp_bytes']), 'Uploads are copied into their products, so the originals can go.', null, null, 'storage');
        }

        if (!filled(Gst::store()['gstin'] ?? null)) {
            $add('gstin', 'Add Elitezaar’s GSTIN', 'Without it, the store’s invoices are bills of supply with no GST.', '/admin/gst');
        } elseif ($count = Category::query()->whereNull('parent_id')->where('status', 1)->where(fn ($query) => $query->whereNull('hsn_code')->orWhere('hsn_code', ''))->count()) {
            $add('hsn', $plural($count, 'category has', 'categories have') . ' no HSN code', 'Tax invoices should show the HSN code of each product.', '/admin/manage-categories');
        }
        if (!app(GoogleSignIn::class)->configured()) {
            $add('google', 'Turn on “Continue with Google”', 'Shoppers sign up faster with one tap. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the backend’s .env.');
        }

        return $items;
    }

    /**
     * Run by the scheduled check: alerts the admins (email, push and inbox) about new problems and about server
     * trouble they haven't heard about in the last day. Returns whether an alert was sent.
     */
    public static function alertAdmins(): bool
    {
        $now = now();
        $items = collect(self::attention())->whereIn('severity', ['critical', 'warning'])->where('key', '!=', 'problems')->keyBy('key');
        $alerted = json_decode((string) Setting::read(self::ALERTED, ''), true) ?: [];
        // Trouble that cleared up is forgotten, so it alerts again if it comes back.
        $alerted = array_intersect_key($alerted, $items->all());
        $fresh = $items->filter(fn ($item, $key) => !isset($alerted[$key]) || Carbon::parse($alerted[$key])->lt($now->copy()->subDay()));
        $problems = MonitorProblem::query()->where('status', MonitorProblem::OPEN)->whereNull('notified_at')->orderByDesc('hits')->get();

        if ($fresh->isNotEmpty() || $problems->isNotEmpty()) {
            Messenger::send(User::storeAdmins(), new ServerAlert($fresh->values()->all(), $problems->take(5)->map(fn ($problem) => [
                'title' => $problem->title,
                'hits' => $problem->hits,
                'who' => self::mostAffected($problem),
            ])->all(), $problems->count()));
            MonitorProblem::query()->whereIn('id', $problems->pluck('id'))->update(['notified_at' => $now]);
            foreach ($fresh->keys() as $key) {
                $alerted[$key] = $now->toIso8601String();
            }
        }
        Setting::write(self::ALERTED, json_encode($alerted));

        return $fresh->isNotEmpty() || $problems->isNotEmpty();
    }

    /** "shoppers", "sellers"… whoever ran into the problem most. */
    public static function mostAffected(MonitorProblem $problem): ?string
    {
        $affected = $problem->affected ?? [];
        arsort($affected);
        $who = array_key_first($affected);

        return ['customer' => 'shoppers', 'seller' => 'sellers', 'admin' => 'admins', 'guest' => 'visitors not signed in', 'system' => 'background tasks'][$who] ?? null;
    }

    /** Clears out problems fixed long ago. */
    public static function prune(): void
    {
        MonitorProblem::query()->where(fn ($query) => $query
            ->where(fn ($resolved) => $resolved->where('status', MonitorProblem::RESOLVED)->where('resolved_at', '<', now()->subDays(90)))
            ->orWhere('last_seen_at', '<', now()->subDays(180)))->delete();
    }
}
