<?php

namespace App\Http\Controllers;

use App\Models\ShippingMethod;
use Illuminate\Http\Request;

class ShippingMethodController extends Controller
{
    public function index()
    {
        return response()->json(ShippingMethod::query()->orderBy('id')->get(), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0', 'decimal:0,2'],
            'status' => ['sometimes', 'boolean'],
        ]);

        $shippingMethod = ShippingMethod::create($validated);

        return response()->json([
            'message' => 'Shipping method created successfully.',
            'data' => $shippingMethod,
        ], 201);
    }

    public function show(ShippingMethod $shippingMethod)
    {
        return response()->json($shippingMethod, 200);
    }

    public function update(Request $request, ShippingMethod $shippingMethod)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0', 'decimal:0,2'],
            'status' => ['required', 'boolean'],
        ]);

        $shippingMethod->update($validated);

        return response()->json([
            'message' => 'Shipping method updated successfully.',
            'data' => $shippingMethod->refresh(),
        ], 200);
    }

    public function destroy(ShippingMethod $shippingMethod)
    {
        $shippingMethod->delete();

        return response()->json(['message' => 'Shipping method deleted successfully.'], 200);
    }
}
