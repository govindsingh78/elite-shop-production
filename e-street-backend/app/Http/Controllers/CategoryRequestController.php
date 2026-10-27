<?php

namespace App\Http\Controllers;

use App\Models\CategoryRequest;
use App\Services\CategoryRequests;
use Illuminate\Http\Request;

/**
 * A seller's own category requests: asking for a category or subcategory the store doesn't have yet, seeing the
 * answers, and withdrawing one that's still waiting. Sellers waiting for approval can ask too.
 */
class CategoryRequestController extends Controller
{
    public function index(Request $request)
    {
        $requests = $request->user()->categoryRequests()
            ->with(['parent:id,name', 'category:id,name,parent_id', 'category.parent:id,name'])
            ->latest('id')->limit(50)->get();

        return response()->json([
            'requests' => $requests->map(fn (CategoryRequest $item) => self::present($item)),
            'max_pending' => CategoryRequests::MAX_PENDING,
        ]);
    }

    public function store(Request $request)
    {
        $created = CategoryRequests::file($request->user(), $request->validate(CategoryRequests::rules(), CategoryRequests::messages()));

        return response()->json([
            'message' => "Thanks! We’ve asked our team to add “{$created->label()}”, and we’ll let you know.",
            'request' => self::present($created),
        ], 201);
    }

    public function destroy(Request $request, CategoryRequest $categoryRequest)
    {
        abort_unless($categoryRequest->seller_id === $request->user()->id, 404);
        abort_unless($categoryRequest->status === CategoryRequest::PENDING, 422, 'This request has already been answered, so it can’t be withdrawn.');
        $categoryRequest->delete();

        return response()->json(['message' => 'Request withdrawn.']);
    }

    /** A request as sellers and admins see it; `category` is what it became once added. */
    public static function present(CategoryRequest $item): array
    {
        $category = $item->category;

        return [
            ...$item->only(['id', 'name', 'parent_id', 'note', 'status', 'admin_note', 'created_at', 'reviewed_at']),
            'parent_name' => $item->parent?->name,
            'label' => $item->label(),
            'category' => $category ? [
                'id' => $category->id,
                'label' => $category->parent ? "{$category->parent->name} › {$category->name}" : $category->name,
            ] : null,
        ];
    }
}
