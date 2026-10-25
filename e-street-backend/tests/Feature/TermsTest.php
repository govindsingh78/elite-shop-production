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

    public function test_privacy_policy_is_served_with_the_sections_people_and_app_stores_look_for(): void
    {
        $privacy = $this->getJson('/api/storefront/policies/privacy')->assertOk()
            ->assertJsonPath('slug', 'privacy')
            ->assertJsonPath('title', 'Privacy Policy')
            ->assertJsonCount(4, 'highlights')
            ->json();

        $ids = array_column($privacy['sections'], 'id');
        // Google Play links to #delete-account as the account deletion page; the rest are what the law expects a notice to cover.
        foreach (['information-we-collect', 'how-we-use', 'sharing', 'security', 'retention', 'your-rights', 'delete-account', 'children', 'contact'] as $id) {
            $this->assertContains($id, $ids);
        }
        $this->assertTrue(collect($privacy['sections'])->firstWhere('id', 'contact')['contact']);
    }

    /** Every policy file: unique section anchors, known block types, and links only to policies that exist. */
    public function test_every_policy_is_well_formed_and_links_to_real_policies(): void
    {
        $files = glob(resource_path('policies/*.json'));
        $this->assertGreaterThanOrEqual(3, count($files));

        foreach ($files as $file) {
            $policy = json_decode(file_get_contents($file), true);
            $this->assertIsArray($policy, basename($file) . ' must be valid JSON.');
            $this->assertSame(basename($file, '.json'), $policy['slug']);
            $ids = array_column($policy['sections'], 'id');
            $this->assertSame(array_unique($ids), $ids, "Section ids in {$policy['slug']} are page anchors, so they must be unique.");

            foreach ($policy['sections'] as $section) {
                $this->assertNotEmpty($section['title']);
                foreach ($section['blocks'] as $block) {
                    $this->assertContains($block['type'], ['p', 'list', 'steps', 'note', 'link'], "Unknown block in {$policy['slug']}#{$section['id']}");
                    if ($block['type'] === 'link') {
                        $this->assertFileExists(resource_path("policies/{$block['to']}.json"));
                        $this->getJson("/api/storefront/policies/{$block['to']}")->assertOk();
                    }
                }
            }
        }
    }
}
