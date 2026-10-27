<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where Elitezaar delivers (see App\Services\Delivery): admins list PIN codes, or the start of them ("302" is every
 * PIN code in and around Jaipur), that we deliver to or don't, with extra days for hard-to-reach places. Sellers
 * add the PIN code their parcels are picked up from, for delivery estimates.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_areas', function (Blueprint $table) {
            $table->id();
            $table->string('pincode', 6)->unique(); // a full PIN code, or its first 2–5 digits
            $table->string('name', 80)->nullable();
            $table->boolean('deliverable')->default(true);
            $table->unsignedTinyInteger('extra_days')->default(0);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('pickup_pincode', 6)->nullable()->after('business_state');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_areas');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('pickup_pincode');
        });
    }
};
