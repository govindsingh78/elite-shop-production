<?php

namespace App\Http\Controllers;

use App\Models\BrandRequest;
use App\Services\BrandRequests;
use Illuminate\Http\Request;

/**
 * A seller's own brand requests: asking for a brand the store doesn't have yet, seeing the answers, and withdrawing
 * one that's still waiting. Sellers waiting for approval can ask too.
 */
class BrandRequestController extends Controller
{
    public function index(Request $request)
    {
        $requests = $request->user()->brandRequests()->with('brand:id,name')->latest('id')->limit(50)->get();

        return response()->json([
            'requests' => $requests->map(fn (BrandRequest $item) => self::present($item)),
            'max_pending' => BrandRequests::MAX_PENDING,
        ]);
    }

    public function store(Request $request)
    {
        $created = BrandRequests::file($request->user(), $request->validate(BrandRequests::rules(), BrandRequests::messages()));

        return response()->json([
            'message' => "Thanks! We’ve asked our team to add “{$created->name}”, and we’ll let you know.",
            'request' => self::present($created),
        ], 201);
    }

    public function destroy(Request $request, BrandRequest $brandRequest)
    {
        abort_unless($brandRequest->seller_id === $request->user()->id, 404);
        abort_unless($brandRequest->status === BrandRequest::PENDING, 422, 'This request has already been answered, so it can’t be withdrawn.');
        $brandRequest->delete();

        return response()->json(['message' => 'Request withdrawn.']);
    }

    /** A request as sellers and admins see it; `brand` is what it became once added. */
    public static function present(BrandRequest $item): array
    {
        return [
            ...$item->only(['id', 'name', 'note', 'status', 'admin_note', 'created_at', 'reviewed_at']),
            'brand' => $item->brand?->only(['id', 'name']),
        ];
    }
}
