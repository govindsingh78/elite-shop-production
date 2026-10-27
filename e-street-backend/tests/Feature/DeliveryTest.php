<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\DeliveryArea;
use App\Models\Product;
use App\Models\User;
use App\Services\Delivery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class DeliveryTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $seller;
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
        Notification::fake();
        config(['admin.emails' => ['admin@example.com']]);
        // Wednesday 28 October 2026, 10 am in India.
        $this->travelTo(Carbon::parse('2026-10-28 10:00', 'Asia/Kolkata'));
        $this->admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->seller = User::forceCreate(['name' => 'Loom Studio', 'email' => 'loom@example.com', 'password' => 'secret123', 'role' => 'seller', 'seller_status' => User::SELLER_APPROVED, 'pickup_pincode' => '302016']);
        $this->category = Category::create(['name' => 'Men', 'status' => 1]);
        $this->brand = Brand::create(['name' => 'Acme', 'status' => 1]);
    }

    private function product(?User $seller): Product
    {
        return Product::create([
            'title' => 'Linen shirt', 'price' => 1499, 'category_id' => $this->category->id, 'brand_id' => $this->brand->id, 'sku' => 'LIN-' . ($seller?->id ?? 0),
            'barcode' => '', 'qty' => 10, 'status' => 1, 'is_featured' => 'no', 'approval_status' => Product::APPROVED, 'vendor_id' => $seller?->id,
        ]);
    }

    private function order(Product $product, string $pincode, string $country = 'India')
    {
        return $this->postJson('/api/orders', [
            'customer_name' => 'Asha Verma', 'customer_email' => 'asha@example.com', 'address' => '14 Civil Lines', 'city' => 'Jaipur', 'state' => 'Rajasthan',
            'postal_code' => $pincode, 'country' => $country, 'payment_method' => 'cod', 'accept_policy' => true,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]);
    }

    public function test_pin_codes_are_placed_in_their_region(): void
    {
        $regions = [
            '110001' => 'Delhi', '122001' => 'Haryana', '160017' => 'Chandigarh', '302016' => 'Rajasthan', '400001' => 'Maharashtra',
            '403001' => 'Goa', '560001' => 'Karnataka', '500001' => 'Telangana', '600001' => 'Tamil Nadu', '700001' => 'West Bengal',
            '737101' => 'Sikkim', '744101' => 'Andaman & Nicobar', '682555' => 'Lakshadweep', '682001' => 'Kerala', '781001' => 'Assam',
            '799001' => 'Tripura', '800001' => 'Bihar', '834001' => 'Jharkhand', '248001' => 'Uttarakhand', '226001' => 'Uttar Pradesh',
            '194101' => 'Ladakh', '190001' => 'Jammu & Kashmir',
        ];
        foreach ($regions as $pincode => $region) {
            $this->assertSame($region, Delivery::region($pincode)['name'] ?? null, $pincode);
        }
        $this->assertTrue(Delivery::region('744101')['remote']);
        $this->assertFalse(Delivery::region('302016')['remote']);
        foreach (['012345', '30201', '3020166', '999999', '560 001x'] as $wrong) {
            $this->assertNull(Delivery::region($wrong), $wrong);
        }
        $this->assertSame('302016', Delivery::normalise(' 302 016 '));
    }

    public function test_the_product_page_estimates_delivery_from_the_seller_to_the_buyer(): void
    {
        $product = $this->product($this->seller);

        // Same city as the seller (Jaipur): 1–2 days on the road, plus a day to pack.
        $this->getJson("/api/storefront/delivery?pincode=302001&product={$product->id}")->assertOk()
            ->assertJsonPath('deliverable', true)->assertJsonPath('from', 'Rajasthan')->assertJsonPath('to', 'Rajasthan')
            ->assertJsonPath('zone', 'local')->assertJsonPath('days', ['min' => 2, 'max' => 3])
            ->assertJsonPath('dates', ['earliest' => '2026-10-30', 'latest' => '2026-10-31'])
            ->assertJsonPath('label', 'Delivery by Sat, 31 Oct')->assertJsonPath('message', 'Usually arrives in 2–3 days · ships from Rajasthan.');

        // Elsewhere in Rajasthan; then far away (Bengaluru), counting Monday to Saturday only.
        $this->getJson("/api/storefront/delivery?pincode=313001&product={$product->id}")->assertOk()->assertJsonPath('zone', 'state')->assertJsonPath('days', ['min' => 3, 'max' => 4]);
        $far = $this->getJson("/api/storefront/delivery?pincode=560001&product={$product->id}")->assertOk()
            ->assertJsonPath('zone', 'national')->assertJsonPath('days', ['min' => 5, 'max' => 7])->assertJsonPath('dates.latest', '2026-11-05')->json();
        $this->assertGreaterThan(1200, $far['distance_km']);

        // Hard-to-reach places take longer.
        $this->getJson("/api/storefront/delivery?pincode=744101&product={$product->id}")->assertOk()->assertJsonPath('zone', 'remote')->assertJsonPath('days', ['min' => 7, 'max' => 9]);

        // Elitezaar's own products ship from its dispatch PIN code, or with a general estimate without one.
        $ours = $this->product(null);
        $this->getJson("/api/storefront/delivery?pincode=400001&product={$ours->id}")->assertOk()->assertJsonPath('from', null)->assertJsonPath('days', ['min' => 4, 'max' => 7]);
        Delivery::saveSettings(['store_pincode' => '400070', 'dispatch_days' => 2]);
        $this->getJson("/api/storefront/delivery?pincode=400001&product={$ours->id}")->assertOk()->assertJsonPath('from', 'Maharashtra')->assertJsonPath('zone', 'local')->assertJsonPath('days', ['min' => 3, 'max' => 4]);

        // The seller's own PIN code stays private.
        $this->assertStringNotContainsString('302016', $this->getJson("/api/storefront/delivery?pincode=110001&product={$product->id}")->getContent());

        $this->getJson('/api/storefront/delivery?pincode=12345')->assertUnprocessable()->assertJsonValidationErrors(['pincode']);
        $this->getJson('/api/storefront/delivery?pincode=999999')->assertOk()->assertJsonPath('deliverable', false)->assertJsonPath('message', 'We couldn’t find PIN code 999999. Check it and try again.');
    }

    public function test_admins_choose_where_we_deliver_and_checkout_follows(): void
    {
        $product = $this->product($this->seller);
        $this->actingAs($this->admin, 'sanctum');

        // Everywhere, apart from a blocked area — except one PIN code inside it, and with extra days for another place.
        $this->postJson('/api/admin/delivery/areas', ['pincodes' => '19', 'name' => 'Jammu & Kashmir', 'deliverable' => false])->assertCreated()->assertJsonPath('message', 'Added 19.');
        $this->postJson('/api/admin/delivery/areas', ['pincodes' => "190001\n 302001, 302001", 'name' => 'City centre', 'deliverable' => true, 'extra_days' => 1])->assertCreated()
            ->assertJsonPath('message', 'Added 2 PIN codes.');
        $this->postJson('/api/admin/delivery/areas', ['pincodes' => '1234567, abc', 'deliverable' => true])->assertUnprocessable()->assertJsonValidationErrors(['pincodes']);

        $this->getJson('/api/storefront/delivery?pincode=190015')->assertOk()->assertJsonPath('deliverable', false)
            ->assertJsonPath('message', 'Sorry, we don’t deliver to 190015 (Jammu & Kashmir) yet.');
        $this->getJson('/api/storefront/delivery?pincode=190001')->assertOk()->assertJsonPath('deliverable', true);
        $this->getJson("/api/storefront/delivery?pincode=302001&product={$product->id}")->assertOk()->assertJsonPath('days', ['min' => 3, 'max' => 4]);

        auth()->forgetGuards();
        $this->order($product, '190015')->assertUnprocessable()->assertJsonPath('errors.postal_code.0', 'Sorry, we don’t deliver to 190015 (Jammu & Kashmir) yet. Please choose another address.');
        $this->order($product, '30200')->assertUnprocessable()->assertJsonPath('errors.postal_code.0', 'Enter a 6-digit PIN code, like 302016.');
        $this->order($product, '302 001')->assertCreated();
        $this->order($product, 'SW1A 1AA', 'United Kingdom')->assertCreated();

        // Only listed areas: needs at least one first; then everything else is refused.
        $this->actingAs($this->admin, 'sanctum');
        DeliveryArea::query()->where('deliverable', true)->delete();
        $this->putJson('/api/admin/delivery/settings', ['mode' => 'listed', 'dispatch_days' => 1])->assertUnprocessable()->assertJsonValidationErrors(['mode']);
        $this->postJson('/api/admin/delivery/areas', ['pincodes' => '302', 'name' => 'Jaipur', 'deliverable' => true])->assertCreated();
        $this->putJson('/api/admin/delivery/settings', ['mode' => 'listed', 'store_pincode' => '302 016', 'dispatch_days' => 1])->assertOk()
            ->assertJsonPath('settings.store_pincode', '302016')->assertJsonPath('settings.store_region', 'Rajasthan');
        $this->putJson('/api/admin/delivery/settings', ['mode' => 'all', 'store_pincode' => '999999', 'dispatch_days' => 1])->assertUnprocessable()->assertJsonValidationErrors(['store_pincode']);

        $this->getJson('/api/storefront/delivery?pincode=302033')->assertOk()->assertJsonPath('deliverable', true)->assertJsonPath('to', 'Jaipur, Rajasthan');
        $this->getJson('/api/storefront/delivery?pincode=110001')->assertOk()->assertJsonPath('deliverable', false);
        auth()->forgetGuards();
        $this->order($product, '110001')->assertUnprocessable()->assertJsonValidationErrors(['postal_code']);
        $this->order($product, '302033')->assertCreated();

        // The list, editing, removing — and the last area people can get deliveries in can't be removed.
        $this->actingAs($this->admin, 'sanctum');
        $list = $this->getJson('/api/admin/delivery?search=30')->assertOk()->assertJsonPath('settings.mode', 'listed');
        $jaipur = collect($list->json('data'))->firstWhere('pincode', '302');
        $this->assertSame([true, 'Rajasthan'], [$jaipur['is_prefix'], $jaipur['region']]);
        $this->putJson("/api/admin/delivery/areas/{$jaipur['id']}", ['name' => 'Jaipur city', 'deliverable' => true, 'extra_days' => 2])->assertOk()->assertJsonPath('area.extra_days', 2);
        $this->deleteJson("/api/admin/delivery/areas/{$jaipur['id']}")->assertUnprocessable();
        $this->getJson('/api/admin/delivery/check?pincode=302033&from=110001')->assertOk()->assertJsonPath('from', 'Delhi')->assertJsonPath('zone', 'regional');

        $this->actingAs($this->seller, 'sanctum')->getJson('/api/admin/delivery')->assertForbidden();
    }

    public function test_sellers_keep_their_pickup_pin_code(): void
    {
        $this->actingAs($this->seller, 'sanctum')->getJson('/api/vendor/business')->assertOk()->assertJsonPath('business.pickup_pincode', '302016');
        $this->putJson('/api/vendor/business', ['pickup_pincode' => '400 070'])->assertOk()->assertJsonPath('business.pickup_pincode', '400070');
        $this->putJson('/api/vendor/business', ['pickup_pincode' => '40007'])->assertUnprocessable()->assertJsonValidationErrors(['pickup_pincode']);
        // Saving without it (an older app) keeps it.
        $this->putJson('/api/vendor/business', ['legal_name' => 'Loom Studio LLP'])->assertOk()->assertJsonPath('business.pickup_pincode', '400070');
        $this->putJson('/api/vendor/business', ['pickup_pincode' => ''])->assertOk()->assertJsonPath('business.pickup_pincode', null);
    }
}
