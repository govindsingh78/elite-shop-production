<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Product sizes with their own stock, and the size each order item was bought in. Also fills the size
 * list with the usual clothing sizes; admins can add more (shoe sizes, waist sizes, kids' ages…).
 */
return new class extends Migration
{
    private const DEFAULT_SIZES = ['Free Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

    public function up(): void
    {
        Schema::table('sizes', function (Blueprint $table) {
            $table->unsignedSmallInteger('sort_order')->default(0)->after('name');
        });

        // The old product–size table was never used; drop any repeated pairs before making each pair unique.
        $duplicates = DB::table('product_sizes')
            ->select('product_id', 'size_id', DB::raw('MIN(id) as keep_id'))
            ->groupBy('product_id', 'size_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();
        foreach ($duplicates as $duplicate) {
            DB::table('product_sizes')
                ->where('product_id', $duplicate->product_id)
                ->where('size_id', $duplicate->size_id)
                ->where('id', '!=', $duplicate->keep_id)
                ->delete();
        }
        Schema::table('product_sizes', function (Blueprint $table) {
            // Null = stock isn't tracked for this size.
            $table->unsignedInteger('qty')->nullable()->after('size_id');
            $table->unique(['product_id', 'size_id']);
        });

        // A snapshot of the size at checkout, like the product title, so orders read the same after sizes change.
        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('size_id')->nullable()->after('product_id')->constrained('sizes')->nullOnDelete();
            $table->string('size', 60)->nullable()->after('size_id');
        });

        // Standard sizes in shop order; any sizes already in the table go after them.
        $existing = DB::table('sizes')->get(['id', 'name'])->keyBy(fn ($size) => mb_strtolower(trim($size->name)));
        foreach (self::DEFAULT_SIZES as $index => $name) {
            $position = ($index + 1) * 10;
            if ($size = $existing->get(mb_strtolower($name))) {
                DB::table('sizes')->where('id', $size->id)->update(['sort_order' => $position]);
            } else {
                DB::table('sizes')->insert(['name' => $name, 'sort_order' => $position, 'created_at' => now(), 'updated_at' => now()]);
            }
        }
        DB::table('sizes')->where('sort_order', 0)->update(['sort_order' => 900]);
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('size_id');
            $table->dropColumn('size');
        });
        Schema::table('product_sizes', function (Blueprint $table) {
            $table->dropUnique(['product_id', 'size_id']);
            $table->dropColumn('qty');
        });
        Schema::table('sizes', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
