<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\TempImage;
use Illuminate\Support\Facades\File;
use Intervention\Image\Facades\Image;

class TempImageController extends Controller
{
    public function store(Request $request)
    {   
        // dump(\Log::info($request->all()));
        // dump($request->all());
        // dd("here");
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:40960',
        ]);

        $image = $request->file('image');
        $originalPath = public_path('uploads/temp/original');
        $thumbPath = public_path('uploads/temp/thumb');

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
            ->resize(450, 450, function ($constraint) {
                $constraint->aspectRatio();
            });
        $thumbImage->save($thumbPath . '/' . $thumbName);

        // Save image details in the database
        $tempImage = new TempImage();
        $tempImage->name = $originalName;
        $tempImage->original_path = 'uploads/temp/original/' . $originalName;
        $tempImage->thumb_path = 'uploads/temp/thumb/' . $thumbName;
        $tempImage->save();

        return response()->json([
            'status' => true,
            'message' => 'Image uploaded successfully!',
            'data' => $tempImage,
        ], 201);
    }
}
