<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * GST on Elitezaar. Prices shown to shoppers include GST, so tax is worked backwards from them: the
 * taxable value is price ÷ (1 + rate), split into CGST + SGST when the supplier and the delivery address are
 * in the same state, or IGST when they aren't. A supplier without a GSTIN charges no GST (bill of supply).
 *
 * Rates are the store's to set (category defaults, product overrides); check them with your accountant.
 */
class Gst
{
    /** GST state codes. */
    public const STATES = [
        '01' => 'Jammu and Kashmir', '02' => 'Himachal Pradesh', '03' => 'Punjab', '04' => 'Chandigarh', '05' => 'Uttarakhand',
        '06' => 'Haryana', '07' => 'Delhi', '08' => 'Rajasthan', '09' => 'Uttar Pradesh', '10' => 'Bihar', '11' => 'Sikkim',
        '12' => 'Arunachal Pradesh', '13' => 'Nagaland', '14' => 'Manipur', '15' => 'Mizoram', '16' => 'Tripura',
        '17' => 'Meghalaya', '18' => 'Assam', '19' => 'West Bengal', '20' => 'Jharkhand', '21' => 'Odisha',
        '22' => 'Chhattisgarh', '23' => 'Madhya Pradesh', '24' => 'Gujarat', '26' => 'Dadra and Nagar Haveli and Daman and Diu',
        '27' => 'Maharashtra', '29' => 'Karnataka', '30' => 'Goa', '31' => 'Lakshadweep', '32' => 'Kerala',
        '33' => 'Tamil Nadu', '34' => 'Puducherry', '35' => 'Andaman and Nicobar Islands', '36' => 'Telangana',
        '37' => 'Andhra Pradesh', '38' => 'Ladakh', '97' => 'Other Territory',
    ];

    /** Older or everyday names for the same states. */
    private const ALIASES = [
        'orissa' => '21', 'pondicherry' => '34', 'uttaranchal' => '05', 'newdelhi' => '07', 'nctofdelhi' => '07',
        'nationalcapitalterritoryofdelhi' => '07', 'dadraandnagarhaveli' => '26', 'damananddiu' => '26', 'jandk' => '01',
    ];

    /** The usual GST rates, offered in the forms. */
    public const RATES = [0, 3, 5, 12, 18, 28, 40];

    private const STORE_DEFAULTS = [
        'legal_name' => 'Elitezaar',
        'gstin' => null,
        'address' => '',
        'state_code' => null,
        'invoice_prefix' => 'EZ',
        // Clothing and footwear under GST 2.0 (from 22 Sept 2025): 5% up to ₹2,500 a piece, 18% above.
        'default_rate' => 5,
        'default_rate_high' => 18,
        'default_threshold' => 2500,
        'shipping_rate' => 18,
    ];

    /** The store's own GST details and defaults (admin settings). */
    public static function store(): array
    {
        $saved = json_decode((string) Setting::read('gst.store', ''), true);

        return array_merge(self::STORE_DEFAULTS, is_array($saved) ? $saved : []);
    }

    public static function saveStore(array $values): array
    {
        $store = array_merge(self::store(), $values);
        Setting::write('gst.store', json_encode($store));

        return $store;
    }

    /** "Rajasthan" (or "RJ"-style codes like "08") → "08"; null if it isn't an Indian state or UT. */
    public static function stateCode(?string $state): ?string
    {
        $state = trim((string) $state);
        if ($state === '') {
            return null;
        }
        if (isset(self::STATES[$state])) {
            return $state;
        }
        $key = preg_replace('/[^a-z]/', '', str_replace('&', 'and', Str::lower($state)));
        foreach (self::STATES as $code => $name) {
            if (preg_replace('/[^a-z]/', '', Str::lower($name)) === $key) {
                return $code;
            }
        }

        return self::ALIASES[$key] ?? null;
    }

    /** Where the order is delivered, as a state code; null outside India. */
    public static function placeOfSupply(?string $state, ?string $country): ?string
    {
        $country = Str::lower(trim((string) $country));

        return $country === '' || in_array($country, ['india', 'in', 'ind'], true) ? self::stateCode($state) : null;
    }

