<?php

namespace App\Http\Controllers;

use App\Services\BulkProductImport;
use Illuminate\Http\Request;

/**
 * Bulk product upload for admins (/api/admin/bulk-products/…) and sellers (/api/vendor/bulk-products/…).
 * The website builds and reads the spreadsheet; these endpoints supply its drop-down lists, check rows,
 * and save them. Sellers only ever see and change their own products.
 */
class BulkProductController extends Controller
{
    public function template(Request $request)
    {
        return response()->json((new BulkProductImport($request->user()))->templateData());
    }

    public function export(Request $request)
    {
        $import = new BulkProductImport($request->user());

        return response()->json([...$import->templateData(), 'rows' => $import->exportRows()]);
    }

    public function check(Request $request)
    {
        $validated = $request->validate($this->rules() + [
            'image_names' => ['sometimes', 'array', 'max:2000'],
            'image_names.*' => ['string', 'max:255'],
        ]);

        return response()->json((new BulkProductImport($request->user()))->check($validated['rows'], $validated['image_names'] ?? []));
    }

    public function import(Request $request)
    {
        // Photos come as [{name, id}] (not {name: id}), since file names contain dots.
        $validated = $request->validate($this->rules() + [
            'images' => ['sometimes', 'array', 'max:2000'],
            'images.*.name' => ['required', 'string', 'max:255'],
            'images.*.id' => ['required', 'integer', 'exists:temp_images,id'],
        ]);
        $imageMap = collect($validated['images'] ?? [])->mapWithKeys(fn ($image) => [$image['name'] => $image['id']])->all();

        $report = (new BulkProductImport($request->user()))->import($validated['rows'], $imageMap);

        return response()->json([
            ...$report,
            'message' => $this->message($report, $request->user()->role === 'seller'),
        ]);
    }

    private function rules(): array
    {
        return [
            'rows' => ['required', 'array', 'min:1', 'max:' . BulkProductImport::MAX_ROWS],
            'rows.*' => ['array'],
        ];
    }

    private function message(array $report, bool $seller): string
    {
        $parts = array_filter([
            $report['created'] ? "{$report['created']} " . ($report['created'] === 1 ? 'product' : 'products') . ' added' : null,
            $report['updated'] ? "{$report['updated']} updated" : null,
            ($skipped = count($report['skipped']) + count($report['failed'])) ? "{$skipped} skipped" : null,
        ]);
        $summary = $parts ? ucfirst(implode(', ', $parts)) . '.' : 'Nothing was saved.';

        return $seller && ($report['created'] || $report['updated'])
            ? "{$summary} New and changed listings go live once our team approves them."
            : $summary;
    }
}
