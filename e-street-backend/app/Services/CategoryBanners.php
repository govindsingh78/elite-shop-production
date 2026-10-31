<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Category banners: uploaded to /temp-images first, then copied here. deploy.sh keeps this folder writable by PHP. */
class CategoryBanners
{
    public const FOLDER = 'uploads/categories';

    /** The longest side: about the widest a banner is ever shown, on a large screen. */
    private const MAX_SIDE = 2000;

    /** Makes an uploaded temp image the category's banner, in place of any earlier one. */
    public static function attach(Category $category, int $tempImageId): void
    {
        $tempName = (string) DB::table('temp_images')->where('id', $tempImageId)->value('name');
        $source = public_path('uploads/temp/original/' . basename($tempName));
        $banner = $category->id . '-' . Str::random(12) . '.' . pathinfo($source, PATHINFO_EXTENSION);
        $target = public_path(self::FOLDER . '/' . $banner);
        File::ensureDirectoryExists(dirname($target));

        if ($tempName === '' || !File::isFile($source) || !ProductImages::saveResized($source, $target, self::MAX_SIDE)) {
            throw ValidationException::withMessages(['banner_temp_id' => 'That photo couldn’t be saved. Please upload it again.']);
        }

        self::remove($category);
        $category->forceFill(['banner' => $banner])->save();
    }

    public static function remove(Category $category): void
    {
        if ($category->banner) {
            File::delete(public_path(self::FOLDER . '/' . basename($category->banner)));
            $category->forceFill(['banner' => null])->save();
        }
    }
}
