<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cookie choices made on the website ("Accept all", "Necessary only" or chosen one by one), kept as a record
 * of what each visitor agreed to and when. A visitor is identified only by a random consent ID their browser
 * keeps, plus their account if they were signed in.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cookie_consents', function (Blueprint $table) {
            $table->id();
            $table->uuid('consent_id')->index();
            $table->string('choice', 20); // accept_all, necessary_only or custom
            $table->boolean('performance')->default(false);
            $table->string('version', 20); // of the Cookie Policy agreed to
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('page', 191)->nullable();
            $table->string('device', 120)->nullable();
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cookie_consents');
    }
};
