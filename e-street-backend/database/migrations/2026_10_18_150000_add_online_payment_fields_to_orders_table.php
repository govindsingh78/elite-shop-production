<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('razorpay_order_id', 64)->nullable()->unique()->after('payment_status');
            $table->string('razorpay_payment_id', 64)->nullable()->after('razorpay_order_id');
            $table->timestamp('paid_at')->nullable()->after('razorpay_payment_id');
            // Proves a guest checkout is the one completing payment for this order.
            $table->string('payment_token', 64)->nullable()->after('paid_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['razorpay_order_id']);
            $table->dropColumn(['razorpay_order_id', 'razorpay_payment_id', 'paid_at', 'payment_token']);
        });
    }
};
