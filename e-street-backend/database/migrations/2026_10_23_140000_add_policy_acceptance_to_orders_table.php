<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Which Return & Refund Policy the shopper agreed to at checkout, and when. Empty for orders placed before this existed.
        Schema::table('orders', function (Blueprint $table) {
            $table->string('policy_version', 20)->nullable()->after('notes');
            $table->timestamp('policy_accepted_at')->nullable()->after('policy_version');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['policy_version', 'policy_accepted_at']);
        });
    }
};
