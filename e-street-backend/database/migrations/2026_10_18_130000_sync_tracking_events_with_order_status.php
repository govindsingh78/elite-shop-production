<?php

use App\Models\Order;
use App\Models\OrderTrackingEvent;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * The tracking backfill gave every existing order only an "order placed" event, so orders that
     * were already further along showed the wrong progress. Add an event matching their real status.
     */
    public function up(): void
    {
        Order::query()->with('latestTrackingEvent')->chunkById(200, function ($orders) {
            foreach ($orders as $order) {
                $latest = $order->latestTrackingEvent;
                $trackedStatus = $latest ? OrderTrackingEvent::STATUS_TO_ORDER_STATUS[$latest->status] ?? null : null;
                $milestone = OrderTrackingEvent::ORDER_STATUS_TO_STATUS[$order->status] ?? null;

                if ($milestone && $trackedStatus !== $order->status) {
                    $order->trackingEvents()->create([
                        'status' => $milestone,
                        'description' => 'Order status updated to ' . $order->status . '.',
                        'event_at' => max($order->updated_at ?? now(), $latest?->event_at ?? now()),
                    ]);
                }
            }
        });
    }

    public function down(): void
    {
        // Data correction only.
    }
};
