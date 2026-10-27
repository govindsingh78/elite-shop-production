<?php

namespace App\Notifications;

use App\Models\CategoryRequest;

/** To a seller: an admin added the category they asked for (or pointed them to one), or declined it. */
class CategoryRequestReviewed extends StoreMessage
{
    public function __construct(public CategoryRequest $request)
    {
    }

    public function kind(): string
    {
        return 'listing';
    }

    private function approved(): bool
    {
        return $this->request->status === CategoryRequest::APPROVED && $this->request->category;
    }

    /** "Kids › Footwear", or just "Footwear" for a main collection. */
    private function categoryLabel(): string
    {
        $category = $this->request->category;

        return $category->parent ? "{$category->parent->name} › {$category->name}" : $category->name;
    }

    /** Ready to list it straight away (not a seller still waiting for approval, or deactivated). */
    private function canList(): bool
    {
        return $this->approved() && $this->request->seller->canSell();
    }

    public function title(): string
    {
        return $this->approved()
            ? "“{$this->request->category->name}” is ready for your products"
            : "We didn’t add “{$this->request->name}”";
    }

    public function body(): string
    {
        if ($this->approved()) {
            $asked = mb_strtolower($this->categoryLabel()) === mb_strtolower($this->request->label()) ? '' : "You asked for “{$this->request->label()}”. ";

            return "{$asked}You can now choose {$this->categoryLabel()} when you list a product.";
        }
        $reason = $this->request->admin_note ? ' Reason: ' . rtrim($this->request->admin_note, '. ') . '.' : '';

        return "You asked for “{$this->request->label()}”, and our team didn’t add it.{$reason} Choose the closest category for now, or ask for a different one.";
    }

    public function webPath(): ?string
    {
        return $this->canList() ? '/vendor/products/create' : '/vendor/category-requests';
    }

    public function appPath(): ?string
    {
        return $this->canList() ? '/vendor/product-form' : '/vendor/category-requests';
    }

    protected function actionLabel(): string
    {
        return $this->canList() ? 'List a product' : 'See your category requests';
    }
}
