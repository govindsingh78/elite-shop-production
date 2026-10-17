<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $products = Product::query()
            ->with(['category:id,name', 'brand:id,name'])
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->trim()->toString();
                $query->where(function ($query) use ($search) {
                    $query->where('title', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('barcode', 'like', "%{$search}%");
                });
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->input('status')))
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json($products, 200);
    }

    public function options()
    {
        return response()->json([
            'categories' => Category::query()->where('status', 1)->orderBy('name')->get(['id', 'name']),
            'brands' => Brand::query()->where('status', 1)->orderBy('name')->get(['id', 'name']),
        ], 200);
    }

    public function show(Product $product)
    {
        return response()->json($product->load(['category:id,name', 'brand:id,name', 'images']), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate($this->rules());

        $galleryIds = $validated['gallery'] ?? [];
        unset($validated['gallery']);
        // The existing products schema stores barcode as a non-null string.
        $validated['barcode'] ??= '';

        $product = DB::transaction(function () use ($validated, $galleryIds) {
            $product = Product::create($validated);
            $this->attachGallery($product, $galleryIds);
            return $product;
        });

        return response()->json([
            'message' => 'Product created successfully.',
            'data' => $product->load(['category:id,name', 'brand:id,name', 'images']),
        ], 201);
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate($this->rules($product));
        $galleryIds = $validated['gallery'] ?? [];
        unset($validated['gallery']);

        DB::transaction(function () use ($product, $validated, $galleryIds) {
            $product->update($validated);
            if ($galleryIds) {
                $this->attachGallery($product, $galleryIds);
            }
        });

        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => $product->refresh()->load(['category:id,name', 'brand:id,name', 'images']),
        ], 200);
    }

    public function destroy(Product $product)
    {
        DB::transaction(function () use ($product) {
            $product->images()->delete();
            $product->delete();
        });

        return response()->json(['message' => 'Product deleted successfully.'], 200);
    }

    private function rules(?Product $product = null): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
            'compare_price' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string'],
            'short_description' => ['nullable', 'string'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'brand_id' => ['required', 'integer', 'exists:brands,id'],
            'sku' => ['required', 'string', 'max:255', Rule::unique('products', 'sku')->ignore($product?->id)],
            'barcode' => ['nullable', 'string', 'max:255'],
            'qty' => ['nullable', 'integer', 'min:0'],
            'status' => ['required', 'boolean'],
            'is_featured' => ['required', Rule::in(['yes', 'no'])],
            'gallery' => ['sometimes', 'array'],
            'gallery.*' => ['integer', 'exists:temp_images,id'],
        ];
    }

    private function attachGallery(Product $product, array $galleryIds): void
    {
        foreach ($galleryIds as $tempImageId) {
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
            if (!$product->image) {
                $product->image = $imageName;
                $product->save();
            }
        }
    }
}
