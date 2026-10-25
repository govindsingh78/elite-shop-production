<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Commission tracking: a store-wide default rate (settings), an optional rate per seller, the rate and
     * commission saved on each order line when it's ordered, and the payouts made to sellers.
     */
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 100)->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            // Null means the seller pays the store-wide default rate.
            $table->decimal('commission_rate', 5, 2)->nullable()->after('role');
        });

        Schema::table('order_items', function (Blueprint $table) {
            // Saved when the order is placed, so later rate changes don't rewrite past sales. Null for Elitezaar's own products.
            $table->decimal('commission_rate', 5, 2)->nullable()->after('line_total');
            $table->decimal('commission_amount', 10, 2)->nullable()->after('commission_rate');
        });

        Schema::create('seller_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('amount', 10, 2);
            $table->date('paid_on');
            $table->string('method', 30)->nullable();
            $table->string('reference', 120)->nullable();
            $table->text('note')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['vendor_id', 'paid_on']);
        });

        // Orders placed before commission tracking: apply the 10% default.
        DB::table('order_items')
            ->whereNotNull('vendor_id')
            ->whereNull('commission_amount')
            // Decimal literals, so no database rounds this down with whole-number division.
            ->update(['commission_rate' => 10, 'commission_amount' => DB::raw('ROUND(line_total * 10.0 / 100.0, 2)')]);
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_payouts');
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['commission_rate', 'commission_amount']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('commission_rate');
        });
        Schema::dropIfExists('settings');
    }
};
