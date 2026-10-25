<?php

namespace App\Services;

use App\Http\Controllers\Vendor\ProductController as VendorProductController;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Bulk product upload from a spreadsheet, for admins and sellers. The website reads the sheet and sends
 * its rows here; each row creates a product or, when its SKU is already one of the user's products,
 * updates it (blank cells keep the current value). The same rules as the product form apply: sellers
 * can only touch their own products, and their new or changed listings go to review.
 *
 * Row keys: sku, title, category, brand, price, compare_price, qty, short_description, description,
 * barcode, show_in_store, featured (admins only), images (file names, separated by commas), _row (sheet row).
 */
class BulkProductImport
{
    public const MAX_ROWS = 500;
    public const MAX_IMAGES_PER_ROW = 10;

    /** @var Collection<string, int> normalised category label or unique name => id */
    private Collection $categories;

    /** @var Collection<string, int> lower-case brand name => id */
    private Collection $brands;

    public function __construct(private User $user)
    {
        $this->categories = self::categoryLookup();
        $this->brands = Brand::query()->where('status', 1)->get(['id', 'name'])
            ->mapWithKeys(fn (Brand $brand) => [Str::lower(trim($brand->name)) => $brand->id]);
    }

    public function forAdmin(): bool
    {
        return $this->user->hasAdminRole();
    }

    /** What the sample sheet needs: the category and brand drop-downs, and who it's for. */
    public function templateData(): array
    {
        return [
            'portal' => $this->forAdmin() ? 'admin' : 'vendor',
            'owner' => ['name' => $this->user->name, 'email' => $this->user->email],
            'categories' => self::categoryOptions()->pluck('label')->values(),
            'brands' => Brand::query()->where('status', 1)->orderBy('name')->pluck('name'),
            'max_rows' => self::MAX_ROWS,
            'max_images' => self::MAX_IMAGES_PER_ROW,
        ];
    }

    /** The user's products as sheet rows, to update prices and stock in bulk. Admins get every product. */
    public function exportRows(int $limit = 2000): array
    {
        return Product::query()
            ->when(!$this->forAdmin(), fn ($query) => $query->where('vendor_id', $this->user->id))
            ->with(['category:id,name,parent_id', 'category.parent:id,name', 'brand:id,name'])
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->map(fn (Product $product) => array_filter([
                'sku' => $product->sku,
                'title' => $product->title,
                'category' => $product->category ? self::labelFor($product->category) : '',
                'brand' => $product->brand?->name ?? '',
                'price' => (float) $product->price,
                'compare_price' => $product->compare_price !== null ? (float) $product->compare_price : '',
                'qty' => $product->qty ?? '',
                'short_description' => $product->short_description ?? '',
                'description' => $product->description ?? '',
                'barcode' => $product->barcode ?? '',
                'show_in_store' => (int) $product->status === 1 ? 'Yes' : 'No',
                'featured' => $this->forAdmin() ? ($product->is_featured === 'yes' ? 'Yes' : 'No') : null,
                'images' => '',
            ], fn ($value) => $value !== null))
            ->all();
    }

    /**
     * Checks every row without saving anything.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @param  array<int, string>  $imageNames  file names of the photos the user selected
     */
    public function check(array $rows, array $imageNames): array
    {
        $results = $this->inspectAll($rows, $imageNames);

        return [
            'rows' => array_map(fn (array $result) => self::publicResult($result), $results),
            'summary' => $this->summarise($results),
        ];
    }

    /**
     * Saves every valid row; rows with problems are skipped and reported.
     *
     * @param  array<string, int>  $imageMap  photo file name => uploaded temp image id
     */
    public function import(array $rows, array $imageMap): array
    {
        $tempIds = collect($imageMap)->mapWithKeys(fn ($id, $name) => [Str::lower(basename((string) $name)) => (int) $id]);
        $results = $this->inspectAll($rows, $tempIds->keys()->all());
        $report = ['created' => 0, 'updated' => 0, 'skipped' => [], 'failed' => [], 'saved' => []];

        foreach ($results as $result) {
            if ($result['errors']) {
                $report['skipped'][] = self::publicResult($result);
                continue;
            }

            try {
                $product = DB::transaction(fn () => $this->save($result, $tempIds));
                $report[$result['action'] === 'create' ? 'created' : 'updated']++;
                $report['saved'][] = [
                    'row' => $result['row'], 'sku' => $product->sku, 'title' => $product->title, 'action' => $result['action'],
                    'product_id' => $product->id, 'approval_status' => $product->approval_status,
                ];
            } catch (Throwable $exception) {
                Log::warning('Bulk product row failed', ['row' => $result['row'], 'sku' => $result['sku'], 'error' => $exception->getMessage()]);
                $report['failed'][] = ['row' => $result['row'], 'sku' => $result['sku'], 'title' => $result['title'], 'errors' => ['This row couldn’t be saved. Please check it and try again.']];
            }
        }

        return $report;
    }

