<?php

namespace App\Http\Controllers\Vendor;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderTrackingEvent;
use App\Models\Product;
use App\Services\Commissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Orders containing the signed-in vendor's products, showing only that vendor's lines. */
class OrderController extends Controller
{
    private const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    private const LOW_STOCK = 5;

    public function dashboard(Request $request)
    {
        $vendorId = $request->user()->id;
        $products = Product::query()->where('vendor_id', $vendorId);
        $soldItems = OrderItem::query()
            ->where('vendor_id', $vendorId)
            ->whereHas('order', fn ($query) => $query->where('status', '!=', 'cancelled'));
        $earnings = Commissions::summary($request->user());

        return response()->json([
            'stats' => [
                'total_products' => (clone $products)->count(),
                'active_products' => (clone $products)->onStorefront()->count(),
                'pending_review' => (clone $products)->where('approval_status', Product::PENDING)->count(),
                'rejected' => (clone $products)->where('approval_status', Product::REJECTED)->count(),
                'low_stock' => (clone $products)->whereNotNull('qty')->where('qty', '<=', self::LOW_STOCK)->count(),
                'total_orders' => $this->vendorOrders($vendorId)->count(),
                'to_ship' => $this->vendorOrders($vendorId)->whereIn('status', ['pending', 'processing'])->count(),
                'revenue' => round((float) (clone $soldItems)->sum('line_total'), 2),
                'units_sold' => (int) (clone $soldItems)->sum('quantity'),
                'commission_rate' => $earnings['effective_rate'],
                'balance_due' => $earnings['balance'],
                'pending_earnings' => $earnings['pending_earnings'],
            ],
            'recent_orders' => $this->withVendorTotals($this->vendorOrders($vendorId), $vendorId)
                ->with('latestTrackingEvent')->orderByDesc('id')->limit(5)->get(),
            'low_stock_products' => (clone $products)->whereNotNull('qty')->where('qty', '<=', self::LOW_STOCK)
                ->orderBy('qty')->limit(5)->get(['id', 'title', 'sku', 'qty', 'status']),
        ]);
    }

    public function index(Request $request)
    {
        $vendorId = $request->user()->id;
        $orders = $this->withVendorTotals($this->vendorOrders($vendorId), $vendorId)
            ->with('latestTrackingEvent')
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->trim()->toString();
                $query->where(function ($query) use ($search) {
                    $query->where('customer_name', 'like', "%{$search}%")
                        ->orWhere('tracking_number', 'like', "%{$search}%");
                    if (ctype_digit($search)) {
                        $query->orWhere('id', (int) $search);
                    }
                });
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->input('status')))
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json($orders);
    }

    public function show(Request $request, Order $order)
    {
        return response()->json(self::present($order, $request->user()->id));
    }

    public function update(Request $request, Order $order)
    {
        $vendorId = $request->user()->id;
        self::authorizeShipping($order, $vendorId);

        $validated = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'courier_name' => ['nullable', 'string', 'max:120'],
            'estimated_delivery_date' => ['nullable', 'date'],
        ]);

        DB::transaction(function () use ($order, $validated, $vendorId) {
            $previousStatus = $order->status;
            $order->update($validated);
            if ($validated['status'] !== $previousStatus) {
                $order->recordTrackingEvent(
                    OrderTrackingEvent::ORDER_STATUS_TO_STATUS[$validated['status']],
                    ['description' => 'Order status updated to ' . $validated['status'] . '.'],
                    $vendorId,
                );
            }
        });

        return response()->json(['message' => 'Order updated successfully.', 'data' => self::present($order->refresh(), $vendorId)]);
    }

    /** The order as a vendor may see it: only their lines, and order totals only if they sold everything. */
    public static function present(Order $order, int $vendorId): Order
    {
        $vendorItems = $order->items()->where('vendor_id', $vendorId)->get();
        abort_if($vendorItems->isEmpty(), 404);

        $ownsWholeOrder = self::ownsWholeOrder($order, $vendorId);
        $order->setRelation('items', $vendorItems);
        $order->load('trackingEvents');
        $order->setAttribute('vendor_subtotal', round((float) $vendorItems->sum('line_total'), 2));
        $order->setAttribute('can_manage_shipping', $ownsWholeOrder);
        if (!$ownsWholeOrder) {
            $order->makeHidden(['subtotal', 'shipping_amount', 'total']);
        }

        return $order;
    }

    /**
     * Shipping and tracking belong to the whole order, so a vendor may change them only
     * when every line in the order is theirs. Mixed orders are handled by the store team.
     */
    public static function authorizeShipping(Order $order, int $vendorId): void
    {
        abort_unless($order->items()->where('vendor_id', $vendorId)->exists(), 404);
        abort_unless(self::ownsWholeOrder($order, $vendorId), 403, 'This order includes items from other sellers, so the store team manages its shipping.');
    }

    private static function ownsWholeOrder(Order $order, int $vendorId): bool
    {
        return !$order->items()
            ->where(fn ($query) => $query->whereNull('vendor_id')->orWhere('vendor_id', '!=', $vendorId))
            ->exists();
    }

    private function vendorOrders(int $vendorId)
    {
        return Order::query()->whereHas('items', fn ($query) => $query->where('vendor_id', $vendorId));
    }

    private function withVendorTotals($query, int $vendorId)
    {
        return $query
            ->withCount(['items as items_count' => fn ($query) => $query->where('vendor_id', $vendorId)])
            ->withSum(['items as vendor_subtotal' => fn ($query) => $query->where('vendor_id', $vendorId)], 'line_total');
    }
}
