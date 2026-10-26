<?php

use App\Http\Middleware\BlockListedAddresses;
use App\Http\Middleware\RecordRequestTiming;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Times every API call for Admin › Server & health › Speed.
        $middleware->api(append: [RecordRequestTiming::class]);
        // Admin › Security: addresses blocked from the whole store are turned away first.
        $middleware->api(prepend: [BlockListedAddresses::class]);
        $middleware->append(SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
