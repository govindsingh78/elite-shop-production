<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\BrandRequest;
use App\Models\Category;
use App\Models\User;
use App\Notifications\BrandRequested;
use App\Notifications\BrandRequestReviewed;
use App\Notifications\SellerJoined;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BrandRequestTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Brand $levis;

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
        Notification::fake();
        config(['admin.emails' => ['admin@example.com']]);
        $this->admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->levis = Brand::create(['name' => 'Levis', 'status' => 1]);
    }

    private function register(string $email, array $brandRequests = [], array $categoryRequests = [])
    {
        return $this->postJson('/api/vendor/register', [
            'name' => 'Loom Studio', 'email' => $email, 'password' => 'secret123', 'password_confirmation' => 'secret123',
            ...($brandRequests ? ['brand_requests' => $brandRequests] : []),
            ...($categoryRequests ? ['category_requests' => $categoryRequests] : []),
        ]);
    }

    private function seller(string $email, string $status = User::SELLER_APPROVED): User
    {
        return User::forceCreate(['name' => ucfirst(strtok($email, '@')), 'email' => $email, 'password' => 'secret123', 'role' => 'seller', 'seller_status' => $status]);
    }

    public function test_a_seller_can_ask_for_brands_when_signing_up(): void
    {
        $this->register('loom@example.com', [
            ['name' => '  boAt   audio '],
            ['name' => 'Loom Craft', 'note' => 'My own label'],
        ])->assertCreated()->assertJsonPath('message', fn ($message) => str_contains($message, 'brand requests'));

        $seller = User::where('email', 'loom@example.com')->firstOrFail();
        // Spacing is tidied, but a brand's capitals are its own.
        $this->assertSame(['boAt audio', 'Loom Craft'], $seller->brandRequests()->orderBy('id')->pluck('name')->all());
        $this->assertSame('My own label', $seller->brandRequests()->where('name', 'Loom Craft')->value('note'));

        // One message to the admins about the new seller, naming what they asked for.
        Notification::assertSentTo($this->admin, SellerJoined::class, fn (SellerJoined $message) => str_contains($message->body(), 'boAt audio, Loom Craft'));
        Notification::assertNotSentTo($this->admin, BrandRequested::class);

        // Asking for both at once.
        $kids = Category::create(['name' => 'Kids', 'status' => 1]);
        $this->register('both@example.com', [['name' => 'Tiny Toes']], [['name' => 'Footwear', 'parent_id' => $kids->id]])
            ->assertCreated()->assertJsonPath('message', fn ($message) => str_contains($message, 'category and brand requests'));
        Notification::assertSentTo($this->admin, SellerJoined::class, fn (SellerJoined $message) => str_contains($message->body(), 'Kids › Footwear') && str_contains($message->body(), 'Tiny Toes'));
    }

    public function test_sign_up_refuses_brands_already_in_the_store_or_asked_twice(): void
    {
        $this->register('loom@example.com', [['name' => 'LEVIS']])
            ->assertUnprocessable()->assertJsonValidationErrors('brand_requests.0.name')
            ->assertJsonPath('errors', fn ($errors) => str_contains($errors['brand_requests.0.name'][0], '“Levis” is already in the store'));
        $this->register('loom@example.com', [['name' => 'Puma'], ['name' => ' puma ']])
            ->assertUnprocessable()->assertJsonValidationErrors('brand_requests.1.name');
        $this->register('loom@example.com', [['name' => 'One'], ['name' => 'Two'], ['name' => 'Three'], ['name' => 'Four']])
            ->assertUnprocessable()->assertJsonValidationErrors('brand_requests');
        $this->assertDatabaseMissing('users', ['email' => 'loom@example.com']);

        // Problems with categories and brands show together, not one list at a time.
        $men = Category::create(['name' => 'Men', 'status' => 1]);
        $this->register('loom@example.com', [['name' => 'Levis']], [['name' => $men->name]])
            ->assertUnprocessable()->assertJsonValidationErrors(['brand_requests.0.name', 'category_requests.0.name']);

        // A hidden brand can be asked for: an admin can switch it back on.
        Brand::create(['name' => 'Old Label', 'status' => 0]);
        $this->register('loom@example.com', [['name' => 'old label']])->assertCreated();
    }

    public function test_a_seller_can_ask_later_see_answers_and_withdraw(): void
    {
        $seller = $this->seller('loom@example.com', User::SELLER_PENDING);

        $id = $this->actingAs($seller)->postJson('/api/vendor/brand-requests', ['name' => 'Loom Craft', 'note' => 'Handloom'])
            ->assertCreated()->assertJsonPath('request.status', BrandRequest::PENDING)->json('request.id');
        Notification::assertSentTo($this->admin, BrandRequested::class, fn (BrandRequested $message) => str_contains($message->body(), 'Loom Craft') && str_contains($message->body(), 'Handloom'));

        $this->postJson('/api/vendor/brand-requests', ['name' => 'loom craft'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->postJson('/api/vendor/brand-requests', ['name' => 'Levis'])->assertUnprocessable()
            ->assertJsonPath('errors.name.0', '“Levis” is already in the store. You can choose it when you list a product.');
        $this->postJson('/api/vendor/brand-requests', ['name' => ''])->assertUnprocessable()->assertJsonPath('errors.name.0', 'Enter the brand you need.');

        foreach (['Two', 'Three', 'Four', 'Five'] as $name) {
            $this->postJson('/api/vendor/brand-requests', ['name' => $name])->assertCreated();
        }
        $this->postJson('/api/vendor/brand-requests', ['name' => 'Six'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->getJson('/api/vendor/brand-requests')->assertOk()->assertJsonCount(5, 'requests')->assertJsonPath('max_pending', 5);

        // Only your own, and only while it's waiting.
        $other = $this->seller('other@example.com');
        $this->actingAs($other)->deleteJson("/api/vendor/brand-requests/{$id}")->assertNotFound();
        $this->actingAs($seller)->deleteJson("/api/vendor/brand-requests/{$id}")->assertOk();
        $this->assertDatabaseMissing('brand_requests', ['id' => $id]);

        $answered = BrandRequest::query()->where('seller_id', $seller->id)->firstOrFail();
        $this->actingAs($this->admin)->postJson("/api/admin/brand-requests/{$answered->id}/approve", [])->assertOk();
        $this->actingAs($seller)->deleteJson("/api/vendor/brand-requests/{$answered->id}")->assertUnprocessable();
    }

    public function test_an_admin_adds_a_brand_and_everyone_who_asked_is_told(): void
    {
        $first = $this->seller('first@example.com');
        $second = $this->seller('second@example.com', User::SELLER_PENDING);
        $this->actingAs($first)->postJson('/api/vendor/brand-requests', ['name' => 'boAt'])->assertCreated();
        $this->actingAs($second)->postJson('/api/vendor/brand-requests', ['name' => 'BOAT'])->assertCreated();
        $request = BrandRequest::query()->where('seller_id', $first->id)->firstOrFail();

        // Sellers can't answer, and customers can't see the queue.
        $this->actingAs($first)->postJson("/api/admin/brand-requests/{$request->id}/approve", [])->assertForbidden();
        $this->actingAs($this->admin)->getJson('/api/admin/brand-requests')->assertOk()->assertJsonPath('counts.pending', 2)
            ->assertJsonPath('data.0.also_waiting', 1)->assertJsonPath('data.0.seller.email', 'first@example.com');
        $this->getJson('/api/admin/sellers')->assertOk()
            ->assertJsonPath('data', fn ($sellers) => collect($sellers)->firstWhere('email', 'first@example.com')['pending_brand_requests'] === 1);

        $this->postJson("/api/admin/brand-requests/{$request->id}/approve", [])->assertOk()
            ->assertJsonPath('request.status', BrandRequest::APPROVED)->assertJsonPath('request.brand.name', 'boAt')
            ->assertJsonPath('counts.pending', 0)->assertJsonPath('counts.approved', 2)
            ->assertJsonPath('message', fn ($message) => str_contains($message, 'The 2 sellers'));
        $brand = Brand::query()->where('name', 'boAt')->firstOrFail();
        $this->assertSame(1, (int) $brand->status);
        $this->assertSame(2, BrandRequest::query()->where('brand_id', $brand->id)->count());

        // The seller who can sell goes straight to listing; the one still waiting sees their requests.
        Notification::assertSentTo($first, BrandRequestReviewed::class, fn (BrandRequestReviewed $message) => $message->webPath() === '/vendor/products/create' && $message->appPath() === '/vendor/product-form' && str_contains($message->title(), 'boAt'));
        Notification::assertSentTo($second, BrandRequestReviewed::class, fn (BrandRequestReviewed $message) => $message->webPath() === '/vendor/brand-requests' && str_contains($message->body(), 'You can now choose boAt'));

        // It's on the seller's product form now, and a request can't be answered twice.
        $this->actingAs($first)->getJson('/api/vendor/product-options')->assertOk()
            ->assertJsonPath('brands', fn ($brands) => collect($brands)->contains('name', 'boAt'));
        $this->actingAs($this->admin)->postJson("/api/admin/brand-requests/{$request->id}/decline", ['note' => 'No'])->assertUnprocessable();
    }

    public function test_an_admin_can_rename_reuse_or_decline(): void
    {
        $seller = $this->seller('loom@example.com');
        $this->actingAs($seller);
        foreach (['Addidas', 'Levi', 'Old Label', 'Knockoffs'] as $name) {
            $this->postJson('/api/vendor/brand-requests', ['name' => $name])->assertCreated();
        }
        $request = fn (string $name) => BrandRequest::query()->where('name', $name)->firstOrFail();
        $this->actingAs($this->admin);

        // Fixing a typo, and the seller is told what they asked for.
        $this->postJson("/api/admin/brand-requests/{$request('Addidas')->id}/approve", ['name' => '  adidas '])->assertOk()->assertJsonPath('request.brand.name', 'adidas');
        Notification::assertSentTo($seller, BrandRequestReviewed::class, fn (BrandRequestReviewed $message) => str_contains($message->body(), 'You asked for “Addidas”. You can now choose adidas'));

        // Pointing to a brand already in the store adds nothing new.
        $brands = Brand::query()->count();
        $this->postJson("/api/admin/brand-requests/{$request('Levi')->id}/approve", ['brand_id' => $this->levis->id])->assertOk()->assertJsonPath('request.brand.id', $this->levis->id);
        $this->assertSame($brands, Brand::query()->count());

        // The same name reuses the brand, and a hidden one is switched on.
        $hidden = Brand::create(['name' => 'old label', 'status' => 0]);
        $this->postJson("/api/admin/brand-requests/{$request('Old Label')->id}/approve", [])->assertOk()->assertJsonPath('request.brand.id', $hidden->id);
        $this->assertSame(1, (int) $hidden->fresh()->status);

        // Declining needs a reason, which the seller sees.
        $id = $request('Knockoffs')->id;
        $this->postJson("/api/admin/brand-requests/{$id}/decline", ['note' => ''])->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->postJson("/api/admin/brand-requests/{$id}/decline", ['note' => 'We only list genuine brands.'])->assertOk()->assertJsonPath('request.status', BrandRequest::DECLINED);
        Notification::assertSentTo($seller, BrandRequestReviewed::class, fn (BrandRequestReviewed $message) => str_contains($message->body(), 'Reason: We only list genuine brands.') && $message->webPath() === '/vendor/brand-requests');
        $this->assertSame(0, Brand::query()->where('name', 'Knockoffs')->count());
    }
}
