<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A size products can come in, e.g. Free Size, M or UK 8. Admins keep the list; sellers pick from it. */
class Size extends Model
{
    protected $fillable = ['name', 'sort_order'];

    protected $casts = ['sort_order' => 'integer'];

    protected $hidden = ['created_at', 'updated_at'];

    /** In shop order (Free Size, XS, S, M…), as the admin arranged them. */
    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('id');
    }

    public function productSizes()
    {
        return $this->hasMany(ProductSize::class);
    }
}
