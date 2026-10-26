<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A phone that receives push notifications for a signed-in user (an Expo push token from the app). */
class DeviceToken extends Model
{
    protected $fillable = ['user_id', 'token', 'platform'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
