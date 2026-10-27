<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Notifications\StoreMessage;
use Illuminate\Validation\ValidationException;

/**
 * Coupon codes: a percentage (optionally capped) or flat amount off the products a coupon covers, never delivery.
 *
 * The discount is shared across the covered lines in proportion to their value, so each line's GST is worked out on
 * what the shopper actually pays, and invoices show it. Who pays for it is the coupon's choice: Elitezaar ("store"),
 * when sellers are paid exactly as if there were no coupon (Elitezaar's commission absorbs it), or the seller, when
 * their earnings are on the discounted price. Elitezaar's own products are discounted by Elitezaar either way.
 */
class Coupons
{
    /** "aw 30" → "AW30" */
    public static function normalise(?string $code): string
    {
        return strtoupper(preg_replace('/\s+/', '', (string) $code));
    }

    /**
     * Checks a code against a bag and works out the discount. `$lines` are the bag's lines as
     * ['product' => Product, 'amount' => price × quantity]; `$customer` or `$email` say who's buying (for per-customer
     * limits and first orders). Returns ['coupon', 'discount', 'eligible', 'shares' => [line index => discount]].
     * A code that can't be used throws a validation error on `coupon_code`, saying why.
     */
    public static function apply(string $code, array $lines, ?User $customer = null, ?string $email = null): array
    {
        $code = self::normalise($code);
        $coupon = Coupon::query()->where('code', $code)->first();
        $fail = fn (string $message) => throw ValidationException::withMessages(['coupon_code' => $message]);

        if (!$coupon || !$coupon->status) {
            $fail("“{$code}” isn’t a valid code.");
        }
        if ($coupon->starts_at?->isFuture()) {
            $fail('This code works from ' . $coupon->starts_at->copy()->timezone('Asia/Kolkata')->format('j M Y, g:i a') . '.');
        }
        if ($coupon->ends_at && !$coupon->ends_at->isFuture()) {
            $fail('This code expired on ' . self::lastDay($coupon) . '.');
        }
        if ($coupon->usage_limit !== null && $coupon->usedOrders()->count() >= $coupon->usage_limit) {
            $fail('This code has been fully used.');
        }

        $email = strtolower(trim((string) ($customer?->email ?? $email)));
        $theirs = fn () => Order::query()->where('status', '!=', 'cancelled')
            ->where(fn ($query) => $query->when($customer, fn ($inner) => $inner->where('user_id', $customer->id))
                ->when($email !== '', fn ($inner) => $inner->orWhereRaw('LOWER(customer_email) = ?', [$email])));
        if ($customer || $email !== '') {
            if ($coupon->per_customer_limit !== null && $theirs()->where('coupon_id', $coupon->id)->count() >= $coupon->per_customer_limit) {
                $fail($coupon->per_customer_limit === 1 ? 'You’ve already used this code.' : "You’ve used this code {$coupon->per_customer_limit} times, the most allowed.");
            }
            if ($coupon->first_order_only && $theirs()->exists()) {
                $fail('This code is for your first order with Elitezaar.');
            }
        }

        $covered = array_filter($lines, fn (array $line) => $coupon->covers($line['product']));
        if (!$covered) {
            $fail('This code is for select products, and none of them are in your bag.');
        }
        $eligible = round(array_sum(array_column($covered, 'amount')), 2);
        if ($coupon->min_order !== null && $eligible < $coupon->min_order) {
            $short = StoreMessage::inr($coupon->min_order - $eligible);
            $fail("Add {$short} more" . (count($covered) < count($lines) ? ' of the products this code covers' : '') . ' to use this code (minimum ' . StoreMessage::inr($coupon->min_order) . ').');
        }

        $discount = $coupon->type === Coupon::PERCENT ? $eligible * $coupon->value / 100 : $coupon->value;
        if ($coupon->max_discount !== null) {
            $discount = min($discount, $coupon->max_discount);
        }
        $discount = round(min($discount, $eligible), 2);

        return ['coupon' => $coupon, 'discount' => $discount, 'eligible' => $eligible, 'shares' => self::share($discount, $covered)];
    }

    /** The discount split across the lines in proportion to their value; the last line takes the rounding. */
    private static function share(float $discount, array $covered): array
    {
        $total = array_sum(array_column($covered, 'amount'));
        $shares = [];
        $left = $discount;
        $keys = array_keys($covered);
        foreach ($keys as $position => $key) {
            $share = $position === count($keys) - 1 ? round($left, 2) : round($discount * $covered[$key]['amount'] / $total, 2);
            $shares[$key] = $share;
            $left -= $share;
        }

        return $shares;
    }

    /** Coupons shown as offers on a product page (or for a bag of products): live, listed, covering them, not used up. */
    public static function offersFor(iterable $products): array
    {
        $products = collect($products);

        return Coupon::query()->live()->where('show_on_product', true)->orderByDesc('value')->get()
            ->filter(fn (Coupon $coupon) => $coupon->usage_limit === null || $coupon->usedOrders()->count() < $coupon->usage_limit)
            ->filter(fn (Coupon $coupon) => $products->contains(fn (Product $product) => $coupon->covers($product)))
            ->map(fn (Coupon $coupon) => self::present($coupon))->values()->all();
    }

    /** "8 Nov 2026": the last day it works (it ends at midnight after it, India time). */
    private static function lastDay(Coupon $coupon): string
    {
        return $coupon->ends_at->copy()->subSecond()->timezone('Asia/Kolkata')->format('j M Y');
    }

    /** What shoppers see of a coupon. */
    public static function present(Coupon $coupon): array
    {
        return [
            ...$coupon->only(['code', 'title', 'description', 'terms', 'type', 'value', 'max_discount', 'min_order', 'first_order_only']),
            'headline' => $coupon->headline(),
            'ends_at' => $coupon->ends_at?->toIso8601String(),
            'conditions' => self::conditions($coupon),
        ];
    }

    /** The rules in plain words, for the T&C. */
    public static function conditions(Coupon $coupon): array
    {
        return array_values(array_filter([
            $coupon->headline() . ($coupon->max_discount !== null && $coupon->type === Coupon::PERCENT ? ', up to ' . StoreMessage::inr($coupon->max_discount) : '') . '.',
            $coupon->min_order !== null ? 'Minimum purchase of ' . StoreMessage::inr($coupon->min_order) . ($coupon->category_ids || $coupon->product_ids ? ' on the products it covers' : '') . '.' : null,
            $coupon->category_ids || $coupon->product_ids ? 'Valid on select products only.' : 'Valid on everything in the store.',
            $coupon->first_order_only ? 'For your first order with Elitezaar.' : null,
            $coupon->per_customer_limit !== null ? ($coupon->per_customer_limit === 1 ? 'Once per customer.' : "Up to {$coupon->per_customer_limit} times per customer.") : null,
            $coupon->ends_at ? 'Valid until ' . self::lastDay($coupon) . '.' : null,
            'Not valid on delivery charges.',
        ]));
    }
}