    /** Format and check digit, e.g. 27AAPFU0939F1ZV. */
    public static function validGstin(?string $gstin): bool
    {
        $gstin = Str::upper(trim((string) $gstin));
        if (!preg_match('/^(\d{2})[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/', $gstin, $match) || !isset(self::STATES[$match[1]])) {
            return false;
        }
        $chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $sum = 0;
        for ($i = 0; $i < 14; $i++) {
            $product = strpos($chars, $gstin[$i]) * ($i % 2 === 0 ? 1 : 2);
            $sum += intdiv($product, 36) + $product % 36;
        }

        return $chars[(36 - $sum % 36) % 36] === $gstin[14];
    }

    /** The supplier of a product: its seller, or (null) Elitezaar. Returns [registered, state code]. */
    public static function supplier(?User $seller): array
    {
        if ($seller) {
            return [self::validGstin($seller->gstin), $seller->business_state ?: ($seller->gstin ? substr($seller->gstin, 0, 2) : null)];
        }
        $store = self::store();

        return [self::validGstin($store['gstin']), $store['state_code'] ?: ($store['gstin'] ? substr($store['gstin'], 0, 2) : null)];
    }

    /**
     * The HSN code and GST rate for a product sold at `unitPrice` (GST included): the product's own, else its
     * category's (or the parent category's), else the store default. A higher rate applies when the value per
     * piece before GST is above the threshold.
     *
     * @return array{hsn_code: ?string, gst_rate: float}
     */
    public static function rateFor(?Product $product, float $unitPrice): array
    {
        $category = $product?->category_id ? Category::query()->with('parent')->find($product->category_id) : null;
        $hsn = $product?->hsn_code ?: $category?->hsn_code ?: $category?->parent?->hsn_code;

        if ($product?->gst_rate !== null) {
            return ['hsn_code' => $hsn, 'gst_rate' => (float) $product->gst_rate];
        }
        $rule = collect([$category, $category?->parent])->filter()->first(fn (Category $item) => $item->gst_rate !== null);
        $store = self::store();
        [$rate, $high, $threshold] = $rule
            ? [(float) $rule->gst_rate, $rule->gst_rate_high, $rule->gst_threshold]
            : [(float) $store['default_rate'], $store['default_rate_high'], $store['default_threshold']];

        if ($high !== null && $threshold !== null && $unitPrice / (1 + $rate / 100) > (float) $threshold) {
            $rate = (float) $high;
        }

        return ['hsn_code' => $hsn, 'gst_rate' => $rate];
    }

    /**
     * Splits a GST-inclusive amount. Within one state the tax is shared equally by CGST and SGST.
     *
     * @return array{taxable_value: float, cgst: float, sgst: float, igst: float}
     */
    public static function split(float $amount, float $rate, bool $sameState): array
    {
        $taxable = round($amount / (1 + $rate / 100), 2);
        $tax = round($amount - $taxable, 2);
        if (!$sameState) {
            return ['taxable_value' => $taxable, 'cgst' => 0.0, 'sgst' => 0.0, 'igst' => $tax];
        }
        $cgst = round($tax / 2, 2);

        return ['taxable_value' => $taxable, 'cgst' => $cgst, 'sgst' => round($tax - $cgst, 2), 'igst' => 0.0];
    }

    /**
     * GST on one order line, for the order_items columns. Unregistered suppliers charge none.
     *
     * @return array{hsn_code: ?string, gst_rate: float, taxable_value: float, cgst: float, sgst: float, igst: float}
     */
    public static function forLine(?Product $product, float $unitPrice, float $lineTotal, ?User $seller, ?string $placeOfSupply): array
    {
        [$registered, $supplierState] = self::supplier($seller);
        $rate = self::rateFor($product, $unitPrice);
        if (!$registered) {
            return ['hsn_code' => $rate['hsn_code'], 'gst_rate' => 0.0, 'taxable_value' => round($lineTotal, 2), 'cgst' => 0.0, 'sgst' => 0.0, 'igst' => 0.0];
        }

        return ['hsn_code' => $rate['hsn_code'], 'gst_rate' => $rate['gst_rate'],
            ...self::split($lineTotal, $rate['gst_rate'], $supplierState !== null && $supplierState === $placeOfSupply)];
    }

    /** Validation rule: an optional, valid GSTIN. */
    public static function gstinRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) {
            if ($value !== null && $value !== '' && !self::validGstin($value)) {
                $fail('That GSTIN doesn’t look right. It has 15 characters, like 08ABCDE1234F1Z5.');
            }
        };
    }
}
