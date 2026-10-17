<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->string('customer_email')->nullable();
            $table->string('customer_phone', 40)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 120)->nullable();
            $table->string('state', 120)->nullable();
            $table->string('postal_code', 30)->nullable();
            $table->string('country', 120)->default('');
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('shipping_amount', 10, 2)->default(0);
            $table->foreignId('shipping_method_id')->nullable()->constrained('shipping_methods')->nullOnDelete();
            $table->decimal('total', 10, 2)->default(0);
            $table->string('payment_method', 40)->default('cod');
            $table->string('payment_status', 40)->default('unpaid');
            $table->string('status', 40)->default('pending')->index();
            $table->string('tracking_number')->nullable();
            $table->text('notes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
            $table->dropConstrainedForeignId('shipping_method_id');
            $table->dropColumn([
                'customer_name', 'customer_email', 'customer_phone', 'address', 'city',
                'state', 'postal_code', 'country', 'subtotal', 'shipping_amount', 'total',
                'payment_method', 'payment_status', 'status', 'tracking_number', 'notes',
            ]);
        });
    }
};
