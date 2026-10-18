<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('courier_name', 120)->nullable()->after('tracking_number');
            $table->date('estimated_delivery_date')->nullable()->after('courier_name');
        });

        Schema::create('order_tracking_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('status', 40)->index();
            $table->string('location')->nullable();
            $table->text('description')->nullable();
            $table->timestamp('event_at')->useCurrent();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['order_id', 'event_at']);
        });

        // Give existing orders a starting point so their tracking history is never empty.
        DB::table('orders')->orderBy('id')->chunkById(200, function ($orders) {
            DB::table('order_tracking_events')->insert($orders->map(fn ($order) => [
                'order_id' => $order->id,
                'status' => 'order_placed',
                'description' => 'Order received.',
                'event_at' => $order->created_at ?? now(),
                'created_at' => now(),
                'updated_at' => now(),
            ])->all());
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_tracking_events');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['courier_name', 'estimated_delivery_date']);
        });
    }
};
