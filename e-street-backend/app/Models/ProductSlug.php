<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** An earlier web address of a renamed product, so old links still find it. */
class ProductSlug extends Model
{
    protected $fillable = ['product_id', 'slug'];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
