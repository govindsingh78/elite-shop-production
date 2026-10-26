<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Str;

/** To the store admins: the scheduled check found server trouble or new problems people ran into. */
class ServerAlert extends StoreMessage
{
    /**
     * @param array<int, array{title: string, detail: string, severity: string}> $items server trouble, worst first
     * @param array<int, array{title: string, hits: int, who: ?string}> $problems the most frequent new problems
     * @param int $problemCount how many new problems there are in all
     */
    public function __construct(public array $items, public array $problems, public int $problemCount)
    {
    }

    public function kind(): string
    {
        return 'server';
    }

    public function title(): string
    {
        if ($this->items) {
            return ($this->items[0]['severity'] === 'critical' ? 'Server alert: ' : 'Server needs attention: ') . $this->items[0]['title'];
        }

        return $this->problemCount . ' new ' . ($this->problemCount === 1 ? 'problem' : 'problems') . ' on Elitezaar';
    }

    public function body(): string
    {
        $parts = [];
        if ($this->items) {
            $parts[] = Str::limit($this->items[0]['detail'], 160, '…');
            if ($more = array_column(array_slice($this->items, 1, 2), 'title')) {
                $parts[] = 'Also: ' . implode('; ', $more) . '.';
            }
        }
        if ($this->problems) {
            $top = $this->problems[0];
            $parts[] = ($this->items ? "{$this->problemCount} new " . ($this->problemCount === 1 ? 'problem' : 'problems') . ', e.g. ' : 'Most frequent: ')
                . "“{$top['title']}” ({$top['hits']}×" . ($top['who'] ? ", {$top['who']}" : '') . ').';
        }

        return implode(' ', $parts);
    }

    protected function mailDetails(MailMessage $mail): MailMessage
    {
        foreach ($this->items as $item) {
            $mail->line("**{$item['title']}** — {$item['detail']}");
        }
        if ($this->problems) {
            $mail->line("**New problems ({$this->problemCount})**");
            foreach ($this->problems as $problem) {
                $mail->line("• {$problem['title']} — {$problem['hits']}×" . ($problem['who'] ? ", mostly {$problem['who']}" : ''));
            }
        }

        return $mail;
    }

    public function webPath(): ?string
    {
        return '/admin/server';
    }

    public function appPath(): ?string
    {
        return '/admin/server';
    }

    protected function actionLabel(): string
    {
        return 'Open Server & health';
    }
}
