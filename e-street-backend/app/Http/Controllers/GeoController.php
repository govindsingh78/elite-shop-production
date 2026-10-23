<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\File;

/** Countries → states → cities for address forms. Data lives in resources/geo (see its README). */
class GeoController extends Controller
{
    /** The lists only change when the data files are rebuilt, so browsers and apps may cache them for a day. */
    private const CACHE = 'public, max-age=86400';

    public function countries()
    {
        return response()->json($this->read('countries.json'), 200, ['Cache-Control' => self::CACHE]);
    }

    public function states(string $country)
    {
        $states = array_map(fn (array $state) => ['code' => $state['code'], 'name' => $state['name']], $this->regions($country));

        return response()->json($states, 200, ['Cache-Control' => self::CACHE]);
    }

    public function cities(string $country, string $state)
    {
        $region = collect($this->regions($country))->firstWhere('code', $state);
        abort_unless($region, 404, 'State not found.');

        return response()->json($region['cities'], 200, ['Cache-Control' => self::CACHE]);
    }

    private function regions(string $country): array
    {
        // Routes only let two letters through, so the code is safe to use as a file name.
        return $this->read('regions/' . strtoupper($country) . '.json');
    }

    private function read(string $file): array
    {
        $path = resource_path('geo/' . $file);
        abort_unless(File::isFile($path), 404, 'Not found.');

        return json_decode(File::get($path), true);
    }
}
