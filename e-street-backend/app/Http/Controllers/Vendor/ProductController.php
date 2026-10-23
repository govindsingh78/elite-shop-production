<?php

namespace App\Http\Controllers\Vendor;

use App\Http\Controllers\Admin\ProductController as AdminProductController;
use App\Models\Product;
use Illuminate\Http\Request;

/** The admin product tools, limited to the signed-in vendor's own listings. */
class ProductController extends AdminProductController
{
    /** What shoppers see. Changing any of these (or adding photos) sends an approved listing back for review; price and stock changes don't. */
    private const REVIEWED_FIELDS = ['title', 'description', 'short_description', 'category_id', 'brand_id'];

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

        // Seller listings stay off the storefront until an admin approves them. Saving a rejected listing resubmits it.
        if (!$product || $product->approval_status !== Product::APPROVED || $this->changesListing($request, $validated, $product)) {
            $validated['approval_status'] = Product::PENDING;
            $validated['review_note'] = null;
            $validated['reviewed_at'] = null;
        }

        return $validated;
    }

    protected function savedMessage(Product $product, bool $created): string
    {
        if ($product->approval_status !== Product::PENDING) {
            return parent::savedMessage($product, $created);
        }

        return $created
            ? 'Product submitted for review. It goes live once our team approves it.'
            : 'Changes saved and sent for review. The listing is hidden until it is approved.';
    }

    private function changesListing(Request $request, array $validated, Product $product): bool
    {
        if (!empty($request->input('gallery'))) {
            return true;
        }

        foreach (self::REVIEWED_FIELDS as $field) {
            if (array_key_exists($field, $validated) && (string) ($validated[$field] ?? '') !== (string) ($product->{$field} ?? '')) {
                return true;
            }
        }

        return false;
    }

    protected function rules(?Product $product = null): array
    {
        $rules = parent::rules($product);
        $rules['is_featured'] = ['sometimes'];

        return $rules;
    }
}