    private function save(array $result, Collection $tempIds): Product
    {
        $attributes = $result['attributes'];
        $imageIds = collect($result['images'])->map(fn ($name) => $tempIds->get(Str::lower($name)))->filter()->values()->all();
        $product = $result['product'];

        if (!$this->forAdmin()) {
            if (!$product) {
                $attributes['vendor_id'] = $this->user->id;
                $attributes['is_featured'] = 'no';
            }
            if (VendorProductController::needsReview($attributes, $product, $imageIds !== [])) {
                $attributes['approval_status'] = Product::PENDING;
                $attributes['review_note'] = null;
                $attributes['reviewed_at'] = null;
            }
        } elseif (!$product) {
            $attributes['approval_status'] = Product::APPROVED;
        }

        if ($product) {
            $product->update($attributes);
        } else {
            $product = Product::create($attributes);
        }
        ProductImages::attachTempImages($product, $imageIds);

        return $product->refresh();
    }

    /** @return array<int, array<string, mixed>> */
    private function inspectAll(array $rows, array $imageNames): array
    {
        $available = collect($imageNames)->map(fn ($name) => Str::lower(basename(trim((string) $name))))->flip();
        $seenSkus = [];
        $results = [];
        foreach (array_values($rows) as $index => $row) {
            $results[] = $this->inspect(is_array($row) ? $row : [], $index, $available, $seenSkus);
        }

        return $results;
    }

    private function inspect(array $row, int $index, Collection $available, array &$seenSkus): array
    {
        $text = fn (string $key) => trim((string) ($row[$key] ?? ''));
        $line = (int) ($row['_row'] ?? $index + 2);
        $errors = [];
        $warnings = [];
        $attributes = [];

        $sku = $text('sku');
        $product = null;
        if ($sku === '') {
            $errors[] = 'SKU is required.';
        } elseif (Str::length($sku) > 255) {
            $errors[] = 'SKU must be 255 characters or fewer.';
        } elseif (isset($seenSkus[Str::lower($sku)])) {
            $errors[] = "This SKU is already used on row {$seenSkus[Str::lower($sku)]} of this sheet.";
        } else {
            $seenSkus[Str::lower($sku)] = $line;
            $product = Product::query()->where('sku', $sku)->first();
            if ($product && !$this->forAdmin() && (int) $product->vendor_id !== (int) $this->user->id) {
                $errors[] = 'This SKU belongs to another product on Elitezaar. Use a different SKU.';
                $product = null;
            }
        }
        $creating = !$product;
        $attributes['sku'] = $sku;

        $title = $text('title');
        if (Str::length($title) > 255) {
            $errors[] = 'Title must be 255 characters or fewer.';
        } elseif ($title !== '') {
            $attributes['title'] = $title;
        } elseif ($creating) {
            $errors[] = 'Title is required.';
        }

        $category = $text('category');
        if ($category !== '') {
            $categoryId = $this->categories->get(self::normaliseLabel($category));
            if ($categoryId) {
                $attributes['category_id'] = $categoryId;
            } else {
                $errors[] = "Category “{$category}” isn’t on Elitezaar. Pick one from the drop-down list.";
            }
        } elseif ($creating) {
            $errors[] = 'Category is required.';
        }

        $brand = $text('brand');
        if ($brand !== '') {
            $brandId = $this->brands->get(Str::lower($brand));
            if ($brandId) {
                $attributes['brand_id'] = $brandId;
            } else {
                $errors[] = "Brand “{$brand}” isn’t on Elitezaar. Pick one from the drop-down list.";
            }
        } elseif ($creating) {
            $errors[] = 'Brand is required.';
        }

        foreach (['price' => 'Price', 'compare_price' => 'MRP'] as $key => $label) {
            $raw = $text($key);
            if ($raw === '') {
                if ($key === 'price' && $creating) {
                    $errors[] = 'Price is required.';
                }
                continue;
            }
            $amount = self::money($raw);
            if ($amount === null || $amount < 0) {
                $errors[] = "{$label} must be a number, like 1499 or 1499.50.";
            } else {
                $attributes[$key] = $amount;
            }
        }
        $price = $attributes['price'] ?? (float) ($product?->price ?? 0);
        if (isset($attributes['compare_price']) && $attributes['compare_price'] > 0 && $attributes['compare_price'] < $price) {
            $warnings[] = 'MRP is lower than the price, so no discount will show.';
        }

        $qty = $text('qty');
        if ($qty !== '') {
            if (!preg_match('/^\d+(\.0+)?$/', $qty)) {
                $errors[] = 'Stock must be a whole number, like 25. Leave it blank if you don’t track stock.';
            } else {
                $attributes['qty'] = (int) $qty;
                if ($attributes['qty'] === 0) {
                    $warnings[] = 'Stock is 0, so it shows as sold out.';
                }
            }
        }

        foreach (['short_description', 'description'] as $key) {
            if ($text($key) !== '') {
                $attributes[$key] = $text($key);
            }
        }
        $barcode = $text('barcode');
        if (Str::length($barcode) > 255) {
            $errors[] = 'Barcode must be 255 characters or fewer.';
        } elseif ($barcode !== '') {
            $attributes['barcode'] = $barcode;
        } elseif ($creating) {
            $attributes['barcode'] = '';
        }

        if ($text('show_in_store') !== '') {
            $show = self::yesNo($text('show_in_store'));
            if ($show === null) {
                $errors[] = 'Show in store must be Yes or No.';
            } else {
                $attributes['status'] = $show ? 1 : 0;
            }
        } elseif ($creating) {
            $attributes['status'] = 1;
        }

        // Featured placement is a store decision: sellers' sheets don't have this column.
        if ($this->forAdmin()) {
            if ($text('featured') !== '') {
                $featured = self::yesNo($text('featured'));
                if ($featured === null) {
                    $errors[] = 'Featured must be Yes or No.';
                } else {
                    $attributes['is_featured'] = $featured ? 'yes' : 'no';
                }
            } elseif ($creating) {
                $attributes['is_featured'] = 'no';
            }
        }

        $images = collect(preg_split('/[,;\n]+/', $text('images')) ?: [])
            ->map(fn ($name) => basename(str_replace('\\', '/', trim($name))))
            ->filter()
            ->unique(fn ($name) => Str::lower($name))
            ->values();
        if ($images->count() > self::MAX_IMAGES_PER_ROW) {
            $errors[] = 'Use at most ' . self::MAX_IMAGES_PER_ROW . ' photos per product.';
        }
        $missing = $images->reject(fn ($name) => $available->has(Str::lower($name)));
        if ($missing->isNotEmpty()) {
            $errors[] = 'Photo' . ($missing->count() > 1 ? 's' : '') . ' not among the files you selected: ' . $missing->implode(', ') . '.';
        }
        if ($creating && $images->isEmpty()) {
            $warnings[] = 'No photos. Products with photos sell much better.';
        }

        return [
            'row' => $line,
            'sku' => $sku,
            'title' => $attributes['title'] ?? $product?->title ?? '',
            'action' => $sku === '' ? null : ($creating ? 'create' : 'update'),
            'errors' => $errors,
            'warnings' => $warnings,
            'images' => $images->all(),
            'attributes' => $attributes,
            'product' => $product,
        ];
    }

