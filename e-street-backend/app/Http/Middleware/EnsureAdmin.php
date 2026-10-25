<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        // Also refuses admin accounts whose email isn't approved in config/admin.php, including their existing sessions.
        if (!$request->user() || $request->user()->role !== 'admin' || !User::isApprovedAdminEmail($request->user()->email)) {
            return response()->json(['message' => 'Administrator access required.'], 403);
        }

        return $next($request);
    }
}
