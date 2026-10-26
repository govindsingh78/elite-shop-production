<?php

namespace App\Providers;

use App\Services\Monitoring\Problems;
use App\Services\Monitoring\Speed;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Server & health: every logged warning or error becomes a problem admins can see, and each request's
        // database queries are counted to spot pages that run too many.
        Event::listen(MessageLogged::class, [Problems::class, 'fromLog']);
        DB::listen(function () {
            Speed::$queries++;
        });
    }
}
