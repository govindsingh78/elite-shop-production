<?php

namespace App\Http\Controllers;

use App\Models\Size;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The admin's list of sizes that sellers and the store can offer products in. */
class SizeController extends Controller
{
    public function index()
    {
        return response()->json(Size::query()->ordered()->withCount('productSizes as products_count')->get(), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate($this->rules());
        // New sizes go to the end of the list unless a position is given.
        $validated['sort_order'] ??= ((int) Size::query()->max('sort_order')) + 10;

        return response()->json(['message' => "Size {$validated['name']} added.", 'data' => Size::create($validated)], 201);
    }

    public function update(Request $request, Size $size)
    {
        $validated = $request->validate($this->rules($size));
        // A blank position keeps the size where it is.
        if (($validated['sort_order'] ?? null) === null) {
            unset($validated['sort_order']);
        }
        $size->update($validated);

        return response()->json(['message' => 'Size updated.', 'data' => $size], 200);
    }

    public function destroy(Size $size)
    {
        // Past orders keep the size name, but live products would silently lose the size and its stock.
        $inUse = $size->productSizes()->count();
        if ($inUse) {
            return response()->json([
                'message' => "{$size->name} is used by {$inUse} " . ($inUse === 1 ? 'product' : 'products') . '. Remove it from those products first.',
            ], 422);
        }
        $size->delete();

        return response()->json(['message' => "Size {$size->name} deleted."], 200);
    }

    private function rules(?Size $size = null): array
    {
        return [
            'name' => ['required', 'string', 'max:60', Rule::unique('sizes', 'name')->ignore($size?->id)],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ];
    }
}
