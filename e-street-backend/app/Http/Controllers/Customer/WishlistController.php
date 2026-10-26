<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\WishlistItem;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** The signed-in customer's wishlist. Items come back shaped like storefront products so the apps can show them as product cards. */
class WishlistController extends Controller
{
    private const LIMIT = 200;

    public function index(Request $request)
    {
        return response()->json(['data' => $this->items($request)]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['product_id' => ['required', 'integer']]);
        $product = Product::query()->onStorefront()->find($validated['product_id']);
        abort_unless($product, 404, 'This product is no longer available.');

        $saved = $this->savedIds($request);
        if (!in_array($product->id, $saved, true) && count($saved) >= self::LIMIT) {
            throw ValidationException::withMessages(['product_id' => 'Your wishlist is full. Remove a few pieces to save new ones.']);
        }

        $item = WishlistItem::firstOrCreate(['user_id' => $request->user()->id, 'product_id' => $product->id]);

        return response()->json(['message' => 'Saved to your wishlist.', 'data' => $this->present($item->load($this->relations()))], 201);
    }

    public function destroy(Request $request, int $product)
    {
        WishlistItem::query()->where('user_id', $request->user()->id)->where('product_id', $product)->delete();

        return response()->json(['message' => 'Removed from your wishlist.']);
    }

    /** Adds pieces saved before signing in (on this device) to the account, then returns the whole list. */
    public function sync(Request $request)
    {
        $validated = $request->validate([
            'product_ids' => ['present', 'array', 'max:' . self::LIMIT],
            'product_ids.*' => ['integer'],
        ]);

        $saved = $this->savedIds($request);
        $room = max(0, self::LIMIT - count($saved));
        $newIds = Product::query()->onStorefront()
            ->whereIn('id', array_diff(array_unique($validated['product_ids']), $saved))
            ->limit($room)
            ->pluck('id');

        foreach ($newIds as $productId) {
            WishlistItem::firstOrCreate(['user_id' => $request->user()->id, 'product_id' => $productId]);
        }

        return response()->json(['data' => $this->items($request)]);
    }

    private function savedIds(Request $request): array
    {
        return WishlistItem::query()->where('user_id', $request->user()->id)->pluck('product_id')->all();
    }

    private function relations(): array
    {
        return ['product.brand:id,name', 'product.category:id,name,slug', 'product.sizes'];
    }

    private function items(Request $request): array
    {
        return WishlistItem::query()
            ->with($this->relations())
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get()
            ->filter(fn (WishlistItem $item) => $item->product)
            ->map(fn (WishlistItem $item) => $this->present($item))
            ->values()
            ->all();
    }

    private function present(WishlistItem $item): array
    {
        $product = $item->product;

        return [
            'id' => $product->id,
            'title' => $product->title,
            'slug' => $product->slug,
            'price' => $product->price,
            'compare_price' => $product->compare_price,
            'image' => $product->image,
            'sku' => $product->sku,
            'qty' => $product->qty,
            // A product sold in sizes moves to the bag from its page, where the shopper picks one.
            'sizes' => $product->sizes,
            'brand' => $product->brand ? ['name' => $product->brand->name] : null,
            'category' => $product->category ? ['name' => $product->category->name, 'slug' => $product->category->slug] : null,
            // Hidden or unapproved since it was saved: shown as "no longer available" rather than silently dropped.
            'available' => $product->isOnStorefront(),
            'saved_at' => $item->created_at,
        ];
    }
}
