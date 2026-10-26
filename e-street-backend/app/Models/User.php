<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Notifications\ResetPasswordNotification;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function addresses()
    {
        return $this->hasMany(CustomerAddress::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    /** The account roles each sign-in portal accepts. */
    public const PORTAL_ROLES = [
        'admin' => ['admin', 'superadmin'],
        'vendor' => ['seller'],
        'customer' => ['customer'],
    ];

    public const ADMIN_ROLES = ['admin', 'superadmin'];

    /** Admin roles are reserved for the addresses in config/admin.php. */
    public static function isApprovedAdminEmail(?string $email): bool
    {
        $approved = array_map(fn ($address) => strtolower(trim($address)), config('admin.emails', []));

        return in_array(strtolower(trim((string) $email)), $approved, true);
    }

    /** Phones signed in to this account that receive push notifications. */
    public function deviceTokens()
    {
        return $this->hasMany(DeviceToken::class);
    }

    /** Admins who may use the admin portal, for store alerts such as new orders. */
    public static function storeAdmins()
    {
        return self::query()->whereIn('role', self::ADMIN_ROLES)->get()
            ->filter(fn (User $user) => self::isApprovedAdminEmail($user->email))
            ->values();
    }

    public function hasAdminRole(): bool
    {
        return in_array($this->role, self::ADMIN_ROLES, true);
    }

    public function canUsePortal(string $portal): bool
    {
        if (!in_array($this->role, self::PORTAL_ROLES[$portal] ?? [], true)) {
            return false;
        }

        return $portal !== 'admin' || self::isApprovedAdminEmail($this->email);
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'role',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'google_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'commission_rate' => 'decimal:2',
        ];
    }
}
