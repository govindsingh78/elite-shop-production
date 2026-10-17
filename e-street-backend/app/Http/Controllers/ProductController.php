<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Category;
use Illuminate\Http\Request;
use Intervention\Image\Facades\Image;
use App\Models\TempImage;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    /** Public active product feed for storefront pages. */
    public function storefrontIndex(Request $request)
    {
        $request->validate([
            'min_price' => ['nullable', 'numeric', 'min:0'],
            'max_price' => ['nullable', 'numeric', 'min:0'],
            'brand_id' => ['nullable', 'integer', 'min:1'],
        ]);

        if ($request->filled('min_price') && $request->filled('max_price')
            && (float) $request->input('min_price') > (float) $request->input('max_price')) {
            return response()->json([
                'message' => 'Minimum price cannot be higher than maximum price.',
                'errors' => ['min_price' => ['Minimum price cannot be higher than maximum price.']],
            ], 422);
        }

        $categoryId = $request->integer('category_id');
        $categorySlug = $request->input('category_slug');
        $brandId = $request->integer('brand_id');
        $search = trim((string) $request->input('search', ''));
        $minPrice = $request->input('min_price');
        $maxPrice = $request->input('max_price');
        $category = $categorySlug
            ? Category::query()->where('status', 1)->where('slug', $categorySlug)->first()
            : null;

        if ($categorySlug && !$category) {
            return response()->json(['message' => 'Category not found.'], 404);
        }

        $filteredProducts = Product::query()
            ->with(['category:id,name', 'brand:id,name'])
            ->where('status', 1)
            ->when($category, fn ($query) => $query->where('category_id', $category->id))
            ->when(!$category && $categoryId, fn ($query) => $query->where('category_id', $categoryId))
            ->when($brandId, fn ($query) => $query->where('brand_id', $brandId))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('title', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('short_description', 'like', "%{$search}%");
                });
            })
            ->when($request->input('featured') === 'yes', fn ($query) => $query->where('is_featured', 'yes'));

        $priceRange = (clone $filteredProducts)
            ->selectRaw('MIN(price) as min_price, MAX(price) as max_price')
            ->first();

        $products = (clone $filteredProducts)
            ->when($minPrice !== null && $minPrice !== '', fn ($query) => $query->where('price', '>=', (float) $minPrice))
            ->when($maxPrice !== null && $maxPrice !== '', fn ($query) => $query->where('price', '<=', (float) $maxPrice))
            ->orderByDesc('id')
            ->paginate(12);

        $brands = \App\Models\Brand::query()
            ->where('status', 1)
            ->whereIn('id', Product::query()->where('status', 1)->select('brand_id')->distinct())
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json([
            'products' => $products,
            'category' => $category ? ['id' => $category->id, 'name' => $category->name, 'slug' => $category->slug] : null,
            'brands' => $brands,
            'price_range' => [
                'min' => $priceRange?->min_price !== null ? (float) $priceRange->min_price : 0,
                'max' => $priceRange?->max_price !== null ? (float) $priceRange->max_price : 0,
            ],
            'filters' => [
                'brand_id' => $brandId ?: null,
                'search' => $search ?: null,
                'min_price' => $minPrice !== null ? (float) $minPrice : null,
                'max_price' => $maxPrice !== null ? (float) $maxPrice : null,
            ],
        ], 200);
    }

    /** Public product details for the storefront. */
    public function storefrontShow(string $id)
    {
        $product = Product::query()
            ->where('status', 1)
            ->with(['category:id,name,slug', 'brand:id,name', 'images'])
            ->find($id);

        if (!$product) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        return response()->json(['data' => $product], 200);
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return response()->json([
            'status' => true,
            'products' => Product::all(),
        ], 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'title' => 'required|string|max:255',
            'price' => 'required|numeric',
            'description' => 'nullable|string',
            'status' => 'required|boolean',
            'compare_price' => 'nullable|numeric',
            'category_id' => 'required|exists:categories,id',
            'brand_id' => 'required|exists:brands,id',
            'sku' => 'required|string|max:255|unique:products,sku',
            'short_description' => 'nullable|string',
            'is_featured' => 'nullable|string|in:yes,no',
            'qty' => 'nullable|integer',
            'barcode' => 'nullable|string|max:255',
        ]);

        // $product = Product::create($validatedData);
        // Store the new product
        $product = new Product();
        $product->title = $request->title;
        $product->price = $request->price;
        $product->compare_price = $request->compare_price;
        $product->category_id = $request->category_id;
        $product->brand_id = $request->brand_id;
        $product->sku = $request->sku;
        $product->description = $request->description;
        $product->short_description = $request->short_description;
        $product->status = $request->status;
        $product->is_featured = $request->is_featured;
        $product->qty = $request->qty;
        $product->barcode = $request->barcode;
        $product->save();

        // Save the product images
        if (!empty($request->gallery)) {
            $originalPath = public_path('uploads/temp/original');
            $largeProductPath = public_path('uploads/products/large');
            $smallProductPath = public_path('uploads/products/small');
            foreach ($request->gallery as $key => $tempImageId) {
                $tempImage = TempImage::find($tempImageId);
                // dump($tempImage->name);
                
                // Large Thumbnail
                $extArray = explode('.', $tempImage->name);
                $ext = end($extArray);
                $imageName = $product->id . '-' . time() . '-' . $tempImage->name . '.' . $ext;

                $largeImage = Image::make($originalPath . '/' . $tempImage->name)
                ->resize(1200, 750, function ($constraint) {
                $constraint->aspectRatio();
                });
                $largeImage->save($largeProductPath . '/' . $imageName);

                // Small Thumbnail
                $smallImage = Image::make($originalPath . '/' . $tempImage->name)
                ->resize(400, 460, function ($constraint) {
                $constraint->aspectRatio();
                });
                $smallImage->save($smallProductPath . '/' . $imageName);

                if ($key == 0) {
                    $product->image = $imageName;
                    $product->save();
                }
                
            }

            // dd($request->gallery);
        }


        return response()->json([
            'status' => true,
            'message' => 'Product created successfully!',
            'product' => $product,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return response()->json([
                'status' => false,
                'message' => 'Product not found',
            ], 404);
        }

        return response()->json([
            'status' => true,
            'product' => $product,
        ], 200);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return response()->json([
                'status' => false,
                'message' => 'Product not found',
            ], 404);
        }

        $validatedData = $request->validate([
            'title' => 'required|string|max:255',
            'price' => 'required|numeric',
            'description' => 'nullable|string',
            'status' => 'required|boolean',
            'compare_price' => 'nullable|numeric',
            'category_id' => 'required|exists:categories,id',
            'brand_id' => 'required|exists:brands,id',
            'sku' => 'required|string|max:255|unique:products,sku,' . $id,
            'short_description' => 'nullable|string',
            'is_featured' => 'nullable|string|in:yes,no',
            'qty' => 'nullable|integer',
            'barcode' => 'nullable|string|max:255',
        ]);

        $product->title = $request->title;
        $product->price = $request->price;
        $product->compare_price = $request->compare_price;
        $product->category_id = $request->category_id;
        $product->brand_id = $request->brand_id;
        $product->sku = $request->sku;
        $product->description = $request->description;
        $product->short_description = $request->short_description;
        $product->status = $request->status;
        $product->is_featured = $request->is_featured;
        $product->qty = $request->qty;
        $product->barcode = $request->barcode;
        $product->save();

        return response()->json([
            'status' => true,
            'message' => 'Product updated successfully!',
            'product' => $product,
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return response()->json([
                'status' => false,
                'message' => 'Product not found',
            ], 404);
        }

        $product->delete();

        return response()->json([
            'status' => true,
            'message' => 'Product deleted successfully!',
        ], 200);
    }
}