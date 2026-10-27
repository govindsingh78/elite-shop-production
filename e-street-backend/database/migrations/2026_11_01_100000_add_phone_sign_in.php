<?php

use App\Services\Security\PhoneOtp;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Signing in with a mobile number and a one-time code (OTP) sent by SMS. A number can only be used to sign in
 * once its owner has confirmed it with a code while signed in, so a number someone typed by mistake (or on
 * purpose) never opens their account to whoever owns it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // The phone in one standard form (+919876543210), for finding the account a code was sent for.
            $table->string('phone_e164', 16)->nullable()->index();
            $table->timestamp('phone_verified_at')->nullable();
        });

        DB::table('users')->whereNotNull('phone')->orderBy('id')->each(function ($user) {
            DB::table('users')->where('id', $user->id)->update(['phone_e164' => PhoneOtp::normalise($user->phone)]);
        });

        // Each code sent: only a keyed hash of it is kept, and it can be used once, within a few minutes.
        Schema::create('otp_challenges', function (Blueprint $table) {
            $table->id();
            $table->string('purpose', 10); // login, or verify (confirming a number while signed in)
            $table->string('portal', 10)->nullable();
            $table->string('phone', 16);
            $table->unsignedBigInteger('user_id')->index();
            $table->string('code_hash', 64);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['phone', 'purpose', 'created_at']);
            $table->index(['ip', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('otp_challenges');
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['phone_e164']);
            $table->dropColumn(['phone_e164', 'phone_verified_at']);
        });
    }
};
