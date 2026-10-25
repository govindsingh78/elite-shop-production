<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Services\Commissions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommissionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $seller;
    private User $otherSeller;
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
        $this->otherSeller = User::create(['name' => 'Kids Corner', 'email' => 'kids@example.com', 'password' => 'secret123', 'role' => 'seller']);
        $this->category = Category::create(['name' => 'Women', 'status' => 1]);
        $this->brand = Brand::create(['name' => 'Loom', 'status' => 1]);
    }

    private function product(?User $seller, string $sku, float $price): Product
    {
        return Product::create([
            'vendor_id' => $seller?->id, 'title' => "Kurta {$sku}", 'price' => $price, 'category_id' => $this->category->id,
            'brand_id' => $this->brand->id, 'qty' => 50, 'sku' => $sku, 'barcode' => '', 'status' => 1,
        ]);
    }

    /** Places an order as a guest and returns it. */
    private function order(array $lines, string $status = 'pending'): Order
    {
        $id = $this->postJson('/api/orders', [
            'customer_name' => 'Asha', 'customer_email' => 'asha@example.com', 'customer_phone' => '9876543210',
            'address' => '12 MG Road', 'city' => 'Jaipur', 'payment_method' => 'cod', 'accept_policy' => true,
            'items' => array_map(fn ($line) => ['product_id' => $line[0]->id, 'quantity' => $line[1]], $lines),
        ])->assertCreated()->json('data.id');

        $order = Order::findOrFail($id);
        $order->forceFill(['status' => $status])->save();

        return $order;
    }

    public function test_each_order_line_keeps_the_rate_in_force_when_it_was_ordered(): void
    {
        $kurta = $this->product($this->seller, 'K1', 1000);
        $toy = $this->product($this->otherSeller, 'T1', 500);
        $ours = $this->product(null, 'E1', 800);
        $this->otherSeller->forceFill(['commission_rate' => 0])->save();

        $order = $this->order([[$kurta, 2], [$toy, 1], [$ours, 1]]);
        $lines = $order->items()->get()->keyBy('sku');
        $this->assertSame('10.00', $lines['K1']->commission_rate);
        $this->assertSame('200.00', $lines['K1']->commission_amount);
        $this->assertSame('0.00', $lines['T1']->commission_amount);
        $this->assertNull($lines['E1']->commission_rate, 'Elitezaar’s own products carry no commission.');

        // Customers never see the commission.
        $customerView = $order->load('items')->toArray();
        $this->assertArrayNotHasKey('commission_amount', $customerView['items'][0]);

        // Changing the rate affects new orders only.
        Commissions::setDefaultRate(15);
        $this->order([[$kurta, 1]]);
        $this->assertSame(['10.00', '15.00'], OrderItem::where('sku', 'K1')->orderBy('id')->pluck('commission_rate')->all());
    }

    public function test_admin_sees_what_each_seller_earned_and_is_owed(): void
    {
        $kurta = $this->product($this->seller, 'K1', 1000);
        $toy = $this->product($this->otherSeller, 'T1', 500);
        $this->order([[$kurta, 2]], 'delivered');   // ₹2,000 sold, ₹200 commission, ₹1,800 earned
        $this->order([[$kurta, 1]], 'shipped');     // ₹1,000 pending
        $this->order([[$kurta, 5]], 'cancelled');   // doesn't count
        $this->order([[$toy, 1]], 'delivered');     // ₹500, ₹50, ₹450

        $this->actingAs($this->admin, 'sanctum');
        $data = $this->getJson('/api/admin/commissions')->assertOk()->json();
        $this->assertSame(10.0, (float) $data['default_rate']);
        $loom = collect($data['sellers'])->firstWhere('id', $this->seller->id);
        $this->assertEquals(['sales' => 2000, 'commission' => 200, 'earnings' => 1800, 'paid' => 0, 'balance' => 1800, 'units' => 2, 'pending_sales' => 1000, 'pending_earnings' => 900],
            collect($loom)->only(['sales', 'commission', 'earnings', 'paid', 'balance', 'units', 'pending_sales', 'pending_earnings'])->all());
        $this->assertEquals(2250, $data['totals']['earnings']);
        $this->assertEquals(250, $data['totals']['commission']);
        $this->assertSame($this->seller->id, $data['sellers'][0]['id'], 'Sellers owed the most come first.');

        // Payouts reduce the balance, can't exceed it, and can be removed.
        $this->postJson("/api/admin/commissions/sellers/{$this->seller->id}/payouts", ['amount' => 2000])
            ->assertJsonValidationErrors(['amount' => 'more than this seller is owed']);
        $payout = $this->postJson("/api/admin/commissions/sellers/{$this->seller->id}/payouts", ['amount' => 1500, 'method' => 'upi', 'reference' => 'UPI-123', 'paid_on' => now()->toDateString()])
            ->assertCreated()
            ->assertJsonPath('seller.balance', 300)
            ->json('payout');
        $this->postJson("/api/admin/commissions/sellers/{$this->seller->id}/payouts", ['amount' => 50, 'paid_on' => now()->addDay()->toDateString()])
            ->assertJsonValidationErrors('paid_on');

        $detail = $this->getJson("/api/admin/commissions/sellers/{$this->seller->id}")->assertOk()->json();
        $this->assertSame(1500.0, (float) $detail['seller']['paid']);
        $this->assertCount(1, $detail['payouts']);
        $this->assertCount(3, $detail['items']['data']);
        $this->assertEquals(['line_total' => 1000, 'commission_amount' => 100, 'earning' => 900, 'order_status' => 'shipped'],
            collect($detail['items']['data'][1])->only(['line_total', 'commission_amount', 'earning', 'order_status'])->all());

        $this->deleteJson("/api/admin/commissions/payouts/{$payout['id']}")->assertOk();
        $this->assertSame(1800.0, (float) $this->getJson("/api/admin/commissions/sellers/{$this->seller->id}")->json('seller.balance'));
    }

    public function test_admin_sets_the_default_and_per_seller_rates(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $this->putJson('/api/admin/commissions/settings', ['default_rate' => 120])->assertJsonValidationErrors('default_rate');
        $this->putJson('/api/admin/commissions/settings', ['default_rate' => 12.5])->assertOk()->assertJsonPath('default_rate', 12.5);

        $this->putJson("/api/admin/commissions/sellers/{$this->seller->id}", ['commission_rate' => 0])
            ->assertOk()->assertJsonPath('seller.effective_rate', 0);
        $this->putJson("/api/admin/commissions/sellers/{$this->seller->id}", ['commission_rate' => null])
            ->assertOk()->assertJsonPath('seller.commission_rate', null)->assertJsonPath('seller.effective_rate', 12.5);

        $customer = User::create(['name' => 'Asha', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->getJson("/api/admin/commissions/sellers/{$customer->id}")->assertNotFound();
    }

    public function test_sellers_see_only_their_own_earnings(): void
    {
        $kurta = $this->product($this->seller, 'K1', 1000);
        $toy = $this->product($this->otherSeller, 'T1', 500);
        $this->order([[$kurta, 1], [$toy, 2]], 'delivered');

        $this->actingAs($this->seller, 'sanctum');
        $this->getJson('/api/vendor/earnings')->assertOk()
            ->assertJsonPath('summary.earnings', 900)
            ->assertJsonPath('summary.balance', 900)
            ->assertJsonPath('summary.effective_rate', 10)
            ->assertJsonCount(1, 'items.data')
            ->assertJsonPath('items.data.0.product_title', 'Kurta K1');
        $this->getJson('/api/vendor/dashboard')->assertOk()->assertJsonPath('stats.balance_due', 900)->assertJsonPath('stats.commission_rate', 10);
        $this->getJson('/api/admin/commissions')->assertForbidden();

        $customer = User::create(['name' => 'Asha', 'email' => 'buyer@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->actingAs($customer, 'sanctum');
        $this->getJson('/api/vendor/earnings')->assertForbidden();
    }
}
