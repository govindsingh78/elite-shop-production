<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderTrackingEvent;
use App\Services\Invoices;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Admin-managed delivery tracking updates for an order. */
class OrderTrackingController extends Controller
{
    public function index(Request $request, Order $order)
    {
        $this->authorizeOrder($request, $order);

        return response()->json([
            'statuses' => OrderTrackingEvent::statuses(),
            'events' => $order->trackingEvents()->get(),
        ]);
    }

    public function store(Request $request, Order $order)
    {
        $this->authorizeOrder($request, $order);
        $validated = $request->validate([
            'status' => ['required', Rule::in(OrderTrackingEvent::statuses())],
            'location' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'event_at' => ['nullable', 'date', 'before_or_equal:' . now()->addMinutes(5)->toDateTimeString()],
        ], ['event_at.before_or_equal' => 'The update time cannot be in the future.']);

        if (!empty($validated['event_at'])) {
            // Store in the app timezone regardless of the offset the browser sent.
            $validated['event_at'] = Carbon::parse($validated['event_at'])->setTimezone(config('app.timezone'));
        }

        $event = DB::transaction(fn () => $order->recordTrackingEvent($validated['status'], $validated, $request->user()->id));

        return response()->json([
            'message' => 'Tracking update added.',
            'event' => $event,
            'data' => $this->present($request, $order->refresh()),
        ], 201);
    }

    public function destroy(Request $request, Order $order, OrderTrackingEvent $event)
    {
        $this->authorizeOrder($request, $order);
        abort_unless($event->order_id === $order->id, 404);

        DB::transaction(function () use ($order, $event) {
            $event->delete();
            $order->syncStatusWithTracking();
        });

        return response()->json([
            'message' => 'Tracking update removed.',
            'data' => $this->present($request, $order->refresh()),
        ]);
    }

    /** Admins may track any order. */
    protected function authorizeOrder(Request $request, Order $order): void
    {
    }

    protected function present(Request $request, Order $order): Order
    {
        // Shipping can issue invoices, so the order page gets the latest ones back.
        return $order->load(['items', 'trackingEvents'])->setAttribute('invoice_links', Invoices::linksFor($order));
    }
}
