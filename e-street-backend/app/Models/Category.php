<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Category extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'status'];

    protected $hidden = [];

    protected static function booted(): void
    {
        static::creating(function (Category $category) {
            $category->slug = static::uniqueSlug($category->name);
        });

        static::updating(function (Category $category) {
            if ($category->isDirty('name')) {
                $category->slug = static::uniqueSlug($category->name, $category->id);
            }
        });
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
