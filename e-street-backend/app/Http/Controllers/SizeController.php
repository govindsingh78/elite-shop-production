<?php

namespace App\Http\Controllers;
use Illuminate\Http\Request;
use App\Models\Size;


class SizeController extends Controller
{
    /**
     * Display a listing of the sizes.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        $sizes = Size::all();
        return response()->json($sizes);
    }

    /**
     * Store a newly created size in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $size = Size::create($validatedData);
        return response()->json($size, 201);
    }

    /**
     * Display the specified size.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show($id)
    {
        $size = Size::find($id);

        if (!$size) {
            return response()->json(['message' => 'Size not found'], 404);
        }

        return response()->json($size);
    }

    /**
     * Update the specified size in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        $size = Size::find($id);

        if (!$size) {
            return response()->json(['message' => 'Size not found'], 404);
        }

        $validatedData = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $size->update($validatedData);
        return response()->json($size);
    }

    /**
     * Remove the specified size from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        $size = Size::find($id);

        if (!$size) {
            return response()->json(['message' => 'Size not found'], 404);
        }

        $size->delete();
        return response()->json(['message' => 'Size deleted successfully']);
    }
}