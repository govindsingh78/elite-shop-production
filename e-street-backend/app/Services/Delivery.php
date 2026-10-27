<?php

namespace App\Services;

use App\Models\DeliveryArea;
use App\Models\Product;
use App\Models\Setting;
use Closure;
use Illuminate\Support\Carbon;

/**
 * Where Elitezaar delivers, and roughly when a parcel arrives.
 *
 * A PIN code says where a place is: its first two digits are the postal circle (about a state) and the first three
 * the sorting district (about a city). A delivery is estimated from the seller's pickup PIN code (Elitezaar's own
 * dispatch PIN code for its products) to the buyer's: same city, same state, or how far apart the two are, with
 * extra days for hard-to-reach places, plus the days to pack the parcel. Couriers deliver Monday to Saturday.
 *
 * Admins choose where we deliver: everywhere in India apart from the areas they block, or only the areas they list.
 * An area is a full PIN code or the start of one; the most specific match wins.
 */
class Delivery
{
    public const SETTINGS_KEY = 'delivery.settings';

    public const MODES = ['all', 'listed'];

    public const DEFAULTS = ['mode' => 'all', 'store_pincode' => null, 'dispatch_days' => 1];

    /** Each region's rough centre (latitude, longitude), and whether it's hard to reach (couriers' special zone). */
    private const REGIONS = [
        'Delhi' => [28.61, 77.21], 'Haryana' => [29.06, 76.09], 'Punjab' => [30.90, 75.85], 'Chandigarh' => [30.73, 76.78],
        'Himachal Pradesh' => [31.10, 77.17], 'Jammu & Kashmir' => [33.40, 75.00, true], 'Ladakh' => [34.15, 77.58, true],
        'Uttar Pradesh' => [26.85, 80.95], 'Uttarakhand' => [30.32, 78.03], 'Rajasthan' => [26.91, 75.79], 'Gujarat' => [23.02, 72.57],
        'Maharashtra' => [19.75, 75.71], 'Goa' => [15.30, 74.12], 'Madhya Pradesh' => [23.26, 77.41], 'Chhattisgarh' => [21.25, 81.63],
        'Telangana' => [17.39, 78.49], 'Andhra Pradesh' => [16.51, 80.65], 'Karnataka' => [14.50, 76.00], 'Tamil Nadu' => [11.10, 78.66],
        'Kerala' => [10.00, 76.30], 'Lakshadweep' => [10.57, 72.64, true], 'West Bengal' => [23.50, 87.80], 'Sikkim' => [27.33, 88.61, true],
        'Andaman & Nicobar' => [11.62, 92.73, true], 'Odisha' => [20.30, 85.82], 'Assam' => [26.14, 91.74, true],
        'Arunachal Pradesh' => [27.08, 93.61, true], 'Meghalaya' => [25.57, 91.88, true], 'Manipur' => [24.82, 93.94, true],
        'Mizoram' => [23.73, 92.72, true], 'Nagaland' => [25.67, 94.11, true], 'Tripura' => [23.83, 91.28, true],
        'Bihar' => [25.59, 85.14], 'Jharkhand' => [23.34, 85.31],
    ];

    /** The region for each PIN code start; a longer start overrides a shorter one (e.g. 403 is Goa, not Maharashtra). */
    private static function prefixes(): array
    {
        static $map;
        if ($map) {
            return $map;
        }
        $ranges = [
            'Delhi' => ['11'], 'Haryana' => ['12', '13'], 'Punjab' => ['14', '15', '16'], 'Chandigarh' => ['160'],
            'Himachal Pradesh' => ['17'], 'Jammu & Kashmir' => ['18', '19'], 'Ladakh' => ['194'],
            'Uttar Pradesh' => range(20, 28), 'Uttarakhand' => ['246', '247', '248', '249', '262', '263'],
            'Rajasthan' => range(30, 34), 'Gujarat' => range(36, 39), 'Maharashtra' => range(40, 44), 'Goa' => ['403'],
            'Madhya Pradesh' => range(45, 48), 'Chhattisgarh' => ['49'], 'Telangana' => ['50'], 'Andhra Pradesh' => range(51, 53),
            'Karnataka' => range(56, 59), 'Tamil Nadu' => range(60, 64), 'Kerala' => range(67, 69), 'Lakshadweep' => ['68255'],
            'West Bengal' => range(70, 74), 'Sikkim' => ['737'], 'Andaman & Nicobar' => ['744'], 'Odisha' => range(75, 77),
            'Assam' => ['78'], 'Arunachal Pradesh' => ['790', '791', '792'], 'Meghalaya' => ['793', '794'], 'Manipur' => ['795'],
            'Mizoram' => ['796'], 'Nagaland' => ['797', '798'], 'Tripura' => ['799'], 'Bihar' => range(80, 85),
            'Jharkhand' => ['814', '815', '816', '822', '825', '826', '827', '828', '829', '831', '832', '833', '834', '835'],
        ];
        $map = [];
        foreach ($ranges as $region => $starts) {
            foreach ($starts as $start) {
                $map[(string) $start] = $region;
            }
        }

        return $map;
    }

