<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Notifications\SellerAccountUpdated;
use App\Notifications\SellerJoined;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class SellerApprovalTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
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
        // Messages normally go out after the response; here they go out straight away.
        $this->withoutDefer();
        Notification::fake();
        config(['admin.emails' => ['admin@example.com']]);
        $this->admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->category = Category::create(['name' => 'Men', 'slug' => 'men', 'status' => 1]);
        $this->brand = Brand::create(['name' => 'Acme', 'status' => 1]);
    }

    private function listing(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Linen shirt', 'price' => 1499, 'category_id' => $this->category->id, 'brand_id' => $this->brand->id,
            'sku' => 'LIN-1', 'qty' => 4, 'status' => 1, 'is_featured' => 'no',
        ], $overrides);
    }

    private function storefrontIds(): array
    {
        return collect($this->getJson("/api/storefront/products?category_slug={$this->category->slug}")->assertOk()->json('products.data'))
            ->pluck('id')->all();
    }

    private function order(int $productId)
    {
        return $this->postJson('/api/orders', [
            'customer_name' => 'Asha', 'customer_email' => 'asha@example.com', 'address' => '12 MG Road', 'city' => 'Jaipur',
            'payment_method' => 'cod', 'accept_policy' => true, 'items' => [['product_id' => $productId, 'quantity' => 1]],
        ]);
    }

    private function setStatus(User $seller, string $status, ?string $note = null)
    {
        return $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/sellers/{$seller->id}/status", array_filter(['status' => $status, 'note' => $note]));
    }

    public function test_a_seller_who_signs_up_waits_for_approval(): void
    {
        $this->postJson('/api/vendor/register', ['name' => 'Loom Studio', 'email' => 'loom@example.com', 'password' => 'secret123', 'password_confirmation' => 'secret123'])
            ->assertCreated()->assertJsonPath('user.seller_status', User::SELLER_PENDING);
        $seller = User::where('email', 'loom@example.com')->firstOrFail();
        Notification::assertSentTo($this->admin, SellerJoined::class, fn (SellerJoined $message) => $message->webPath() === '/admin/sellers');

        // They can sign in, see where they stand and add their business details, but not sell yet.
        $this->postJson('/api/vendor/login', ['email' => 'loom@example.com', 'password' => 'secret123'])->assertOk()
            ->assertJsonPath('user.seller_status', User::SELLER_PENDING);
        $this->actingAs($seller, 'sanctum');
        $this->getJson('/api/vendor/dashboard')->assertOk()
            ->assertJsonPath('account.status', User::SELLER_PENDING)
            ->assertJsonPath('account.can_sell', false)
            ->assertJsonPath('account.business_details_added', false);
        $this->putJson('/api/vendor/business', ['legal_name' => 'Loom Studio LLP', 'gstin' => '27AAPFU0939F1ZV', 'business_address' => '4 Linking Road, Mumbai'])->assertOk();
        $this->getJson('/api/vendor/dashboard')->assertJsonPath('account.business_details_added', true);
        $this->getJson('/api/vendor/products')->assertOk();
        $this->postJson('/api/vendor/products', $this->listing())->assertForbidden()
            ->assertJsonPath('seller_status', User::SELLER_PENDING)
            ->assertJsonPath('message', fn ($message) => str_contains($message, 'waiting for approval'));
        $this->postJson('/api/vendor/bulk-products/check', [])->assertForbidden();

        // The admin sees the application, with the business details, and approves it.
        $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/sellers?status=pending')->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('counts.pending', 1)
            ->assertJsonPath('data.0.gstin', '27AAPFU0939F1ZV')
            ->assertJsonPath('data.0.business_state_name', 'Maharashtra');
        $this->setStatus($seller, User::SELLER_APPROVED)->assertOk()
            ->assertJsonPath('message', 'Loom Studio is approved and can now list products.')
            ->assertJsonPath('seller.seller_status', User::SELLER_APPROVED)
            ->assertJsonPath('counts.pending', 0);
        Notification::assertSentTo($seller, SellerAccountUpdated::class, fn (SellerAccountUpdated $message) => $message->title() === 'Your seller account is approved'
            && $message->appPath() === '/vendor/product-form');

        $this->actingAs($seller->fresh(), 'sanctum')->postJson('/api/vendor/products', $this->listing())->assertCreated();
    }

    public function test_deactivating_a_seller_hides_their_products_until_reactivated(): void
    {
        $seller = User::create(['name' => 'Loom Studio', 'email' => 'loom@example.com', 'password' => 'secret123', 'role' => 'seller']);
        $this->assertSame(User::SELLER_APPROVED, $seller->seller_status, 'sellers an admin makes start approved');
        $product = Product::create([...$this->listing(), 'barcode' => '8901234567890', 'vendor_id' => $seller->id, 'approval_status' => Product::APPROVED]);
        $this->assertContains($product->id, $this->storefrontIds());
        $orderId = $this->order($product->id)->assertCreated()->json('data.id');

        $this->setStatus($seller, User::SELLER_DEACTIVATED)->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->setStatus($seller, User::SELLER_DEACTIVATED, 'Repeated late shipments')->assertOk()
            ->assertJsonPath('message', 'Loom Studio is deactivated and their products are hidden from the store. They have 1 open order — you can manage it from Orders.')
            ->assertJsonPath('seller.open_orders', 1)
            ->assertJsonPath('seller.listed_products_count', 1);
        Notification::assertSentTo($seller, SellerAccountUpdated::class, fn (SellerAccountUpdated $message) => $message->title() === 'Your seller account has been deactivated'
            && str_contains($message->body(), 'Reason: Repeated late shipments.'));

        // Out of the store, and can't be bought.
        $this->assertNotContains($product->id, $this->storefrontIds());
        $this->getJson("/api/storefront/products/{$product->slug}")->assertNotFound();
        $this->order($product->id)->assertUnprocessable();
        $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/products')->assertOk()
            ->assertJsonPath('data.0.vendor.seller_status', User::SELLER_DEACTIVATED);

        // The seller can still see their orders, but not change products or orders.
        $this->actingAs($seller->fresh(), 'sanctum');
        $this->getJson("/api/vendor/orders/{$orderId}")->assertOk();
        $this->getJson('/api/vendor/earnings')->assertOk();
        $this->putJson("/api/vendor/orders/{$orderId}", ['status' => 'processing'])->assertForbidden()
            ->assertJsonPath('message', 'Your seller account has been deactivated: Repeated late shipments. Your products are hidden from the store. Contact Elitezaar support if you have questions.');
        $this->putJson("/api/vendor/products/{$product->id}", $this->listing(['qty' => 9]))->assertForbidden();
        $this->deleteJson("/api/vendor/products/{$product->id}")->assertForbidden();
        $this->getJson('/api/vendor/dashboard')->assertJsonPath('account.status', User::SELLER_DEACTIVATED)
            ->assertJsonPath('account.note', 'Repeated late shipments');

        $this->setStatus($seller, User::SELLER_APPROVED)->assertOk()
            ->assertJsonPath('message', 'Loom Studio is active again. Their approved products are back in the store.')
            ->assertJsonPath('seller.seller_status_note', null);
        Notification::assertSentTo($seller, SellerAccountUpdated::class, fn (SellerAccountUpdated $message) => $message->title() === 'Your seller account is active again');
        $this->assertContains($product->id, $this->storefrontIds());
        $this->actingAs($seller->fresh(), 'sanctum')->putJson("/api/vendor/orders/{$orderId}", ['status' => 'processing'])->assertOk();
    }

    public function test_only_sensible_changes_are_allowed(): void
    {
        $applicant = User::forceCreate(['name' => 'New Seller', 'email' => 'new@example.com', 'password' => 'secret123', 'role' => 'seller', 'seller_status' => User::SELLER_PENDING]);
        $trading = User::create(['name' => 'Trading Seller', 'email' => 'trading@example.com', 'password' => 'secret123', 'role' => 'seller']);
        $customer = User::create(['name' => 'Shopper', 'email' => 'shopper@example.com', 'password' => 'secret123', 'role' => 'customer']);

        $this->setStatus($applicant, User::SELLER_DEACTIVATED, 'Spam')->assertUnprocessable()
            ->assertJsonPath('errors.status.0', 'Only an approved seller can be deactivated. Decline an application instead.');
        $this->setStatus($applicant, User::SELLER_REJECTED)->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->setStatus($applicant, User::SELLER_REJECTED, 'We couldn’t verify your GSTIN.')->assertOk()
            ->assertJsonPath('seller.seller_status_note', 'We couldn’t verify your GSTIN.');
        Notification::assertSentTo($applicant, SellerAccountUpdated::class, fn (SellerAccountUpdated $message) => $message->title() === 'Your seller application wasn’t approved'
            && str_contains($message->body(), 'Reason: We couldn’t verify your GSTIN.'));
        $this->actingAs($applicant->fresh(), 'sanctum')->postJson('/api/vendor/products', $this->listing())->assertForbidden()
            ->assertJsonPath('message', 'Your seller application wasn’t approved: We couldn’t verify your GSTIN. Contact Elitezaar support if you have questions.');
        $this->setStatus($applicant, User::SELLER_REJECTED, 'Again')->assertUnprocessable()
            ->assertJsonPath('errors.status.0', 'This seller is already declined.');
        // A declined seller can still be approved later.
        $this->setStatus($applicant, User::SELLER_APPROVED)->assertOk();

        $this->setStatus($trading, User::SELLER_REJECTED, 'No')->assertUnprocessable()
            ->assertJsonPath('errors.status.0', 'Only an application that’s waiting for approval can be declined.');
        $this->setStatus($trading, User::SELLER_APPROVED)->assertUnprocessable()
            ->assertJsonPath('errors.status.0', 'This seller is already approved.');
        $this->setStatus($customer, User::SELLER_APPROVED)->assertNotFound();

        // Admins only.
        $this->actingAs($trading, 'sanctum')->getJson('/api/admin/sellers')->assertForbidden();
        $this->actingAs($trading, 'sanctum')->patchJson("/api/admin/sellers/{$applicant->id}/status", ['status' => 'deactivated', 'note' => 'x'])->assertForbidden();
    }

    public function test_the_sellers_list_filters_and_counts(): void
    {
        User::forceCreate(['name' => 'Waiting One', 'email' => 'wait1@example.com', 'password' => 'secret123', 'role' => 'seller', 'seller_status' => User::SELLER_PENDING]);
        User::forceCreate(['name' => 'Waiting Two', 'email' => 'wait2@example.com', 'password' => 'secret123', 'role' => 'seller', 'seller_status' => User::SELLER_PENDING]);
        User::create(['name' => 'Shopper', 'email' => 'shopper@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->actingAs($this->admin, 'sanctum');
        // An admin adding a seller account vouches for it.
        $made = $this->postJson('/api/admin/users', ['name' => 'Kids Corner', 'email' => 'kids@example.com', 'role' => 'seller', 'password' => 'secret123', 'password_confirmation' => 'secret123'])
            ->assertCreated()->json('data.id');
        $this->assertSame(User::SELLER_APPROVED, User::find($made)->seller_status);

        $list = $this->getJson('/api/admin/sellers')->assertOk()
            ->assertJsonPath('counts', ['pending' => 2, 'approved' => 1, 'rejected' => 0, 'deactivated' => 0, 'all' => 3])
            ->assertJsonPath('total', 3);
        // Applications first.
        $this->assertSame(['pending', 'pending', 'approved'], collect($list->json('data'))->pluck('seller_status')->all());
        $this->assertSame(['Waiting One', 'Waiting Two'], collect($this->getJson('/api/admin/sellers?status=pending')->json('data'))->pluck('name')->all());
        $this->getJson('/api/admin/sellers?search=kids')->assertJsonPath('total', 1)->assertJsonPath('data.0.name', 'Kids Corner');
        $this->getJson("/api/admin/sellers/{$made}")->assertOk()->assertJsonPath('seller.products_count', 0);
        $this->getJson('/api/admin/sellers?status=unknown')->assertUnprocessable();
    }
}
