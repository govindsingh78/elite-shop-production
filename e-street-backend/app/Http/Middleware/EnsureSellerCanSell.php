<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Listing products and handling orders: approved sellers only. Others can still look around their portal. */
class EnsureSellerCanSell
{
    public function handle(Request $request, Closure $next): Response
    {
        $seller = $request->user();
        if ($seller && $restriction = $seller->sellerRestriction()) {
            return response()->json(['message' => $restriction, 'seller_status' => $seller->seller_status], 403);
        }

        return $next($request);
    }
}
