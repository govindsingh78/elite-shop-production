<?php

namespace App\Http\Controllers\Vendor;

use App\Http\Controllers\Admin\ProductController as AdminProductController;
use App\Models\Product;
use Illuminate\Http\Request;

/** The admin product tools, limited to the signed-in vendor's own listings. */
class ProductController extends AdminProductController
{
    protected function productQuery(Request $request)
    {
        return Product::query()->where('vendor_id', $request->user()->id);
    }

    protected function authorizeProduct(Request $request, Product $product): void
    {
        // 404 rather than 403, so vendors cannot probe which product ids exist.
        abort_unless((int) $product->vendor_id === (int) $request->user()->id, 404);
    }

    protected function prepareAttributes(Request $request, array $validated, ?Product $product): array
    {
        $validated['vendor_id'] = $request->user()->id;
        // Featured placement on the storefront is a store decision, not a vendor one.
        $validated['is_featured'] = $product?->is_featured ?? 'no';

        return $validated;
    }

    protected function rules(?Product $product = null): array
    {
        $rules = parent::rules($product);
        $rules['is_featured'] = ['sometimes'];

        return $rules;
    }
}
