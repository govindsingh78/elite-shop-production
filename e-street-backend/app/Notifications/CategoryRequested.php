<?php

namespace App\Notifications;

use App\Models\CategoryRequest;

/** To the store admins: a seller asked for a category or subcategory the store doesn't have yet. */
class CategoryRequested extends StoreMessage
{
    public function __construct(public CategoryRequest $request)
    {
    }

    public function kind(): string
    {
        return 'listing';
    }

    public function title(): string
    {
        return "Category request: {$this->request->label()}";
    }

    public function body(): string
    {
        $seller = $this->request->seller;
        $what = $this->request->parent
            ? "a new subcategory “{$this->request->name}” under {$this->request->parent->name}"
            : "a new main collection “{$this->request->name}”";
        $note = $this->request->note ? " Their note: “{$this->request->note}”." : '';

        return "{$seller->name} ({$seller->email}) asked for {$what}.{$note} Add it, or decline it with a reason.";
    }

    public function webPath(): ?string
    {
        return '/admin/category-requests';
    }

    public function appPath(): ?string
    {
        return '/admin/category-requests';
    }

    protected function actionLabel(): string
    {
        return 'Review the request';
    }
}
