<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\PolicyController;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderTrackingEvent;
use App\Models\Product;
use App\Models\ProductSize;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Services\Commissions;
use App\Services\Coupons;
use App\Services\Delivery;
use App\Services\Gst;
use App\Services\Invoices;
use App\Services\Messenger;
use App\Services\Razorpay;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    private const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    public function index(Request $request)
    {
        $orders = Order::query()
            ->withCount('items')
            ->with('latestTrackingEvent')
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->trim()->toString();
                $query->where(function ($query) use ($search) {
                    $query->where('customer_name', 'like', "%{$search}%")
                        ->orWhere('customer_email', 'like', "%{$search}%")
                        ->orWhere('tracking_number', 'like', "%{$search}%");
                    if (ctype_digit($search)) {
                        $query->orWhere('id', (int) $search);
                    }
                });
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->input('status')))
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json($orders, 200);
    }

    public function show(Order $order)
    {
        return response()->json($order->load(['items', 'trackingEvents'])->setAttribute('invoice_links', Invoices::linksFor($order)), 200);
    }

    /** Issues the order's invoices now, e.g. for an order that shipped before invoices existed. */
    public function issueInvoices(Order $order)
    {
        abort_if(in_array($order->status, ['pending', 'cancelled'], true), 422, 'Invoices are issued once an order is confirmed, and not for cancelled orders.');
        Invoices::issue($order);

        return response()->json(['message' => 'Invoices issued.', 'invoice_links' => Invoices::linksFor($order)], 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_action' => ['sometimes', Rule::in(['guest', 'register', 'login'])],
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_email' => ['required', 'email', 'max:255'],
            'account_password' => ['required_if:customer_action,register,login', 'nullable', 'string', 'min:8'],
            'account_password_confirmation' => ['required_if:customer_action,register', 'nullable', 'same:account_password'],
            'customer_phone' => ['required_if:customer_action,register', 'nullable', 'string', 'max:40'],
            'address' => ['required', 'string', 'max:2000'],
            'city' => ['required', 'string', 'max:120'],
            'state' => ['required_if:customer_action,register', 'nullable', 'string', 'max:120'],
            'postal_code' => ['required_if:customer_action,register', 'nullable', 'string', 'max:30'],
            'country' => ['nullable', 'string', 'max:120'],
            'payment_method' => ['required', Rule::in(['cod', 'razorpay'])],
            'shipping_method_id' => ['nullable', 'integer', 'exists:shipping_methods,id'],
            'notes' => ['nullable', 'string', 'max:4000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            // Required for products sold in sizes; checked against the product below.
            'items.*.size_id' => ['nullable', 'integer'],
            // Business buyers can have their GSTIN on the invoice, to claim input tax credit.
            'billing_gstin' => ['nullable', 'string', 'max:15', Gst::gstinRule()],
            'billing_name' => ['nullable', 'required_with:billing_gstin', 'string', 'max:255'],
            'coupon_code' => ['nullable', 'string', 'max:30'],
            // Shoppers must agree to the Return & Refund Policy; the version they saw is kept on the order.
            'accept_policy' => ['accepted'],
        ], [
            'accept_policy.accepted' => 'Please read and accept the Return & Refund Policy to place your order.',
            'billing_name.required_with' => 'Add the business name registered with this GSTIN.',
        ]);
        $placeOfSupply = Gst::placeOfSupply($validated['state'] ?? null, $validated['country'] ?? null);
        // Only to PIN codes we deliver to (Admin › Delivery areas).
        if ($problem = Delivery::checkoutProblem($validated['postal_code'] ?? null, $validated['country'] ?? null)) {
            throw ValidationException::withMessages(['postal_code' => $problem]);
        }

        if ($validated['payment_method'] === 'razorpay' && !app(Razorpay::class)->configured()) {
            throw ValidationException::withMessages(['payment_method' => 'Online payment is not available right now. Please choose cash on delivery.']);
        }

        $customerToken = null;
        $customer = null;
        $order = DB::transaction(function () use ($request, &$validated, &$customerToken, &$customer, $placeOfSupply) {
            $customerAction = $validated['customer_action'] ?? 'guest';
            $customer = null;

            if ($customerAction === 'login') {
                $customer = \App\Models\User::query()
                    ->where('email', $validated['customer_email'])
                    ->where('role', 'customer')
                    ->first();
                if (!$customer || !Hash::check($validated['account_password'], $customer->password)) {
                    abort(422, 'The email or password is incorrect for an existing customer account.');
                }
                if ($customer->name !== $validated['customer_name']) {
                    $validated['customer_name'] = $customer->name;
                }
            } elseif ($customerAction === 'register') {
                if (\App\Models\User::query()->where('email', $validated['customer_email'])->exists()) {
                    abort(422, 'An account with this email already exists. Choose existing customer sign-in.');
                }
                $customer = \App\Models\User::create([
                    'name' => $validated['customer_name'],
                    'email' => $validated['customer_email'],
                    'phone' => $validated['customer_phone'],
                    'password' => Hash::make($validated['account_password']),
                    'role' => 'customer',
                ]);
                // Customer accounts always keep a default delivery address.
                $customer->addresses()->create([
                    'label' => 'Home',
                    'full_name' => $validated['customer_name'],
                    'phone' => $validated['customer_phone'],
                    'address' => $validated['address'],
                    'city' => $validated['city'],
                    'state' => $validated['state'],
                    'postal_code' => $validated['postal_code'],
                    'country' => ($validated['country'] ?? '') ?: 'India',
                    'is_default' => true,
                ]);
            }

            $subtotal = 0;
            $items = [];
            // Each line's product and seller, and its value before any coupon.
            $lines = [];
            $sellerRates = [];
            $sellers = [];
            $taxTotal = 0.0;
            foreach ($validated['items'] as $requestedItem) {
                $product = Product::query()->lockForUpdate()->findOrFail($requestedItem['product_id']);
                if (!$product->isOnStorefront()) {
                    abort(422, "{$product->title} is not available.");
                }
                // A product sold in sizes is bought in one of them, from that size's own stock.
                $sizes = ProductSize::query()->with('size:id,name')->where('product_id', $product->id)->lockForUpdate()->get();
                $size = null;
                if ($sizes->isNotEmpty()) {
                    $size = $sizes->firstWhere('size_id', (int) ($requestedItem['size_id'] ?? 0));
                    if (!$size) {
                        abort(422, "Please choose a size for {$product->title}.");
                    }
                    if ($size->qty !== null && $size->qty < $requestedItem['quantity']) {
                        abort(422, $size->qty === 0
                            ? "{$product->title} is sold out in size {$size->name}."
                            : "Only {$size->qty} left of {$product->title} in size {$size->name}.");
                    }
                    if ($size->qty !== null) {
                        $size->decrement('qty', $requestedItem['quantity']);
                    }
                }
                if ($product->qty !== null && $product->qty < $requestedItem['quantity']) {
                    abort(422, "Insufficient stock for {$product->title}.");
                }
                if ($product->qty !== null) {
                    $product->decrement('qty', $requestedItem['quantity']);
                }

                $unitPrice = (float) $product->price;
                $lineTotal = round($unitPrice * $requestedItem['quantity'], 2);
                $subtotal += $lineTotal;
                $seller = $product->vendor_id ? ($sellers[$product->vendor_id] ??= User::find($product->vendor_id)) : null;
                // A seller's product carries Elitezaar's commission at the seller's current rate; our own products don't.
                $commissionRate = $product->vendor_id
                    ? ($sellerRates[$product->vendor_id] ??= $seller ? Commissions::rateFor($seller) : Commissions::defaultRate())
                    : null;
                $lines[] = ['product' => $product, 'seller' => $seller, 'amount' => $lineTotal];
                $items[] = [
                    'product_id' => $product->id,
                    'size_id' => $size?->size_id,
                    'size' => $size?->name,
                    'vendor_id' => $product->vendor_id,
                    'product_title' => $product->title,
                    'sku' => $product->sku,
                    'quantity' => $requestedItem['quantity'],
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                    'commission_rate' => $commissionRate,
                ];
            }

            // A coupon comes off the lines it covers (App\Services\Coupons); each line's GST and commission follow.
            $applied = filled($validated['coupon_code'] ?? null)
                ? Coupons::apply($validated['coupon_code'], $lines, $customer ?? $request->user('sanctum'), $validated['customer_email'])
                : null;
            foreach ($items as $index => $item) {
                $gross = $item['line_total'];
                $discount = (float) ($applied['shares'][$index] ?? 0);
                $paid = round($gross - $discount, 2);
                // GST included in the price paid, worked out for the supplier (the seller, or Elitezaar) and delivery state.
                $tax = Gst::forLine($lines[$index]['product'], $paid / $item['quantity'], $paid, $lines[$index]['seller'], $placeOfSupply);
                $taxTotal += $tax['cgst'] + $tax['sgst'] + $tax['igst'];
                // A seller's product carries Elitezaar's commission. When Elitezaar pays for a coupon, it comes out of
                // the commission, so the seller earns what they would have without it.
                $rate = $item['commission_rate'];
                $commission = $rate === null ? null : ($discount > 0 && $applied['coupon']->funded_by === 'store'
                    ? round(Commissions::amount($gross, $rate) - $discount, 2)
                    : Commissions::amount($paid, $rate));
                $items[$index] = [...$tax, ...$item, 'discount_amount' => $discount, 'line_total' => $paid, 'commission_amount' => $commission];
            }
            $discountTotal = (float) ($applied['discount'] ?? 0);

            $shippingMethod = !empty($validated['shipping_method_id'])
                ? ShippingMethod::query()->where('status', 1)->findOrFail($validated['shipping_method_id'])
                : null;
            $shippingAmount = (float) ($shippingMethod?->price ?? 0);
            // Delivery is charged by Elitezaar, so it carries GST only if the store is registered.
            [$storeRegistered, $storeState] = Gst::supplier(null);
            $shippingRate = $storeRegistered && $shippingAmount > 0 ? (float) Gst::store()['shipping_rate'] : null;
            $shippingTax = $shippingRate !== null ? Gst::split($shippingAmount, $shippingRate, $storeState !== null && $storeState === $placeOfSupply) : null;
            $shippingTaxTotal = $shippingTax ? round($shippingTax['cgst'] + $shippingTax['sgst'] + $shippingTax['igst'], 2) : 0.0;

            $order = Order::create([
                // The route is public, so read an optional bearer token to link signed-in customers.
                'user_id' => $customer?->id ?? $request->user('sanctum')?->id,
                'customer_name' => $validated['customer_name'],
                'customer_email' => $validated['customer_email'],
                'customer_phone' => $validated['customer_phone'] ?? null,
                'address' => $validated['address'],
                'city' => $validated['city'],
                'state' => $validated['state'] ?? null,
                'postal_code' => $validated['postal_code'] ?? null,
                'country' => $validated['country'] ?? '',
                'subtotal' => $subtotal,
                'coupon_id' => $applied['coupon']->id ?? null,
                'coupon_code' => $applied['coupon']->code ?? null,
                'discount_amount' => $discountTotal,
                'shipping_amount' => $shippingAmount,
                'shipping_method_id' => $shippingMethod?->id,
                'total' => round($subtotal - $discountTotal + $shippingAmount, 2),
                'payment_method' => $validated['payment_method'],
                'payment_status' => 'unpaid',
                'status' => 'pending',
                'notes' => $validated['notes'] ?? null,
                'policy_version' => PolicyController::version(PolicyController::RETURN_REFUND),
                'policy_accepted_at' => now(),
                'billing_name' => ($validated['billing_gstin'] ?? null) ? $validated['billing_name'] : null,
                'billing_gstin' => ($validated['billing_gstin'] ?? null) ? strtoupper(trim($validated['billing_gstin'])) : null,
                'place_of_supply' => $placeOfSupply,
                'tax_total' => round($taxTotal + $shippingTaxTotal, 2),
                'shipping_gst_rate' => $shippingRate,
                'shipping_tax' => $shippingTaxTotal,
            ]);

            foreach ($items as $item) {
                $order->items()->create($item);
            }
            $order->recordTrackingEvent('order_placed', ['description' => 'Order received.']);

            if ($customer) {
                $customerToken = $customer->issueToken('customer');
            }

            return ['order' => $order, 'customer' => $customer];
        });

        $customer = $order['customer'];
        $order = $order['order'];

        // Online orders get a one-time token so only this checkout can complete or change the payment.
        $paymentToken = null;
        if ($order->payment_method === 'razorpay') {
            $paymentToken = Str::random(48);
            $order->forceFill(['payment_token' => $paymentToken])->save();
        } else {
            // Cash on delivery orders are confirmed now; online ones once paid (Order::markPaid).
            Messenger::orderPlaced($order);
        }

        return response()->json([
            'message' => 'Order created successfully.',
            'data' => $order->load('items.product:id,image,slug'),
            'customer' => $customer,
            'customer_token' => $customerToken,
            'payment_token' => $paymentToken,
        ], 201);
    }

    public function update(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'payment_status' => ['sometimes', Rule::in(['unpaid', 'paid', 'refunded', 'failed'])],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'courier_name' => ['nullable', 'string', 'max:120'],
            'estimated_delivery_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        DB::transaction(function () use ($request, $order, $validated) {
            $previousStatus = $order->status;
            $order->update($validated);

            // Changing the status directly still leaves a trail the customer can follow.
            if ($validated['status'] !== $previousStatus) {
                $order->recordTrackingEvent(
                    OrderTrackingEvent::ORDER_STATUS_TO_STATUS[$validated['status']],
                    ['description' => 'Order status updated to ' . $validated['status'] . '.'],
                    $request->user()?->id,
                );
            }
        });

        return response()->json([
            'message' => 'Order updated successfully.',
            'data' => $order->refresh()->load(['items', 'trackingEvents'])->setAttribute('invoice_links', Invoices::linksFor($order)),
        ], 200);
    }

    public function destroy(Order $order)
    {
        $order->delete();

        return response()->json(['message' => 'Order deleted successfully.'], 200);
    }
}
