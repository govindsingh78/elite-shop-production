<?php

namespace Tests\Feature;

use App\Mail\BrandedMail;
use App\Mail\TestEmail;
use App\Models\LoginBlock;
use App\Models\User;
use App\Notifications\AccountLocked;
use App\Notifications\SellerAccountUpdated;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class EmailDesignTest extends TestCase
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

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutDefer();
        // The mailer and sender come from .env (MAIL_MAILER, MAIL_FROM_…); here the "array" mailer keeps what's sent.
        config(['mail.default' => 'array', 'mail.from' => ['address' => 'hello@elitezaar.test', 'name' => 'Elitezaar'], 'app.frontend_url' => 'https://elitezaar.com']);
    }

    /** @return list<Email> */
    private function sent(): array
    {
        return app('mailer')->getSymfonyTransport()->messages()->map(fn ($message) => $message->getOriginalMessage())->all();
    }

    private function seller(): User
    {
        return User::forceCreate(['name' => 'Nishu Kapoor', 'email' => 'nishu@example.com', 'password' => 'secret123', 'role' => 'seller', 'seller_status' => User::SELLER_APPROVED]);
    }

    public function test_store_emails_go_out_through_the_configured_mailer_in_the_store_design(): void
    {
        $seller = $this->seller();
        $seller->notify(new SellerAccountUpdated($seller, User::SELLER_PENDING));

        [$email] = $this->sent();
        $this->assertSame('hello@elitezaar.test', $email->getFrom()[0]->getAddress());
        $this->assertSame('Elitezaar', $email->getFrom()[0]->getName());
        $this->assertSame('nishu@example.com', $email->getTo()[0]->getAddress());
        $this->assertSame('Your seller account is approved', $email->getSubject());

        $html = $email->getHtmlBody();
        foreach (['EVERYDAY, ELEVATED.', 'https://elitezaar.com/icon-192.png', 'Seller account', 'Your seller account is approved', 'Hello Nishu,',
            'href="https://elitezaar.com/vendor/products/create"', 'List your first product', '+91 70734 44156', 'support@elitezaar.com',
            'https://elitezaar.com/privacy-policy', 'You’re receiving this email because you sell on Elitezaar.', 'Team Elitezaar'] as $expected) {
            $this->assertStringContainsString($expected, $html);
        }

        // A plain-text part for clients that don't show HTML.
        $text = $email->getTextBody();
        $this->assertStringContainsString('Your seller account is approved', $text);
        $this->assertStringContainsString('List your first product: https://elitezaar.com/vendor/products/create', $text);
        $this->assertStringContainsString('Call +91 70734 44156 or +91 87699 70222 · email support@elitezaar.com', $text);
        $this->assertStringNotContainsString('<', $text);
    }

    public function test_password_reset_and_test_emails_share_the_design(): void
    {
        $seller = $this->seller();
        $seller->sendPasswordResetNotification('reset-token');
        Mail::to('owner@example.com')->send(new TestEmail());

        [$reset, $test] = $this->sent();
        $this->assertSame('Reset your Elitezaar password', $reset->getSubject());
        $this->assertStringContainsString('https://elitezaar.com/reset-password?token=reset-token&amp;email=nishu%40example.com', $reset->getHtmlBody());
        $this->assertStringContainsString('This link works for 60 minutes', $reset->getHtmlBody());
        $this->assertStringContainsString('EVERYDAY, ELEVATED.', $reset->getHtmlBody());

        $this->assertSame('Test email from Elitezaar', $test->getSubject());
        $this->assertStringContainsString('Your emails are working', $test->getHtmlBody());
        $this->assertStringContainsString('Elitezaar &lt;hello@elitezaar.test&gt;', $test->getHtmlBody());
        $this->assertStringContainsString('Your emails are working', $test->getTextBody());
    }

    public function test_details_without_a_value_are_left_out(): void
    {
        $block = new LoginBlock(['attempts' => 3]);
        $block->blocked_until = now()->addDay();
        $html = (string) (new AccountLocked($block, '203.0.113.50', null))->toMail($this->seller())->render();
        $this->assertStringContainsString('203.0.113.50', $html);
        $this->assertStringNotContainsString('>Device<', $html);

        $data = BrandedMail::data('Subject', 'Headline', ['sections' => [
            null,
            ['type' => 'facts', 'rows' => [['label' => 'Courier', 'value' => null]]],
            ['type' => 'items', 'items' => []],
            ['type' => 'note', 'text' => 'Kept'],
        ]]);
        $this->assertSame([['type' => 'note', 'text' => 'Kept']], $data['sections']);
        $this->assertSame('Headline', $data['preheader']);
    }
}
