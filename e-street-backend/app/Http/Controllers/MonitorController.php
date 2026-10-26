<?php

namespace App\Http\Controllers;

use App\Services\Monitoring\Problems;
use App\Services\Monitoring\Speed;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** What the website and app report back: crashes people ran into, and how fast website pages loaded. */
class MonitorController extends Controller
{
    /** A page path with ids and names swapped for placeholders, e.g. /product/:handle. */
    private const PAGE = 'regex:/^\/[A-Za-z0-9\/:._-]*$/';

    public function clientError(Request $request)
    {
        $report = $request->validate([
            'source' => ['required', Rule::in(['website', 'app'])],
            'message' => ['required', 'string', 'max:2000'],
            'stack' => ['nullable', 'string', 'max:8000'],
            'page' => ['nullable', 'string', 'max:191', self::PAGE],
            'component' => ['nullable', 'string', 'max:191'],
            'platform' => ['nullable', 'string', 'max:60'],
            'version' => ['nullable', 'string', 'max:30'],
        ]);
        Problems::fromClient($report, $request->user('sanctum'));

        return response()->noContent();
    }

    public function pageSpeed(Request $request)
    {
        $timing = $request->validate([
            'page' => ['required', 'string', 'max:191', self::PAGE],
            'device' => ['required', Rule::in(['mobile', 'desktop'])],
            'lcp' => ['required', 'integer', 'min:0', 'max:120000'],
            'ttfb' => ['nullable', 'integer', 'min:0', 'max:120000'],
            'load' => ['nullable', 'integer', 'min:0', 'max:300000'],
        ]);
        Speed::recordPage($timing['page'], $timing['device'], $timing['lcp'], (int) ($timing['ttfb'] ?? 0), (int) ($timing['load'] ?? 0));

        return response()->noContent();
    }
}
