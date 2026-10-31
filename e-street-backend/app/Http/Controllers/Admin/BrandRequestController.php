<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\BrandRequestController as SellerRequests;
use App\Http\Controllers\Controller;
use App\Models\BrandRequest;
use App\Services\BrandRequests;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin: brands sellers asked for. Add one (as asked, renamed, or by pointing to a brand already in the store) or
 * decline it with a reason; the seller is told either way.
 */
class BrandRequestController extends Controller
{
    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in([...BrandRequest::STATUSES, 'all'])]]);
        $status = $request->input('status', BrandRequest::PENDING);

        $requests = BrandRequest::query()
            ->with(['seller:id,name,email,seller_status', 'brand:id,name', 'reviewer:id,name'])
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            // Waiting ones oldest first, like a queue; answered ones newest first.
            ->when($status === BrandRequest::PENDING, fn ($query) => $query->oldest('id'), fn ($query) => $query->latest('id'))
            ->paginate(20);

        $requests->setCollection($requests->getCollection()->map(fn (BrandRequest $item) => $this->present($item)));

        return response()->json([...$requests->toArray(), 'counts' => $this->counts()]);
    }

    public function approve(Request $request, BrandRequest $brandRequest)
    {
        $this->ensureWaiting($brandRequest);
        $validated = $request->validate([
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'name' => ['nullable', 'string', 'max:60'],
        ]);
        $choice = filled($validated['brand_id'] ?? null) ? ['brand_id' => $validated['brand_id']] : ['name' => $validated['name'] ?? null];

        $waitingToo = BrandRequests::alsoWaiting($brandRequest);
        $brand = BrandRequests::approve($brandRequest, $request->user(), $choice);
        $told = $waitingToo ? ' The ' . ($waitingToo + 1) . ' sellers who asked for it have been told.' : ' The seller has been told.';

        return response()->json([
            'message' => "{$brand->name} is ready for sellers' products.{$told}",
            'request' => $this->present($brandRequest->fresh()),
            'counts' => $this->counts(),
        ]);
    }

    public function decline(Request $request, BrandRequest $brandRequest)
    {
        $this->ensureWaiting($brandRequest);
        $validated = $request->validate(
            ['note' => ['required', 'string', 'max:300']],
            ['note.required' => 'Tell the seller why, so they can choose another brand or ask again.'],
        );
        BrandRequests::decline($brandRequest, $request->user(), $validated['note']);

        return response()->json([
            'message' => 'Request declined. The seller has been told why.',
            'request' => $this->present($brandRequest->fresh()),
            'counts' => $this->counts(),
        ]);
    }

    private function ensureWaiting(BrandRequest $brandRequest): void
    {
        abort_unless($brandRequest->status === BrandRequest::PENDING, 422, 'This request has already been answered.');
    }

    private function present(BrandRequest $item): array
    {
        $item->loadMissing(['seller:id,name,email,seller_status', 'brand:id,name', 'reviewer:id,name']);

        return [
            ...SellerRequests::present($item),
            'seller' => $item->seller?->only(['id', 'name', 'email', 'seller_status']),
            'reviewer' => $item->reviewer?->name,
            'also_waiting' => $item->status === BrandRequest::PENDING ? BrandRequests::alsoWaiting($item) : 0,
        ];
    }

    /** How many requests have each status. */
    private function counts(): array
    {
        $counts = BrandRequest::query()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        return collect(BrandRequest::STATUSES)->mapWithKeys(fn ($status) => [$status => (int) ($counts[$status] ?? 0)])
            ->put('all', (int) $counts->sum())->all();
    }
}
