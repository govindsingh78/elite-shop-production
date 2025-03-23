<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Brand;

class BrandController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return response()->json(Brand::all(), 200);
    }
    
    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
{
    $request->validate([
        'name' => 'required|string|max:255',
        'status' => 'integer',
    ]);

    $brand = Brand::create($request->all());

    return response()->json(['message' => 'Brand created successfully', 'data' => $brand, 'status' => 201], 201);
}


    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $brand = Brand::find($id);
        
        if (!$brand) {
            return response()->json(['message' => 'Brand not found'], 404);
        }
    
        return response()->json($brand, 200);
    }
    
    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $brand = Brand::find($id);
    
        if (!$brand) {
            return response()->json(['message' => 'Brand not found'], 404);
        }
    
        $request->validate([
            'name' => 'required|string|max:255',
            'status' => 'integer',
        ]);
    
        $brand->update($request->all());
    
        return response()->json(['message' => 'Brand updated successfully'], 200);
    }
    
    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
{
    $brand = Brand::find($id);

    if (!$brand) {
        return response()->json(['message' => 'Brand not found'], 404);
    }

    $brand->delete();

    return response()->json(['message' => 'Brand deleted successfully'], 200);
}

}
