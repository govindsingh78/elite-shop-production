<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Money paid to a seller for their delivered sales, recorded by an admin (the transfer itself happens outside the app). */
class SellerPayout extends Model
{
    public const METHODS = ['upi', 'bank_transfer', 'cash', 'other'];

    protected $fillable = ['vendor_id', 'amount', 'paid_on', 'method', 'reference', 'note', 'recorded_by'];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_on' => 'date:Y-m-d',
    ];

    public function vendor()
    {
        return $this->belongsTo(User::class, 'vendor_id');
    }
}
