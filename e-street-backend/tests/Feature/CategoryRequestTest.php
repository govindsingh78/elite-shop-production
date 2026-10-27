<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\CategoryRequest;
use App\Models\User;
use App\Notifications\CategoryRequested;
use App\Notifications\CategoryRequestReviewed;
use App\Notifications\SellerJoined;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CategoryRequestTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Category $kids;
    private Category $women;

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
        Notification::fake();
        config(['admin.emails' => ['admin@example.com']]);
        $this->admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->kids = Category::create(['name' => 'Kids', 'status' => 1]);
        $this->women = Category::create(['name' => 'Women', 'status' => 1]);
        Category::create(['name' => 'Toys', 'parent_id' => $this->kids->id, 'status' => 1]);
    }

    private function register(string $email, array $categoryRequests = [])
    {
        return $this->postJson('/api/vendor/register', [
            'name' => 'Loom Studio', 'email' => $email, 'password' => 'secret123', 'password_confirmation' => 'secret123',
            ...($categoryRequests ? ['category_requests' => $categoryRequests] : []),
        ]);
    }

    private function seller(string $email, string $status = User::SELLER_APPROVED): User
    {
        return User::forceCreate(['name' => ucfirst(strtok($email, '@')), 'email' => $email, 'password' => 'secret123', 'role' => 'seller', 'seller_status' => $status]);
    }

    public function test_a_seller_can_ask_for_categories_when_signing_up(): void
    {
        $this->register('loom@example.com', [
            ['name' => '  footwear ', 'parent_id' => $this->kids->id],
            ['name' => 'Home decor', 'note' => 'Cushions and throws'],
        ])->assertCreated()->assertJsonPath('message', fn ($message) => str_contains($message, 'category requests'));

        $seller = User::where('email', 'loom@example.com')->firstOrFail();
        $this->assertSame(['Footwear', 'Home decor'], $seller->categoryRequests()->orderBy('id')->pluck('name')->all());
        $this->assertSame([CategoryRequest::PENDING], $seller->categoryRequests()->distinct()->pluck('status')->all());
        $this->assertSame('Cushions and throws', $seller->categoryRequests()->where('name', 'Home decor')->value('note'));

        // One message to the admins about the new seller, naming what they asked for.
        Notification::assertSentTo($this->admin, SellerJoined::class, fn (SellerJoined $message) => str_contains($message->body(), 'Kids › Footwear, Home decor'));
        Notification::assertNotSentTo($this->admin, CategoryRequested::class);

        // Signing up without asking for anything works as before.
        $this->register('plain@example.com')->assertCreated();
    }

    public function test_sign_up_refuses_categories_already_in_the_store_or_asked_twice(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class); // more sign-ups than the 5 a minute allowed
        $this->register('a@example.com', [['name' => 'toys', 'parent_id' => $this->kids->id]])
            ->assertUnprocessable()->assertJsonPath('errors', fn ($errors) => str_contains($errors['category_requests.0.name'][0], '“Toys” is already in the store under Kids'));
        $this->register('a@example.com', [['name' => 'Sarees', 'parent_id' => $this->women->id], ['name' => 'sarees', 'parent_id' => $this->women->id]])
            ->assertUnprocessable()->assertJsonValidationErrors(['category_requests.1.name']);
        $this->register('a@example.com', array_fill(0, 4, ['name' => 'Bags']))->assertUnprocessable()->assertJsonValidationErrors(['category_requests']);
        // Subcategories go under a main collection, never under another subcategory.
        $toys = Category::where('name', 'Toys')->value('id');
        $this->register('a@example.com', [['name' => 'Puzzles', 'parent_id' => $toys]])->assertUnprocessable()->assertJsonValidationErrors(['category_requests.0.parent_id']);
        $this->register('a@example.com', [['name' => '', 'parent_id' => $this->kids->id]])->assertUnprocessable()->assertJsonValidationErrors(['category_requests.0.name']);
        $this->assertDatabaseMissing('users', ['email' => 'a@example.com']);

        // "Toys" under Women is a different place, and a switched-off category can be asked for.
        Category::create(['name' => 'Bags', 'status' => 0]);
        $this->register('a@example.com', [['name' => 'Toys', 'parent_id' => $this->women->id], ['name' => 'Bags']])->assertCreated();
        $this->assertSame(2, CategoryRequest::count());
    }

    public function test_a_seller_can_ask_later_see_answers_and_withdraw(): void
    {
        // Still waiting for approval, and can already ask.
        $seller = $this->seller('loom@example.com', User::SELLER_PENDING);
        $this->actingAs($seller, 'sanctum')->postJson('/api/vendor/category-requests', ['name' => 'sarees', 'parent_id' => $this->women->id, 'note' => 'Silk and cotton'])
            ->assertCreated()->assertJsonPath('request.label', 'Women › Sarees')->assertJsonPath('request.status', CategoryRequest::PENDING);
        Notification::assertSentTo($this->admin, CategoryRequested::class, fn (CategoryRequested $message) => $message->title() === 'Category request: Women › Sarees'
            && str_contains($message->body(), 'a new subcategory “Sarees” under Women') && str_contains($message->body(), 'Silk and cotton')
            && $message->webPath() === '/admin/category-requests');

        $this->postJson('/api/vendor/category-requests', ['name' => 'Sarees', 'parent_id' => $this->women->id])
            ->assertUnprocessable()->assertJsonPath('errors.name.0', 'You’ve already asked for this one. We’ll let you know once it’s added.');
        $this->getJson('/api/vendor/category-requests')->assertOk()->assertJsonCount(1, 'requests')->assertJsonPath('requests.0.parent_name', 'Women');

        foreach (['Lehengas', 'Dupattas', 'Kurtis', 'Gowns'] as $name) {
            $this->postJson('/api/vendor/category-requests', ['name' => $name, 'parent_id' => $this->women->id])->assertCreated();
        }
        $this->postJson('/api/vendor/category-requests', ['name' => 'Shawls'])->assertUnprocessable()->assertJsonValidationErrors(['name']);

        // Withdrawing: only their own, and only while waiting.
        $request = CategoryRequest::where('name', 'Sarees')->firstOrFail();
        $this->actingAs($this->seller('other@example.com'), 'sanctum')->deleteJson("/api/vendor/category-requests/{$request->id}")->assertNotFound();
        $this->actingAs($seller, 'sanctum')->deleteJson("/api/vendor/category-requests/{$request->id}")->assertOk();
        $this->assertModelMissing($request);
        $this->postJson('/api/vendor/category-requests', ['name' => 'Shawls'])->assertCreated();

        // Shoppers can't ask.
        $shopper = User::create(['name' => 'Asha', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->actingAs($shopper, 'sanctum')->postJson('/api/vendor/category-requests', ['name' => 'Toys'])->assertForbidden();
    }

    public function test_an_admin_adds_a_category_and_everyone_who_asked_is_told(): void
    {
        $this->register('new@example.com', [['name' => 'Footwear', 'parent_id' => $this->kids->id]])->assertCreated();
        $newSeller = User::where('email', 'new@example.com')->firstOrFail();
        $approved = $this->seller('shoes@example.com');
        $this->actingAs($approved, 'sanctum')->postJson('/api/vendor/category-requests', ['name' => 'FOOTWEAR', 'parent_id' => $this->kids->id])->assertCreated();

        $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/sellers')->assertOk()
            ->assertJsonPath('data', fn ($sellers) => collect($sellers)->firstWhere('email', 'new@example.com')['pending_category_requests'] === 1);
        $list = $this->getJson('/api/admin/category-requests')->assertOk()->assertJsonPath('counts.pending', 2)->assertJsonCount(2, 'data');
        $this->assertSame([1, 1], array_column($list->json('data'), 'also_waiting'));
        $this->assertSame('new@example.com', $list->json('data.0.seller.email'));

        $first = CategoryRequest::where('seller_id', $newSeller->id)->firstOrFail();
        $this->postJson("/api/admin/category-requests/{$first->id}/approve")->assertOk()
            ->assertJsonPath('message', 'Kids › Footwear is ready for sellers\' products. The 2 sellers who asked for it have been told.')
            ->assertJsonPath('request.status', CategoryRequest::APPROVED)->assertJsonPath('request.category.label', 'Kids › Footwear')
            ->assertJsonPath('counts.pending', 0)->assertJsonPath('counts.approved', 2);

        $footwear = Category::where('name', 'Footwear')->firstOrFail();
        $this->assertSame([$this->kids->id, 1, 'kids-footwear'], [$footwear->parent_id, (int) $footwear->status, $footwear->slug]);
        $this->assertSame([$footwear->id], CategoryRequest::distinct()->pluck('category_id')->all());
        $children = collect($this->getJson('/api/storefront/categories')->json())->firstWhere('name', 'Kids')['children'];
        $this->assertContains('Footwear', array_column($children, 'name'));

        // The seller still waiting for approval can't list yet, so their message leads to their requests.
        Notification::assertSentTo($newSeller, CategoryRequestReviewed::class, fn (CategoryRequestReviewed $message) => $message->title() === '“Footwear” is ready for your products'
            && $message->body() === 'You can now choose Kids › Footwear when you list a product.' && $message->webPath() === '/vendor/category-requests');
        Notification::assertSentTo($approved, CategoryRequestReviewed::class, fn (CategoryRequestReviewed $message) => $message->webPath() === '/vendor/products/create'
            && $message->appPath() === '/vendor/product-form');

        $this->postJson("/api/admin/category-requests/{$first->id}/approve")->assertUnprocessable();
        $this->actingAs($this->seller('nobody@example.com'), 'sanctum')->getJson('/api/admin/category-requests')->assertForbidden();
    }

    public function test_an_admin_can_rename_move_reuse_or_decline(): void
    {
        $seller = $this->seller('loom@example.com');
        $ask = fn (string $name, ?int $parentId = null) => CategoryRequest::findOrFail(
            $this->actingAs($seller, 'sanctum')->postJson('/api/vendor/category-requests', ['name' => $name, 'parent_id' => $parentId])->assertCreated()->json('request.id')
        );
        $tshirts = Category::create(['name' => 'T-shirts', 'parent_id' => $this->women->id, 'status' => 1]);
        $hiddenBags = Category::create(['name' => 'Bags', 'status' => 0]);
        $ethnic = $ask('Ethnic', $this->women->id);
        $tees = $ask('Tees', $this->women->id);
        $bags = $ask('bags');
        $gadgets = $ask('Gadgets');

        // Renamed and made a main collection.
        $this->actingAs($this->admin, 'sanctum')->postJson("/api/admin/category-requests/{$ethnic->id}/approve", ['name' => 'ethnic wear', 'parent_id' => null])->assertOk();
        $created = Category::where('name', 'Ethnic wear')->firstOrFail();
        $this->assertNull($created->parent_id);
        Notification::assertSentTo($seller, CategoryRequestReviewed::class, fn (CategoryRequestReviewed $message) => $message->request->is($ethnic)
            && $message->body() === 'You asked for “Women › Ethnic”. You can now choose Ethnic wear when you list a product.');

        // Pointed to a category already in the store: nothing new is added.
        $count = Category::count();
        $this->postJson("/api/admin/category-requests/{$tees->id}/approve", ['category_id' => $tshirts->id])->assertOk()->assertJsonPath('request.category.label', 'Women › T-shirts');
        $this->assertSame($count, Category::count());

        // The same name in the same place is reused and switched back on.
        $this->postJson("/api/admin/category-requests/{$bags->id}/approve")->assertOk();
        $this->assertSame([$hiddenBags->id, 1], [$bags->fresh()->category_id, (int) $hiddenBags->fresh()->status]);

        // Declining needs a reason, which the seller sees.
        $this->postJson("/api/admin/category-requests/{$gadgets->id}/decline")->assertUnprocessable()->assertJsonValidationErrors(['note']);
        $this->postJson("/api/admin/category-requests/{$gadgets->id}/decline", ['note' => 'We only sell clothing and accessories.'])->assertOk()
            ->assertJsonPath('request.status', CategoryRequest::DECLINED)->assertJsonPath('request.admin_note', 'We only sell clothing and accessories.');
        Notification::assertSentTo($seller, CategoryRequestReviewed::class, fn (CategoryRequestReviewed $message) => $message->title() === 'We didn’t add “Gadgets”'
            && str_contains($message->body(), 'Reason: We only sell clothing and accessories.'));

        $answered = collect($this->actingAs($seller, 'sanctum')->getJson('/api/vendor/category-requests')->assertOk()->json('requests'))->keyBy('name');
        $this->assertSame(['approved', 'Ethnic wear'], [$answered['Ethnic']['status'], $answered['Ethnic']['category']['label']]);
        $this->assertSame('declined', $answered['Gadgets']['status']);
        $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/category-requests?status=all')->assertOk()
            ->assertJsonPath('counts', ['pending' => 0, 'approved' => 3, 'declined' => 1, 'all' => 4])
            ->assertJsonPath('data.0.reviewer', 'Admin');
    }
}
