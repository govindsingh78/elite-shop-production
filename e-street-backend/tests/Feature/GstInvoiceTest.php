<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\Gst;
use App\Services\Invoices;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class GstInvoiceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $seller;
    private User $customer;
    private Category $men;
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
        $this->withoutDefer();
        Carbon::setTestNow('2026-10-27 10:00:00');
        config(['admin.emails' => ['owner@example.com']]);
        $this->admin = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'secret123', 'role' => 'admin']);
        // A registered seller in Maharashtra; the store is registered in Rajasthan.
        $this->seller = User::create(['name' => 'Loom Studio', 'email' => 'loom@example.com', 'password' => 'secret123', 'role' => 'seller',
            'legal_name' => 'Loom Studio LLP', 'gstin' => '27AAPFU0939F1ZV', 'business_address' => '4 Linking Road, Mumbai', 'business_state' => '27']);
        $this->customer = User::create(['name' => 'Asha Verma', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        Gst::saveStore(['legal_name' => 'Elitezaar Retail Pvt Ltd', 'gstin' => '08AABCE1234F1Z5', 'state_code' => '08', 'address' => '12 MI Road, Jaipur']);
        // Clothing: 5% up to ₹2,500 a piece, 18% above.
        $this->men = Category::create(['name' => 'Men', 'status' => 1, 'hsn_code' => '6205', 'gst_rate' => 5, 'gst_rate_high' => 18, 'gst_threshold' => 2500]);
        $this->brand = Brand::create(['name' => 'Levis', 'status' => 1]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function product(string $title, float $price, ?User $seller, array $extra = []): Product
    {
        return Product::create([
            'title' => $title, 'price' => $price, 'category_id' => $this->men->id, 'brand_id' => $this->brand->id, 'sku' => strtoupper(substr(md5($title), 0, 8)),
            'barcode' => '', 'qty' => 20, 'status' => 1, 'is_featured' => 'no', 'approval_status' => Product::APPROVED, 'vendor_id' => $seller?->id, ...$extra,
        ]);
    }

    private function order(array $items, array $overrides = [])
    {
        return $this->actingAs($this->customer, 'sanctum')->postJson('/api/orders', array_merge([
            'customer_name' => 'Asha Verma', 'customer_email' => 'asha@example.com', 'customer_phone' => '9876543210',
            'address' => '14 Civil Lines', 'city' => 'Jaipur', 'state' => 'Rajasthan', 'postal_code' => '302006', 'country' => 'India',
            'payment_method' => 'cod', 'accept_policy' => true,
            'items' => array_map(fn ($line) => ['product_id' => $line[0]->id, 'quantity' => $line[1]], $items),
        ], $overrides));
    }

    public function test_gstins_and_states_are_checked(): void
    {
        $this->assertTrue(Gst::validGstin('27AAPFU0939F1ZV'));
        $this->assertTrue(Gst::validGstin('08aabce1234f1z5'));
        $this->assertFalse(Gst::validGstin('27AAPFU0939F1ZX'), 'wrong check digit');
        $this->assertFalse(Gst::validGstin('99AAPFU0939F1ZV'), 'no such state');
        $this->assertSame('08', Gst::stateCode('Rajasthan'));
        $this->assertSame('26', Gst::stateCode('Dadra & Nagar Haveli and Daman & Diu'));
        $this->assertSame('21', Gst::stateCode('Orissa'));
        $this->assertNull(Gst::placeOfSupply('California', 'United States'));
    }

    public function test_checkout_works_out_gst_within_and_between_states(): void
    {
        $ours = $this->product('Cotton shirt', 1050, null);                  // store, Rajasthan → Rajasthan: CGST + SGST at 5%
        $theirs = $this->product('Linen blazer', 5900, $this->seller);       // seller, Maharashtra → Rajasthan: IGST at 18% (above ₹2,500)
        $order = $this->order([[$ours, 2], [$theirs, 1]])->assertCreated()->json('data');

        $items = Order::find($order['id'])->items()->orderBy('id')->get();
        $this->assertSame(['6205', 5.0, 2000.0, 50.0, 50.0, 0.0], [$items[0]->hsn_code, (float) $items[0]->gst_rate, (float) $items[0]->taxable_value, (float) $items[0]->cgst, (float) $items[0]->sgst, (float) $items[0]->igst]);
        $this->assertSame([18.0, 5000.0, 0.0, 900.0], [(float) $items[1]->gst_rate, (float) $items[1]->taxable_value, (float) $items[1]->cgst, (float) $items[1]->igst]);
        $this->assertSame('08', $order['place_of_supply']);
        $this->assertEquals(1000.0, $order['tax_total']);

        // The product's own rate wins over its category's.
        $exempt = $this->product('Khadi stole', 500, null, ['gst_rate' => 0, 'hsn_code' => '6214']);
        $line = Order::find($this->order([[$exempt, 1]])->json('data.id'))->items()->first();
        $this->assertSame(['6214', 0.0, 500.0], [$line->hsn_code, (float) $line->gst_rate, (float) $line->taxable_value]);
    }

    public function test_business_buyers_add_a_valid_gstin(): void
    {
        $shirt = $this->product('Cotton shirt', 1050, null);
        $this->order([[$shirt, 1]], ['billing_gstin' => '08AABCE1234F1Z9', 'billing_name' => 'Acme'])->assertUnprocessable()->assertJsonValidationErrors('billing_gstin');
        $this->order([[$shirt, 1]], ['billing_gstin' => '27AAPFU0939F1ZV'])->assertUnprocessable()->assertJsonValidationErrors('billing_name');
        $this->order([[$shirt, 1]], ['billing_gstin' => '27aapfu0939f1zv', 'billing_name' => 'Acme Traders'])->assertCreated()
            ->assertJsonPath('data.billing_gstin', '27AAPFU0939F1ZV')->assertJsonPath('data.billing_name', 'Acme Traders');
    }

    public function test_invoices_are_issued_per_supplier_when_the_order_ships(): void
    {
        $ours = $this->product('Cotton shirt', 1050, null);
        $theirs = $this->product('Linen blazer', 5900, $this->seller);
        $orderId = $this->order([[$ours, 2], [$theirs, 1]], ['billing_gstin' => '27AAPFU0939F1ZV', 'billing_name' => 'Acme Traders'])->json('data.id');
        $this->assertSame(0, Invoice::count(), 'no invoice before the order ships');

        $this->actingAs($this->admin)->postJson("/api/admin/orders/{$orderId}/tracking", ['status' => 'dispatched'])->assertSuccessful();
        $invoices = Invoice::orderBy('id')->get();
        $this->assertCount(2, $invoices);
        [$store, $seller] = [$invoices->firstWhere('vendor_id', null), $invoices->firstWhere('vendor_id', $this->seller->id)];

        $this->assertSame('EZ/2627/0001', $store->number);
        $this->assertSame("S{$this->seller->id}/2627/0001", $seller->number);
        $this->assertSame(['2026-27', Invoice::TAX_INVOICE, '08AABCE1234F1Z5', 'Acme Traders', '27AAPFU0939F1ZV'],
            [$store->financial_year, $store->type, $store->supplier['gstin'], $store->buyer['name'], $store->buyer['gstin']]);
        $this->assertSame(['2000.00', '50.00', '50.00', '0.00', '2100.00'], [$store->taxable_total, $store->cgst_total, $store->sgst_total, $store->igst_total, $store->grand_total]);
        $this->assertSame(['Loom Studio LLP', '27', '900.00', '5900.00'], [$seller->supplier['name'], $seller->supplier['state_code'], $seller->igst_total, $seller->grand_total]);

        // Shipping again doesn't issue more; the next order follows on.
        $this->actingAs($this->admin)->postJson("/api/admin/orders/{$orderId}/tracking", ['status' => 'delivered'])->assertSuccessful();
        $this->assertSame(2, Invoice::count());
        $next = $this->order([[$ours, 1]])->json('data.id');
        $this->actingAs($this->admin)->putJson("/api/admin/orders/{$next}", ['status' => 'shipped'])->assertOk();
        $this->assertSame('EZ/2627/0002', Invoice::where('order_id', $next)->value('number'));

        // Cancelling keeps the number but marks it cancelled.
        $this->actingAs($this->admin)->putJson("/api/admin/orders/{$next}", ['status' => 'cancelled'])->assertOk();
        $this->assertSame('cancelled', Invoice::where('order_id', $next)->value('status'));
    }

    public function test_unregistered_sellers_issue_a_bill_of_supply_without_gst(): void
    {
        $this->seller->update(['gstin' => null]);
        $theirs = $this->product('Linen blazer', 5900, $this->seller);
        $orderId = $this->order([[$theirs, 1]])->json('data.id');
        $this->assertEquals(0, Order::find($orderId)->tax_total);

        // Invoices wait until the order is confirmed; then an admin can issue them early.
        $this->actingAs($this->admin)->postJson("/api/admin/orders/{$orderId}/invoices")->assertUnprocessable();
        Order::whereKey($orderId)->update(['status' => 'processing']);
        $this->actingAs($this->admin)->postJson("/api/admin/orders/{$orderId}/invoices")->assertOk();
        $invoice = Invoice::firstOrFail();
        $this->assertSame([Invoice::BILL_OF_SUPPLY, '5900.00', '5900.00'], [$invoice->type, $invoice->taxable_total, $invoice->grand_total]);
    }

    public function test_the_printable_invoice_opens_from_its_signed_link_only(): void
    {
        $ours = $this->product('Cotton shirt', 1050, null);
        $orderId = $this->order([[$ours, 2]], ['shipping_method_id' => \App\Models\ShippingMethod::create(['name' => 'Express', 'price' => 118, 'status' => 1])->id])->json('data.id');
        $this->actingAs($this->admin)->putJson("/api/admin/orders/{$orderId}", ['status' => 'shipped'])->assertOk();

        $links = $this->actingAs($this->customer)->getJson("/api/customer/orders/{$orderId}")->assertOk()->json('invoice_links');
        $this->assertCount(1, $links);
        $html = $this->get('/api' . substr($links[0]['print_url'], 4))->assertOk()->getContent();
        $this->assertStringContainsString('Tax invoice', $html);
        $this->assertStringContainsString('EZ/2627/0001', $html);
        $this->assertStringContainsString('Delivery charges', $html);
        $this->assertStringContainsString('996812', $html);
        $this->assertStringContainsString('Two thousand two hundred eighteen rupees only', $html);
        $this->get("/api/invoices/{$links[0]['id']}/print")->assertForbidden();
        $this->assertSame('One lakh twenty-five thousand four hundred rupees and fifty paise only', Invoices::amountInWords(125400.5));
    }

    public function test_admins_sellers_and_shoppers_see_their_invoices_and_reports(): void
    {
        $ours = $this->product('Cotton shirt', 1050, null);
        $theirs = $this->product('Linen blazer', 5900, $this->seller);
        $orderId = $this->order([[$ours, 1], [$theirs, 1]])->json('data.id');
        $this->actingAs($this->admin)->putJson("/api/admin/orders/{$orderId}", ['status' => 'shipped'])->assertOk();

        $this->actingAs($this->admin)->getJson('/api/invoices?month=2026-10')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('totals.grand', 6950);
        $this->actingAs($this->admin)->getJson('/api/invoices?vendor_id=store')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($this->seller)->getJson('/api/invoices')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.supplier_name', 'Loom Studio LLP');
        $this->actingAs($this->customer)->getJson('/api/invoices')->assertOk()->assertJsonCount(2, 'data');
        $this->actingAs($this->seller)->getJson("/api/vendor/orders/{$orderId}")->assertOk()->assertJsonCount(1, 'invoice_links');

        $csv = $this->actingAs($this->seller)->get('/api/vendor/gst/report?month=2026-10')->assertOk()->streamedContent();
        $this->assertStringContainsString('"Invoice number",Date,Type', $csv);
        $this->assertStringContainsString('08-Rajasthan,"Linen blazer",6205,1,18,5000,0,0,900,5900', $csv);
        $this->assertStringContainsString("S{$this->seller->id}/2627/0001", $csv);
        $this->assertStringNotContainsString('EZ/2627/0001', $csv, 'a seller only gets their own invoices');
        $this->actingAs($this->customer)->get('/api/admin/gst/report?month=2026-10')->assertForbidden();
    }

    public function test_admins_and_sellers_keep_their_gst_details(): void
    {
        $this->actingAs($this->admin)->putJson('/api/admin/gst/settings', [
            'legal_name' => 'Elitezaar Retail Pvt Ltd', 'gstin' => '08AABCE1234F1Z5', 'state_code' => '27', 'invoice_prefix' => 'EZ',
            'default_rate' => 5, 'default_rate_high' => 18, 'default_threshold' => 2500, 'shipping_rate' => 18,
        ])->assertUnprocessable()->assertJsonValidationErrors('state_code');
        $this->actingAs($this->admin)->putJson('/api/admin/gst/settings', [
            'legal_name' => 'Elitezaar Retail Pvt Ltd', 'gstin' => '08aabce1234f1z5', 'invoice_prefix' => 'S12',
            'default_rate' => 5, 'shipping_rate' => 18,
        ])->assertUnprocessable()->assertJsonValidationErrors('invoice_prefix');
        $this->actingAs($this->admin)->putJson('/api/admin/gst/settings', [
            'legal_name' => 'Elitezaar Retail Pvt Ltd', 'gstin' => '08aabce1234f1z5', 'invoice_prefix' => 'ELZ',
            'default_rate' => 5, 'shipping_rate' => 18,
        ])->assertOk()->assertJsonPath('settings.state_code', '08')->assertJsonPath('settings.gstin', '08AABCE1234F1Z5');
        $this->actingAs($this->seller)->getJson('/api/admin/gst/settings')->assertForbidden();

        $this->actingAs($this->seller)->getJson('/api/vendor/business')->assertOk()->assertJsonPath('business.gstin', '27AAPFU0939F1ZV')
            ->assertJsonPath('states.0.code', '01');
        $this->actingAs($this->seller)->putJson('/api/vendor/business', ['gstin' => '27AAPFU0939F1ZV', 'business_address' => ''])
            ->assertUnprocessable()->assertJsonValidationErrors('business_address');
        $this->actingAs($this->seller)->putJson('/api/vendor/business', ['legal_name' => 'Loom Studio LLP', 'gstin' => '', 'business_address' => '4 Linking Road', 'business_state' => '27'])
            ->assertOk()->assertJsonPath('business.gstin', null);
    }
}
