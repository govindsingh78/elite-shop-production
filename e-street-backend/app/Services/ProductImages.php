<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Intervention\Image\Facades\Image;
use RuntimeException;
use Throwable;

/** Product photos: uploaded to /temp-images first, then copied into the product's gallery. */
class ProductImages
{
    /** The longest side of each copy: "large" for the product page (with zoom), "small" for cards and lists. */
    public const SIDES = ['large' => 1600, 'small' => 600];

    private const QUALITY = 82;

    /** Bigger photos are left alone: decoding one would need more memory than the server can spare. */
    private const MAX_PIXELS = 40_000_000;

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

            if (!self::saveResized($source, $largePath, self::SIDES['large']) || !self::saveResized($source, $smallPath, self::SIDES['small'])) {
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

    /**
     * Saves `$source` at `$target` no bigger than `$maxSide` pixels on its longest side, turned the right way up.
     * Falls back to a plain copy when the photo can't be resized (a GIF, or too big to decode).
     */
    public static function saveResized(string $source, string $target, int $maxSide): bool
    {
        try {
            $info = @getimagesize($source);
            if ($info && self::canResize($info)) {
                $image = self::resized($source, $info[2], $maxSide);
                $image->save($target, self::QUALITY);
                $image->destroy();

                return true;
            }
        } catch (Throwable) {
            // Fall through to the plain copy.
        }

        return File::copy($source, $target);
    }

    /**
     * Shrinks up to `$limit` existing product photos that are bigger than shoppers need, in place. Each one is
     * done in a single pass, so calling this until `remaining` is 0 (or nothing more gets optimised) finishes.
     *
     * @return array{optimised: int, freed: int, remaining: int, skipped: int}
     */
    public static function optimiseExisting(int $limit = 20): array
    {
        @ini_set('memory_limit', '512M');
        $todo = [];
        $skipped = 0;
        foreach (self::SIDES as $size => $maxSide) {
            foreach (glob(public_path("uploads/products/{$size}/*")) ?: [] as $path) {
                $info = @getimagesize($path);
                if (!$info || max($info[0], $info[1]) <= $maxSide) {
                    continue;
                }
                if (self::canResize($info)) {
                    $todo[] = [$path, $info[2], $maxSide];
                } else {
                    $skipped++;
                }
            }
        }

        $optimised = 0;
        $freed = 0;
        foreach (array_slice($todo, 0, $limit) as [$path, $type, $maxSide]) {
            $before = filesize($path);
            $temporary = $path . '.optimising';
            try {
                $image = self::resized($path, $type, $maxSide);
                $image->save($temporary, self::QUALITY, pathinfo($path, PATHINFO_EXTENSION));
                $image->destroy();
                if (!@rename($temporary, $path)) {
                    throw new RuntimeException('Could not replace the photo.');
                }
                clearstatcache(true, $path);
                $freed += $before - filesize($path);
                $optimised++;
            } catch (Throwable) {
                $skipped++;
            } finally {
                if (is_file($temporary)) {
                    @unlink($temporary);
                }
            }
        }

        return ['optimised' => $optimised, 'freed' => max(0, $freed), 'remaining' => count($todo) - $optimised, 'skipped' => $skipped];
    }

    /** Whether a photo (from getimagesize) can be shrunk safely. */
    private static function canResize(array $info): bool
    {
        return in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)
            && $info[0] * $info[1] <= self::MAX_PIXELS
            // Phone photos are often stored sideways with a note to rotate them, which needs PHP's exif to read.
            && ($info[2] !== IMAGETYPE_JPEG || function_exists('exif_read_data'));
    }

    private static function resized(string $path, int $type, int $maxSide)
    {
        $image = Image::make($path);
        if ($type === IMAGETYPE_JPEG) {
            $image->orientate();
        }

        return $image->resize($maxSide, $maxSide, function ($constraint) {
            $constraint->aspectRatio();
            $constraint->upsize();
        });
    }
}
