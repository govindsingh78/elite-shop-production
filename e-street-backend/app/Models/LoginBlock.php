<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** An account (email) or IP address that can't sign in, or (scope "all") can't use the store at all, for now. */
class LoginBlock extends Model
{
    public const ACCOUNT = 'account';
    public const IP = 'ip';
    public const SIGN_IN = 'sign-in';
    public const ALL = 'all';

    protected $guarded = ['id'];

    protected $casts = [
        'attempts' => 'integer',
        'blocked_until' => 'datetime',
        'unblocked_at' => 'datetime',
    ];

    /** Blocks in force right now. */
    public function scopeActive($query)
    {
        return $query->whereNull('unblocked_at')
            ->where(fn ($until) => $until->whereNull('blocked_until')->orWhere('blocked_until', '>', now()));
    }

    public function isActive(): bool
    {
        return $this->unblocked_at === null && ($this->blocked_until === null || $this->blocked_until->isFuture());
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
