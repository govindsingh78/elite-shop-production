<?php

namespace Tests\Feature;

use App\Models\CookieConsent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CookieConsentTest extends TestCase
{
    use RefreshDatabase;

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

    private function choose(array $overrides = [])
    {
        return $this->postJson('/api/consents', array_merge([
            'consent_id' => (string) Str::uuid(),
            'choice' => CookieConsent::ACCEPT_ALL,
            'performance' => true,
            'version' => '2026-10-26',
            'page' => '/product/:handle',
        ], $overrides));
    }

    public function test_the_cookie_policy_is_served_and_linked_from_the_privacy_policy(): void
    {
        $cookies = $this->getJson('/api/storefront/policies/cookies')->assertOk()
            ->assertJsonPath('title', 'Cookie Policy')
            ->assertJsonCount(4, 'highlights')
            ->json();
        $this->assertSame(['what-are-cookies', 'your-choices', 'strictly-necessary', 'performance', 'third-parties', 'managing-cookies', 'changes', 'contact'], array_column($cookies['sections'], 'id'));

        $privacy = $this->getJson('/api/storefront/policies/privacy')->json();
        $links = collect($privacy['sections'])->firstWhere('id', 'cookies')['blocks'];
        $this->assertContains(['type' => 'link', 'text' => 'Read the Cookie Policy', 'to' => 'cookies'], $links);
    }

    public function test_choices_are_recorded_as_proof_of_consent(): void
    {
        $id = (string) Str::uuid();
        $this->choose(['consent_id' => $id])->assertCreated();
        // "Necessary only" never records performance as allowed, whatever is sent.
        $this->choose(['choice' => CookieConsent::NECESSARY_ONLY, 'performance' => true])->assertCreated();
        $this->choose(['choice' => CookieConsent::CUSTOM, 'performance' => false])->assertCreated();

        $customer = User::create(['name' => 'Asha', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->withToken($customer->issueToken('customer'))->postJson('/api/consents', [
            'consent_id' => $id, 'choice' => CookieConsent::NECESSARY_ONLY, 'performance' => false, 'version' => '2026-10-26',
        ])->assertCreated();

        $this->assertSame([true, false, false, false], CookieConsent::query()->orderBy('id')->pluck('performance')->all());
        $this->assertSame([null, null, null, $customer->id], CookieConsent::query()->orderBy('id')->pluck('user_id')->all());
        $this->assertSame(2, CookieConsent::query()->where('consent_id', $id)->count(), 'a changed choice is a new record under the same ID');

        $this->choose(['consent_id' => 'not-a-uuid'])->assertUnprocessable();
        $this->choose(['choice' => 'everything'])->assertUnprocessable();
        $this->choose(['page' => 'javascript:alert(1)'])->assertUnprocessable();
    }

    public function test_admins_see_how_visitors_chose(): void
    {
        $this->choose()->assertCreated();
        $this->choose()->assertCreated();
        $this->choose(['choice' => CookieConsent::NECESSARY_ONLY, 'performance' => false])->assertCreated();
        $this->choose(['choice' => CookieConsent::CUSTOM, 'performance' => false])->assertCreated();

        config(['admin.emails' => ['owner@example.com']]);
        $admin = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'secret123', 'role' => 'admin']);
        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/consents')->assertOk()
            ->assertJsonPath('policy_version', '2026-10-26')
            ->assertJsonPath('last_30_days', ['total' => 4, 'accept_all' => 2, 'necessary_only' => 1, 'custom' => 1, 'performance_share' => 50])
            ->assertJsonCount(4, 'latest');

        $customer = User::create(['name' => 'Asha', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->actingAs($customer, 'sanctum')->getJson('/api/admin/consents')->assertForbidden();
    }
}
