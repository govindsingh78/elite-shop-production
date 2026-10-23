<?php

namespace Tests\Feature;

use Tests\TestCase;

class GeoTest extends TestCase
{
    public function test_lists_every_country_with_iso_codes(): void
    {
        $countries = $this->getJson('/api/geo/countries')->assertOk()
            ->assertHeader('Cache-Control', 'max-age=86400, public')
            ->json();

        $this->assertGreaterThan(240, count($countries));
        $this->assertContains(['code' => 'IN', 'name' => 'India'], $countries);
    }

    public function test_states_then_cities_for_a_country(): void
    {
        $states = collect($this->getJson('/api/geo/countries/in/states')->assertOk()->json());
        $maharashtra = $states->firstWhere('name', 'Maharashtra');

        $this->assertCount(36, $states);
        $this->assertSame(['code', 'name'], array_keys($maharashtra));
        $this->assertContains('Mumbai', $this->getJson("/api/geo/countries/IN/states/{$maharashtra['code']}/cities")->assertOk()->json());
    }

    public function test_countries_without_states_return_an_empty_list(): void
    {
        $this->getJson('/api/geo/countries/MO/states')->assertOk()->assertExactJson([]);
    }

    public function test_unknown_codes_are_not_found(): void
    {
        $this->getJson('/api/geo/countries/ZZ/states')->assertNotFound();
        $this->getJson('/api/geo/countries/IN/states/NOPE/cities')->assertNotFound();
        $this->getJson('/api/geo/countries/IND/states')->assertNotFound();
        $this->getJson('/api/geo/countries/..%2F..%2Fenv/states')->assertNotFound();
    }
}
