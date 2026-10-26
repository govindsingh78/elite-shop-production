<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A problem someone ran into (a server error, or a crash on the website or in the app), with how often it happened. */
class MonitorProblem extends Model
{
    public const OPEN = 'open';
    public const RESOLVED = 'resolved';

    protected $guarded = ['id'];

    protected $casts = [
        'hits' => 'integer',
        'affected' => 'array',
        'context' => 'array',
        'first_seen_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'resolved_at' => 'datetime',
        'notified_at' => 'datetime',
    ];

    /** What the problem list shows. */
    public function summary(): array
    {
        return [
            ...$this->only(['id', 'source', 'level', 'title', 'location', 'url', 'method', 'status', 'hits', 'first_seen_at', 'last_seen_at', 'resolved_at']),
            'affected' => (object) ($this->affected ?? []),
        ];
    }

    /** Everything, for the problem's own page. */
    public function details(): array
    {
        return [
            ...$this->summary(),
            ...$this->only(['message', 'trace', 'context', 'last_user_id']),
        ];
    }
}
