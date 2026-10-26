<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Product reviews: public listing, the customer's own review, and admin moderation. */
class ReviewController extends Controller
{
    /** Published reviews for a product, newest first, with the rating summary. */
    public function index(Request $request, int $product)
    {
        $product = Product::query()->onStorefront()->findOrFail($product);
        $reviews = $product->reviews()->published()->with('user:id,name')->orderByDesc('id')->paginate(10);

        return response()->json([
            'summary' => $this->summary($product),
            'reviews' => $reviews->through(fn (ProductReview $review) => $review->toPublicArray()),
        ]);
    }

    /** The signed-in customer's review of a product, and whether they may write one. */
    public function mine(Request $request, int $product)
    {
        $product = Product::query()->findOrFail($product);
        $review = $product->reviews()->where('user_id', $request->user()->id)->first();
        $canReview = $review !== null || $this->deliveredOrderId($request->user(), $product) !== null;

        return response()->json([
            'review' => $review ? [...$review->toPublicArray(), 'status' => $review->status] : null,
            'can_review' => $canReview,
            'reason' => $canReview ? null : 'You can review this piece once an order with it has been delivered to you.',
        ]);
    }

    /** Creates or updates the customer's review. Only customers who received the product may review it. */
    public function save(Request $request, int $product)
    {
        $product = Product::query()->findOrFail($product);
        $validated = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'title' => ['nullable', 'string', 'max:120'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ], ['rating.required' => 'Choose a star rating.', 'rating.between' => 'Choose a star rating.']);

        $user = $request->user();
        $review = $product->reviews()->where('user_id', $user->id)->first();
        $orderId = $review?->order_id ?? $this->deliveredOrderId($user, $product);
        if (!$review && !$orderId) {
            throw ValidationException::withMessages(['rating' => 'You can review this piece once an order with it has been delivered to you.']);
        }

        $attributes = [
            'rating' => $validated['rating'],
            'title' => trim((string) ($validated['title'] ?? '')) ?: null,
            'comment' => trim((string) ($validated['comment'] ?? '')) ?: null,
        ];
        // Editing keeps the store's decision: a hidden review stays hidden.
        $review = $review
            ? tap($review)->update($attributes)
            : ProductReview::create([...$attributes, 'product_id' => $product->id, 'user_id' => $user->id, 'order_id' => $orderId]);

        return response()->json([
            'message' => $review->wasRecentlyCreated ? 'Thank you! Your review is live.' : 'Your review has been updated.',
            'review' => [...$review->load('user:id,name')->toPublicArray(), 'status' => $review->status],
            'summary' => $this->summary($product),
        ], $review->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request, int $product)
    {
        ProductReview::query()->where('product_id', $product)->where('user_id', $request->user()->id)->delete();

        return response()->json(['message' => 'Your review has been removed.']);
    }

    /** Admin: every review, newest first, filterable by status, rating and text. */
    public function adminIndex(Request $request)
    {
        $request->validate([
            'status' => ['nullable', Rule::in([ProductReview::PUBLISHED, ProductReview::HIDDEN])],
            'rating' => ['nullable', 'integer', 'between:1,5'],
        ]);

        $reviews = ProductReview::query()
            ->with(['product:id,title,slug', 'user:id,name,email'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->input('status')))
            ->when($request->filled('rating'), fn ($query) => $query->where('rating', $request->integer('rating')))
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->trim()->toString();
                $query->where(fn ($query) => $query->where('title', 'like', "%{$search}%")
                    ->orWhere('comment', 'like', "%{$search}%")
                    ->orWhereHas('product', fn ($product) => $product->where('title', 'like', "%{$search}%")));
            })
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json($reviews);
    }

    /** Admin: publish or hide a review. */
    public function moderate(Request $request, ProductReview $review)
    {
        $validated = $request->validate(['status' => ['required', Rule::in([ProductReview::PUBLISHED, ProductReview::HIDDEN])]]);
        $review->update($validated);

        return response()->json([
            'message' => $review->status === ProductReview::HIDDEN ? 'Review hidden from the store.' : 'Review published.',
            'data' => $review->load(['product:id,title,slug', 'user:id,name,email']),
        ]);
    }

    public function adminDestroy(ProductReview $review)
    {
        $review->delete();

        return response()->json(['message' => 'Review deleted.']);
    }

    private function summary(Product $product): array
    {
        $counts = $product->reviews()->published()->selectRaw('rating, COUNT(*) as total')->groupBy('rating')->pluck('total', 'rating');
        $count = (int) $counts->sum();
        $average = $count ? round($counts->reduce(fn ($sum, $total, $rating) => $sum + $rating * $total, 0) / $count, 1) : 0;

        return [
            'average' => $average,
            'count' => $count,
            'distribution' => collect([5, 4, 3, 2, 1])->mapWithKeys(fn ($rating) => [$rating => (int) ($counts[$rating] ?? 0)]),
        ];
    }

    /** The latest delivered order of this customer (or an earlier guest order with their email) that included the product. */
    private function deliveredOrderId(User $user, Product $product): ?int
    {
        return Order::query()
            ->where('status', 'delivered')
            ->where(fn ($query) => $query->where('user_id', $user->id)
                ->orWhere(fn ($query) => $query->whereNull('user_id')->where('customer_email', $user->email)))
            ->whereHas('items', fn ($query) => $query->where('product_id', $product->id))
            ->orderByDesc('id')
            ->value('id');
    }
}