    private function summarise(array $results): array
    {
        $valid = array_filter($results, fn ($result) => !$result['errors']);

        return [
            'total' => count($results),
            'create' => count(array_filter($valid, fn ($result) => $result['action'] === 'create')),
            'update' => count(array_filter($valid, fn ($result) => $result['action'] === 'update')),
            'errors' => count($results) - count($valid),
            'images' => count(array_unique(array_merge([], ...array_map(fn ($result) => array_map('strtolower', $result['images']), $valid)))),
        ];
    }

    private static function publicResult(array $result): array
    {
        return array_diff_key($result, ['attributes' => true, 'product' => true]);
    }

    private const YES = ['yes', 'y', 'true', '1', 'active', 'show', 'live'];
    private const NO = ['no', 'n', 'false', '0', 'hidden', 'hide', 'inactive'];

    /** "Yes" → true, "No" → false, anything else → null. */
    private static function yesNo(string $value): ?bool
    {
        $value = Str::lower(trim($value));

        return in_array($value, self::YES, true) ? true : (in_array($value, self::NO, true) ? false : null);
    }

    /** "₹1,499.50" → 1499.5 */
    private static function money(string $value): ?float
    {
        $clean = preg_replace('/[₹,\s]|rs\.?|inr/i', '', $value);

        return is_numeric($clean) ? round((float) $clean, 2) : null;
    }

    private static function normaliseLabel(string $label): string
    {
        return Str::lower(preg_replace('/\s*(›|»|>|\/)\s*/u', ' › ', trim(preg_replace('/\s+/u', ' ', $label))));
    }

    private static function labelFor(Category $category): string
    {
        return $category->parent ? "{$category->parent->name} › {$category->name}" : $category->name;
    }

    /** Active categories in tree order, labelled "Kids › Toys" (as in the product form). */
    private static function categoryOptions(): Collection
    {
        $categories = Category::query()->where('status', 1)->orderBy('name')->get(['id', 'name', 'parent_id']);
        $children = $categories->whereNotNull('parent_id')->groupBy('parent_id');

        return $categories->whereNull('parent_id')->flatMap(fn (Category $parent) => [
            ['id' => $parent->id, 'name' => $parent->name, 'label' => $parent->name],
            ...($children->get($parent->id) ?? collect())->map(fn (Category $child) => [
                'id' => $child->id, 'name' => $child->name, 'label' => "{$parent->name} › {$child->name}",
            ])->all(),
        ])->values();
    }

    /** Labels always match; a plain name matches too when only one category has it. */
    private static function categoryLookup(): Collection
    {
        $options = self::categoryOptions();
        $lookup = $options->mapWithKeys(fn ($option) => [self::normaliseLabel($option['label']) => $option['id']]);
        $options->groupBy(fn ($option) => Str::lower($option['name']))
            ->filter(fn ($group) => $group->count() === 1)
            ->each(function ($group, $name) use (&$lookup) {
                $lookup->put(self::normaliseLabel($name), $group->first()['id']);
            });

        return $lookup;
    }
}
