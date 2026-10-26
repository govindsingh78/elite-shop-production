<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Server & health in the admin panel: problems shoppers, sellers and admins run into (server errors and
 * website/app crashes, grouped), how long each API call takes, and how fast the website's pages load for
 * real visitors.
 */
return new class extends Migration
{
    public function up(): void
    {
        // One row per distinct problem; repeats add to the count. A resolved problem reopens if it happens again.
        Schema::create('monitor_problems', function (Blueprint $table) {
            $table->id();
            $table->string('fingerprint', 64)->unique();
            $table->string('source', 10); // server, website or app
            $table->string('level', 10); // warning, error or critical
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('location')->nullable(); // file:line, or the website/app screen
            $table->string('url', 500)->nullable(); // the last page or API address it happened on
            $table->string('method', 10)->nullable();
            $table->string('status', 10)->default('open'); // open or resolved
            $table->unsignedInteger('hits')->default(1);
            $table->json('affected')->nullable(); // how often each kind of user hit it: customer, seller, admin, guest
            $table->unsignedBigInteger('last_user_id')->nullable();
            $table->text('trace')->nullable();
            $table->json('context')->nullable(); // browser or app version and the like, from the latest time
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamp('resolved_at')->nullable();
            // Set once admins have been alerted; cleared when it reopens.
            $table->timestamp('notified_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'last_seen_at']);
        });

        // API calls per route, per hour.
        Schema::create('monitor_requests', function (Blueprint $table) {
            $table->id();
            $table->string('route', 191); // e.g. "GET storefront/products/{handle}"
            $table->timestamp('hour')->nullable();
            $table->unsignedInteger('hits')->default(0);
            $table->unsignedBigInteger('total_ms')->default(0);
            $table->unsignedInteger('max_ms')->default(0);
            $table->unsignedInteger('slow_hits')->default(0); // took a second or more
            $table->unsignedInteger('error_hits')->default(0); // server errors (5xx)
            $table->unsignedBigInteger('queries')->default(0); // database queries, all hits together
            $table->unique(['route', 'hour']);
            $table->index('hour');
        });

        // Website page loads from real visitors, per page, per day and device.
        Schema::create('monitor_pages', function (Blueprint $table) {
            $table->id();
            $table->string('page', 191); // e.g. "/product/:handle"
            $table->date('day');
            $table->string('device', 10); // mobile or desktop
            $table->unsignedInteger('hits')->default(0);
            $table->unsignedBigInteger('lcp_total')->default(0); // largest contentful paint, ms
            $table->unsignedInteger('lcp_good')->default(0); // under 2.5 s
            $table->unsignedInteger('lcp_poor')->default(0); // over 4 s
            $table->unsignedBigInteger('ttfb_total')->default(0); // time to first byte, ms
            $table->unsignedBigInteger('load_total')->default(0); // full page load, ms
            $table->unique(['page', 'day', 'device']);
            $table->index('day');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monitor_pages');
        Schema::dropIfExists('monitor_requests');
        Schema::dropIfExists('monitor_problems');
    }
};
