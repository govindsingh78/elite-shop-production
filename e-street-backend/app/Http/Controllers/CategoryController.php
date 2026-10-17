<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Category;

class CategoryController extends Controller
{
    /**
     * Public active categories used by storefront navigation.
     */
    public function navigation()
    {
        return response()->json(Category::query()
            ->where('status', 1)
            ->orderBy('name')
            ->get(['id', 'name', 'slug'])
            ->map(fn (Category $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
            ]), 200);
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return response()->json(Category::all(), 200);
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
            'name' => 'required|string|max:255'
        ]);
    
        $category = Category::create($request->all());
    
        return response()->json(['message' => 'Category created successfully', 'data' => $category, 'status' => 201], 201);
    }
    

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $category = Category::find($id);
        
        if (!$category) {
            return response()->json(['message' => 'Category not found'], 404);
        }
    
        return response()->json($category, 200);
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
    $category = Category::find($id);

    if (!$category) {
        return response()->json(['message' => 'Category not found'], 404);
    }

    $request->validate([
        'name' => 'required|string|max:255',
        'status' => 'integer',
    ]);

    $category->update($request->all());

    return response()->json(['message' => 'Category updated successfully'], 200);
}


    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $category = Category::find($id);
    
        if (!$category) {
            return response()->json(['message' => 'Category not found'], 404);
        }
    
        $category->delete();
    
        return response()->json(['message' => 'Category deleted successfully'], 200);
    }
    
}
