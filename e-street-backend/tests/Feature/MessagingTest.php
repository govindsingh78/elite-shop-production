<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\DeviceToken;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Notifications\AdminNewOrder;
use App\Notifications\ListingReviewed;
use App\Notifications\ListingsAwaitingReview;
use App\Notifications\OrderPlaced;
use App\Notifications\OrderProgress;
use App\Notifications\PayoutSent;
use App\Notifications\SellerJoined;
use App\Notifications\SellerNewOrder;
use App\Notifications\StoreMessage;
use App\Services\ExpoPush;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class MessagingTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $seller;
    private User $customer;
    private Product $shirt;
    private Product $ours;

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
        // Messages normally go out after the response; here they go out straight away.
        $this->withoutDefer();
        config(['admin.emails' => ['owner@example.com'], 'app.frontend_url' => 'https://elitezaar.com']);
        $this->admin = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->seller = User::create(['name' => 'Loom Studio', 'email' => 'loom@example.com', 'password' => 'secret123', 'role' => 'seller']);
        $this->customer = User::create(['name' => 'Asha Verma', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $category = Category::create(['name' => 'Men', 'status' => 1]);
        $brand = Brand::create(['name' => 'Levis', 'status' => 1]);
        $make = fn (string $title, ?int $vendor, float $price) => Product::create([
            'title' => $title, 'price' => $price, 'category_id' => $category->id, 'brand_id' => $brand->id, 'sku' => strtoupper(substr($title, 0, 5)),
            'barcode' => '', 'qty' => 20, 'status' => 1, 'is_featured' => 'no', 'approval_status' => Product::APPROVED, 'vendor_id' => $vendor,
        ]);
        $this->shirt = $make('Linen shirt', $this->seller->id, 1500);
        $this->ours = $make('Tote bag', null, 500);
    }

    private function placeOrder(array $overrides = [], ?User $as = null)
    {
        $request = $as ? $this->actingAs($as, 'sanctum') : $this;

        return $request->postJson('/api/orders', array_merge([
            'customer_name' => 'Asha Verma', 'customer_email' => 'asha@example.com', 'customer_phone' => '9876543210',
            'address' => '14 Civil Lines', 'city' => 'Jaipur', 'state' => 'Rajasthan', 'postal_code' => '302006',
            'payment_method' => 'cod', 'accept_policy' => true,
            'items' => [['product_id' => $this->shirt->id, 'quantity' => 2], ['product_id' => $this->ours->id, 'quantity' => 1]],
        ], $overrides))->assertCreated();
    }

    public function test_a_cash_on_delivery_order_is_confirmed_to_the_shopper_the_seller_and_the_admins_once(): void
    {
        Notification::fake();
        $orderId = $this->placeOrder([], $this->customer)->json('data.id');

        Notification::assertSentTo($this->customer, OrderPlaced::class, fn (OrderPlaced $message, array $channels) => $message->order->id === $orderId
            && $channels === ['database', \App\Notifications\Channels\ExpoPushChannel::class, 'mail']
            && $message->appPath() === "/customer/orders/{$orderId}");
        Notification::assertSentTo($this->seller, SellerNewOrder::class, fn (SellerNewOrder $message) => $message->items->count() === 1
            && $message->title() === "New order #{$orderId} · ₹3,000.00"
            && str_contains($message->body(), 'You have 2 items to pack: Linen shirt × 2.'));
        Notification::assertSentTo($this->admin, AdminNewOrder::class, fn (AdminNewOrder $message) => $message->body() === 'Asha Verma ordered 3 items · cash on delivery.');
        Notification::assertNotSentTo($this->seller, OrderPlaced::class);

        // However often it's asked, an order is confirmed once.
        \App\Services\Messenger::orderPlaced(Order::find($orderId));
        Notification::assertSentToTimes($this->customer, OrderPlaced::class, 1);
    }

    public function test_guests_get_the_confirmation_by_email_with_the_order_details(): void
    {
        Notification::fake();
        $this->placeOrder(['customer_email' => 'guest@example.com']);

        Notification::assertSentOnDemand(OrderPlaced::class, function (OrderPlaced $message, array $channels, object $notifiable) {
            $mail = $message->toMail($notifiable)->render()->toHtml();

            return $notifiable->routes['mail'] === 'guest@example.com' && $channels === ['mail']
                && $message->webPath() === null
                && str_contains($mail, 'Linen shirt × 2 — ₹3,000.00') && str_contains($mail, 'Total: ₹3,500.00')
                && str_contains($mail, '14 Civil Lines, Jaipur, Rajasthan, 302006') && str_contains($mail, 'Hello Asha,');
        });
    }

    public function test_online_orders_are_confirmed_once_paid_not_when_created(): void
    {
        config(['services.razorpay.key_id' => 'rzp_test_x', 'services.razorpay.key_secret' => 'secret']);
        Notification::fake();
        $orderId = $this->placeOrder(['payment_method' => 'razorpay'], $this->customer)->json('data.id');
        Notification::assertNothingSent();

        $order = Order::find($orderId);
        $order->markPaid('pay_123');
        $order->markPaid('pay_123');
        Notification::assertSentToTimes($this->customer, OrderPlaced::class, 1);
        Notification::assertSentTo($this->admin, AdminNewOrder::class, fn (AdminNewOrder $message) => str_ends_with($message->body(), 'paid online.'));
    }

    public function test_shoppers_hear_about_the_milestones_that_matter(): void
    {
        $orderId = $this->placeOrder([], $this->customer)->json('data.id');
        Notification::fake();

        $this->actingAs($this->admin)->postJson("/api/admin/orders/{$orderId}/tracking", ['status' => 'in_transit'])->assertSuccessful();
        Notification::assertNothingSent();

        Order::whereKey($orderId)->update(['courier_name' => 'Delhivery', 'tracking_number' => 'DL123']);
        $this->actingAs($this->admin)->postJson("/api/admin/orders/{$orderId}/tracking", ['status' => 'dispatched'])->assertSuccessful();
        Notification::assertSentTo($this->customer, OrderProgress::class, fn (OrderProgress $message) => $message->milestone === 'dispatched'
            && $message->title() === "Order #{$orderId} is on its way"
            && str_contains($message->body(), 'with Delhivery (tracking number DL123)'));

        $this->actingAs($this->admin)->postJson("/api/admin/orders/{$orderId}/tracking", ['status' => 'out_for_delivery'])->assertSuccessful();
        Notification::assertSentTo($this->customer, OrderProgress::class, fn (OrderProgress $message) => $message->milestone === 'out_for_delivery'
            && str_contains($message->body(), '₹3,500.00 ready for cash on delivery'));

        // Changing the status directly counts too.
        $this->actingAs($this->admin)->putJson("/api/admin/orders/{$orderId}", ['status' => 'delivered'])->assertOk();
        Notification::assertSentTo($this->customer, OrderProgress::class, fn (OrderProgress $message) => $message->milestone === 'delivered');
    }

    public function test_sellers_and_admins_hear_about_listings_payouts_and_new_sellers(): void
    {
        Notification::fake();
        $payload = fn (array $overrides = []) => array_merge([
            'title' => 'Block print kurta', 'price' => 999, 'category_id' => $this->shirt->category_id, 'brand_id' => $this->shirt->brand_id,
            'sku' => 'KURTA-1', 'qty' => 4, 'status' => 1, 'gallery' => [],
        ], $overrides);

        $id = $this->actingAs($this->seller)->postJson('/api/vendor/products', $payload())->assertCreated()->json('data.id');
        Notification::assertSentTo($this->admin, ListingsAwaitingReview::class, fn (ListingsAwaitingReview $message) => $message->title() === 'New listing to review'
            && $message->body() === 'Loom Studio sent “Block print kurta” for review.' && $message->appPath() === "/admin/product-form?id={$id}");

        // Editing a listing that is already waiting doesn't alert the admins again.
        $this->actingAs($this->seller)->putJson("/api/vendor/products/{$id}", $payload(['title' => 'Block print kurta (blue)']))->assertOk();
        Notification::assertSentToTimes($this->admin, ListingsAwaitingReview::class, 1);

        $this->actingAs($this->admin)->patchJson("/api/admin/products/{$id}/review", ['decision' => 'rejected', 'note' => 'Please add a photo.'])->assertOk();
        Notification::assertSentTo($this->seller, ListingReviewed::class, fn (ListingReviewed $message) => $message->title() === 'Changes needed on your listing'
            && str_ends_with($message->body(), 'Please add a photo.'));

        // Resubmitting a rejected listing alerts them again; approving tells the seller it's live.
        $this->actingAs($this->seller)->putJson("/api/vendor/products/{$id}", $payload(['title' => 'Block print kurta (blue)']))->assertOk();
        Notification::assertSentToTimes($this->admin, ListingsAwaitingReview::class, 2);
        $this->actingAs($this->admin)->patchJson("/api/admin/products/{$id}/review", ['decision' => 'approved'])->assertOk();
        Notification::assertSentTo($this->seller, ListingReviewed::class, fn (ListingReviewed $message) => $message->body() === '“Block print kurta (blue)” is now live in the Elitezaar store.');

        // A payout, once the seller has delivered sales to be paid for.
        $orderId = $this->placeOrder([], $this->customer)->json('data.id');
        $this->actingAs($this->admin)->putJson("/api/admin/orders/{$orderId}", ['status' => 'delivered'])->assertOk();
        $this->actingAs($this->admin)->postJson("/api/admin/commissions/sellers/{$this->seller->id}/payouts", ['amount' => 1000, 'method' => 'upi', 'reference' => 'UTR42', 'paid_on' => '2026-10-20'])->assertCreated();
        Notification::assertSentTo($this->seller, PayoutSent::class, fn (PayoutSent $message) => $message->title() === 'Payment sent: ₹1,000.00'
            && $message->body() === 'We’ve paid you ₹1,000.00 by UPI on 20 Oct 2026. Reference: UTR42.');

        $this->postJson('/api/vendor/register', ['name' => 'Kids Corner', 'email' => 'kids@example.com', 'password' => 'secret123', 'password_confirmation' => 'secret123'])->assertCreated();
        Notification::assertSentTo($this->admin, SellerJoined::class, fn (SellerJoined $message) => $message->title() === 'New seller: Kids Corner');
    }

    public function test_the_inbox_lists_messages_and_marks_them_read(): void
    {
        $orderId = $this->placeOrder([], $this->customer)->json('data.id');

        $inbox = $this->actingAs($this->customer)->getJson('/api/notifications')->assertOk()
            ->assertJsonPath('unread', 1)
            ->assertJsonPath('data.0.title', "Order #{$orderId} confirmed")
            ->assertJsonPath('data.0.kind', 'order')
            ->assertJsonPath('data.0.app_url', "/customer/orders/{$orderId}")
            ->assertJsonPath('data.0.read', false);
        $id = $inbox->json('data.0.id');

        $this->actingAs($this->customer)->patchJson("/api/notifications/{$id}/read")->assertOk()->assertJsonPath('unread', 0);
        $this->actingAs($this->seller)->patchJson("/api/notifications/{$id}/read")->assertNotFound();
        $this->actingAs($this->admin)->getJson('/api/notifications?per_page=1')->assertOk()->assertJsonPath('unread', 1);
        $this->actingAs($this->admin)->postJson('/api/notifications/read-all')->assertOk()->assertJsonPath('unread', 0);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/notifications')->assertUnauthorized();
    }

    public function test_phones_register_for_push_and_receive_messages(): void
    {
        $token = 'ExponentPushToken[abc123]';
        $this->actingAs($this->customer)->postJson('/api/device-tokens', ['token' => 'not-a-token'])->assertUnprocessable();
        $this->actingAs($this->seller)->postJson('/api/device-tokens', ['token' => $token, 'platform' => 'android'])->assertCreated();
        // The same phone signing in to another account moves with it.
        $this->actingAs($this->customer)->postJson('/api/device-tokens', ['token' => $token, 'platform' => 'android'])->assertCreated();
        $this->assertSame($this->customer->id, DeviceToken::where('token', $token)->value('user_id'));

        // Expo accepts the first message; by the second the phone has uninstalled the app.
        Http::fake([ExpoPush::ENDPOINT => Http::sequence()
            ->push(['data' => [['status' => 'ok', 'id' => 'ticket-1']]])
            ->push(['data' => [['status' => 'error', 'details' => ['error' => 'DeviceNotRegistered']]]])]);
        $orderId = $this->placeOrder([], $this->customer)->json('data.id');
        Http::assertSent(fn ($request) => $request->url() === ExpoPush::ENDPOINT
            && $request[0]['to'] === $token
            && $request[0]['title'] === "Order #{$orderId} confirmed"
            && $request[0]['data']['url'] === "/customer/orders/{$orderId}"
            && isset($request[0]['data']['notification_id']));

        // A phone that uninstalled the app is forgotten.
        $this->actingAs($this->admin)->postJson("/api/admin/orders/{$orderId}/tracking", ['status' => 'dispatched'])->assertSuccessful();
        $this->assertFalse(DeviceToken::where('token', $token)->exists());

        $this->actingAs($this->customer)->postJson('/api/device-tokens', ['token' => $token])->assertCreated();
        $this->actingAs($this->customer)->deleteJson('/api/device-tokens', ['token' => $token])->assertOk();
        $this->assertFalse(DeviceToken::where('token', $token)->exists());
    }

    public function test_amounts_are_written_the_indian_way(): void
    {
        $this->assertSame('₹999.00', StoreMessage::inr(999));
        $this->assertSame('₹1,52,500.50', StoreMessage::inr(152500.5));
        $this->assertSame('₹12,34,56,789.00', StoreMessage::inr('123456789'));
    }
}
