<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Null vendor = a product sold by the store itself.
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('vendor_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
        });

        // Snapshot of the seller at checkout, so vendor order views survive later product changes.
        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('vendor_id')->nullable()->after('product_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vendor_id');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vendor_id');
        });
    }
};
