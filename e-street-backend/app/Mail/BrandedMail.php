<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * The look every Elitezaar email shares (resources/views/emails/message.blade.php, with a plain-text twin): the
 * logo, a headline, the message, optional detail sections, a button, and a footer with how to reach support.
 * Emails go out through the mailer set in .env (MAIL_MAILER, MAIL_HOST, MAIL_PORT, MAIL_USERNAME…), from
 * MAIL_FROM_ADDRESS.
 *
 * Sections, shown in order below the message:
 *  - ['type' => 'items', 'title' => …, 'items' => [['name', 'meta', 'amount']], 'totals' => [['label', 'value', 'strong']]]
 *  - ['type' => 'facts', 'title' => …, 'rows' => [['label', 'value']]]
 *  - ['type' => 'list', 'title' => …, 'items' => [['title', 'detail']]]
 *  - ['type' => 'links', 'title' => …, 'links' => [['label', 'url', 'hint']]]
 *  - ['type' => 'note', 'text' => …, 'tone' => 'info'|'success'|'warning'|'danger']
 */
class BrandedMail
{
    public const VIEWS = ['emails.message', 'emails.message-text'];

    /** Who an email is for decides the footer's "why you're getting this" line. */
    public const AUDIENCES = ['guest', 'customer', 'seller', 'admin'];

    /**
     * @param array{eyebrow?: ?string, greeting?: string, paragraphs?: list<string>, sections?: list<array>, action?: ?array{label: string, url: string}, after?: list<string>, audience?: ?string, preheader?: string} $content
     */
    public static function data(string $subject, string $headline, array $content): array
    {
        $paragraphs = array_values(array_filter($content['paragraphs'] ?? [], 'filled'));

        return [
            'subject' => $subject,
            'headline' => $headline,
            'eyebrow' => $content['eyebrow'] ?? null,
            'greeting' => $content['greeting'] ?? 'Hello,',
            'paragraphs' => $paragraphs,
            'sections' => self::sections($content['sections'] ?? []),
            'action' => $content['action'] ?? null,
            'after' => $content['after'] ?? [],
            // The grey line inbox lists show after the subject.
            'preheader' => $content['preheader'] ?? ($paragraphs[0] ?? $headline),
            'audience' => in_array($content['audience'] ?? null, self::AUDIENCES, true) ? $content['audience'] : null,
            'site' => rtrim((string) config('app.frontend_url'), '/'),
            'support' => config('store.support'),
            'year' => now()->year,
        ];
    }

    /** Leaves out missing sections, fact rows without a value, and sections left with nothing to show. */
    private static function sections(array $sections): array
    {
        $keys = ['items' => 'items', 'facts' => 'rows', 'list' => 'items', 'links' => 'links'];

        return collect($sections)->filter()
            ->map(fn (array $section) => ($section['type'] ?? null) === 'facts'
                ? [...$section, 'rows' => array_values(array_filter($section['rows'] ?? [], fn (array $row) => filled($row['value'] ?? null)))]
                : $section)
            ->filter(fn (array $section) => isset($keys[$section['type'] ?? '']) ? !empty($section[$keys[$section['type']]]) : filled($section['text'] ?? null))
            ->values()->all();
    }

    /** A notification's email in the store's look. */
    public static function message(string $subject, string $headline, array $content): MailMessage
    {
        return (new MailMessage())->subject($subject)->view(self::VIEWS, self::data($subject, $headline, $content));
    }

    /** "guest" for an order's email address without an account; otherwise the account's role. */
    public static function audience(object $notifiable): string
    {
        if ($notifiable instanceof AnonymousNotifiable) {
            return 'guest';
        }
        $role = $notifiable->role ?? null;

        return match (true) {
            in_array($role, User::ADMIN_ROLES, true) => 'admin',
            $role === 'seller' => 'seller',
            default => 'customer',
        };
    }
}
