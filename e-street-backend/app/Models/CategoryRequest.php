<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** A seller asking for a category or subcategory the store doesn't have yet; see App\Services\CategoryRequests. */
class CategoryRequest extends Model
{
    public const PENDING = 'pending';
    public const APPROVED = 'approved';
    public const DECLINED = 'declined';
    public const STATUSES = [self::PENDING, self::APPROVED, self::DECLINED];

    protected $fillable = ['name', 'parent_id', 'note'];

    protected $attributes = ['status' => self::PENDING];

    protected $casts = ['reviewed_at' => 'datetime'];

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function parent()
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::PENDING);
    }

    /** Requests for the same name in the same place (case and spacing don't matter). */
    public function scopeSameAs(Builder $query, string $name, ?int $parentId): Builder
    {
        return $query->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->when($parentId, fn ($query) => $query->where('parent_id', $parentId), fn ($query) => $query->whereNull('parent_id'));
    }

    /** "Kids › Footwear", or just "Footwear" for a new main collection. */
    public function label(): string
    {
        return $this->parent ? "{$this->parent->name} › {$this->name}" : $this->name;
    }
}
