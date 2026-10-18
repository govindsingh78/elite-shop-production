<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\CustomerAddressRequest;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Endpoints for the signed-in customer's own account, orders and addresses. */
class AccountController extends Controller
{
    private const ACTIVE_STATUSES = ['pending', 'processing', 'shipped'];

    public function dashboard(Request $request)
    {
        $user = $request->user();
        $orders = $this->ordersFor($request);

        return response()->json([
            'user' => $user,
            'stats' => [
                'total_orders' => (clone $orders)->count(),
                'active_orders' => (clone $orders)->whereIn('status', self::ACTIVE_STATUSES)->count(),
                'delivered_orders' => (clone $orders)->where('status', 'delivered')->count(),
                'total_spent' => round((float) (clone $orders)->where('status', '!=', 'cancelled')->sum('total'), 2),
                'saved_addresses' => $user->addresses()->count(),
            ],
            'recent_orders' => (clone $orders)->withCount('items')->with('latestTrackingEvent')->orderByDesc('id')->limit(5)->get(),
            'default_address' => $user->addresses()->orderByDesc('is_default')->orderBy('id')->first(),
        ]);
    }

    public function profile(Request $request)
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40', 'regex:/^[0-9+\-\s()]{7,40}$/'],
        ], ['phone.regex' => 'Enter a valid phone number.']);

        $request->user()->update($validated);

        return response()->json(['message' => 'Profile updated successfully.', 'user' => $request->user()->refresh()]);
    }

    public function orders(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])]]);

        $orders = $this->ordersFor($request)
            ->withCount('items')
            ->with('latestTrackingEvent')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->input('status')))
            ->orderByDesc('id')
            ->paginate(10);

        return response()->json($orders);
    }

    public function showOrder(Request $request, int $order)
    {
        $order = $this->ordersFor($request)->with(['items.product:id,image', 'shippingMethod:id,name', 'trackingEvents'])->findOrFail($order);

        return response()->json($order);
    }

    public function addresses(Request $request)
    {
        return response()->json($request->user()->addresses()->orderByDesc('is_default')->orderBy('id')->get());
    }

    public function storeAddress(CustomerAddressRequest $request)
    {
        $user = $request->user();
        $address = DB::transaction(function () use ($request, $user) {
            $isDefault = $request->boolean('is_default') || !$user->addresses()->exists();
            if ($isDefault) {
                $user->addresses()->update(['is_default' => false]);
            }

            return $user->addresses()->create([
                ...$request->validated(),
                'label' => $request->input('label') ?: 'Home',
                'country' => $request->input('country') ?: 'India',
                'is_default' => $isDefault,
            ]);
        });

        return response()->json(['message' => 'Address saved.', 'data' => $address], 201);
    }

    public function updateAddress(CustomerAddressRequest $request, int $address)
    {
        $user = $request->user();
        $address = $user->addresses()->findOrFail($address);

        DB::transaction(function () use ($request, $user, $address) {
            if ($request->boolean('is_default')) {
                $user->addresses()->whereKeyNot($address->id)->update(['is_default' => false]);
            }
            $address->update([
                ...$request->validated(),
                'label' => $request->input('label') ?: 'Home',
                'country' => $request->input('country') ?: 'India',
                // The default address stays default until another one is chosen.
                'is_default' => $request->boolean('is_default') || $address->is_default,
            ]);
        });

        return response()->json(['message' => 'Address updated.', 'data' => $address->refresh()]);
    }

    public function setDefaultAddress(Request $request, int $address)
    {
        $user = $request->user();
        $address = $user->addresses()->findOrFail($address);

        DB::transaction(function () use ($user, $address) {
            $user->addresses()->update(['is_default' => false]);
            $address->update(['is_default' => true]);
        });

        return response()->json(['message' => 'Default delivery address updated.', 'data' => $address->refresh()]);
    }

    public function destroyAddress(Request $request, int $address)
    {
        $user = $request->user();
        $address = $user->addresses()->findOrFail($address);

        // A delivery address is mandatory for customers, so the last one cannot be removed.
        if ($user->addresses()->count() <= 1) {
            return response()->json(['message' => 'You need at least one delivery address on your account.'], 422);
        }

        DB::transaction(function () use ($user, $address) {
            $wasDefault = $address->is_default;
            $address->delete();
            if ($wasDefault) {
                $user->addresses()->orderBy('id')->first()?->update(['is_default' => true]);
            }
        });

        return response()->json(['message' => 'Address removed.']);
    }

    /** Orders linked to the account, plus guest orders placed earlier with the same email. */
    private function ordersFor(Request $request)
    {
        $user = $request->user();

        return Order::query()->where(function ($query) use ($user) {
            $query->where('user_id', $user->id)
                ->orWhere(fn ($query) => $query->whereNull('user_id')->where('customer_email', $user->email));
        });
    }
}
