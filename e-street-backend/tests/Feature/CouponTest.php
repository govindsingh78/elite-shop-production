<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Notifications\OrderPlaced;
use App\Services\Commissions;
use App\Services\Gst;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CouponTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $seller;
    private Category $men;
    private Category $kids;
    private Product $blazer;
    private Product $toy;

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
        $this->withoutMiddleware(ThrottleRequests::class);
        Carbon::setTestNow('2026-10-27 10:00:00');
        config(['admin.emails' => ['owner@example.com']]);
        $this->admin = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'secret123', 'role' => 'admin']);
        // A registered seller in Maharashtra; the store is registered in Rajasthan, where the orders go.
        $this->seller = User::forceCreate(['name' => 'Loom Studio', 'email' => 'loom@example.com', 'password' => 'secret123', 'role' => 'seller', 'seller_status' => User::SELLER_APPROVED,
            'legal_name' => 'Loom Studio LLP', 'gstin' => '27AAPFU0939F1ZV', 'business_address' => '4 Linking Road, Mumbai', 'business_state' => '27']);
        Gst::saveStore(['legal_name' => 'Elitezaar Retail Pvt Ltd', 'gstin' => '08AABCE1234F1Z5', 'state_code' => '08', 'address' => '12 MI Road, Jaipur']);
        Commissions::setDefaultRate(10);
        // Clothing: 5% up to ₹2,500 a piece (before GST), 18% above.
        $this->men = Category::create(['name' => 'Men', 'status' => 1, 'hsn_code' => '6205', 'gst_rate' => 5, 'gst_rate_high' => 18, 'gst_threshold' => 2500]);
        $this->kids = Category::create(['name' => 'Kids', 'status' => 1, 'hsn_code' => '9503', 'gst_rate' => 12]);
        $brand = Brand::create(['name' => 'Acme', 'status' => 1]);
        $make = fn (string $title, float $price, Category $category, ?User $seller) => Product::create([
            'title' => $title, 'price' => $price, 'category_id' => $category->id, 'brand_id' => $brand->id, 'sku' => strtoupper(substr(md5($title), 0, 8)),
            'barcode' => '', 'qty' => 50, 'status' => 1, 'is_featured' => 'no', 'approval_status' => Product::APPROVED, 'vendor_id' => $seller?->id,
        ]);
        $this->blazer = $make('Linen blazer', 2800, $this->men, $this->seller);
        $this->toy = $make('Wooden train', 1000, $this->kids, null);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function coupon(array $values = [])
    {
        return $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/coupons', [
            'code' => 'aw30', 'title' => 'Flat 30% Off On Select Fashion', 'description' => 'On men’s clothing', 'terms' => 'Not valid with other offers.',
            'type' => 'percent', 'value' => 30, 'max_discount' => 500, 'category_ids' => [$this->men->id], 'funded_by' => 'store', ...$values,
        ]);
    }

    private function order(array $items, array $overrides = [])
    {
        auth()->forgetGuards();

        return $this->postJson('/api/orders', [
            'customer_name' => 'Asha Verma', 'customer_email' => 'asha@example.com', 'address' => '14 Civil Lines', 'city' => 'Jaipur', 'state' => 'Rajasthan',
            'postal_code' => '302006', 'country' => 'India', 'payment_method' => 'cod', 'accept_policy' => true,
            'items' => array_map(fn ($line) => ['product_id' => $line[0]->id, 'quantity' => $line[1]], $items), ...$overrides,
        ]);
    }

    private function check(string $code, array $items, ?string $email = 'asha@example.com')
    {
        auth()->forgetGuards();

        return $this->postJson('/api/storefront/coupons/check', [
            'code' => $code, 'customer_email' => $email,
            'items' => array_map(fn ($line) => ['product_id' => $line[0]->id, 'quantity' => $line[1]], $items),
        ]);
    }

    public function test_admins_create_and_manage_coupons(): void
    {
        $this->coupon()->assertCreated()->assertJsonPath('coupon.code', 'AW30')->assertJsonPath('coupon.headline', '30% off')->assertJsonPath('coupon.state', 'active');
        $this->coupon()->assertUnprocessable()->assertJsonPath('errors.code.0', 'Another coupon already uses this code.');
        $this->coupon(['code' => 'A!'])->assertUnprocessable()->assertJsonValidationErrors(['code']);
        $this->coupon(['code' => 'BIG', 'value' => 120])->assertUnprocessable()->assertJsonPath('errors.value.0', 'A percentage can’t be more than 100.');
        $this->coupon(['code' => 'DATES', 'starts_on' => '2026-11-10', 'ends_on' => '2026-11-01'])->assertUnprocessable()->assertJsonValidationErrors(['ends_on']);

        // Dates are whole days in India; a flat coupon has no cap.
        $diwali = $this->coupon(['code' => 'DIWALI', 'type' => 'flat', 'value' => 200, 'max_discount' => 50, 'starts_on' => '2026-11-01', 'ends_on' => '2026-11-08', 'category_ids' => []])
            ->assertCreated()->assertJsonPath('coupon.state', 'scheduled')->assertJsonPath('coupon.max_discount', null)
            ->assertJsonPath('coupon.starts_on', '2026-11-01')->assertJsonPath('coupon.ends_on', '2026-11-08')->json('coupon');
        $this->assertSame('2026-11-08 18:30:00', Coupon::find($diwali['id'])->ends_at->toDateTimeString(), 'the end of 8 Nov in India');

        $this->getJson('/api/admin/coupons')->assertOk()->assertJsonPath('counts.active', 1)->assertJsonPath('counts.scheduled', 1)->assertJsonPath('total', 2);
        $this->getJson('/api/admin/coupons?state=scheduled')->assertOk()->assertJsonPath('data.0.code', 'DIWALI');
        $this->patchJson("/api/admin/coupons/{$diwali['id']}/status", ['status' => false])->assertOk()->assertJsonPath('coupon.state', 'paused');
        $this->putJson("/api/admin/coupons/{$diwali['id']}", [...$diwali, 'title' => 'Diwali special', 'status' => true, 'funded_by' => 'seller'])->assertOk()->assertJsonPath('coupon.title', 'Diwali special');
        $this->deleteJson("/api/admin/coupons/{$diwali['id']}")->assertOk();
        $this->getJson('/api/admin/coupons/products?search=linen')->assertOk()->assertJsonPath('products.0.title', 'Linen blazer');

        $this->actingAs($this->seller, 'sanctum')->getJson('/api/admin/coupons')->assertForbidden();
    }

    public function test_product_pages_show_the_offers_that_cover_them(): void
    {
        $this->coupon()->assertCreated();
        $this->coupon(['code' => 'SECRET', 'show_on_product' => false])->assertCreated();
        $this->coupon(['code' => 'ALL25', 'title' => 'Flat 25% off for all users', 'value' => 25, 'max_discount' => null, 'category_ids' => []])->assertCreated();
        $this->coupon(['code' => 'OLD', 'category_ids' => [], 'ends_on' => '2026-10-20'])->assertCreated();
        $this->coupon(['code' => 'OFF', 'category_ids' => [], 'status' => false])->assertCreated();
        auth()->forgetGuards();

        $blazer = $this->getJson("/api/storefront/coupons?product={$this->blazer->id}")->assertOk()->json('offers');
        $this->assertSame(['AW30', 'ALL25'], array_column($blazer, 'code'));
        $this->assertSame(['30% off, up to ₹500.00.', 'Valid on select products only.', 'Not valid on delivery charges.'], $blazer[0]['conditions']);
        $this->assertSame('Not valid with other offers.', $blazer[0]['terms']);
        $this->assertSame(['ALL25'], array_column($this->getJson("/api/storefront/coupons?product={$this->toy->id}")->json('offers'), 'code'));
        $this->assertSame(['AW30', 'ALL25'], array_column($this->getJson("/api/storefront/coupons?products={$this->toy->id},{$this->blazer->id}")->json('offers'), 'code'));
    }

    public function test_codes_are_checked_against_the_bag(): void
    {
        $this->coupon()->assertCreated();
        $this->coupon(['code' => 'FLAT200', 'type' => 'flat', 'value' => 200, 'min_order' => 2500, 'category_ids' => []])->assertCreated();
        $this->coupon(['code' => 'WELCOME', 'type' => 'flat', 'value' => 100, 'category_ids' => [], 'first_order_only' => true])->assertCreated();
        $this->coupon(['code' => 'SOON', 'category_ids' => [], 'starts_on' => '2026-11-01'])->assertCreated();
        $this->coupon(['code' => 'GONE', 'category_ids' => [], 'ends_on' => '2026-10-20'])->assertCreated();

        // 30% of the blazer is ₹840, capped at ₹500; the toy isn't covered.
        $this->check(' aw 30 ', [[$this->blazer, 1], [$this->toy, 1]])->assertOk()->assertJsonPath('code', 'AW30')
            ->assertJsonPath('discount', 500)->assertJsonPath('eligible', 2800)->assertJsonPath('message', 'You save ₹500.00 with AW30.');
        $this->check('AW30', [[$this->toy, 1]])->assertUnprocessable()->assertJsonPath('errors.coupon_code.0', 'This code is for select products, and none of them are in your bag.');
        $this->check('FLAT200', [[$this->toy, 2]])->assertUnprocessable()->assertJsonPath('errors.coupon_code.0', 'Add ₹500.00 more to use this code (minimum ₹2,500.00).');
        $this->check('FLAT200', [[$this->toy, 3]])->assertOk()->assertJsonPath('discount', 200);
        $this->check('NOPE', [[$this->toy, 1]])->assertUnprocessable()->assertJsonPath('errors.coupon_code.0', '“NOPE” isn’t a valid code.');
        $this->check('SOON', [[$this->toy, 1]])->assertUnprocessable()->assertJsonPath('errors.coupon_code.0', 'This code works from 1 Nov 2026, 12:00 am.');
        $this->check('GONE', [[$this->toy, 1]])->assertUnprocessable()->assertJsonPath('errors.coupon_code.0', 'This code expired on 20 Oct 2026.');

        // A first-order code, and a per-customer limit, once Asha has ordered.
        $this->check('WELCOME', [[$this->toy, 1]])->assertOk();
        $this->order([[$this->toy, 3]], ['coupon_code' => 'FLAT200'])->assertCreated();
        $this->check('WELCOME', [[$this->toy, 1]])->assertUnprocessable()->assertJsonPath('errors.coupon_code.0', 'This code is for your first order with Elitezaar.');
        $this->check('WELCOME', [[$this->toy, 1]], 'ravi@example.com')->assertOk();
        $this->coupon(['code' => 'ONCE', 'type' => 'flat', 'value' => 50, 'category_ids' => [], 'per_customer_limit' => 1, 'usage_limit' => 2])->assertCreated();
        $this->order([[$this->toy, 1]], ['coupon_code' => 'ONCE'])->assertCreated();
        $this->check('ONCE', [[$this->toy, 1]])->assertUnprocessable()->assertJsonPath('errors.coupon_code.0', 'You’ve already used this code.');
        $this->order([[$this->toy, 1]], ['coupon_code' => 'ONCE', 'customer_email' => 'ravi@example.com'])->assertCreated();
        $this->check('ONCE', [[$this->toy, 1]], 'meera@example.com')->assertUnprocessable()->assertJsonPath('errors.coupon_code.0', 'This code has been fully used.');
        // A cancelled order gives its use back.
        Order::query()->where('customer_email', 'ravi@example.com')->update(['status' => 'cancelled']);
        $this->check('ONCE', [[$this->toy, 1]], 'meera@example.com')->assertOk();
    }

    public function test_an_order_with_a_coupon_charges_less_and_everyone_is_paid_right(): void
    {
        Notification::fake();
        $this->coupon()->assertCreated();
        $this->coupon(['code' => 'FLAT200', 'type' => 'flat', 'value' => 200, 'category_ids' => [], 'funded_by' => 'seller'])->assertCreated();

        // Elitezaar pays for AW30: ₹500 off the blazer (₹2,800 → ₹2,300), so it falls to the 5% GST rate.
        $order = Order::find($this->order([[$this->blazer, 1], [$this->toy, 1]], ['coupon_code' => 'aw30'])->assertCreated()
            ->assertJsonPath('data.coupon_code', 'AW30')->assertJsonPath('data.subtotal', '3800.00')->assertJsonPath('data.discount_amount', '500.00')
            ->assertJsonPath('data.total', '3300.00')->json('data.id'));
        $blazerLine = $order->items->firstWhere('product_id', $this->blazer->id);
        $toyLine = $order->items->firstWhere('product_id', $this->toy->id);
        $this->assertSame(['500.00', '2300.00', '5.00', '2190.48', '109.52'], [$blazerLine->discount_amount, $blazerLine->line_total, $blazerLine->gst_rate, $blazerLine->taxable_value, $blazerLine->igst]);
        $this->assertSame(['0.00', '1000.00'], [$toyLine->discount_amount, $toyLine->line_total]);
        // The seller earns ₹2,520 either way (₹2,800 less their 10%); Elitezaar's commission absorbs the coupon.
        $this->assertSame('-220.00', $blazerLine->commission_amount);
        $this->assertEqualsWithDelta(2520, (float) $blazerLine->line_total - (float) $blazerLine->commission_amount, 0.001);

        // The shopper's email shows the coupon as its own line, under prices before it.
        Notification::assertSentOnDemand(OrderPlaced::class, function (OrderPlaced $message, array $channels, object $notifiable) {
            $text = preg_replace('/\s+/', ' ', strip_tags((string) $message->toMail($notifiable)->render()));

            return str_contains($text, 'Linen blazer Qty 1 ₹2,800.00') && str_contains($text, 'Coupon AW30 −₹500.00') && str_contains($text, 'Total ₹3,300.00');
        });

        // The seller pays for FLAT200: ₹200 shared across both lines by value, and earnings on what was paid.
        $second = Order::find($this->order([[$this->blazer, 1], [$this->toy, 1]], ['coupon_code' => 'FLAT200', 'customer_email' => 'ravi@example.com'])->assertCreated()->json('data.id'));
        $blazerLine = $second->items->firstWhere('product_id', $this->blazer->id);
        $this->assertSame(['147.37', '2652.63', '265.26'], [$blazerLine->discount_amount, $blazerLine->line_total, $blazerLine->commission_amount]);
        $this->assertSame('52.63', $second->items->firstWhere('product_id', $this->toy->id)->discount_amount);
        $this->assertSame('3600.00', $second->total);

        // Invoices show the discount and GST on the price paid.
        $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/orders/{$order->id}", ['status' => 'shipped'])->assertOk();
        $invoice = Invoice::query()->where('order_id', $order->id)->where('vendor_id', $this->seller->id)->firstOrFail();
        $this->assertEquals([2800, 500, 2300], [$invoice->lines[0]['unit_price'], $invoice->lines[0]['discount'], $invoice->lines[0]['total']]);
        $html = $this->get($invoice->printPath())->assertOk()->getContent();
        $this->assertStringContainsString('<th>Discount</th>', $html);

        // An unknown code stops the order, and nothing is taken from stock.
        $stock = $this->toy->fresh()->qty;
        $this->order([[$this->toy, 1]], ['coupon_code' => 'NOPE'])->assertUnprocessable()->assertJsonValidationErrors(['coupon_code']);
        $this->assertSame($stock, $this->toy->fresh()->qty);
        $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/coupons')->assertOk()->assertJsonPath('data.1.uses', 1)->assertJsonPath('data.1.discount_given', 500);
        $this->deleteJson('/api/admin/coupons/' . Coupon::where('code', 'AW30')->value('id'))->assertUnprocessable();
    }
}
