<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\CategoryRequestController as SellerRequests;
use App\Http\Controllers\Controller;
use App\Models\CategoryRequest;
use App\Services\CategoryRequests;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin: categories sellers asked for. Add one (as asked, renamed or moved, or by pointing to a category already in
 * the store) or decline it with a reason; the seller is told either way.
 */
class CategoryRequestController extends Controller
{
    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in([...CategoryRequest::STATUSES, 'all'])]]);
        $status = $request->input('status', CategoryRequest::PENDING);

        $requests = CategoryRequest::query()
            ->with(['seller:id,name,email,seller_status', 'parent:id,name', 'category:id,name,parent_id', 'category.parent:id,name', 'reviewer:id,name'])
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            // Waiting ones oldest first, like a queue; answered ones newest first.
            ->when($status === CategoryRequest::PENDING, fn ($query) => $query->oldest('id'), fn ($query) => $query->latest('id'))
            ->paginate(20);

        $requests->setCollection($requests->getCollection()->map(fn (CategoryRequest $item) => $this->present($item)));

        return response()->json([...$requests->toArray(), 'counts' => $this->counts()]);
    }

    public function approve(Request $request, CategoryRequest $categoryRequest)
    {
        $this->ensureWaiting($categoryRequest);
        $validated = $request->validate([
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'name' => ['nullable', 'string', 'max:60'],
            'parent_id' => ['nullable', 'integer', Rule::exists('categories', 'id')->whereNull('parent_id')],
        ], [
            'parent_id.exists' => 'Choose one of the main collections, or add it as a main collection.',
        ]);
        // Leaving out parent_id keeps the place the seller asked for; sending null makes it a main collection.
        $choice = filled($validated['category_id'] ?? null)
            ? ['category_id' => $validated['category_id']]
            : ['name' => $validated['name'] ?? null, ...($request->exists('parent_id') ? ['parent_id' => $validated['parent_id'] ?? null] : [])];

        $waitingToo = CategoryRequests::alsoWaiting($categoryRequest);
        $category = CategoryRequests::approve($categoryRequest, $request->user(), $choice);
        $label = $category->parent ? "{$category->parent->name} › {$category->name}" : $category->name;
        $told = $waitingToo ? ' The ' . ($waitingToo + 1) . ' sellers who asked for it have been told.' : ' The seller has been told.';

        return response()->json([
            'message' => "{$label} is ready for sellers' products.{$told}",
            'request' => $this->present($categoryRequest->fresh()),
            'counts' => $this->counts(),
        ]);
    }

    public function decline(Request $request, CategoryRequest $categoryRequest)
    {
        $this->ensureWaiting($categoryRequest);
        $validated = $request->validate(
            ['note' => ['required', 'string', 'max:300']],
            ['note.required' => 'Tell the seller why, so they can choose another category or ask again.'],
        );
        CategoryRequests::decline($categoryRequest, $request->user(), $validated['note']);

        return response()->json([
            'message' => 'Request declined. The seller has been told why.',
            'request' => $this->present($categoryRequest->fresh()),
            'counts' => $this->counts(),
        ]);
    }

    private function ensureWaiting(CategoryRequest $categoryRequest): void
    {
        abort_unless($categoryRequest->status === CategoryRequest::PENDING, 422, 'This request has already been answered.');
    }

    private function present(CategoryRequest $item): array
    {
        $item->loadMissing(['seller:id,name,email,seller_status', 'parent:id,name', 'category.parent:id,name', 'reviewer:id,name']);

        return [
            ...SellerRequests::present($item),
            'seller' => $item->seller?->only(['id', 'name', 'email', 'seller_status']),
            'reviewer' => $item->reviewer?->name,
            'also_waiting' => $item->status === CategoryRequest::PENDING ? CategoryRequests::alsoWaiting($item) : 0,
        ];
    }

    /** How many requests have each status. */
    private function counts(): array
    {
        $counts = CategoryRequest::query()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        return collect(CategoryRequest::STATUSES)->mapWithKeys(fn ($status) => [$status => (int) ($counts[$status] ?? 0)])
            ->put('all', (int) $counts->sum())->all();
    }
}
