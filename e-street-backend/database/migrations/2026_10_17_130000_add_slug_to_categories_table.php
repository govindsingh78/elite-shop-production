<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('name');
        });

        $usedSlugs = [];
        DB::table('categories')->orderBy('id')->get(['id', 'name'])->each(function ($category) use (&$usedSlugs) {
            $baseSlug = Str::slug($category->name) ?: 'category';
            $slug = $baseSlug;
            $suffix = 2;
            while (isset($usedSlugs[$slug])) {
                $slug = $baseSlug . '-' . $suffix++;
            }
            $usedSlugs[$slug] = true;
            DB::table('categories')->where('id', $category->id)->update(['slug' => $slug]);
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->unique('slug');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};
