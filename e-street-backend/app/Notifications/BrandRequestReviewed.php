<?php

namespace App\Notifications;

use App\Models\BrandRequest;

/** To a seller: an admin added the brand they asked for (or pointed them to one), or declined it. */
class BrandRequestReviewed extends StoreMessage
{
    public function __construct(public BrandRequest $request)
    {
    }

    public function kind(): string
    {
        return 'listing';
    }

    private function approved(): bool
    {
        return $this->request->status === BrandRequest::APPROVED && $this->request->brand;
    }

    /** Ready to list it straight away (not a seller still waiting for approval, or deactivated). */
    private function canList(): bool
    {
        return $this->approved() && $this->request->seller->canSell();
    }

    public function title(): string
    {
        return $this->approved()
            ? "“{$this->request->brand->name}” is ready for your products"
            : "We didn’t add “{$this->request->name}”";
    }

    public function body(): string
    {
        if ($this->approved()) {
            $brand = $this->request->brand->name;
            $asked = mb_strtolower($brand) === mb_strtolower($this->request->name) ? '' : "You asked for “{$this->request->name}”. ";

            return "{$asked}You can now choose {$brand} when you list a product.";
        }
        $reason = $this->request->admin_note ? ' Reason: ' . rtrim($this->request->admin_note, '. ') . '.' : '';

        return "You asked for “{$this->request->name}”, and our team didn’t add it.{$reason} Choose the closest brand for now, or ask for a different one.";
    }

    public function webPath(): ?string
    {
        return $this->canList() ? '/vendor/products/create' : '/vendor/brand-requests';
    }

    public function appPath(): ?string
    {
        return $this->canList() ? '/vendor/product-form' : '/vendor/brand-requests';
    }

    protected function actionLabel(): string
    {
        return $this->canList() ? 'List a product' : 'See your brand requests';
    }
}
