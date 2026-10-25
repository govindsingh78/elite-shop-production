<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductReviewTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
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
        $this->customer = User::create(['name' => 'Asha Verma', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $category = Category::create(['name' => 'Women', 'status' => 1]);
        $brand = Brand::create(['name' => 'Fabindia', 'status' => 1]);
        $this->product = Product::create([
            'title' => 'Block Print Kurta', 'price' => 1499, 'category_id' => $category->id, 'brand_id' => $brand->id,
            'qty' => 10, 'sku' => 'KRT-1', 'barcode' => '', 'status' => 1,
        ]);
    }

    private function order(string $status, array $overrides = []): Order
    {
        $order = Order::create(array_merge([
            'user_id' => $this->customer->id, 'customer_name' => 'Asha Verma', 'customer_email' => 'asha@example.com',
            'address' => '12 MG Road', 'city' => 'Jaipur', 'subtotal' => 1499, 'shipping_amount' => 0, 'total' => 1499,
            'payment_method' => 'cod', 'payment_status' => 'paid', 'status' => $status,
        ], $overrides));
        $order->items()->create(['product_id' => $this->product->id, 'product_title' => 'Block Print Kurta', 'sku' => 'KRT-1', 'quantity' => 1, 'unit_price' => 1499, 'line_total' => 1499]);

        return $order;
    }

    private function reviewer(string $name, int $rating): void
    {
        $user = User::create(['name' => $name, 'email' => strtolower(str_replace(' ', '.', $name)) . '@example.com', 'password' => 'secret123', 'role' => 'customer']);
        ProductReview::create(['product_id' => $this->product->id, 'user_id' => $user->id, 'rating' => $rating, 'comment' => "Rated {$rating}"]);
    }

    public function test_only_customers_whose_order_was_delivered_can_review(): void
    {
        $this->actingAs($this->customer, 'sanctum');
        $url = "/api/customer/reviews/{$this->product->id}";

        $this->getJson($url)->assertOk()->assertJsonPath('can_review', false)->assertJsonPath('review', null);
        $this->putJson($url, ['rating' => 5])->assertStatus(422)->assertJsonValidationErrors('rating');

        $this->order('shipped');
        $this->putJson($url, ['rating' => 5])->assertStatus(422);

        $this->order('delivered');
        $this->getJson($url)->assertJsonPath('can_review', true);
        $this->putJson($url, ['rating' => 4, 'title' => '  Lovely fabric ', 'comment' => 'Soft and true to size.'])
            ->assertCreated()
            ->assertJsonPath('review.rating', 4)
            ->assertJsonPath('review.title', 'Lovely fabric')
            ->assertJsonPath('review.author', 'Asha V.')
            ->assertJsonPath('summary.count', 1);
    }

    public function test_a_guest_order_with_the_same_email_counts_as_a_purchase(): void
    {
        $this->order('delivered', ['user_id' => null]);

        $this->actingAs($this->customer, 'sanctum')->putJson("/api/customer/reviews/{$this->product->id}", ['rating' => 5])->assertCreated();
    }

    public function test_customers_edit_and_delete_their_own_single_review(): void
    {
        $this->order('delivered');
        $this->actingAs($this->customer, 'sanctum');
        $url = "/api/customer/reviews/{$this->product->id}";

        $this->putJson($url, ['rating' => 3])->assertCreated();
        $this->putJson($url, ['rating' => 5, 'comment' => 'Grew on me.'])->assertOk()->assertJsonPath('review.rating', 5);
        $this->assertSame(1, ProductReview::count());

        $this->putJson($url, ['rating' => 9])->assertStatus(422);
        $this->deleteJson($url)->assertOk();
        $this->assertSame(0, ProductReview::count());
    }

    public function test_public_listing_shows_published_reviews_with_a_summary_and_cards_show_ratings(): void
    {
        $this->reviewer('Ravi Kumar', 5);
        $this->reviewer('Meera Joshi', 4);
        $this->reviewer('Kabir Singh', 1);
        ProductReview::query()->where('rating', 1)->update(['status' => ProductReview::HIDDEN]);

        $this->getJson("/api/storefront/products/{$this->product->id}/reviews")->assertOk()
            ->assertJsonPath('summary.count', 2)
            ->assertJsonPath('summary.average', 4.5)
            ->assertJsonPath('summary.distribution.5', 1)
            ->assertJsonPath('summary.distribution.1', 0)
            ->assertJsonCount(2, 'reviews.data')
            ->assertJsonPath('reviews.data.0.author', 'Meera J.')
            ->assertJsonMissingPath('reviews.data.0.user_id');

        $this->getJson('/api/storefront/products')->assertOk()
            ->assertJsonPath('products.data.0.reviews_count', 2);
        $this->assertEquals(4.5, (float) $this->getJson("/api/storefront/products/{$this->product->id}")->json('data.reviews_avg_rating'));
    }

    public function test_admins_moderate_reviews_and_customers_cannot(): void
    {
        $this->reviewer('Ravi Kumar', 2);
        $review = ProductReview::firstOrFail();
        config(['admin.emails' => ['admin@example.com']]); // admin roles need an approved address (config/admin.php)
        $admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);

        $this->actingAs($this->customer, 'sanctum')->patchJson("/api/admin/reviews/{$review->id}", ['status' => 'hidden'])->assertForbidden();

        $this->actingAs($admin, 'sanctum');
        $this->getJson('/api/admin/reviews?rating=2')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.product.title', 'Block Print Kurta');
        $this->patchJson("/api/admin/reviews/{$review->id}", ['status' => 'hidden'])->assertOk()->assertJsonPath('data.status', 'hidden');
        $this->getJson("/api/storefront/products/{$this->product->id}/reviews")->assertJsonPath('summary.count', 0);
        $this->deleteJson("/api/admin/reviews/{$review->id}")->assertOk();
        $this->assertModelMissing($review);
    }
}
