<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/** Product photos: uploaded to /temp-images first, then copied into the product's gallery. */
class ProductImages
{
    /**
     * Adds uploaded temp images to the product's gallery, in order. The first one becomes the main
     * image if the product has none. Returns how many were attached.
     *
     * @param  array<int>  $tempImageIds
     */
    public static function attachTempImages(Product $product, array $tempImageIds): int
    {
        $attached = 0;
        foreach ($tempImageIds as $tempImageId) {
            $tempImage = DB::table('temp_images')->where('id', $tempImageId)->first();
            if (!$tempImage) {
                continue;
            }

            $source = public_path('uploads/temp/original/' . basename($tempImage->name));
            if (!File::isFile($source)) {
                continue;
            }

            $extension = pathinfo($source, PATHINFO_EXTENSION);
            $imageName = $product->id . '-' . uniqid('', true) . '.' . $extension;
            $largePath = public_path('uploads/products/large/' . $imageName);
            $smallPath = public_path('uploads/products/small/' . $imageName);
            File::ensureDirectoryExists(dirname($largePath));
            File::ensureDirectoryExists(dirname($smallPath));

            if (!File::copy($source, $largePath) || !File::copy($source, $smallPath)) {
                continue;
            }

            $product->images()->create(['image' => $imageName]);
            $attached++;
            if (!$product->image) {
                $product->image = $imageName;
                $product->save();
            }
        }

        return $attached;
    }
}
