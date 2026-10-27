<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Product;
use App\Services\Coupons;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Admin › Coupons: create codes (percentage or flat off, limits, dates, what they cover, who pays), pause or end them,
 * and see how often they're used. Dates are days in India: a coupon runs from the start of its first day to the end
 * of its last.
 */
class CouponController extends Controller
{
    public const STATES = ['active', 'scheduled', 'expired', 'paused'];

    public function index(Request $request)
    {
        $filters = $request->validate(['state' => ['nullable', Rule::in([...self::STATES, 'all'])], 'search' => ['nullable', 'string', 'max:60']]);
        $state = $filters['state'] ?? 'all';
        $search = trim((string) ($filters['search'] ?? ''));

        $coupons = $this->filtered($state)
            ->when($search !== '', fn ($query) => $query->where(fn ($inner) => $inner->where('code', 'like', '%' . Coupons::normalise($search) . '%')->orWhere('title', 'like', "%{$search}%")))
            ->withCount(['orders as uses' => fn ($query) => $query->where('status', '!=', 'cancelled')])
            ->withSum(['orders as discount_given' => fn ($query) => $query->where('status', '!=', 'cancelled')], 'discount_amount')
            ->latest('id')->paginate(20);
        $coupons->setCollection($coupons->getCollection()->map(fn (Coupon $coupon) => $this->present($coupon)));

        return response()->json([
            ...$coupons->toArray(),
            'counts' => collect(self::STATES)->mapWithKeys(fn (string $each) => [$each => $this->filtered($each)->count()])->put('all', Coupon::query()->count()),
            'categories' => Category::query()->where('status', 1)->orderBy('name')->get(['id', 'name', 'parent_id']),
        ]);
    }

    /** One coupon, with the categories to choose from (the app's coupon form). */
    public function show(Coupon $coupon)
    {
        return response()->json([
            'coupon' => $this->present($coupon),
            'categories' => Category::query()->where('status', 1)->orderBy('name')->get(['id', 'name', 'parent_id']),
        ]);
    }

    public function store(Request $request)
    {
        $coupon = Coupon::create($this->validated($request));

        return response()->json(['message' => "Coupon {$coupon->code} created.", 'coupon' => $this->present($coupon)], 201);
    }

    public function update(Request $request, Coupon $coupon)
    {
        $coupon->update($this->validated($request, $coupon));

        return response()->json(['message' => "Coupon {$coupon->code} saved.", 'coupon' => $this->present($coupon->fresh())]);
    }

    /** Pausing or switching back on, without the whole form. */
    public function setStatus(Request $request, Coupon $coupon)
    {
        $coupon->update(['status' => $request->validate(['status' => ['required', 'boolean']])['status']]);

        return response()->json(['message' => $coupon->status ? "{$coupon->code} is on." : "{$coupon->code} is paused; shoppers can’t use it.", 'coupon' => $this->present($coupon->fresh())]);
    }

    public function destroy(Coupon $coupon)
    {
        $uses = $coupon->orders()->count();
        if ($uses) {
            throw ValidationException::withMessages(['coupon' => "It’s on {$uses} " . ($uses === 1 ? 'order' : 'orders') . ', so it’s kept for their records. Pause it instead.']);
        }
        $coupon->delete();

        return response()->json(['message' => "Deleted {$coupon->code}."]);
    }

