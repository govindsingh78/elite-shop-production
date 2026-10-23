<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\File;

/** Store policies (e.g. returns and refunds), kept as JSON in resources/policies so the website and app show the same text. */
class PolicyController extends Controller
{
    public const RETURN_REFUND = 'return-refund';

    public function show(string $policy)
    {
        return response()->json(self::load($policy), 200, ['Cache-Control' => 'public, max-age=3600']);
    }

    /** The version shoppers accept at checkout, recorded on each order. */
    public static function version(string $policy): string
    {
        return self::load($policy)['version'];
    }

    private static function load(string $policy): array
    {
        // Routes only let lowercase letters and hyphens through, so the slug is safe to use as a file name.
        $path = resource_path("policies/{$policy}.json");
        abort_unless(File::isFile($path), 404, 'Policy not found.');

        return json_decode(File::get($path), true);
    }
}
