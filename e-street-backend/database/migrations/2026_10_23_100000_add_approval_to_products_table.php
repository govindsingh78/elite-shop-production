<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Products already in the store stay live; new seller listings start as 'pending' until an admin reviews them.
        Schema::table('products', function (Blueprint $table) {
            $table->string('approval_status', 20)->default('approved')->after('status')->index();
            $table->string('review_note', 500)->nullable()->after('approval_status');
            $table->timestamp('reviewed_at')->nullable()->after('review_note');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['approval_status']);
            $table->dropColumn(['approval_status', 'review_note', 'reviewed_at']);
        });
    }
};
