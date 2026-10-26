<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Category extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'status', 'parent_id', 'hsn_code', 'gst_rate', 'gst_rate_high', 'gst_threshold'];

    protected $casts = ['gst_rate' => 'float', 'gst_rate_high' => 'float', 'gst_threshold' => 'float'];

    protected $hidden = [];

    protected static function booted(): void
    {
        static::creating(function (Category $category) {
            $category->slug = static::uniqueSlug($category->slugSource());
        });

        static::updating(function (Category $category) {
            if ($category->isDirty(['name', 'parent_id'])) {
                $category->slug = static::uniqueSlug($category->slugSource(), $category->id);
            }
        });
    }

    public function parent()
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Category::class, 'parent_id');
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    /** This category and its active subcategories: browsing "Kids" shows Toys and Clothing too. */
    public function storefrontCategoryIds(): array
    {
        return $this->children()->where('status', 1)->pluck('id')->prepend($this->id)->all();
    }

    /** Subcategory slugs carry the parent's name ("kids-toys"), so "Toys" can sit under several categories. */
    private function slugSource(): string
    {
        $parentName = $this->parent_id ? static::query()->whereKey($this->parent_id)->value('name') : null;

        return trim(($parentName ? $parentName . ' ' : '') . $this->name);
    }

    private static function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($name) ?: 'category';
        $slug = $baseSlug;
        $suffix = 2;

        while (static::query()->where('slug', $slug)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $slug = $baseSlug . '-' . $suffix++;
        }

        return $slug;
    }
}
