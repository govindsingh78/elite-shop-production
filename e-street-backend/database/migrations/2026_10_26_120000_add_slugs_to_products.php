<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Readable product web addresses (/product/classic-linen-shirt instead of /product/12). Earlier
 * addresses of renamed products are kept in product_slugs so old links and search results still work.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('slug', 120)->nullable()->after('title');
        });

        Schema::create('product_slugs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('slug', 120)->unique();
            $table->timestamps();
        });

        // Existing products, oldest first, so the first of two same-named products keeps the plain name.
        $taken = [];
        foreach (DB::table('products')->orderBy('id')->get(['id', 'title']) as $product) {
            $base = Str::slug((string) $product->title) ?: 'product';
            if (strlen($base) > 80) {
                $base = substr($base, 0, 81);
                $base = rtrim(substr($base, 0, strrpos($base, '-') ?: 80), '-');
            }
            // An all-number address would read as a product id.
            if (ctype_digit($base)) {
                $base = "product-{$base}";
            }
            $slug = $base;
            for ($n = 2; isset($taken[$slug]); $n++) {
                $slug = "{$base}-{$n}";
            }
            $taken[$slug] = true;
            DB::table('products')->where('id', $product->id)->update(['slug' => $slug]);
        }

        Schema::table('products', function (Blueprint $table) {
            $table->unique('slug');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_slugs');
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};
