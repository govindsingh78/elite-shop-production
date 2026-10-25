<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Services\ProductImages;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $products = $this->productQuery($request)
            ->with(['category:id,name,parent_id', 'category.parent:id,name', 'brand:id,name', 'vendor:id,name'])
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->trim()->toString();
                $query->where(function ($query) use ($search) {
                    $query->where('title', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('barcode', 'like', "%{$search}%");
                });
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->input('status')))
            ->when(in_array($request->input('approval'), Product::APPROVAL_STATUSES, true), fn ($query) => $query->where('approval_status', $request->input('approval')))
            ->orderByDesc('id')
            ->paginate(20);

        // Totals for the review filters, across everything this user can manage.
        $approvalCounts = $this->productQuery($request)
            ->selectRaw('approval_status, COUNT(*) as total')
            ->groupBy('approval_status')
            ->pluck('total', 'approval_status');

        return response()->json([
            ...$products->toArray(),
            'approval_counts' => [
                Product::PENDING => (int) ($approvalCounts[Product::PENDING] ?? 0),
                Product::REJECTED => (int) ($approvalCounts[Product::REJECTED] ?? 0),
            ],
        ], 200);
    }

    /** Approve a seller's listing so it appears in the store, or send it back with the reason. */
    public function review(Request $request, Product $product)
    {
        $validated = $request->validate([
            'decision' => ['required', Rule::in([Product::APPROVED, Product::REJECTED])],
            'note' => ['required_if:decision,' . Product::REJECTED, 'nullable', 'string', 'max:500'],
        ], ['note.required_if' => 'Tell the seller what needs to change.']);

        $product->update([
            'approval_status' => $validated['decision'],
            'review_note' => $validated['note'] ?? null,
            'reviewed_at' => now(),
        ]);

        $message = match (true) {
            $validated['decision'] === Product::REJECTED => 'Product rejected. The seller will see your note.',
            (int) $product->status === 1 => 'Product approved. It is now live in the store.',
            default => 'Product approved. It goes live once it is switched to Active.',
        };

        return response()->json([
            'message' => $message,
            'data' => $product->refresh()->load(['category:id,name', 'brand:id,name', 'vendor:id,name', 'images']),
        ], 200);
    }

    public function options()
    {
        $categories = Category::query()->where('status', 1)->orderBy('name')->get(['id', 'name', 'parent_id']);
        $children = $categories->whereNotNull('parent_id')->groupBy('parent_id');

        return response()->json([
            // Each category followed by its subcategories, labelled "Kids › Toys" for the product form.
            'categories' => $categories->whereNull('parent_id')->flatMap(fn (Category $parent) => [
                ['id' => $parent->id, 'name' => $parent->name, 'label' => $parent->name, 'parent_id' => null],
                ...($children->get($parent->id) ?? collect())->map(fn (Category $child) => [
                    'id' => $child->id, 'name' => $child->name, 'label' => "{$parent->name} › {$child->name}", 'parent_id' => $parent->id,
                ])->all(),
            ])->values(),
            'brands' => Brand::query()->where('status', 1)->orderBy('name')->get(['id', 'name']),
        ], 200);
    }

    public function show(Request $request, Product $product)
    {
        $this->authorizeProduct($request, $product);

        return response()->json($product->load(['category:id,name', 'brand:id,name', 'vendor:id,name', 'images']), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate($this->rules());

        $galleryIds = $validated['gallery'] ?? [];
        unset($validated['gallery']);
        // The existing products schema stores barcode as a non-null string.
        $validated['barcode'] ??= '';
        $validated = $this->prepareAttributes($request, $validated, null);

        $product = DB::transaction(function () use ($validated, $galleryIds) {
            $product = Product::create($validated);
            $this->attachGallery($product, $galleryIds);
            return $product;
        });

        return response()->json([
            'message' => $this->savedMessage($product, true),
            'data' => $product->refresh()->load(['category:id,name', 'brand:id,name', 'images']),
        ], 201);
    }

    public function update(Request $request, Product $product)
    {
        $this->authorizeProduct($request, $product);
        $validated = $request->validate($this->rules($product));
        $galleryIds = $validated['gallery'] ?? [];
        unset($validated['gallery']);
        if (array_key_exists('barcode', $validated)) {
            $validated['barcode'] ??= '';
        }
        $validated = $this->prepareAttributes($request, $validated, $product);

        DB::transaction(function () use ($product, $validated, $galleryIds) {
            $product->update($validated);
            if ($galleryIds) {
                $this->attachGallery($product, $galleryIds);
            }
        });

        $product->refresh();

        return response()->json([
            'message' => $this->savedMessage($product, false),
            'data' => $product->load(['category:id,name', 'brand:id,name', 'images']),
        ], 200);
    }

    public function destroy(Request $request, Product $product)
    {
        $this->authorizeProduct($request, $product);

        DB::transaction(function () use ($product) {
            $product->images()->delete();
            $product->delete();
        });

        return response()->json(['message' => 'Product deleted successfully.'], 200);
    }

    /** Products this user may manage. Admins see the whole catalog. */
    protected function productQuery(Request $request)
    {
        return Product::query();
    }

    /** Stops a user from touching a product outside productQuery(). Admins may manage any product. */
    protected function authorizeProduct(Request $request, Product $product): void
    {
    }

    /** Final adjustments to validated attributes before saving. */
    protected function prepareAttributes(Request $request, array $validated, ?Product $product): array
    {
        // The store's own listings need no review; editing a seller's listing keeps its review state.
        if (!$product) {
            $validated['approval_status'] = Product::APPROVED;
        }

        return $validated;
    }

    protected function savedMessage(Product $product, bool $created): string
    {
        return $created ? 'Product created successfully.' : 'Product updated successfully.';
    }

    protected function rules(?Product $product = null): array
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
        ProductImages::attachTempImages($product, $galleryIds);
    }
}
