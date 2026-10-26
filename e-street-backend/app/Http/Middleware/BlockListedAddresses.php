<?php

namespace App\Http\Middleware;

use App\Services\Security\LoginGuard;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Turns away IP addresses an admin has blocked from the whole store (Admin › Security). */
class BlockListedAddresses
{
    public function handle(Request $request, Closure $next): Response
    {
        if (in_array($request->ip(), LoginGuard::blockedIps(), true)) {
            return response()->json(['message' => 'Access from your network has been blocked. Contact Elitezaar support if this is a mistake.'], 403);
        }

        return $next($request);
    }
}