    /** Products for the "covers these products" picker. */
    public function products(Request $request)
    {
        $search = trim((string) ($request->validate(['search' => ['nullable', 'string', 'max:60']])['search'] ?? ''));

        return response()->json(['products' => Product::query()
            ->when($search !== '', fn ($query) => $query->where(fn ($inner) => $inner->where('title', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%")))
            ->orderBy('title')->limit(12)->get(['id', 'title', 'sku', 'price'])]);
    }

    private function filtered(string $state)
    {
        $now = now();

        return Coupon::query()->when($state !== 'all', fn ($query) => match ($state) {
            'paused' => $query->where('status', false),
            'scheduled' => $query->where('status', true)->where('starts_at', '>', $now),
            'expired' => $query->where('status', true)->where('ends_at', '<=', $now),
            default => $query->live(),
        });
    }

    private function validated(Request $request, ?Coupon $coupon = null): array
    {
        $request->merge(['code' => Coupons::normalise($request->input('code'))]);
        $validated = $request->validate([
            'code' => ['required', 'regex:/^[A-Z0-9]{3,20}$/', Rule::unique('coupons', 'code')->ignore($coupon?->id)],
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'terms' => ['nullable', 'string', 'max:3000'],
            'type' => ['required', Rule::in(Coupon::TYPES)],
            'value' => ['required', 'numeric', 'gt:0', $request->input('type') === Coupon::PERCENT ? 'max:100' : 'max:1000000'],
            'max_discount' => ['nullable', 'numeric', 'gt:0'],
            'min_order' => ['nullable', 'numeric', 'min:0'],
            'starts_on' => ['nullable', 'date_format:Y-m-d'],
            'ends_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:starts_on'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'per_customer_limit' => ['nullable', 'integer', 'min:1'],
            'first_order_only' => ['boolean'],
            'show_on_product' => ['boolean'],
            'funded_by' => ['required', Rule::in(Coupon::FUNDERS)],
            'status' => ['boolean'],
            'category_ids' => ['nullable', 'array', 'max:100'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'product_ids' => ['nullable', 'array', 'max:200'],
            'product_ids.*' => ['integer', 'exists:products,id'],
        ], [
            'code.regex' => 'Use 3 to 20 letters and numbers, like AW30.',
            'code.unique' => 'Another coupon already uses this code.',
            'value.max' => $request->input('type') === Coupon::PERCENT ? 'A percentage can’t be more than 100.' : 'That’s more than any order.',
            'ends_on.after_or_equal' => 'The last day can’t be before the first.',
        ]);

        // The start of a day in India, in the app's own time zone for saving.
        $day = fn (?string $date) => $date ? Carbon::parse($date, 'Asia/Kolkata')->startOfDay()->setTimezone(config('app.timezone')) : null;

        return [
            ...collect($validated)->except(['starts_on', 'ends_on'])->all(),
            'max_discount' => $validated['type'] === Coupon::PERCENT ? ($validated['max_discount'] ?? null) : null,
            'starts_at' => $day($validated['starts_on'] ?? null),
            // Until the end of the last day.
            'ends_at' => $day($validated['ends_on'] ?? null)?->addDay(),
            'category_ids' => array_values(array_unique($validated['category_ids'] ?? [])) ?: null,
            'product_ids' => array_values(array_unique($validated['product_ids'] ?? [])) ?: null,
            'first_order_only' => (bool) ($validated['first_order_only'] ?? false),
            'show_on_product' => (bool) ($validated['show_on_product'] ?? true),
            'status' => (bool) ($validated['status'] ?? true),
        ];
    }

    private function present(Coupon $coupon): array
    {
        $uses = $coupon->uses ?? $coupon->usedOrders()->count();
        $state = match (true) {
            !$coupon->status => 'paused',
            (bool) $coupon->starts_at?->isFuture() => 'scheduled',
            $coupon->ends_at && !$coupon->ends_at->isFuture() => 'expired',
            $coupon->usage_limit !== null && $uses >= $coupon->usage_limit => 'used_up',
            default => 'active',
        };

        return [
            ...$coupon->only(['id', 'code', 'title', 'description', 'terms', 'type', 'value', 'max_discount', 'min_order', 'usage_limit',
                'per_customer_limit', 'first_order_only', 'show_on_product', 'funded_by', 'status', 'created_at']),
            'category_ids' => $coupon->category_ids ?? [],
            'product_ids' => $coupon->product_ids ?? [],
            'products' => $coupon->product_ids ? Product::query()->whereIn('id', $coupon->product_ids)->get(['id', 'title', 'sku']) : [],
            'starts_on' => $coupon->starts_at?->copy()->timezone('Asia/Kolkata')->toDateString(),
            'ends_on' => $coupon->ends_at?->copy()->timezone('Asia/Kolkata')->subDay()->toDateString(),
            'headline' => $coupon->headline(),
            'conditions' => Coupons::conditions($coupon),
            'state' => $state,
            'uses' => $uses,
            'discount_given' => round((float) ($coupon->discount_given ?? $coupon->usedOrders()->sum('discount_amount')), 2),
        ];
    }
}
