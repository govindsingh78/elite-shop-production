<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seller approval. Sellers who sign up themselves wait for an admin to approve them before they can list
 * products or handle orders; an admin can decline an application, or later deactivate a seller (their
 * products leave the store) and reactivate them. Sellers already trading are approved.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // pending, approved, rejected or deactivated; null for accounts that aren't sellers.
            $table->string('seller_status', 20)->nullable()->index();
            // The admin's reason for declining or deactivating, shown to the seller.
            $table->string('seller_status_note', 500)->nullable();
            $table->timestamp('seller_status_at')->nullable();
        });

        DB::table('users')->where('role', 'seller')->update(['seller_status' => 'approved', 'seller_status_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['seller_status']);
            $table->dropColumn(['seller_status', 'seller_status_note', 'seller_status_at']);
        });
    }
};
