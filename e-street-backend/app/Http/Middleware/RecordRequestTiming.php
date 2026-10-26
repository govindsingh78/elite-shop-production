<?php

namespace App\Http\Middleware;

use App\Services\Monitoring\Speed;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/** Times every API call for Server & health › Speed. The timing is saved after the reply has gone out. */
class RecordRequestTiming
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set('monitor.started', hrtime(true));
        $request->attributes->set('monitor.queries', Speed::$queries);

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        $started = $request->attributes->get('monitor.started');
        $route = $request->route();
        // Unknown addresses (404s), the speed and crash reports, and Server & health itself aren't worth timing.
        if (!$started || !$route || str_starts_with($route->uri(), 'api/monitor/') || str_starts_with($route->uri(), 'api/admin/server')) {
            return;
        }

        try {
            Speed::recordRequest(
                $request->method() . ' ' . preg_replace('#^api/#', '', $route->uri()),
                (int) round((hrtime(true) - $started) / 1e6),
                $response->getStatusCode(),
                max(0, Speed::$queries - (int) $request->attributes->get('monitor.queries', 0)),
            );
        } catch (Throwable) {
            // Timing is a nice-to-have; never let it get in the way.
        }
    }
}
