<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\TempImage;
use Illuminate\Support\Facades\File;
use Intervention\Image\Facades\Image;

class ImageController extends Controller
{
    public function uploadTempImage(Request $request)
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        $image = $request->file('image');
        $originalPath = public_path('temp/original');
        $thumbPath = public_path('temp/thumb');

        // Ensure directories exist
        if (!File::exists($originalPath)) {
            File::makeDirectory($originalPath, 0755, true);
        }
        if (!File::exists($thumbPath)) {
            File::makeDirectory($thumbPath, 0755, true);
        }

        // Save original image
        $originalName = time() . '_' . $image->getClientOriginalName();
        $image->move($originalPath, $originalName);

        // Save thumbnail image
        $thumbName = 'thumb_' . $originalName;
        $thumbImage = Image::make($originalPath . '/' . $originalName)
            ->resize(150, 150, function ($constraint) {
                $constraint->aspectRatio();
            });
        $thumbImage->save($thumbPath . '/' . $thumbName);

        // Save image details in the database
        $tempImage = new TempImage();
        $tempImage->name = $image->getClientOriginalName(); // Save original name
        $tempImage->original_path = 'temp/original/' . $originalName;
        $tempImage->thumb_path = 'temp/thumb/' . $thumbName;
        $tempImage->save();

        return response()->json([
            'status' => true,
            'message' => 'Image uploaded successfully!',
            'data' => $tempImage,
        ], 201);
    }
}
