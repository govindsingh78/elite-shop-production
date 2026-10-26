<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\SellerPayout;
use App\Models\User;
use App\Notifications\PayoutSent;
use App\Services\Commissions;
use App\Services\Messenger;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Admin: what each seller has sold, Elitezaar's commission, and what's been paid out or is still owed. */
class CommissionController extends Controller
{
    /** Every seller, plus anyone else with sales or payouts (e.g. a seller whose role later changed). */
    public function index()
    {
        $totals = Commissions::totalsBySeller();
        $sellers = User::query()
            ->where('role', 'seller')
            ->orWhereIn('id', $totals->keys()->all())
            ->orderBy('name')
            ->get()
            ->map(fn (User $seller) => Commissions::summary($seller, $totals->get($seller->id)))
            ->sortByDesc('balance')
            ->values();

        $sum = fn (string $key) => round((float) $sellers->sum($key), 2);

        return response()->json([
            'default_rate' => Commissions::defaultRate(),
            'totals' => [
                'sales' => $sum('sales'),
                'commission' => $sum('commission'),
                'earnings' => $sum('earnings'),
                'paid' => $sum('paid'),
                'balance' => $sum('balance'),
                'pending_sales' => $sum('pending_sales'),
                'pending_earnings' => $sum('pending_earnings'),
            ],
            'sellers' => $sellers,
        ]);
    }

    public function updateSettings(Request $request)
    {
        $validated = $request->validate(['default_rate' => ['required', 'numeric', 'min:0', 'max:100']]);
        Commissions::setDefaultRate((float) $validated['default_rate']);

        return response()->json([
            'message' => 'Default commission updated. It applies to new orders from sellers without their own rate.',
            'default_rate' => Commissions::defaultRate(),
        ]);
    }

    public function show(User $seller)
    {
        $this->ensureSeller($seller);

        return response()->json([
            'seller' => Commissions::summary($seller),
            'default_rate' => Commissions::defaultRate(),
            'payouts' => Commissions::payoutsFor($seller->id),
            'items' => Commissions::itemsFor($seller->id),
        ]);
    }

    /** Sets the seller's own rate, or (null) puts them back on the default. New orders only. */
    public function updateSeller(Request $request, User $seller)
    {
        $this->ensureSeller($seller);
        $validated = $request->validate(['commission_rate' => ['present', 'nullable', 'numeric', 'min:0', 'max:100']]);

        $seller->forceFill(['commission_rate' => $validated['commission_rate'] === null ? null : round((float) $validated['commission_rate'], 2)])->save();

        return response()->json([
            'message' => $seller->commission_rate === null
                ? 'This seller now pays the default commission on new orders.'
                : 'Commission updated. It applies to this seller’s new orders.',
            'seller' => Commissions::summary($seller->fresh()),
        ]);
    }

    public function storePayout(Request $request, User $seller)
    {
        $this->ensureSeller($seller);
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999'],
            'paid_on' => ['nullable', 'date', 'before_or_equal:today'],
            'method' => ['nullable', Rule::in(SellerPayout::METHODS)],
            'reference' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $balance = Commissions::summary($seller)['balance'];
        if (round((float) $validated['amount'], 2) > $balance) {
            throw ValidationException::withMessages([
                'amount' => $balance > 0
                    ? 'That’s more than this seller is owed (₹' . number_format($balance, 2) . ').'
                    : 'This seller isn’t owed anything right now.',
            ]);
        }

        $payout = SellerPayout::create([
            ...$validated,
            'vendor_id' => $seller->id,
            'amount' => round((float) $validated['amount'], 2),
            'paid_on' => $validated['paid_on'] ?? now()->toDateString(),
            'recorded_by' => $request->user()->id,
        ]);
        Messenger::send($seller, new PayoutSent($payout));

        return response()->json([
            'message' => 'Payout recorded.',
            'payout' => $payout,
            'seller' => Commissions::summary($seller),
        ], 201);
    }

    /** Removes a payout recorded by mistake; the amount is owed again. */
    public function destroyPayout(SellerPayout $payout)
    {
        $payout->delete();

        return response()->json(['message' => 'Payout removed. The amount is owed to the seller again.']);
    }

    private function ensureSeller(User $user): void
    {
        $hasSales = OrderItem::query()->where('vendor_id', $user->id)->exists()
            || SellerPayout::query()->where('vendor_id', $user->id)->exists();
        abort_unless($user->role === 'seller' || $hasSales, 404, 'Seller not found.');
    }
}
