<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ProductReview extends Model
{
    public const PUBLISHED = 'published';
    public const HIDDEN = 'hidden';

    protected $fillable = ['product_id', 'user_id', 'order_id', 'rating', 'title', 'comment', 'status'];

    protected $casts = ['rating' => 'integer'];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopePublished($query)
    {
        return $query->where('status', self::PUBLISHED);
    }

    /** "Asha V." — first name and last initial, so reviews don't publish full names. */
    public function authorName(): string
    {
        $parts = preg_split('/\s+/', trim((string) $this->user?->name)) ?: [];
        $first = $parts[0] ?? '';
        $last = count($parts) > 1 ? Str::upper(Str::substr(end($parts), 0, 1)) . '.' : '';

        return trim("{$first} {$last}") ?: 'Elitezaar customer';
    }

    /** What shoppers see. */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'title' => $this->title,
            'comment' => $this->comment,
            'author' => $this->authorName(),
            'verified' => true,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
