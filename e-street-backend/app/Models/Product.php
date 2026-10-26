<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Product extends Model
{
    protected static function booted(): void
    {
        // Every product gets a readable web address from its title: /product/classic-linen-shirt.
        static::creating(function (Product $product) {
            $product->slug ??= self::uniqueSlug((string) $product->title);
        });

        // A real rename gets a new address. The old one is kept, so shared links and search results still
        // lead to the product (and on to its new address); small edits such as capitals keep the address.
        static::updating(function (Product $product) {
            if (!$product->slug) {
                $product->slug = self::uniqueSlug((string) $product->title, $product->id);
                return;
            }
            $base = self::slugBase((string) $product->title);
            if (!$product->isDirty('title') || preg_match('/^' . preg_quote($base, '/') . '(-\d+)?$/', (string) $product->slug)) {
                return;
            }
            $previous = $product->getOriginal('slug');
            $product->slug = self::uniqueSlug((string) $product->title, $product->id);
            ProductSlug::query()->where('product_id', $product->id)->where('slug', $product->slug)->delete();
            if ($previous) {
                ProductSlug::query()->firstOrCreate(['slug' => $previous], ['product_id' => $product->id]);
            }
        });
    }

    /** "Classic Linen Shirt (Blue)" → "classic-linen-shirt-blue", at most 80 characters, cut between words. */
    public static function slugBase(string $title): string
    {
        $slug = Str::slug($title) ?: 'product';
        if (strlen($slug) > 80) {
            $slug = substr($slug, 0, 81);
            $slug = rtrim(substr($slug, 0, strrpos($slug, '-') ?: 80), '-');
        }

        // An all-number address would read as a product id.
        return ctype_digit($slug) ? "product-{$slug}" : $slug;
    }

    /** The title's address, numbered (-2, -3…) when another product has or had it. */
    public static function uniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $base = self::slugBase($title);
        for ($n = 1; ; $n++) {
            $slug = $n === 1 ? $base : "{$base}-{$n}";
            $taken = self::query()->where('slug', $slug)->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))->exists()
                || ProductSlug::query()->where('slug', $slug)->when($ignoreId, fn ($query) => $query->where('product_id', '!=', $ignoreId))->exists();
            if (!$taken) {
                return $slug;
            }
        }
    }

    /** Finds a product by what follows /product/ in a link: its address, an earlier address, or (old links) its id. */
    public function scopeWhereHandle($query, string $handle)
    {
        if (ctype_digit($handle)) {
            return $query->whereKey((int) $handle);
        }
        $handle = Str::lower($handle);

        return $query->where(fn ($query) => $query
            ->where('slug', $handle)
            ->orWhereIn('id', ProductSlug::query()->where('slug', $handle)->select('product_id')));
    }
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

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
    }

    /** The sizes this product comes in, in size order, each with its own stock. Empty for one-size products. */
    public function sizes()
    {
        return $this->hasMany(ProductSize::class)
            ->with('size:id,name,sort_order')
            ->orderBy(Size::select('sort_order')->whereColumn('sizes.id', 'product_sizes.size_id'))
            ->orderBy('size_id');
    }

    /**
     * Replaces the product's sizes with [['size_id' => 3, 'qty' => 10], ...] (qty null = not tracked);
     * an empty list makes it a one-size product again.
     */
    public function syncSizes(array $sizes): void
    {
        $keep = array_map(fn (array $size) => (int) $size['size_id'], $sizes);
        ProductSize::query()->where('product_id', $this->id)->whereNotIn('size_id', $keep)->delete();
        foreach ($sizes as $size) {
            $qty = $size['qty'] ?? null;
            ProductSize::query()->updateOrCreate(
                ['product_id' => $this->id, 'size_id' => (int) $size['size_id']],
                ['qty' => $qty === null || $qty === '' ? null : (int) $qty],
            );
        }
        $this->syncStockWithSizes();
    }

    /**
     * A sized product's own stock is the total of its sizes (untracked if any size is), so product cards,
     * "only 3 left" badges and low-stock alerts keep working without knowing about sizes.
     */
    public function syncStockWithSizes(): void
    {
        $stock = ProductSize::query()->where('product_id', $this->id)->pluck('qty');
        if ($stock->isEmpty()) {
            return;
        }
        $this->forceFill(['qty' => $stock->contains(fn ($qty) => $qty === null) ? null : (int) $stock->sum()])->save();
    }

    /** Adds reviews_count and reviews_avg_rating (published reviews only) for product cards and pages. */
    public function scopeWithRating($query)
    {
        $published = fn ($reviews) => $reviews->where('status', ProductReview::PUBLISHED);

        return $query->withCount(['reviews' => $published])->withAvg(['reviews' => $published], 'rating');
    }
}
