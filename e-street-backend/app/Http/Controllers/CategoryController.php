<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Models\Category;
use App\Models\Product;
use App\Services\CategoryBanners;

class CategoryController extends Controller
{
    /** How many of its newest pieces each collection brings to the home page. */
    private const HOME_PRODUCTS = 8;

    /**
     * Public active categories used by storefront navigation: top-level categories, each with its active subcategories.
     */
    public function navigation()
    {
        $categories = Category::query()->where('status', 1)->orderBy('name')->get(['id', 'name', 'slug', 'parent_id']);
        $children = $categories->whereNotNull('parent_id')->groupBy('parent_id');
        $link = fn (Category $category) => ['id' => $category->id, 'name' => $category->name, 'slug' => $category->slug];

        return response()->json($categories->whereNull('parent_id')->values()->map(fn (Category $category) => [
            ...$link($category),
            'children' => ($children->get($category->id) ?? collect())->map($link)->values(),
        ]), 200);
    }

    /**
     * The home page's collections, all in one request: each main category with its banner, how many pieces it has
     * (its subcategories' included) and its newest few. Those with no pieces yet come back with an empty list.
     */
    public function home()
    {
        $categories = Category::query()->where('status', 1)->orderBy('name')->get(['id', 'name', 'slug', 'parent_id', 'banner']);
        $children = $categories->whereNotNull('parent_id')->groupBy('parent_id');

        return response()->json(['categories' => $categories->whereNull('parent_id')->values()->map(function (Category $category) use ($children) {
            $ids = [$category->id, ...($children->get($category->id)?->pluck('id')->all() ?? [])];
            $products = Product::query()->onStorefront()->whereIn('category_id', $ids);

            return [
                ...$category->only(['id', 'name', 'slug', 'banner']),
                'total' => (clone $products)->count(),
                'products' => $products->with(['category:id,name', 'brand:id,name', 'sizes'])->withRating()
                    ->orderByDesc('id')->limit(self::HOME_PRODUCTS)->get()->makeHidden('description'),
            ];
        })], 200);
    }

    /**
     * Display a listing of the resource: each top-level category followed by its subcategories.
     */
    public function index()
    {
        $categories = Category::query()->withCount(['children', 'products'])->orderBy('name')->get();
        $children = $categories->whereNotNull('parent_id')->groupBy('parent_id');
        $names = $categories->pluck('name', 'id');

        $ordered = $categories->whereNull('parent_id')
            ->flatMap(fn (Category $category) => [$category, ...($children->get($category->id) ?? collect())->all()])
            ->map(fn (Category $category) => [...$category->toArray(), 'parent_name' => $names[$category->parent_id] ?? null]);

        return response()->json($ordered->values(), 200);
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
        $validated = $request->validate($this->rules(), $this->messages());
        $category = DB::transaction(function () use ($validated) {
            $category = Category::create($validated);
            $this->applyBanner($category, $validated);

            return $category;
        });

        return response()->json(['message' => 'Category created successfully', 'data' => $category, 'status' => 201], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $category = Category::withCount('children')->find($id);

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

        $validated = $request->validate($this->rules($category), $this->messages());
        if (!empty($validated['parent_id']) && $category->children()->exists()) {
            throw ValidationException::withMessages([
                'parent_id' => 'This category has its own subcategories, so it can’t go inside another category.',
            ]);
        }

        DB::transaction(function () use ($category, $validated) {
            $category->update($validated);
            $this->applyBanner($category, $validated);
        });

        return response()->json(['message' => 'Category updated successfully', 'data' => $category], 200);
    }

    /**
     * Remove the specified resource from storage. Only empty categories can go: products are deleted along with their category.
     */
    public function destroy($id)
    {
        $category = Category::withCount(['children', 'products'])->find($id);

        if (!$category) {
            return response()->json(['message' => 'Category not found'], 404);
        }

        if ($category->children_count) {
            return response()->json(['message' => "Move or delete the subcategories in {$category->name} first."], 422);
        }
        if ($category->products_count) {
            $products = $category->products_count === 1 ? '1 product' : "{$category->products_count} products";
            return response()->json(['message' => "Move the {$products} in {$category->name} to another category first."], 422);
        }

        CategoryBanners::remove($category);
        $category->delete();

        return response()->json(['message' => 'Category deleted successfully'], 200);
    }

    private function applyBanner(Category $category, array $validated): void
    {
        if (!empty($validated['banner_temp_id'])) {
            CategoryBanners::attach($category, (int) $validated['banner_temp_id']);
        } elseif (!empty($validated['remove_banner'])) {
            CategoryBanners::remove($category);
        }
    }

    private function rules(?Category $category = null): array
    {
        // One level deep: a parent must itself be a top-level category, and never the category being edited.
        $parent = ['nullable', 'integer', Rule::exists('categories', 'id')->whereNull('parent_id')];
        if ($category) {
            $parent[] = Rule::notIn([$category->id]);
        }

        return [
            'name' => ['required', 'string', 'max:255'],
            'status' => ['sometimes', 'integer', 'in:0,1'],
            'parent_id' => $parent,
            // GST for the category's products (subcategories without their own use the parent's); see App\Services\Gst.
            'hsn_code' => ['sometimes', 'nullable', 'regex:/^\d{4,8}$/'],
            'gst_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:40'],
            'gst_rate_high' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:40', 'required_with:gst_threshold'],
            'gst_threshold' => ['sometimes', 'nullable', 'numeric', 'min:1', 'required_with:gst_rate_high'],
            // A photo already sent to /temp-images, or a request to take the banner off.
            'banner_temp_id' => ['sometimes', 'nullable', 'integer', 'exists:temp_images,id'],
            'remove_banner' => ['sometimes', 'boolean'],
        ];
    }

    private function messages(): array
    {
        return [
            'parent_id.exists' => 'Choose a top-level category as the parent.',
            'parent_id.not_in' => 'A category can’t be its own parent.',
            'hsn_code.regex' => 'An HSN code has 4 to 8 digits, like 6205.',
            'gst_rate_high.required_with' => 'Add the higher rate that applies above the price.',
            'gst_threshold.required_with' => 'Add the price above which the higher rate applies.',
            'banner_temp_id.exists' => 'That photo couldn’t be found. Please upload it again.',
        ];
    }
}
