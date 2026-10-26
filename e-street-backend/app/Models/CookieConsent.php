<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A cookie choice made on the website, kept as a record of what the visitor agreed to. */
class CookieConsent extends Model
{
    public const ACCEPT_ALL = 'accept_all';
    public const NECESSARY_ONLY = 'necessary_only';
    public const CUSTOM = 'custom';

    public const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected $casts = [
        'performance' => 'boolean',
        'created_at' => 'datetime',
    ];
}
