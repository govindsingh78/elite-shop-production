<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A PIN code, or the start of one, that we deliver to or don't; see App\Services\Delivery. */
class DeliveryArea extends Model
{
    protected $fillable = ['pincode', 'name', 'deliverable', 'extra_days'];

    protected $casts = ['deliverable' => 'boolean', 'extra_days' => 'integer'];

    /** A full PIN code is one place; fewer digits cover every PIN code that starts with them. */
    public function isPrefix(): bool
    {
        return strlen($this->pincode) < 6;
    }
}
