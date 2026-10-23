<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderTrackingEvent;
use App\Models\Product;
use App\Models\ShippingMethod;
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
        return response()->json($order->load(['items', 'trackingEvents']), 200);
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
        ]);

        if ($validated['payment_method'] === 'razorpay' && !app(Razorpay::class)->configured()) {
            throw ValidationException::withMessages(['payment_method' => 'Online payment is not available right now. Please choose cash on delivery.']);
        }

        $customerToken = null;
        $customer = null;
        $order = DB::transaction(function () use ($request, &$validated, &$customerToken, &$customer) {
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
            foreach ($validated['items'] as $requestedItem) {
                $product = Product::query()->lockForUpdate()->findOrFail($requestedItem['product_id']);
                if (!$product->isOnStorefront()) {
                    abort(422, "{$product->title} is not available.");
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
                $items[] = [
                    'product_id' => $product->id,
                    'vendor_id' => $product->vendor_id,
                    'product_title' => $product->title,
                    'sku' => $product->sku,
                    'quantity' => $requestedItem['quantity'],
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            }

            $shippingMethod = !empty($validated['shipping_method_id'])
                ? ShippingMethod::query()->where('status', 1)->findOrFail($validated['shipping_method_id'])
                : null;
            $shippingAmount = (float) ($shippingMethod?->price ?? 0);

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
                'shipping_amount' => $shippingAmount,
                'shipping_method_id' => $shippingMethod?->id,
                'total' => $subtotal + $shippingAmount,
                'payment_method' => $validated['payment_method'],
                'payment_status' => 'unpaid',
                'status' => 'pending',
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($items as $item) {
                $order->items()->create($item);
            }
            $order->recordTrackingEvent('order_placed', ['description' => 'Order received.']);

            if ($customer) {
                $customerToken = $customer->createToken('customer_auth_token')->plainTextToken;
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
        }

        return response()->json([
            'message' => 'Order created successfully.',
            'data' => $order->load('items.product:id,image'),
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
            'data' => $order->refresh()->load(['items', 'trackingEvents']),
        ], 200);
    }

    public function destroy(Order $order)
    {
        $order->delete();

        return response()->json(['message' => 'Order deleted successfully.'], 200);
    }
}
