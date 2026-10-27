<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Coupon codes (see App\Services\Coupons): a percentage or flat amount off the products they cover, with limits and
 * dates, shown as offers on product pages and applied at checkout. An order keeps the code and the discount, and
 * each of its lines the share of the discount it got.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('title', 120);
            $table->string('description', 255)->nullable();
            $table->text('terms')->nullable();
            $table->string('type', 10); // percent or flat
            $table->decimal('value', 10, 2);
            $table->decimal('max_discount', 10, 2)->nullable(); // a cap on percentage discounts
            $table->decimal('min_order', 10, 2)->nullable(); // of the products the coupon covers
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->unsignedInteger('usage_limit')->nullable(); // across everyone
            $table->unsignedInteger('per_customer_limit')->nullable();
            $table->boolean('first_order_only')->default(false);
            // What it covers: these categories (and their subcategories) and products; neither means everything.
            $table->json('category_ids')->nullable();
            $table->json('product_ids')->nullable();
            $table->boolean('show_on_product')->default(true); // listed under "Offers and discounts"
            $table->string('funded_by', 10)->default('store'); // store (sellers are paid in full) or seller
            $table->boolean('status')->default(true);
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('coupon_id')->nullable()->constrained('coupons')->nullOnDelete();
            $table->string('coupon_code', 20)->nullable();
            $table->decimal('discount_amount', 10, 2)->default(0);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('discount_amount', 10, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('discount_amount');
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('coupon_id');
            $table->dropColumn(['coupon_code', 'discount_amount']);
        });
        Schema::dropIfExists('coupons');
    }
};
