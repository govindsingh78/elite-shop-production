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

    /** A seller's own products. */
    public function products()
    {
        return $this->hasMany(Product::class, 'vendor_id');
    }

    /** The account roles each sign-in portal accepts. */
    public const PORTAL_ROLES = [
        'admin' => ['admin', 'superadmin'],
        'vendor' => ['seller'],
        'customer' => ['customer'],
    ];

    public const ADMIN_ROLES = ['admin', 'superadmin'];

    /** How long a sign-in lasts, by portal: admins sign in again weekly, so a stolen admin token soon stops working. */
    public const TOKEN_DAYS = ['admin' => 7, 'vendor' => 30, 'customer' => 90];

    /** A new API token for signing in to the portal, expiring after its TOKEN_DAYS. */
    public function issueToken(string $portal): string
    {
        return $this->createToken("{$portal}_auth_token", ['*'], now()->addDays(self::TOKEN_DAYS[$portal] ?? 30))->plainTextToken;
    }

    /**
     * A seller account's standing. Sellers who sign up themselves start pending; an admin approves them,
     * declines them (rejected), or later deactivates them. Only approved sellers can list products and handle
     * orders, and only their products are in the store. The others can still sign in to see where they stand.
     */
    public const SELLER_PENDING = 'pending';
    public const SELLER_APPROVED = 'approved';
    public const SELLER_REJECTED = 'rejected';
    public const SELLER_DEACTIVATED = 'deactivated';
    public const SELLER_STATUSES = [self::SELLER_PENDING, self::SELLER_APPROVED, self::SELLER_REJECTED, self::SELLER_DEACTIVATED];
    public const INACTIVE_SELLER_STATUSES = [self::SELLER_PENDING, self::SELLER_REJECTED, self::SELLER_DEACTIVATED];

    protected static function booted(): void
    {
        // A seller made any other way than signing up (by an admin, or a role change) starts approved.
        static::saving(function (User $user) {
            if ($user->role === 'seller' && $user->seller_status === null) {
                $user->seller_status = self::SELLER_APPROVED;
                $user->seller_status_at = now();
            }
        });
    }

    /** Whether this account's products may be in the store (always true for accounts that aren't sellers). */
    public function canSell(): bool
    {
        return !in_array($this->seller_status, self::INACTIVE_SELLER_STATUSES, true);
    }

    /** Why a seller can't list products or handle orders yet, or null if they can. */
    public function sellerRestriction(): ?string
    {
        $reason = $this->seller_status_note ? ': ' . rtrim($this->seller_status_note, '. ') . '.' : '.';

        return match ($this->seller_status) {
            self::SELLER_PENDING => 'Your seller account is waiting for approval. You can list products once our team approves it — add your business and GST details to help us verify you.',
            self::SELLER_REJECTED => "Your seller application wasn’t approved{$reason} Contact Elitezaar support if you have questions.",
            self::SELLER_DEACTIVATED => "Your seller account has been deactivated{$reason} Your products are hidden from the store. Contact Elitezaar support if you have questions.",
            default => null,
        };
    }

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
        'legal_name',
        'gstin',
        'business_address',
        'business_state',
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
            'seller_status_at' => 'datetime',
        ];
    }
}
