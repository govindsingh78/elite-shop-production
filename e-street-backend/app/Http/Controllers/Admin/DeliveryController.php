<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeliveryArea;
use App\Services\Delivery;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Admin › Delivery areas: where we deliver (everywhere in India apart from blocked areas, or only listed ones), the
 * PIN codes and PIN code starts on the list, Elitezaar's own dispatch PIN code and packing time, and a checker.
 */
class DeliveryController extends Controller
{
    /** How many PIN codes can be added in one go. */
    private const MAX_AT_ONCE = 500;

    public function index(Request $request)
    {
        $search = trim((string) ($request->validate(['search' => ['nullable', 'string', 'max:60']])['search'] ?? ''));
        $areas = DeliveryArea::query()
            ->when($search !== '', fn ($query) => $query->where(fn ($inner) => $inner->where('pincode', 'like', "{$search}%")->orWhere('name', 'like', "%{$search}%")))
            ->orderBy('pincode')->paginate(50);
        $areas->setCollection($areas->getCollection()->map(fn (DeliveryArea $area) => $this->present($area)));

        return response()->json([
            ...$areas->toArray(),
            'settings' => $this->settings(),
            'counts' => [
                'all' => DeliveryArea::query()->count(),
                'deliverable' => DeliveryArea::query()->where('deliverable', true)->count(),
                'blocked' => DeliveryArea::query()->where('deliverable', false)->count(),
            ],
        ]);
    }

    public function updateSettings(Request $request)
    {
        $validated = $request->validate([
            'mode' => ['required', Rule::in(Delivery::MODES)],
            'store_pincode' => ['nullable', 'string', 'max:12', Delivery::pincodeRule()],
            'dispatch_days' => ['required', 'integer', 'min:0', 'max:10'],
        ]);
        if ($validated['mode'] === 'listed' && !DeliveryArea::query()->where('deliverable', true)->exists()) {
            throw ValidationException::withMessages(['mode' => 'Add the areas you deliver to first, or every order would be refused.']);
        }
        Delivery::saveSettings([...$validated, 'store_pincode' => Delivery::normalise($validated['store_pincode'] ?? null) ?: null]);

        return response()->json(['message' => 'Delivery settings saved.', 'settings' => $this->settings()]);
    }

    /** Adds one or many PIN codes (or starts of them) with the same settings; ones already listed are updated. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'pincodes' => ['required', 'string', 'max:6000'],
            ...$this->areaRules(),
        ], ['pincodes.required' => 'Enter at least one PIN code.']);

        $entries = array_values(array_unique(array_filter(preg_split('/[\s,;]+/', $validated['pincodes']))));
        $wrong = array_filter($entries, fn (string $entry) => !preg_match('/^[1-9]\d{1,5}$/', $entry));
        if ($wrong) {
            throw ValidationException::withMessages(['pincodes' => 'These aren’t PIN codes or the start of one (2 to 6 digits): ' . implode(', ', array_slice($wrong, 0, 8)) . (count($wrong) > 8 ? '…' : '')]);
        }
        if (count($entries) > self::MAX_AT_ONCE) {
            throw ValidationException::withMessages(['pincodes' => 'Add up to ' . self::MAX_AT_ONCE . ' PIN codes at a time.']);
        }

        $existing = DeliveryArea::query()->whereIn('pincode', $entries)->count();
        foreach ($entries as $pincode) {
            DeliveryArea::query()->updateOrCreate(['pincode' => $pincode], $this->areaValues($validated));
        }
        $added = count($entries) - $existing;

        return response()->json([
            'message' => match (true) {
                $added && $existing => "Added {$added} and updated {$existing}.",
                (bool) $existing => $existing === 1 ? 'Updated it.' : "Updated {$existing}.",
                default => $added === 1 ? "Added {$entries[0]}." : "Added {$added} PIN codes.",
            },
        ], 201);
    }

    public function update(Request $request, DeliveryArea $area)
    {
        $area->update($this->areaValues($request->validate($this->areaRules())));

        return response()->json(['message' => "Saved {$area->pincode}.", 'area' => $this->present($area)]);
    }

    public function destroy(DeliveryArea $area)
    {
        $settings = Delivery::settings();
        if ($settings['mode'] === 'listed' && $area->deliverable && !DeliveryArea::query()->where('deliverable', true)->whereKeyNot($area->id)->exists()) {
            throw ValidationException::withMessages(['area' => 'This is the only area you deliver to. Add another first, or switch to delivering everywhere.']);
        }
        $area->delete();

        return response()->json(['message' => "Removed {$area->pincode}."]);
    }

    /** Tries a PIN code: whether we deliver there, from where, and how long it takes. */
    public function check(Request $request)
    {
        $validated = $request->validate([
            'pincode' => ['required', 'string', 'max:12', Delivery::pincodeRule()],
            'from' => ['nullable', 'string', 'max:12', Delivery::pincodeRule()],
        ]);

        return response()->json(Delivery::check(Delivery::normalise($validated['pincode']), null, $validated['from'] ?? null));
    }

    private function areaRules(): array
    {
        return [
            'name' => ['nullable', 'string', 'max:80'],
            'deliverable' => ['required', 'boolean'],
            'extra_days' => ['nullable', 'integer', 'min:0', 'max:15'],
        ];
    }

    private function areaValues(array $validated): array
    {
        return [
            'name' => filled($validated['name'] ?? null) ? trim($validated['name']) : null,
            'deliverable' => (bool) $validated['deliverable'],
            'extra_days' => (bool) $validated['deliverable'] ? (int) ($validated['extra_days'] ?? 0) : 0,
        ];
    }

    private function settings(): array
    {
        $settings = Delivery::settings();

        return [...$settings, 'store_region' => $settings['store_pincode'] ? Delivery::region($settings['store_pincode'])['name'] ?? null : null];
    }

    private function present(DeliveryArea $area): array
    {
        // A start of a PIN code covers a whole region or city; its region comes from any PIN code it covers.
        $region = Delivery::region(str_pad($area->pincode, 6, '0'))['name'] ?? null;

        return [
            ...$area->only(['id', 'pincode', 'name', 'deliverable', 'extra_days', 'updated_at']),
            'is_prefix' => $area->isPrefix(),
            'region' => $region,
        ];
    }
}
