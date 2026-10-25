<?php

namespace App\Services;

use App\Models\OrderItem;
use App\Models\SellerPayout;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Seller commission: Elitezaar keeps a percentage of each product a seller sells (delivery charges aren't
 * included). A seller's earnings are owed once the order is delivered; cancelled orders don't count.
 * Balance owed = earnings from delivered orders − payouts recorded.
 */
class Commissions
{
    public const DEFAULT_RATE = 10.0;
    private const SETTING = 'commission.default_rate';

    public static function defaultRate(): float
    {
        return round((float) Setting::read(self::SETTING, self::DEFAULT_RATE), 2);
    }

    public static function setDefaultRate(float $rate): void
    {
        Setting::write(self::SETTING, (string) round($rate, 2));
    }

    /** The rate a seller pays on new orders: their own, or the store default. */
    public static function rateFor(User $seller): float
    {
        return $seller->commission_rate !== null ? (float) $seller->commission_rate : self::defaultRate();
    }

    public static function amount(float $lineTotal, float $rate): float
    {
        return round($lineTotal * $rate / 100, 2);
    }

    /**
     * Sales, commission and payouts per seller, keyed by seller id.
     *
     * @param  array<int>|null  $sellerIds  limit to these sellers
     * @return Collection<int, array<string, float|int>>
     */
    public static function totalsBySeller(?array $sellerIds = null): Collection
    {
        $items = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereNotNull('order_items.vendor_id')
            ->where('orders.status', '!=', 'cancelled')
            ->when($sellerIds !== null, fn ($query) => $query->whereIn('order_items.vendor_id', $sellerIds))
            ->groupBy('order_items.vendor_id')
            ->selectRaw("order_items.vendor_id,
                SUM(CASE WHEN orders.status = 'delivered' THEN order_items.line_total ELSE 0 END) AS sales,
                SUM(CASE WHEN orders.status = 'delivered' THEN COALESCE(order_items.commission_amount, 0) ELSE 0 END) AS commission,
                SUM(CASE WHEN orders.status = 'delivered' THEN order_items.quantity ELSE 0 END) AS units,
                SUM(CASE WHEN orders.status <> 'delivered' THEN order_items.line_total ELSE 0 END) AS pending_sales,
                SUM(CASE WHEN orders.status <> 'delivered' THEN order_items.line_total - COALESCE(order_items.commission_amount, 0) ELSE 0 END) AS pending_earnings")
            ->get()
            ->keyBy('vendor_id');

        $paid = SellerPayout::query()
            ->whereNotNull('vendor_id')
            ->when($sellerIds !== null, fn ($query) => $query->whereIn('vendor_id', $sellerIds))
            ->groupBy('vendor_id')
            ->selectRaw('vendor_id, SUM(amount) AS paid')
            ->pluck('paid', 'vendor_id');

        return $items->keys()->merge($paid->keys())->unique()->mapWithKeys(function ($sellerId) use ($items, $paid) {
            $row = $items->get($sellerId);
            $sales = round((float) ($row->sales ?? 0), 2);
            $commission = round((float) ($row->commission ?? 0), 2);
            $earnings = round($sales - $commission, 2);
            $paidOut = round((float) ($paid[$sellerId] ?? 0), 2);

            return [(int) $sellerId => [
                'sales' => $sales,
                'commission' => $commission,
                'earnings' => $earnings,
                'paid' => $paidOut,
                'balance' => round($earnings - $paidOut, 2),
                'units' => (int) ($row->units ?? 0),
                'pending_sales' => round((float) ($row->pending_sales ?? 0), 2),
                'pending_earnings' => round((float) ($row->pending_earnings ?? 0), 2),
            ]];
        });
    }

    /** One seller's figures, with their rate. */
    public static function summary(User $seller, ?array $totals = null): array
    {
        $totals ??= self::totalsBySeller([$seller->id])->get($seller->id);

        return [
            'id' => $seller->id,
            'name' => $seller->name,
            'email' => $seller->email,
            'role' => $seller->role,
            'commission_rate' => $seller->commission_rate !== null ? (float) $seller->commission_rate : null,
            'effective_rate' => self::rateFor($seller),
            ...($totals ?? self::emptyTotals()),
        ];
    }

    public static function emptyTotals(): array
    {
        return ['sales' => 0.0, 'commission' => 0.0, 'earnings' => 0.0, 'paid' => 0.0, 'balance' => 0.0, 'units' => 0, 'pending_sales' => 0.0, 'pending_earnings' => 0.0];
    }

    /** A seller's sold items, newest first, with the commission on each. */
    public static function itemsFor(int $sellerId, int $perPage = 20)
    {
        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.vendor_id', $sellerId)
            ->orderByDesc('orders.created_at')->orderByDesc('order_items.id')
            ->select([
                'order_items.id', 'order_items.order_id', 'order_items.product_id', 'order_items.product_title', 'order_items.sku',
                'order_items.quantity', 'order_items.line_total', 'order_items.commission_rate', 'order_items.commission_amount',
                'orders.status as order_status', 'orders.created_at as ordered_at',
            ])
            ->paginate($perPage)
            ->through(fn (OrderItem $item) => [
                'id' => $item->id,
                'order_id' => $item->order_id,
                'product_id' => $item->product_id,
                'product_title' => $item->product_title,
                'sku' => $item->sku,
                'quantity' => $item->quantity,
                'line_total' => (float) $item->line_total,
                'commission_rate' => $item->commission_rate !== null ? (float) $item->commission_rate : null,
                'commission_amount' => (float) ($item->commission_amount ?? 0),
                'earning' => round((float) $item->line_total - (float) ($item->commission_amount ?? 0), 2),
                'order_status' => $item->order_status,
                'ordered_at' => $item->ordered_at,
            ]);
    }

    public static function payoutsFor(int $sellerId): Collection
    {
        return SellerPayout::query()->where('vendor_id', $sellerId)->orderByDesc('paid_on')->orderByDesc('id')->get();
    }
}
