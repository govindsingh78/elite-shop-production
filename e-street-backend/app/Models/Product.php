<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    public const PENDING = 'pending';
    public const APPROVED = 'approved';
    public const REJECTED = 'rejected';
    public const APPROVAL_STATUSES = [self::PENDING, self::APPROVED, self::REJECTED];

    protected $fillable = [
        'vendor_id',
        'title',
        'price',
        'compare_price',
        'description',
        'short_description',
        'image',
        'category_id',
        'brand_id',
        'qty',
        'sku',
        'barcode',
        'status',
        'is_featured',
        'approval_status',
        'review_note',
        'reviewed_at',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'compare_price' => 'decimal:2',
        'status' => 'integer',
        'qty' => 'integer',
        'reviewed_at' => 'datetime',
    ];

    /** Products shoppers can see and buy: switched on and approved by an admin. */
    public function scopeOnStorefront($query)
    {
        return $query->where('status', 1)->where('approval_status', self::APPROVED);
    }

    public function isOnStorefront(): bool
    {
        return (int) $this->status === 1 && $this->approval_status === self::APPROVED;
    }

    public function vendor()
    {
        return $this->belongsTo(User::class, 'vendor_id');
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class);
    }
}
