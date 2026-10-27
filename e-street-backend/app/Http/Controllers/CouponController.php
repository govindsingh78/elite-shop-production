<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Notifications\StoreMessage;
use App\Services\Coupons;
use Illuminate\Http\Request;

/** Coupons for shoppers: the offers on a product page or for a bag, and checking a code before placing an order. */
class CouponController extends Controller
{
    /** Offers that cover a product (`product`) or any product in a bag (`products`, comma-separated ids). */
    public function index(Request $request)
    {
        $validated = $request->validate(['product' => ['nullable', 'integer'], 'products' => ['nullable', 'string', 'max:500']]);
        $ids = array_filter(array_map('intval', explode(',', (string) ($validated['products'] ?? $validated['product'] ?? ''))));
        $products = $ids ? Product::query()->onStorefront()->with('category:id,parent_id')->whereIn('id', $ids)->get() : collect();

        return response()->json(['offers' => $products->isEmpty() ? [] : Coupons::offersFor($products)]);
    }

    /** Whether a code works for this bag, and how much it takes off (checkout works it out again when ordering). */
    public function check(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'customer_email' => ['nullable', 'email', 'max:255'],
        ], ['code.required' => 'Enter a coupon code.']);

        $products = Product::query()->onStorefront()->with('category:id,parent_id')
            ->whereIn('id', array_column($validated['items'], 'product_id'))->get()->keyBy('id');
        $lines = collect($validated['items'])->filter(fn (array $item) => $products->has($item['product_id']))
            ->map(fn (array $item) => ['product' => $products[$item['product_id']], 'amount' => round((float) $products[$item['product_id']]->price * $item['quantity'], 2)])
            ->values()->all();

        $applied = Coupons::apply($validated['code'], $lines, $request->user('sanctum'), $validated['customer_email'] ?? null);

        return response()->json([
            'coupon' => Coupons::present($applied['coupon']),
            'code' => $applied['coupon']->code,
            'discount' => $applied['discount'],
            'eligible' => $applied['eligible'],
            'message' => 'You save ' . StoreMessage::inr($applied['discount']) . " with {$applied['coupon']->code}.",
        ]);
    }
}
