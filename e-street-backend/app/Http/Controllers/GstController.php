<?php

namespace App\Http\Controllers;

use App\Services\Delivery;
use App\Services\Gst;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** GST details: the store's (admins) and each seller's own (sellers). */
class GstController extends Controller
{
    public function settings()
    {
        return response()->json(['settings' => Gst::store(), ...self::choices()], 200);
    }

    /** The business behind the store, for shoppers (site footer, About): its legal name and, when registered, its GSTIN. */
    public function publicDetails()
    {
        $store = Gst::store();
        $gstin = Gst::validGstin($store['gstin']) ? strtoupper(trim($store['gstin'])) : null;
        $stateCode = $store['state_code'] ?: ($gstin ? substr($gstin, 0, 2) : null);

        return response()->json(['business' => [
            'legal_name' => $store['legal_name'],
            'gstin' => $gstin,
            'state' => Gst::STATES[$stateCode] ?? null,
            'address' => filled($store['address']) ? $store['address'] : null,
        ]], 200)->header('Cache-Control', 'public, max-age=60');
    }

    public function updateSettings(Request $request)
    {
        $validated = $request->validate([
            'legal_name' => ['required', 'string', 'max:255'],
            'gstin' => ['nullable', 'string', 'max:15', Gst::gstinRule()],
            'address' => ['nullable', 'string', 'max:500'],
            'state_code' => ['nullable', Rule::in(array_keys(Gst::STATES))],
            // Sellers' invoices start S<seller id>, so the store's prefix must not look like one.
            'invoice_prefix' => ['required', 'string', 'regex:/^[A-Z0-9]{1,6}$/', 'not_regex:/^S\d+$/'],
            'default_rate' => ['required', 'numeric', 'min:0', 'max:40'],
            'default_rate_high' => ['nullable', 'numeric', 'min:0', 'max:40', 'required_with:default_threshold'],
            'default_threshold' => ['nullable', 'numeric', 'min:0', 'required_with:default_rate_high'],
            'shipping_rate' => ['required', 'numeric', 'min:0', 'max:40'],
        ], [
            'invoice_prefix.regex' => 'Use up to 6 capital letters or numbers, like EZ.',
            'invoice_prefix.not_regex' => 'S followed by numbers is kept for sellers’ invoices.',
        ]);

        $saved = Gst::saveStore([...$validated, ...self::stateFromGstin($validated, 'state_code')]);

        return response()->json(['message' => 'GST settings saved.', 'settings' => $saved], 200);
    }

    public function business(Request $request)
    {
        $seller = $request->user();

        return response()->json([
            'business' => $seller->only(self::BUSINESS_FIELDS),
            ...self::choices(),
        ], 200);
    }

    /** What sellers see and keep here; the pickup PIN code is used for delivery estimates (App\Services\Delivery). */
    private const BUSINESS_FIELDS = ['name', 'legal_name', 'gstin', 'business_address', 'business_state', 'pickup_pincode'];

    public function updateBusiness(Request $request)
    {
        $validated = $request->validate([
            'legal_name' => ['nullable', 'string', 'max:255'],
            'gstin' => ['nullable', 'string', 'max:15', Gst::gstinRule()],
            'business_address' => ['required_with:gstin', 'nullable', 'string', 'max:500'],
            'business_state' => ['nullable', Rule::in(array_keys(Gst::STATES))],
            'pickup_pincode' => ['nullable', 'string', 'max:12', Delivery::pincodeRule()],
        ], ['business_address.required_with' => 'Add your registered business address; it appears on your invoices.']);

        $seller = $request->user();
        // Older app versions don't send it, so it only changes when it's there.
        if ($request->exists('pickup_pincode')) {
            $seller->forceFill(['pickup_pincode' => Delivery::normalise($validated['pickup_pincode'] ?? null) ?: null]);
        }
        unset($validated['pickup_pincode']);
        $seller->update([...$validated, ...self::stateFromGstin($validated, 'business_state')]);

        return response()->json([
            'message' => $seller->gstin ? 'Business details saved. Your invoices will show GST.' : 'Business details saved.',
            'business' => $seller->only(self::BUSINESS_FIELDS),
        ], 200);
    }

    /** A GSTIN fixes the state; a different one chosen alongside it is a mistake. */
    private static function stateFromGstin(array $validated, string $field): array
    {
        $gstin = strtoupper(trim((string) ($validated['gstin'] ?? '')));
        if ($gstin === '') {
            return ['gstin' => null];
        }
        $state = substr($gstin, 0, 2);
        if (!empty($validated[$field]) && $validated[$field] !== $state) {
            throw ValidationException::withMessages([$field => 'This doesn’t match the state in the GSTIN (' . (Gst::STATES[$state] ?? $state) . ').']);
        }

        return ['gstin' => $gstin, $field => $state];
    }

    private static function choices(): array
    {
        return [
            'states' => collect(Gst::STATES)->map(fn ($name, $code) => ['code' => (string) $code, 'name' => $name])->values(),
            'rates' => Gst::RATES,
        ];
    }
}
