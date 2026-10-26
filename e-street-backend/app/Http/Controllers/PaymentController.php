<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\Messenger;
use App\Services\Razorpay;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/** Razorpay online payments (UPI, net banking, cards) for storefront orders. */
class PaymentController extends Controller
{
    public function __construct(private Razorpay $razorpay)
    {
    }

    /** Which payment options the storefront may offer. */
    public function methods()
    {
        return response()->json([
            'cod' => true,
            'online' => $this->razorpay->configured(),
        ]);
    }

    /** Creates (or reuses) the Razorpay order and returns what the checkout window needs. */
    public function start(Request $request, Order $order)
    {
        $this->authorizePayment($request, $order);

        try {
            if (!$order->razorpay_order_id) {
                $order->forceFill([
                    'razorpay_order_id' => $this->razorpay->createOrder((float) $order->total, 'order_' . $order->id, ['order_id' => (string) $order->id]),
                ])->save();
            }
        } catch (RuntimeException $exception) {
            Log::warning('Razorpay order creation failed', ['order_id' => $order->id, 'error' => $exception->getMessage()]);

            return response()->json(['message' => 'We couldn’t start the online payment. Please try again or choose cash on delivery.'], 502);
        }

        return response()->json([
            'key_id' => $this->razorpay->keyId(),
            'razorpay_order_id' => $order->razorpay_order_id,
            'amount' => Razorpay::toPaise((float) $order->total),
            'currency' => 'INR',
            'order_id' => $order->id,
            'prefill' => ['name' => $order->customer_name, 'email' => $order->customer_email, 'contact' => $order->customer_phone],
        ]);
    }

    /** Confirms a payment from the checkout window using Razorpay's signature. */
    public function verify(Request $request, Order $order)
    {
        $validated = $request->validate([
            'razorpay_order_id' => ['required', 'string'],
            'razorpay_payment_id' => ['required', 'string'],
            'razorpay_signature' => ['required', 'string'],
        ]);
        $this->authorizePayment($request, $order);

        $valid = $validated['razorpay_order_id'] === $order->razorpay_order_id
            && $this->razorpay->validCheckoutSignature($validated['razorpay_order_id'], $validated['razorpay_payment_id'], $validated['razorpay_signature']);
        if (!$valid) {
            return response()->json(['message' => 'We couldn’t verify this payment. If money was deducted, it will be refunded automatically.'], 422);
        }

        $order->markPaid($validated['razorpay_payment_id']);

        return response()->json(['message' => 'Payment received.', 'data' => $order->refresh()->load('items.product:id,image,slug')]);
    }

    /** Lets the shopper fall back to cash on delivery if the online payment didn't go through. */
    public function payOnDelivery(Request $request, Order $order)
    {
        $this->authorizePayment($request, $order);

        $order->forceFill(['payment_method' => 'cod', 'payment_token' => null])->save();
        Messenger::orderPlaced($order);

        return response()->json(['message' => 'Switched to cash on delivery.', 'data' => $order->refresh()->load('items.product:id,image,slug')]);
    }

    /** Server-to-server confirmation, so orders are marked paid even if the shopper closes the tab. */
    public function webhook(Request $request)
    {
        if (!$this->razorpay->validWebhookSignature($request->getContent(), (string) $request->header('X-Razorpay-Signature'))) {
            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        if (in_array($request->input('event'), ['payment.captured', 'order.paid'], true)) {
            $payment = $request->input('payload.payment.entity', []);
            $order = Order::query()->where('razorpay_order_id', $payment['order_id'] ?? null)->first();
            if ($order && isset($payment['id'])) {
                $order->markPaid($payment['id']);
            }
        }

        return response()->json(['status' => 'ok']);
    }

    /** Only the checkout that created an unpaid online order may act on its payment. */
    private function authorizePayment(Request $request, Order $order): void
    {
        abort_unless(
            $order->payment_token && hash_equals($order->payment_token, (string) $request->input('payment_token')),
            403,
            'This payment link is no longer valid.',
        );
        abort_if($order->payment_status === 'paid', 422, 'This order is already paid.');
        abort_unless($order->payment_method === 'razorpay', 422, 'This order is not set up for online payment.');
    }
}
