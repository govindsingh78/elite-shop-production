<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\Category;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Understands what shoppers type or say, e.g. "show me linen shirts for men under 2000": price limits ("under
 * 2000", "between 500 and 1500"), a collection ("men") and a brand are picked out, filler words are dropped,
 * and every remaining word must appear in the product's title, description, SKU, brand or category.
 */
class ProductSearch
{
    /** Words people say around what they're looking for. */
    private const FILLER = [
        'a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'on', 'to', 'with', 'my', 'me', 'i', 'we', 'you', 'your', 'it', 'is', 'are', 'be',
        'show', 'find', 'search', 'searching', 'get', 'give', 'buy', 'want', 'wanted', 'need', 'looking', 'look', 'see', 'display', 'list',
        'please', 'some', 'any', 'all', 'that', 'which', 'what', 'can', 'could', 'would', 'like', 'do', 'have', 'has', 'something', 'anything',
        'product', 'item', 'thing', 'stuff', 'elitezaar', 'price', 'priced', 'cost', 'costing', 'rupee', 'rs', 'inr', 'only',
    ];

    /** Everyday words for the store's collections. */
    private const SYNONYMS = [
        'man' => 'men', 'gent' => 'men', 'male' => 'men', 'mens' => 'men',
        'woman' => 'women', 'lady' => 'women', 'female' => 'women', 'womens' => 'women',
        'child' => 'kid', 'children' => 'kid', 'baby' => 'kid', 'kids' => 'kid',
    ];

    private const CURRENCY = '(?:rs\.?|₹|inr|rupees?)?\s*';
    private const AMOUNT = '(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?';

    /**
     * What a search asks for.
     *
     * @return array{query: string, terms: string[], category: ?Category, brand: ?Brand, min_price: ?float, max_price: ?float}
     */
    public static function interpret(string $query): array
    {
        $text = ' ' . Str::lower(trim($query)) . ' ';
        $text = str_replace(['’', "'"], '', $text);
        $minPrice = null;
        $maxPrice = null;
        $amount = fn (string $number, ?string $thousands) => (float) str_replace(',', '', $number) * ($thousands ? 1000 : 1);

        // "between 500 and 1500", "from 500 to 1500", "500 to 1500 rupees"
        if (preg_match('/(?:between|from)?\s*' . self::CURRENCY . self::AMOUNT . '\s*(?:and|to|-)\s*' . self::CURRENCY . self::AMOUNT . '(?:\s*rupees?)?/u', $text, $match)
            && (preg_match('/\b(between|from)\b/', $match[0]) || preg_match('/rupees?|₹|rs/', $match[0]))) {
            $minPrice = $amount($match[1], $match[2] ?? null);
            $maxPrice = $amount($match[3], $match[4] ?? null);
            $text = str_replace($match[0], ' ', $text);
        }
        // "under 2000", "below ₹2,000", "less than 2k", "within 1500", "up to 999"
        if (preg_match('/\b(?:under|below|less than|lesser than|cheaper than|within|upto|up to|max(?:imum)?|not more than|not over)\s*' . self::CURRENCY . self::AMOUNT . '(?:\s*rupees?)?/u', $text, $match)) {
            $maxPrice = $amount($match[1], $match[2] ?? null);
            $text = str_replace($match[0], ' ', $text);
        }
        // "above 1000", "over ₹500", "more than 2k", "at least 999", "starting from 499"
        if (preg_match('/\b(?:above|over|more than|greater than|at least|min(?:imum)?|starting (?:from|at))\s*' . self::CURRENCY . self::AMOUNT . '(?:\s*rupees?)?/u', $text, $match)) {
            $minPrice = $amount($match[1], $match[2] ?? null);
            $text = str_replace($match[0], ' ', $text);
        }

        // A brand named in the search ("levis jeans") filters by that brand.
        $brand = Brand::query()->where('status', 1)->get(['id', 'name'])
            ->sortByDesc(fn (Brand $brand) => strlen($brand->name))
            ->first(fn (Brand $brand) => preg_match('/\b' . preg_quote(Str::lower($brand->name), '/') . '\b/u', $text) === 1);
        if ($brand) {
            $text = preg_replace('/\b' . preg_quote(Str::lower($brand->name), '/') . '\b/u', ' ', $text);
        }

        $words = collect(preg_split('/[^\p{L}\p{N}\-]+/u', $text, -1, PREG_SPLIT_NO_EMPTY))
            ->map(fn (string $word) => self::SYNONYMS[$word] ?? self::SYNONYMS[self::singular($word)] ?? self::singular($word))
            ->reject(fn (string $word) => in_array($word, self::FILLER, true) || (mb_strlen($word) < 2 && !ctype_digit($word)))
            ->values();

        // A collection named in the search ("for men", "kids toys") filters by it; the most specific one wins.
        [$category, $words] = self::pickCategory($words->all());

        return [
            'query' => trim($query),
            'terms' => array_values(array_unique($words)),
            'category' => $category,
            'brand' => $brand,
            'min_price' => $minPrice,
            'max_price' => $maxPrice !== null && $minPrice !== null && $maxPrice < $minPrice ? null : $maxPrice,
        ];
    }

    /**
     * Narrows the products to those matching every word (or, with `$any`, at least one) and puts the best
     * matches first: words in the title count most.
     */
    public static function apply(Builder $query, array $terms, bool $any = false): Builder
    {
        if (!$terms) {
            return $query;
        }

        $query->where(function (Builder $outer) use ($terms, $any) {
            foreach ($terms as $term) {
                $like = "%{$term}%"; // words are only letters, digits and hyphens, so nothing to escape
                $matches = fn (Builder $product) => $product->where('title', 'like', $like)
                    ->orWhere('short_description', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhere('sku', 'like', $like)
                    ->orWhereHas('brand', fn (Builder $brand) => $brand->where('name', 'like', $like))
                    ->orWhereHas('category', fn (Builder $category) => $category->where('name', 'like', $like)
                        ->orWhereHas('parent', fn (Builder $parent) => $parent->where('name', 'like', $like)));
                $any ? $outer->orWhere($matches) : $outer->where($matches);
            }
        });

        return $query;
    }

    /** Best matches first: each word in the title counts 3, in the short description 1. */
    public static function orderByRelevance(Builder $query, array $terms): Builder
    {
        if (!$terms) {
            return $query;
        }
        $parts = [];
        $bindings = [];
        foreach ($terms as $term) {
            $like = "%{$term}%"; // words are only letters, digits and hyphens, so nothing to escape
            $parts[] = '(CASE WHEN title LIKE ? THEN 3 ELSE 0 END + CASE WHEN short_description LIKE ? THEN 1 ELSE 0 END)';
            array_push($bindings, $like, $like);
        }

        return $query->orderByRaw('(' . implode(' + ', $parts) . ') DESC', $bindings);
    }

    /** "shirts" → "shirt", "dresses" → "dress", "accessories" → "accessory". */
    public static function singular(string $word): string
    {
        return match (true) {
            mb_strlen($word) > 4 && str_ends_with($word, 'ies') => mb_substr($word, 0, -3) . 'y',
            mb_strlen($word) > 4 && preg_match('/(ss|x|ch|sh)es$/u', $word) === 1 => mb_substr($word, 0, -2),
            mb_strlen($word) > 3 && str_ends_with($word, 's') && !str_ends_with($word, 'ss') && !str_ends_with($word, 'us') => mb_substr($word, 0, -1),
            default => $word,
        };
    }

    /**
     * Finds one of the store's main collections (Men, Women, Kids…) among the words, and returns it with the
     * words left over. Subcategory names ("shirts", "toys") stay as words: they still find products in that
     * subcategory through its name, and also products filed under the main collection with it in the title.
     * Two collections ("men and women") filter by neither.
     *
     * @return array{0: ?Category, 1: string[]}
     */
    private static function pickCategory(array $words): array
    {
        if (!$words) {
            return [null, $words];
        }
        $named = fn (Category $category) => [self::SYNONYMS[$name = self::singular(Str::lower($category->name))] ?? $name, self::singular(Str::lower($category->slug))];
        $found = Category::query()->where('status', 1)->whereNull('parent_id')->get(['id', 'name', 'slug'])
            ->filter(fn (Category $category) => array_intersect($named($category), $words) !== []);
        $remaining = array_values(array_diff($words, $found->flatMap($named)->all()));

        return match ($found->count()) {
            0 => [null, $words],
            1 => [$found->first(), $remaining],
            default => [null, $remaining],
        };
    }
}
