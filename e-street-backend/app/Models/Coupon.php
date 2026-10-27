<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** A coupon code; see App\Services\Coupons. */
class Coupon extends Model
{
    public const PERCENT = 'percent';
    public const FLAT = 'flat';
    public const TYPES = [self::PERCENT, self::FLAT];
    public const FUNDERS = ['store', 'seller'];

    protected $fillable = [
        'code', 'title', 'description', 'terms', 'type', 'value', 'max_discount', 'min_order', 'starts_at', 'ends_at',
        'usage_limit', 'per_customer_limit', 'first_order_only', 'category_ids', 'product_ids', 'show_on_product', 'funded_by', 'status',
    ];

    protected $casts = [
        'value' => 'float', 'max_discount' => 'float', 'min_order' => 'float', 'starts_at' => 'datetime', 'ends_at' => 'datetime',
        'usage_limit' => 'integer', 'per_customer_limit' => 'integer', 'first_order_only' => 'boolean', 'category_ids' => 'array',
        'product_ids' => 'array', 'show_on_product' => 'boolean', 'status' => 'boolean',
    ];

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    /** Switched on, started and not ended. */
    public function scopeLive(Builder $query): Builder
    {
        return $query->where('status', true)
            ->where(fn ($inner) => $inner->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($inner) => $inner->whereNull('ends_at')->orWhere('ends_at', '>', now()));
    }

    /** Orders that used it, apart from cancelled ones. */
    public function usedOrders()
    {
        return $this->orders()->where('status', '!=', 'cancelled');
    }

    /** Whether it covers this product: one of its products, or in one of its categories (or their subcategories). */
    public function covers(Product $product): bool
    {
        $categories = array_map('intval', $this->category_ids ?? []);
        $products = array_map('intval', $this->product_ids ?? []);
        if (!$categories && !$products) {
            return true;
        }
        if (in_array((int) $product->id, $products, true)) {
            return true;
        }
        $category = $product->relationLoaded('category') ? $product->category : $product->category()->first();

        return $category && (in_array((int) $category->id, $categories, true) || in_array((int) $category->parent_id, $categories, true));
    }

    /** "30% off", "₹200 off" */
    public function headline(): string
    {
        return $this->type === self::PERCENT
            ? rtrim(rtrim(number_format($this->value, 2, '.', ''), '0'), '.') . '% off'
            : '₹' . number_format($this->value, $this->value == floor($this->value) ? 0 : 2) . ' off';
    }
}
