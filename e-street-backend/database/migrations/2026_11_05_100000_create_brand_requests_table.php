<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sellers asking for a brand the store doesn't have yet (when they sign up, or later). An admin adds it (or points to
 * one that already exists) or declines with a reason, and the seller is told either way.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('brand_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('note', 300)->nullable();
            $table->string('status', 12)->default('pending')->index(); // pending, approved or declined
            // The brand it became (new, or one that already existed).
            $table->foreignId('brand_id')->nullable()->constrained('brands')->nullOnDelete();
            $table->string('admin_note', 300)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_requests');
    }
};
