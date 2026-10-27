<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Services\Delivery;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** The product page's "Delivery to" check: whether we deliver to a PIN code, and roughly when. */
class DeliveryController extends Controller
{
    public function check(Request $request)
    {
        $validated = $request->validate(['pincode' => ['required', 'string', 'max:12'], 'product' => ['nullable', 'integer']]);
        $pincode = Delivery::normalise($validated['pincode']);
        if (!Delivery::valid($pincode)) {
            throw ValidationException::withMessages(['pincode' => 'Enter a 6-digit PIN code, like 302016.']);
        }
        // The seller's pickup PIN code stays private: only its region is in the answer.
        $product = isset($validated['product'])
            ? Product::query()->onStorefront()->with('vendor:id,pickup_pincode')->find($validated['product'])
            : null;

        return response()->json(Delivery::check($pincode, $product));
    }
}
