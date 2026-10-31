<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** A seller asking for a brand the store doesn't have yet; see App\Services\BrandRequests. */
class BrandRequest extends Model
{
    public const PENDING = 'pending';
    public const APPROVED = 'approved';
    public const DECLINED = 'declined';
    public const STATUSES = [self::PENDING, self::APPROVED, self::DECLINED];

    protected $fillable = ['name', 'note'];

    protected $attributes = ['status' => self::PENDING];

    protected $casts = ['reviewed_at' => 'datetime'];

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::PENDING);
    }

    /** Requests for the same brand (case doesn't matter). */
    public function scopeSameAs(Builder $query, string $name): Builder
    {
        return $query->whereRaw('LOWER(name) = ?', [mb_strtolower($name)]);
    }
}
