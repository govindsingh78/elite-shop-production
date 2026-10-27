<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CategoryRequest;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Notifications\SellerAccountUpdated;
use App\Services\Gst;
use App\Services\Messenger;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Admin: approve or decline new sellers, and deactivate or reactivate existing ones. */
class SellerController extends Controller
{
    private const OPEN_ORDER_STATUSES = ['pending', 'processing', 'shipped'];

    /** Which statuses each change can come from. */
    private const CHANGES = [
        User::SELLER_APPROVED => [User::SELLER_PENDING, User::SELLER_REJECTED, User::SELLER_DEACTIVATED],
        User::SELLER_REJECTED => [User::SELLER_PENDING],
        User::SELLER_DEACTIVATED => [User::SELLER_APPROVED],
    ];

    private const LABELS = [
        User::SELLER_PENDING => 'waiting for approval',
        User::SELLER_APPROVED => 'approved',
        User::SELLER_REJECTED => 'declined',
        User::SELLER_DEACTIVATED => 'deactivated',
    ];

    public function index(Request $request)
    {
        $request->validate([
            'status' => ['nullable', Rule::in(User::SELLER_STATUSES)],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);
        $status = $request->input('status');

        $sellers = $this->sellers()
            ->when($status, fn ($query) => $query->where('seller_status', $status))
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->trim()->toString();
                $query->where(function ($query) use ($search) {
                    foreach (['name', 'email', 'phone', 'legal_name', 'gstin'] as $column) {
                        $query->orWhere($column, 'like', "%{$search}%");
                    }
                });
            })
            // The approval queue is oldest first; otherwise the latest changes come first, applications on top.
            ->when($status === User::SELLER_PENDING, fn ($query) => $query->orderBy('created_at')->orderBy('id'))
            ->when($status !== User::SELLER_PENDING, fn ($query) => $query
                ->orderByRaw('CASE WHEN seller_status = ? THEN 0 ELSE 1 END', [User::SELLER_PENDING])
                ->orderByDesc('seller_status_at')->orderByDesc('id'))
            ->paginate((int) $request->input('per_page', 20));

        $openOrders = $this->openOrders($sellers->getCollection()->pluck('id'));
        $sellers->setCollection($sellers->getCollection()->map(fn (User $seller) => $this->present($seller, $openOrders)));

        return response()->json([...$sellers->toArray(), 'counts' => $this->counts()]);
    }

    public function show(User $seller)
    {
        abort_unless($seller->role === 'seller', 404, 'Seller not found.');
        $seller = $this->sellers()->findOrFail($seller->id);

        return response()->json(['seller' => $this->present($seller, $this->openOrders(collect([$seller->id])))]);
    }

    public function updateStatus(Request $request, User $seller)
    {
        abort_unless($seller->role === 'seller', 404, 'Seller not found.');
        $validated = $request->validate([
            'status' => ['required', Rule::in(array_keys(self::CHANGES))],
            'note' => ['nullable', 'string', 'max:500', Rule::requiredIf(in_array($request->input('status'), [User::SELLER_REJECTED, User::SELLER_DEACTIVATED], true))],
        ], ['note.required' => 'Add a reason. The seller sees it.']);

        $previous = $seller->seller_status;
        $next = $validated['status'];
        if (!in_array($previous, self::CHANGES[$next], true)) {
            throw ValidationException::withMessages(['status' => match (true) {
                $previous === $next => 'This seller is already ' . self::LABELS[$next] . '.',
                $next === User::SELLER_REJECTED => 'Only an application that’s waiting for approval can be declined.',
                default => 'Only an approved seller can be deactivated. Decline an application instead.',
            }]);
        }

        $seller->forceFill([
            'seller_status' => $next,
            'seller_status_note' => $next === User::SELLER_APPROVED ? null : trim($validated['note']),
            'seller_status_at' => now(),
        ])->save();
        Messenger::send($seller, new SellerAccountUpdated($seller, $previous));

        $openOrders = $this->openOrders(collect([$seller->id]));
        $count = $openOrders->get($seller->id, 0);
        $message = match (true) {
            $next === User::SELLER_REJECTED => "{$seller->name}’s application was declined. We’ve told them why.",
            $next === User::SELLER_DEACTIVATED => "{$seller->name} is deactivated and their products are hidden from the store."
                . ($count ? " They have {$count} open " . ($count === 1 ? 'order' : 'orders') . ' — you can manage ' . ($count === 1 ? 'it' : 'them') . ' from Orders.' : ''),
            $previous === User::SELLER_DEACTIVATED => "{$seller->name} is active again. Their approved products are back in the store.",
            default => "{$seller->name} is approved and can now list products.",
        };

        return response()->json([
            'message' => $message,
            'seller' => $this->present($this->sellers()->findOrFail($seller->id), $openOrders),
            'counts' => $this->counts(),
        ]);
    }

    private function sellers()
    {
        return User::query()->where('role', 'seller')->withCount([
            'products',
            // Approved and switched on: in the store while the seller is active.
            'products as listed_products_count' => fn ($query) => $query->where('status', 1)->where('approval_status', Product::APPROVED),
            'categoryRequests as pending_category_requests' => fn ($query) => $query->where('status', CategoryRequest::PENDING),
        ]);
    }

    /** How many sellers have each status. */
    private function counts(): array
    {
        $counts = User::query()->where('role', 'seller')
            ->selectRaw('seller_status, COUNT(*) as total')->groupBy('seller_status')->pluck('total', 'seller_status');

        return collect(User::SELLER_STATUSES)->mapWithKeys(fn ($status) => [$status => (int) ($counts[$status] ?? 0)])
            ->put('all', (int) $counts->sum())->all();
    }

    /** Orders not yet delivered or cancelled with products from each of these sellers, by seller id. */
    private function openOrders(Collection $sellerIds): Collection
    {
        if ($sellerIds->isEmpty()) {
            return collect();
        }

        return OrderItem::query()
            ->whereIn('vendor_id', $sellerIds)
            ->whereHas('order', fn ($query) => $query->whereIn('status', self::OPEN_ORDER_STATUSES))
            ->selectRaw('vendor_id, COUNT(DISTINCT order_id) as total')
            ->groupBy('vendor_id')
            ->pluck('total', 'vendor_id')
            ->map(fn ($total) => (int) $total);
    }

    private function present(User $seller, Collection $openOrders): array
    {
        return [
            ...$seller->only([
                'id', 'name', 'email', 'phone', 'created_at', 'seller_status', 'seller_status_note', 'seller_status_at',
                'legal_name', 'gstin', 'business_address', 'business_state', 'products_count', 'listed_products_count',
                'pending_category_requests',
            ]),
            'business_state_name' => Gst::STATES[$seller->business_state] ?? null,
            'open_orders' => $openOrders->get($seller->id, 0),
        ];
    }
}