    /** "302 016" → "302016" */
    public static function normalise(?string $pincode): string
    {
        return preg_replace('/\s+/', '', (string) $pincode);
    }

    /** Six digits, not starting with 0. */
    public static function valid(string $pincode): bool
    {
        return (bool) preg_match('/^[1-9]\d{5}$/', $pincode);
    }

    /**
     * Where a PIN code is: ['name' => 'Rajasthan', 'lat', 'lng', 'remote' => false], or null for one that isn't in
     * use (or is a field post office, which we can't deliver to).
     */
    public static function region(string $pincode): ?array
    {
        if (!self::valid($pincode)) {
            return null;
        }
        $map = self::prefixes();
        foreach ([5, 3, 2] as $length) {
            if ($name = $map[substr($pincode, 0, $length)] ?? null) {
                [$lat, $lng, $remote] = [...self::REGIONS[$name], false];

                return ['name' => $name, 'lat' => $lat, 'lng' => $lng, 'remote' => (bool) $remote];
            }
        }

        return null;
    }

    /** A validation rule for a PIN code field: six digits, and a place in India we know. */
    public static function pincodeRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            $pincode = self::normalise((string) $value);
            if (!self::valid($pincode)) {
                $fail('Enter a 6-digit PIN code, like 302016.');
            } elseif (!self::region($pincode)) {
                $fail("We couldn’t find PIN code {$pincode}. Check it and try again.");
            }
        };
    }

    public static function settings(): array
    {
        $saved = json_decode((string) Setting::read(self::SETTINGS_KEY, ''), true);

        return array_merge(self::DEFAULTS, is_array($saved) ? $saved : []);
    }

    public static function saveSettings(array $values): array
    {
        $settings = array_merge(self::settings(), $values);
        Setting::write(self::SETTINGS_KEY, json_encode($settings));

        return $settings;
    }

    /** The admins' rule for a PIN code: the most specific area that matches it, if any. */
    public static function areaFor(string $pincode): ?DeliveryArea
    {
        $starts = array_map(fn (int $length) => substr($pincode, 0, $length), range(2, 6));

        return DeliveryArea::query()->whereIn('pincode', $starts)->get()
            ->sortByDesc(fn (DeliveryArea $area) => strlen($area->pincode))->first();
    }

    /**
     * Whether we deliver to a PIN code and, if so, roughly when: from the product's seller (their pickup PIN code),
     * from `$from` (an admin trying it out), or else from Elitezaar's own dispatch PIN code.
     */
    public static function check(string $pincode, ?Product $product = null, ?string $from = null, ?Carbon $now = null): array
    {
        $destination = self::region($pincode);
        if (!$destination) {
            return ['deliverable' => false, 'pincode' => $pincode, 'to' => null, 'message' => "We couldn’t find PIN code {$pincode}. Check it and try again."];
        }

        $settings = self::settings();
        $area = self::areaFor($pincode);
        $deliverable = $area ? $area->deliverable : $settings['mode'] === 'all';
        $where = $area?->name && $area->name !== $destination['name'] ? "{$area->name}, {$destination['name']}" : $destination['name'];
        if (!$deliverable) {
            return ['deliverable' => false, 'pincode' => $pincode, 'to' => $where, 'area' => $area?->pincode, 'message' => "Sorry, we don’t deliver to {$pincode} ({$where}) yet."];
        }

        $from = self::normalise($from ?: (($product?->vendor_id ? $product->vendor?->pickup_pincode : null) ?: $settings['store_pincode']));
        $origin = $from !== '' ? self::region($from) : null;
        [$min, $max, $zone, $distance] = self::transit($from, $origin, $pincode, $destination);
        $added = (int) $settings['dispatch_days'] + ($area?->extra_days ?? 0);
        $now = ($now ?? now())->copy()->timezone('Asia/Kolkata');
        $earliest = self::addWorkingDays($now, $min + $added);
        $latest = self::addWorkingDays($now, $max + $added);
        $days = $min + $added === $max + $added ? (string) ($max + $added) : ($min + $added) . '–' . ($max + $added);

        return [
            'deliverable' => true,
            'pincode' => $pincode,
            'to' => $where,
            'from' => $origin['name'] ?? null,
            'area' => $area?->pincode,
            'zone' => $zone,
            'distance_km' => $distance,
            'days' => ['min' => $min + $added, 'max' => $max + $added],
            'dates' => ['earliest' => $earliest->toDateString(), 'latest' => $latest->toDateString()],
            'label' => 'Delivery by ' . $latest->format('D, j M'),
            'window' => $earliest->isSameDay($latest) ? $latest->format('D, j M') : $earliest->format('D, j M') . ' – ' . $latest->format('D, j M'),
            'message' => "Usually arrives in {$days} days" . ($origin ? " · ships from {$origin['name']}" : '') . '.',
        ];
    }

    /**
     * Days on the road: [fewest, most, zone, km between the two regions]. Same district is "local", same state
     * "state"; otherwise it goes by distance, and hard-to-reach places take two days more.
     */
    private static function transit(string $from, ?array $origin, string $to, array $destination): array
    {
        if (!$origin) {
            return [3, 6, 'national', null];
        }
        if (substr($from, 0, 3) === substr($to, 0, 3)) {
            return [1, 2, 'local', null];
        }
        $distance = $origin['name'] === $destination['name'] ? null : (int) (round(self::distanceKm($origin, $destination) / 50) * 50);
        [$min, $max, $zone] = match (true) {
            $distance === null => [2, 3, 'state'],
            $distance < 500 => [2, 4, 'regional'],
            $distance < 1200 => [3, 5, 'national'],
            default => [4, 6, 'national'],
        };

        return $origin['remote'] || $destination['remote'] ? [$min + 2, $max + 2, 'remote', $distance] : [$min, $max, $zone, $distance];
    }

    /** As the crow flies, between two regions' centres. */
    private static function distanceKm(array $a, array $b): float
    {
        $rad = fn (float $degrees) => deg2rad($degrees);
        $h = sin(($rad($b['lat']) - $rad($a['lat'])) / 2) ** 2
            + cos($rad($a['lat'])) * cos($rad($b['lat'])) * sin(($rad($b['lng']) - $rad($a['lng'])) / 2) ** 2;

        return 6371 * 2 * asin(min(1, sqrt($h)));
    }

    /** Couriers deliver Monday to Saturday. */
    private static function addWorkingDays(Carbon $date, int $days): Carbon
    {
        $date = $date->copy()->startOfDay();
        while ($days > 0) {
            $date->addDay();
            if (!$date->isSunday()) {
                $days--;
            }
        }

        return $date;
    }

    /**
     * Why an order can't go to this address, or null. Only Indian addresses are checked; without a PIN code that's
     * fine unless we only deliver to listed areas.
     */
    public static function checkoutProblem(?string $postalCode, ?string $country): ?string
    {
        if (filled($country) && !in_array(mb_strtolower(trim($country)), ['india', 'in', 'ind', 'bharat'], true)) {
            return null;
        }
        $pincode = self::normalise($postalCode);
        if ($pincode === '') {
            return self::settings()['mode'] === 'listed' ? 'Enter your 6-digit PIN code so we can check we deliver there.' : null;
        }
        if (!self::valid($pincode)) {
            return 'Enter a 6-digit PIN code, like 302016.';
        }
        $result = self::check($pincode);

        return $result['deliverable'] ? null : $result['message'] . ' Please choose another address.';
    }
}
