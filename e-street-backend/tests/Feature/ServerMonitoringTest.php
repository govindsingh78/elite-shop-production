<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\MonitorProblem;
use App\Models\Product;
use App\Models\TempImage;
use App\Models\User;
use App\Notifications\ServerAlert;
use App\Services\Monitoring\Problems;
use App\Services\ProductImages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

class ServerMonitoringTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $customer;
    private User $seller;
    private string $sandbox;

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
        $this->withoutDefer();
        // Log entries still reach the problem list, without filling the real log file.
        config(['logging.default' => 'null', 'admin.emails' => ['owner@example.com']]);
        $this->admin = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->customer = User::create(['name' => 'Asha', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->seller = User::create(['name' => 'Loom', 'email' => 'loom@example.com', 'password' => 'secret123', 'role' => 'seller']);

        // Uploads and logs go to a throwaway folder, never the real ones.
        $this->sandbox = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ez-monitor-' . uniqid();
        File::ensureDirectoryExists($this->sandbox . '/public/uploads/temp/original');
        File::ensureDirectoryExists($this->sandbox . '/public/uploads/temp/thumb');
        File::ensureDirectoryExists($this->sandbox . '/logs');
        $this->app->usePublicPath($this->sandbox . '/public');
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->sandbox);
        parent::tearDown();
    }

    private function photo(string $path, int $width, int $height): void
    {
        File::ensureDirectoryExists(dirname($path));
        $image = imagecreatetruecolor($width, $height);
        imagefilledrectangle($image, 0, 0, $width, $height, imagecolorallocate($image, 200, 120, 40));
        imagejpeg($image, $path, 95);
        imagedestroy($image);
    }

    public function test_errors_become_grouped_problems_showing_who_ran_into_them(): void
    {
        Route::middleware('api')->get('api/test/pay/{id}', fn ($id) => throw new RuntimeException("Payment {$id} failed"));

        $this->actingAs($this->customer, 'sanctum')->getJson('/api/test/pay/12')->assertStatus(500);
        $this->actingAs($this->customer, 'sanctum')->getJson('/api/test/pay/13')->assertStatus(500);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/test/pay/14')->assertStatus(500);
        Log::warning('Message not sent', ['message' => 'OrderPlaced']);
        Log::warning('Method Foo::bar() is deprecated');
        Log::info('Just so you know');

        $this->assertSame(2, MonitorProblem::count(), 'one problem per cause; deprecations and info are left out');
        $payment = MonitorProblem::where('source', 'server')->where('level', 'error')->firstOrFail();
        $this->assertSame(3, $payment->hits);
        $this->assertSame(['customer' => 2, 'guest' => 1], $payment->affected);
        $this->assertSame('RuntimeException: Payment 12 failed', $payment->title);
        $this->assertSame('/api/test/pay/14', $payment->url);
        $this->assertStringStartsWith('tests/Feature/ServerMonitoringTest.php:', $payment->location);

        $this->actingAs($this->admin, 'sanctum');
        $this->getJson('/api/admin/server/problems')->assertOk()->assertJsonPath('total', 2)->assertJsonPath('counts.open', 2);
        $this->getJson('/api/admin/server/problems?audience=customer')->assertJsonPath('total', 1);
        $this->getJson("/api/admin/server/problems/{$payment->id}")->assertOk()
            ->assertJsonPath('problem.message', 'Payment 12 failed')
            ->assertJsonPath('problem.trace', fn ($trace) => str_contains($trace, '#0'));

        // Fixed… until it happens again.
        $this->patchJson("/api/admin/server/problems/{$payment->id}", ['status' => 'resolved'])->assertOk()->assertJsonPath('problem.status', 'resolved');
        $payment->forceFill(['notified_at' => now()])->save();
        $this->getJson('/api/test/pay/15')->assertStatus(500);
        $payment->refresh();
        $this->assertSame('open', $payment->status);
        $this->assertNull($payment->notified_at, 'a reopened problem is alerted again');
        $this->postJson('/api/admin/server/problems/resolve-all')->assertOk()->assertJsonPath('message', 'Marked 2 problems as fixed.');

        $this->actingAs($this->seller, 'sanctum')->getJson('/api/admin/server/problems')->assertForbidden();
    }

    public function test_the_website_and_app_report_crashes(): void
    {
        $report = ['source' => 'website', 'message' => "TypeError: Cannot read properties of undefined (reading 'price')", 'page' => '/product/:handle', 'stack' => 'at ProductPage (index-abc.js:1:200)'];
        $this->postJson('/api/monitor/client-errors', $report)->assertNoContent();
        $token = $this->seller->createToken('vendor_auth_token')->plainTextToken;
        $this->withToken($token)->postJson('/api/monitor/client-errors', [...$report, 'platform' => 'Chrome 140'])->assertNoContent();
        $this->postJson('/api/monitor/client-errors', [...$report, 'page' => 'javascript:alert(1)'])->assertUnprocessable();

        $problem = MonitorProblem::where('source', 'website')->sole();
        $this->assertSame(2, $problem->hits);
        $this->assertSame(['guest' => 1, 'seller' => 1], $problem->affected);
        $this->assertSame(['platform' => 'Chrome 140'], $problem->context);

        // A flood of made-up reports can't bury everything else: 30 new website/app problems an hour at most.
        for ($i = 0; $i < 31; $i++) {
            Problems::fromClient(['source' => 'app', 'message' => "Crash {$i}", 'page' => "/screen-{$i}"], null);
        }
        $this->assertSame(29, MonitorProblem::where('source', 'app')->count());
    }

    public function test_api_calls_and_page_loads_are_timed_with_hints(): void
    {
        foreach (range(1, 3) as $ignored) {
            $this->getJson('/api/storefront/categories')->assertOk();
        }
        foreach ([['mobile', 5200], ['mobile', 4800], ['desktop', 1800]] as [$device, $lcp]) {
            $this->postJson('/api/monitor/page-speed', ['page' => '/product/:handle', 'device' => $device, 'lcp' => $lcp, 'ttfb' => 300, 'load' => $lcp + 500])->assertNoContent();
        }
        DB::table('monitor_requests')->insert(['route' => 'GET storefront/products', 'hour' => now()->startOfHour(), 'hits' => 10, 'total_ms' => 25000, 'max_ms' => 4000, 'slow_hits' => 8, 'error_hits' => 0, 'queries' => 600]);

        $speed = $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/server/speed?days=1')->assertOk();
        $routes = collect($speed->json('routes'))->keyBy('route');
        $this->assertSame(3, $routes['GET storefront/categories']['hits']);
        $this->assertSame('Menu categories', $routes['GET storefront/categories']['label']);
        $this->assertFalse($routes->has('POST monitor/page-speed'), 'the reports themselves aren’t timed');
        $this->assertSame('GET storefront/products', $speed->json('routes.0.route'), 'slowest first');
        $this->assertStringContainsString('60 database queries', $speed->json('routes.0.tip'));
        $speed->assertJsonPath('pages.0.page', '/product/:handle')
            ->assertJsonPath('pages.0.hits', 3)
            ->assertJsonPath('pages.0.poor_share', 67)
            ->assertJsonPath('pages.0.mobile_share', 67)
            ->assertJsonPath('pages.0.tip', fn ($tip) => str_contains($tip, 'Optimise product photos'));

        $attention = collect($this->getJson('/api/admin/server')->assertOk()->json('attention'))->keyBy('key');
        $this->assertSame('Slow: Shop, search & category listings (2.5 s on average)', $attention['slow:GET storefront/products']['title']);
    }

    public function test_overview_storage_clean_ups_and_the_log(): void
    {
        User::forceCreate(['name' => 'New Seller', 'email' => 'new@example.com', 'password' => 'secret123', 'role' => 'seller', 'seller_status' => User::SELLER_PENDING]);
        $this->actingAs($this->admin, 'sanctum');
        $overview = $this->getJson('/api/admin/server')->assertOk()
            ->assertJsonPath('health.database.status', 'ok')
            ->assertJsonPath('health.app.php', PHP_VERSION)
            ->assertJsonPath('health.background.running', false);
        $this->assertNotNull($overview->json('health.disk.total'));
        $this->assertContains('background', array_column($overview->json('attention'), 'key'));
        $this->assertContains('sellers', array_column($overview->json('suggestions'), 'key'));

        // Old uploads go; today's stay.
        $old = TempImage::create(['name' => 'old.jpg', 'original_path' => 'uploads/temp/original/old.jpg', 'thumb_path' => 'uploads/temp/thumb/thumb_old.jpg']);
        $old->forceFill(['created_at' => now()->subDays(2)])->save();
        $fresh = TempImage::create(['name' => 'new.jpg', 'original_path' => 'uploads/temp/original/new.jpg', 'thumb_path' => 'uploads/temp/thumb/thumb_new.jpg']);
        foreach (['original/old.jpg', 'thumb/thumb_old.jpg', 'original/new.jpg', 'thumb/thumb_new.jpg'] as $file) {
            file_put_contents(public_path("uploads/temp/{$file}"), str_repeat('x', 1000));
        }
        touch(public_path('uploads/temp/original/old.jpg'), now()->subDays(2)->getTimestamp());
        $this->postJson('/api/admin/server/cleanup', ['action' => 'temp-uploads'])->assertOk()
            ->assertJsonPath('message', 'Removed 2 old upload files, freeing 2 KB.');
        $this->assertModelMissing($old);
        $this->assertModelExists($fresh);
        $this->assertFileExists(public_path('uploads/temp/original/new.jpg'));

        // Oversized product photos are shrunk in place.
        $this->photo(public_path('uploads/products/large/1-a.jpg'), 2400, 1800);
        $this->photo(public_path('uploads/products/small/1-a.jpg'), 2400, 1800);
        $storage = $this->getJson('/api/admin/server/storage?fresh=1')->assertOk();
        $this->assertSame(1, $storage->json('storage.photos.small.oversized'));
        $this->postJson('/api/admin/server/cleanup', ['action' => 'photos'])->assertOk()
            ->assertJsonPath('optimised', 2)->assertJsonPath('remaining', 0);
        $this->assertSame([1600, 1200], array_slice(getimagesize(public_path('uploads/products/large/1-a.jpg')), 0, 2));
        $this->assertSame([600, 450], array_slice(getimagesize(public_path('uploads/products/small/1-a.jpg')), 0, 2));
        $this->postJson('/api/admin/server/cleanup', ['action' => 'photos'])->assertJsonPath('message', 'All product photos are already the right size.');

        // The latest log entries, worst only.
        $this->app->useStoragePath($this->sandbox);
        file_put_contents(storage_path('logs/laravel.log'), implode("\n", [
            '[2026-10-26 09:00:00] production.INFO: Started',
            '[2026-10-26 09:01:00] production.ERROR: Checkout failed {"exception":"[object] (RuntimeException(code: 0): Checkout failed at /app/X.php:10)',
            '[stacktrace]',
            '#0 /app/Y.php(20): handle()',
            '[2026-10-26 09:02:00] production.WARNING: Message not sent',
        ]) . "\n");
        $this->getJson('/api/admin/server/logs?level=error')->assertOk()
            ->assertJsonPath('file', 'laravel.log')
            ->assertJsonCount(1, 'entries')
            ->assertJsonPath('entries.0.level', 'error')
            ->assertJsonPath('entries.0.message', fn ($message) => str_starts_with($message, 'Checkout failed'))
            ->assertJsonPath('entries.0.details', fn ($details) => str_contains($details, '#0 /app/Y.php'));
        $this->getJson('/api/admin/server/logs')->assertJsonCount(3, 'entries')->assertJsonPath('entries.0.message', 'Message not sent');
    }

    public function test_the_scheduled_check_alerts_admins_once_per_new_problem(): void
    {
        Notification::fake();
        Log::error('Razorpay webhook signature mismatch');

        $this->artisan('monitor:check')->assertExitCode(0);
        Notification::assertSentTo($this->admin, ServerAlert::class, fn (ServerAlert $alert) => $alert->problemCount === 1
            && str_contains($alert->body(), 'Razorpay webhook signature mismatch') && $alert->webPath() === '/admin/server');
        $this->assertNotNull(MonitorProblem::sole()->notified_at);

        $this->artisan('monitor:check')->assertExitCode(0);
        Notification::assertSentToTimes($this->admin, ServerAlert::class, 1);
        $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/server')->assertJsonPath('health.background.running', true);
        $this->artisan('monitor:tidy')->assertExitCode(0);
    }

    public function test_new_product_photos_are_saved_at_sensible_sizes(): void
    {
        $category = Category::create(['name' => 'Men', 'slug' => 'men', 'status' => 1]);
        $brand = Brand::create(['name' => 'Acme', 'status' => 1]);
        $product = Product::create(['title' => 'Linen shirt', 'price' => 1499, 'category_id' => $category->id, 'brand_id' => $brand->id, 'sku' => 'LIN-1', 'barcode' => '1', 'qty' => 4, 'status' => 1, 'is_featured' => 'no']);
        $this->photo(public_path('uploads/temp/original/big.jpg'), 4000, 3000);
        $upload = TempImage::create(['name' => 'big.jpg', 'original_path' => 'uploads/temp/original/big.jpg', 'thumb_path' => 'uploads/temp/thumb/thumb_big.jpg']);

        $this->assertSame(1, ProductImages::attachTempImages($product, [$upload->id]));
        $name = $product->fresh()->image;
        $this->assertSame([1600, 1200], array_slice(getimagesize(public_path("uploads/products/large/{$name}")), 0, 2));
        $this->assertSame([600, 450], array_slice(getimagesize(public_path("uploads/products/small/{$name}")), 0, 2));
    }
}
