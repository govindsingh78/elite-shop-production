<?php

namespace App\Notifications;

use App\Models\Product;
use Illuminate\Notifications\Messages\MailMessage;

/** To a seller: the team approved their listing, or sent it back with a note. */
class ListingReviewed extends StoreMessage
{
    public function __construct(public Product $product)
    {
    }

    private function approved(): bool
    {
        return $this->product->approval_status === Product::APPROVED;
    }

    public function kind(): string
    {
        return 'listing';
    }

    public function title(): string
    {
        return $this->approved() ? 'Your listing is approved' : 'Changes needed on your listing';
    }

    public function body(): string
    {
        $title = "“{$this->product->title}”";
        if (!$this->approved()) {
            return "{$title} needs a few changes before it can go live: {$this->product->review_note}";
        }

        return (int) $this->product->status === 1
            ? "{$title} is now live in the Elitezaar store."
            : "{$title} is approved. Switch it on in your products to put it in the store.";
    }

    public function webPath(): ?string
    {
        return "/vendor/products/{$this->product->id}/edit";
    }

    public function appPath(): ?string
    {
        return "/vendor/product-form?id={$this->product->id}";
    }

    protected function actionLabel(): string
    {
        return $this->approved() ? 'View the listing' : 'Update the listing';
    }

    protected function mailDetails(MailMessage $mail): MailMessage
    {
        return $this->approved() ? $mail : $mail->line('Save your changes and it comes straight back to us for another look.');
    }
}
