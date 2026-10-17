<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShippingMethod extends Model
{
    protected $fillable = ['name', 'price', 'status'];

    protected $casts = [
        'price' => 'decimal:2',
        'status' => 'integer',
    ];
}
