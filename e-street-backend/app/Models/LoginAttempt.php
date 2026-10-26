<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One sign-in attempt, successful or not, for Admin › Security. */
class LoginAttempt extends Model
{
    public const SUCCESS = 'success';
    public const FAILED = 'failed';
    public const BLOCKED = 'blocked';

    public const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected $casts = ['created_at' => 'datetime'];
}
