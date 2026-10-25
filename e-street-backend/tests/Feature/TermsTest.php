<?php

namespace Tests\Feature;

use Tests\TestCase;

class TermsTest extends TestCase
{
    public function test_terms_are_served_to_the_website_and_app(): void
    {
        $terms = $this->getJson('/api/storefront/policies/terms')->assertOk()
            ->assertHeader('Cache-Control', 'max-age=3600, public')
            ->assertJsonPath('slug', 'terms')
            ->assertJsonPath('title', 'Terms & Conditions')
            ->assertJsonCount(4, 'highlights')
            ->json();

        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $terms['version']);
        $this->assertNotEmpty($terms['intro']);
        $this->assertSame('contact', collect($terms['sections'])->last()['id']);
    }

    public function test_every_section_is_well_formed_and_links_to_real_policies(): void
    {
        $terms = json_decode(file_get_contents(resource_path('policies/terms.json')), true);
        $ids = array_column($terms['sections'], 'id');
        $this->assertSame(array_unique($ids), $ids, 'Section ids are used as page anchors, so they must be unique.');

        foreach ($terms['sections'] as $section) {
            $this->assertNotEmpty($section['title']);
            foreach ($section['blocks'] as $block) {
                $this->assertContains($block['type'], ['p', 'list', 'steps', 'note', 'link'], "Unknown block in {$section['id']}");
                if ($block['type'] === 'link') {
                    $this->assertFileExists(resource_path("policies/{$block['to']}.json"));
                    $this->getJson("/api/storefront/policies/{$block['to']}")->assertOk();
                }
            }
        }
    }
}
