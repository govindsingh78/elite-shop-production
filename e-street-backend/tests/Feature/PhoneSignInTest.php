<?php

namespace Tests\Feature;

use App\Models\LoginAttempt;
use App\Models\User;
use App\Services\Security\PhoneOtp;
use App\Services\Sms\FakeSender;
use App\Services\Sms\SmsSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PhoneSignInTest extends TestCase
{
    use RefreshDatabase;

    private FakeSender $sms;
    private User $shopper;
    private User $seller;

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
        config(['logging.default' => 'null', 'admin.emails' => ['owner@example.com']]);
        $this->sms = SmsSender::fake();
        $this->shopper = User::create(['name' => 'Asha', 'email' => 'asha@example.com', 'password' => 'secret123', 'role' => 'customer', 'phone' => '98290 12345']);
        $this->seller = User::create(['name' => 'Loom', 'email' => 'loom@example.com', 'password' => 'secret123', 'role' => 'seller', 'phone' => '+91 98290 12345']);
    }

    protected function tearDown(): void
    {
        SmsSender::stopFaking();
        parent::tearDown();
    }

    private function confirm(User $user, string $phone): void
    {
        $this->actingAs($user, 'sanctum')->postJson('/api/account/phone/send', ['phone' => $phone])->assertOk();
        $this->postJson('/api/account/phone/verify', ['phone' => $phone, 'code' => $this->sms->codeFor(PhoneOtp::normalise($phone))])->assertOk()
            ->assertJsonPath('verified', true);
        $this->app['auth']->forgetGuards();
        DB::table('otp_challenges')->update(['created_at' => now()->subMinute()]);
    }

    private function sendCode(string $phone, string $portal = 'customer')
    {
        return $this->postJson('/api/auth/otp/send', ['portal' => $portal, 'phone' => $phone]);
    }

    public function test_numbers_are_read_the_indian_way(): void
    {
        foreach (['9829012345', '98290 12345', '+91 98290-12345', '919829012345', '09829012345'] as $typed) {
            $this->assertSame('+919829012345', PhoneOtp::normalise($typed), $typed);
        }
        foreach (['12345', '5829012345', '+1 415 555 0100', ''] as $typed) {
            $this->assertNull(PhoneOtp::normalise($typed), $typed);
        }
        $this->assertSame('+91 98290 12345', PhoneOtp::display('+919829012345'));
        $this->assertSame('+91 98•••••345', PhoneOtp::mask('+919829012345'));
        $this->assertSame('+919829012345', $this->shopper->fresh()->phone_e164, 'kept in standard form');
    }

    public function test_a_shopper_confirms_their_number_then_signs_in_with_a_code(): void
    {
        // Not confirmed yet: the same reply as for any number, and no SMS.
        $reply = $this->sendCode('9829012345')->assertOk()->json('message');
        $this->assertSame([], $this->sms->sent);
        $this->assertStringContainsString('+91 98•••••345', $reply);

        $this->confirm($this->shopper, '98290 12345');
        $this->assertNotNull($this->shopper->fresh()->phone_verified_at);

        $this->sendCode('+91 98290 12345')->assertOk()->assertJsonPath('resend_in', 30);
        $code = $this->sms->codeFor('+919829012345');
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $this->assertNotSame($code, DB::table('otp_challenges')->latest('id')->value('code_hash'), 'only a hash is stored');

        $this->postJson('/api/auth/otp/verify', ['portal' => 'customer', 'phone' => '9829012345', 'code' => $code])->assertOk()
            ->assertJsonPath('portal', 'customer')
            ->assertJsonPath('user.email', 'asha@example.com')
            ->assertJsonPath('token', fn ($token) => is_string($token) && $token !== '');
        $this->assertSame('otp', LoginAttempt::query()->where('outcome', 'success')->sole()->method);

        // A code works once.
        $this->postJson('/api/auth/otp/verify', ['portal' => 'customer', 'phone' => '9829012345', 'code' => $code])->assertUnprocessable();
    }

    public function test_a_number_signs_in_only_where_it_was_confirmed(): void
    {
        $this->confirm($this->shopper, '9829012345');
        // The seller account has the same number, unconfirmed: the seller portal sends nothing.
        $this->sendCode('9829012345', 'vendor')->assertOk();
        $this->assertCount(1, $this->sms->sent, 'only the confirmation code');

        // Another shopper can't take over the number, but the seller (another portal) can confirm it too.
        $other = User::create(['name' => 'Other', 'email' => 'other@example.com', 'password' => 'secret123', 'role' => 'customer']);
        $this->actingAs($other, 'sanctum')->postJson('/api/account/phone/send', ['phone' => '9829012345'])->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->app['auth']->forgetGuards();
        $this->confirm($this->seller, '9829012345');
        $this->sendCode('9829012345', 'vendor')->assertOk();
        $this->postJson('/api/auth/otp/verify', ['portal' => 'vendor', 'phone' => '9829012345', 'code' => $this->sms->codeFor('+919829012345')])->assertOk()
            ->assertJsonPath('user.email', 'loom@example.com');

        // A new number in the profile has to be confirmed again; tidying the old one up doesn't.
        $this->actingAs($this->shopper, 'sanctum')->putJson('/api/customer/profile', ['name' => 'Asha', 'phone' => '+91-98290-12345'])->assertOk();
        $this->assertNotNull($this->shopper->fresh()->phone_verified_at);
        $this->putJson('/api/customer/profile', ['name' => 'Asha', 'phone' => '9876500000'])->assertOk();
        $this->assertNull($this->shopper->fresh()->phone_verified_at);
    }

    public function test_wrong_codes_lock_the_account_like_wrong_passwords(): void
    {
        $this->confirm($this->shopper, '9829012345');
        $this->sendCode('9829012345')->assertOk();
        $right = $this->sms->codeFor('+919829012345');
        $wrong = $right === '111111' ? '222222' : '111111';

        $this->postJson('/api/auth/otp/verify', ['portal' => 'customer', 'phone' => '9829012345', 'code' => $wrong])->assertUnprocessable()
            ->assertJsonPath('errors.code.0', 'That code isn’t right. Check the SMS and try again.');
        $this->postJson('/api/auth/otp/verify', ['portal' => 'customer', 'phone' => '9829012345', 'code' => $wrong])->assertUnprocessable();
        $this->postJson('/api/auth/otp/verify', ['portal' => 'customer', 'phone' => '9829012345', 'code' => $wrong])->assertStatus(423);
        // Locked: neither codes nor the password work for now, and no more SMS are sent.
        $this->postJson('/api/auth/otp/verify', ['portal' => 'customer', 'phone' => '9829012345', 'code' => $right])->assertStatus(423);
        $this->postJson('/api/customer/login', ['email' => 'asha@example.com', 'password' => 'secret123'])->assertStatus(423);
        DB::table('otp_challenges')->update(['created_at' => now()->subMinute()]);
        $sent = count($this->sms->sent);
        $this->sendCode('9829012345')->assertStatus(423);
        $this->assertCount($sent, $this->sms->sent);
        $this->assertSame(3, LoginAttempt::query()->where('method', 'otp')->where('outcome', 'failed')->count());
    }

    public function test_sending_is_limited_so_nobody_runs_up_an_sms_bill(): void
    {
        // Our own limits, not the per-minute request limit in front of them.
        $this->withoutMiddleware(ThrottleRequests::class);
        $this->confirm($this->shopper, '9829012345');
        $this->sendCode('9829012345')->assertOk();
        $this->sendCode('9829012345')->assertStatus(429)->assertJsonPath('retry_after', fn ($seconds) => $seconds > 0 && $seconds <= 30);

        foreach (range(1, 3) as $ignored) {
            DB::table('otp_challenges')->update(['created_at' => now()->subSeconds(40)]);
            $this->sendCode('9829012345')->assertOk();
        }
        DB::table('otp_challenges')->update(['created_at' => now()->subSeconds(40)]);
        // 5 in the last hour (the confirmation code included): no more for now.
        $this->sendCode('9829012345')->assertStatus(429)->assertJsonPath('message', fn ($message) => str_contains($message, 'Too many codes'));

        $this->postJson('/api/auth/otp/send', ['portal' => 'customer', 'phone' => '12345'])->assertUnprocessable()->assertJsonValidationErrors('phone');
    }

    public function test_providers_are_called_the_way_they_expect(): void
    {
        SmsSender::stopFaking();
        Http::fake([
            'api.msg91.com/*' => Http::response(['type' => 'success', 'request_id' => 'req-1']),
            '2factor.in/*' => Http::response(['Status' => 'Success', 'Details' => 'session-1']),
            'api.twilio.com/*' => Http::response(['sid' => 'SM1'], 201),
        ]);

        config(['services.sms.driver' => 'msg91', 'services.sms.msg91' => ['authkey' => 'key-1', 'template_id' => 'tmpl-1']]);
        $this->assertTrue(PhoneOtp::enabled());
        SmsSender::make()->sendOtp('+919829012345', '123456', 5);
        Http::assertSent(fn (HttpRequest $request) => str_starts_with($request->url(), 'https://api.msg91.com/api/v5/otp?')
            && $request['authkey'] === 'key-1' && $request['template_id'] === 'tmpl-1' && $request['mobile'] === '919829012345' && $request['otp'] === '123456');

        config(['services.sms.driver' => '2factor', 'services.sms.2factor' => ['api_key' => 'key-2', 'template' => 'ELITE-OTP']]);
        SmsSender::make()->sendOtp('+919829012345', '654321', 5);
        Http::assertSent(fn (HttpRequest $request) => $request->url() === 'https://2factor.in/API/V1/key-2/SMS/9829012345/654321/ELITE-OTP');

        config(['services.sms.driver' => 'twilio', 'services.sms.twilio' => ['sid' => 'AC1', 'token' => 'secret', 'messaging_service_sid' => 'MG1', 'from' => null]]);
        SmsSender::make()->sendOtp('+919829012345', '777777', 5);
        Http::assertSent(fn (HttpRequest $request) => $request->url() === 'https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json'
            && $request['To'] === '+919829012345' && $request['MessagingServiceSid'] === 'MG1' && str_starts_with($request['Body'], '777777 is your Elitezaar sign-in code')
            && $request->hasHeader('Authorization', 'Basic ' . base64_encode('AC1:secret')));

        // No keys, or only the log on the live site: phone sign-in is hidden.
        config(['services.sms.driver' => 'msg91', 'services.sms.msg91' => ['authkey' => null, 'template_id' => null]]);
        $this->assertFalse(PhoneOtp::enabled());
        config(['services.sms.driver' => 'log']);
        $this->app['env'] = 'production';
        $this->getJson('/api/auth/providers')->assertJsonPath('phone', false);
        $this->app['env'] = 'testing';
        $this->getJson('/api/auth/providers')->assertJsonPath('phone', true);
    }

    /** Its own test: with Http::fake, the first response set up for an address is the one used. */
    public function test_a_provider_saying_no_is_explained_and_reported(): void
    {
        SmsSender::stopFaking();
        Http::fake(['api.msg91.com/*' => Http::response(['type' => 'error', 'message' => 'Invalid template'])]);
        config(['services.sms.driver' => 'msg91', 'services.sms.msg91' => ['authkey' => 'key-1', 'template_id' => 'tmpl-1']]);
        $this->actingAs($this->shopper, 'sanctum')->postJson('/api/account/phone/send', ['phone' => '9829012345'])->assertStatus(503)
            ->assertJsonPath('message', fn ($message) => str_starts_with($message, 'We couldn’t send the code just now'));
        // Listed under Server & health › Problems.
        $this->assertDatabaseHas('monitor_problems', ['title' => 'Sign-in code not sent']);
    }
}
