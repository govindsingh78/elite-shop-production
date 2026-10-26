<?php

namespace App\Notifications;

use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Collection;

/** To the store admins: a seller sent one listing (or a bulk upload of them) for review. */
class ListingsAwaitingReview extends StoreMessage
{
    /** @param Collection<int, Product> $products */
    public function __construct(public User $seller, public Collection $products)
    {
    }

    private function single(): ?Product
    {
        return $this->products->count() === 1 ? $this->products->first() : null;
    }

    public function kind(): string
    {
        return 'listing';
    }

    public function title(): string
    {
        return $this->single() ? 'New listing to review' : "{$this->products->count()} listings to review";
    }

    public function body(): string
    {
        return $this->single()
            ? "{$this->seller->name} sent “{$this->single()->title}” for review."
            : "{$this->seller->name} uploaded {$this->products->count()} products for review.";
    }

    public function webPath(): ?string
    {
        return $this->single() ? "/admin/edit-product/{$this->single()->id}" : '/admin/manage-products';
    }

    public function appPath(): ?string
    {
        return $this->single() ? "/admin/product-form?id={$this->single()->id}" : '/admin/products';
    }

    protected function actionLabel(): string
    {
        return $this->single() ? 'Review the listing' : 'Review the listings';
    }
}
