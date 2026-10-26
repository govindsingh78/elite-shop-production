<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One size a product comes in, with its own stock. Sent to apps as {size_id, name, qty, in_stock}. */
class ProductSize extends Model
{
    protected $fillable = ['product_id', 'size_id', 'qty'];

    protected $casts = ['size_id' => 'integer', 'qty' => 'integer'];

    protected $hidden = ['id', 'product_id', 'size', 'created_at', 'updated_at'];

    protected $appends = ['name', 'in_stock'];

    public function size()
    {
        return $this->belongsTo(Size::class);
    }

    public function getNameAttribute(): string
    {
        return $this->size?->name ?? '';
    }

    /** Untracked stock (null) means the size is always available. */
    public function getInStockAttribute(): bool
    {
        return $this->qty === null || $this->qty > 0;
    }
}
