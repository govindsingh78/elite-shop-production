<?php

namespace App\Http\Controllers\Vendor;

use App\Http\Controllers\Controller;
use App\Services\Commissions;
use Illuminate\Http\Request;

/** Seller hub: the seller's own sales, Elitezaar's commission, payouts received and what's still due. */
class EarningsController extends Controller
{
    public function index(Request $request)
    {
        $seller = $request->user();

        return response()->json([
            'summary' => Commissions::summary($seller),
            'payouts' => Commissions::payoutsFor($seller->id)->map->only(['id', 'amount', 'paid_on', 'method', 'reference', 'note']),
            'items' => Commissions::itemsFor($seller->id),
        ]);
    }
}
