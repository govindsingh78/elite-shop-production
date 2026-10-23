<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RazorpayPaymentTest extends TestCase
{
    use RefreshDatabase;

    private Product $product;

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
        config(['services.razorpay' => ['key_id' => 'rzp_test_key', 'key_secret' => 'test_secret', 'webhook_secret' => 'hook_secret']]);
        Http::fake(['api.razorpay.com/*' => Http::response(['id' => 'order_RZP123', 'amount' => 300000], 200)]);

        $category = Category::create(['name' => 'Men', 'status' => 1]);
        $brand = Brand::create(['name' => 'Acme', 'status' => 1]);
        $this->product = Product::create([
            'title' => 'Shirt', 'price' => 1500, 'category_id' => $category->id, 'brand_id' => $brand->id,
            'qty' => 10, 'sku' => 'SH-1', 'barcode' => '', 'status' => 1,
        ]);
    }

    private function placeOnlineOrder(): array
    {
        $response = $this->postJson('/api/orders', [
            'customer_name' => 'Asha', 'customer_email' => 'asha@example.com', 'customer_phone' => '9876543210',
            'address' => '12 MG Road', 'city' => 'Jaipur', 'payment_method' => 'razorpay', 'accept_policy' => true,
            'items' => [['product_id' => $this->product->id, 'quantity' => 2]],
        ])->assertCreated();

        return [Order::findOrFail($response->json('data.id')), $response->json('payment_token')];
    }

    public function test_online_order_flow_creates_razorpay_order_and_verifies_signature(): void
    {
        [$order, $token] = $this->placeOnlineOrder();
        $this->assertNotEmpty($token);
        $this->assertSame('unpaid', $order->payment_status);

        $this->postJson("/api/orders/{$order->id}/payment/start", ['payment_token' => $token])
            ->assertOk()
            ->assertJsonPath('razorpay_order_id', 'order_RZP123')
            ->assertJsonPath('amount', 300000)
            ->assertJsonPath('key_id', 'rzp_test_key');
        Http::assertSent(fn ($request) => $request['amount'] === 300000 && $request['currency'] === 'INR');

        $signature = hash_hmac('sha256', 'order_RZP123|pay_ABC', 'test_secret');
        $this->postJson("/api/orders/{$order->id}/payment/verify", [
            'payment_token' => $token, 'razorpay_order_id' => 'order_RZP123', 'razorpay_payment_id' => 'pay_ABC', 'razorpay_signature' => $signature,
        ])->assertOk()->assertJsonPath('data.payment_status', 'paid')->assertJsonMissingPath('data.payment_token');

        $this->assertSame('pay_ABC', $order->refresh()->razorpay_payment_id);
        $this->assertNotNull($order->paid_at);
    }

    public function test_forged_signature_is_rejected(): void
    {
        [$order, $token] = $this->placeOnlineOrder();
        $this->postJson("/api/orders/{$order->id}/payment/start", ['payment_token' => $token])->assertOk();

        $this->postJson("/api/orders/{$order->id}/payment/verify", [
            'payment_token' => $token, 'razorpay_order_id' => 'order_RZP123', 'razorpay_payment_id' => 'pay_ABC', 'razorpay_signature' => 'forged',
        ])->assertStatus(422);
        $this->assertSame('unpaid', $order->refresh()->payment_status);
    }

    public function test_payment_actions_require_the_checkout_token(): void
    {
        [$order] = $this->placeOnlineOrder();

        $this->postJson("/api/orders/{$order->id}/payment/start", ['payment_token' => 'wrong'])->assertForbidden();
        $this->postJson("/api/orders/{$order->id}/payment/cod")->assertForbidden();
    }

    public function test_shopper_can_fall_back_to_cash_on_delivery(): void
    {
        [$order, $token] = $this->placeOnlineOrder();

        $this->postJson("/api/orders/{$order->id}/payment/cod", ['payment_token' => $token])
            ->assertOk()->assertJsonPath('data.payment_method', 'cod');
        $this->postJson("/api/orders/{$order->id}/payment/start", ['payment_token' => $token])->assertForbidden();
    }

    public function test_webhook_marks_order_paid_only_with_valid_signature(): void
    {
        [$order, $token] = $this->placeOnlineOrder();
        $this->postJson("/api/orders/{$order->id}/payment/start", ['payment_token' => $token])->assertOk();
        $payload = json_encode(['event' => 'payment.captured', 'payload' => ['payment' => ['entity' => ['id' => 'pay_HOOK', 'order_id' => 'order_RZP123']]]]);

        $this->call('POST', '/api/payments/razorpay/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_RAZORPAY_SIGNATURE' => 'bad'], $payload)->assertStatus(400);
        $this->assertSame('unpaid', $order->refresh()->payment_status);

        $signature = hash_hmac('sha256', $payload, 'hook_secret');
        $this->call('POST', '/api/payments/razorpay/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_RAZORPAY_SIGNATURE' => $signature], $payload)->assertOk();
        $this->assertSame('paid', $order->refresh()->payment_status);
        $this->assertSame('pay_HOOK', $order->razorpay_payment_id);
    }

    public function test_online_payment_is_refused_when_not_configured(): void
    {
        config(['services.razorpay.key_id' => null]);

        $this->getJson('/api/storefront/payment-methods')->assertJsonPath('online', false);
        $this->postJson('/api/orders', [
            'customer_name' => 'Asha', 'customer_email' => 'asha@example.com', 'address' => 'x', 'city' => 'y', 'payment_method' => 'razorpay', 'accept_policy' => true,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertStatus(422)->assertJsonValidationErrors('payment_method');
    }
}
