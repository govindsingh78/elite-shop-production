<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sign-in security. Every sign-in attempt is logged for Admin › Security; 3 wrong passwords in a row lock the
 * account for 24 hours, and an address making many wrong attempts is blocked from signing in. Admins can
 * also block an address from the whole store. Sign-in tokens now expire.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_attempts', function (Blueprint $table) {
            $table->id();
            $table->string('email')->nullable()->index(); // as entered, lower-cased
            $table->unsignedBigInteger('user_id')->nullable()->index(); // the account, when one has that email
            $table->string('portal', 20)->nullable(); // admin, vendor or customer
            $table->string('method', 20)->default('password'); // password, google or password_change
            $table->string('outcome', 10); // success, failed or blocked
            $table->string('ip', 45)->nullable()->index();
            $table->string('device', 120)->nullable(); // "Chrome 141 · Windows", "Android app"…
            $table->timestamp('created_at')->nullable()->index();
        });

        Schema::create('login_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('type', 10); // account (an email) or ip
            $table->string('value'); // the email or the IP address
            $table->string('scope', 10)->default('sign-in'); // sign-in, or all (the whole store, for addresses blocked by an admin)
            $table->string('reason');
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('blocked_until')->nullable(); // null: until an admin unblocks it
            $table->timestamp('unblocked_at')->nullable();
            $table->string('unblock_reason')->nullable();
            $table->unsignedBigInteger('created_by')->nullable(); // the admin, for blocks made by hand
            $table->timestamps();
            $table->index(['type', 'value']);
        });

        // Sign-ins made before tokens expired get the same lifetimes as new ones (see User::TOKEN_DAYS).
        foreach (['admin' => 7, 'vendor' => 30, 'customer' => 90] as $portal => $days) {
            DB::table('personal_access_tokens')->whereNull('expires_at')->where('name', "{$portal}_auth_token")
                ->update(['expires_at' => now()->addDays($days)]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('login_blocks');
        Schema::dropIfExists('login_attempts');
    }
};
