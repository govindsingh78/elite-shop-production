<?php

namespace App\Notifications;

use App\Models\BrandRequest;

/** To the store admins: a seller asked for a brand the store doesn't have yet. */
class BrandRequested extends StoreMessage
{
    public function __construct(public BrandRequest $request)
    {
    }

    public function kind(): string
    {
        return 'listing';
    }

    public function title(): string
    {
        return "Brand request: {$this->request->name}";
    }

    public function body(): string
    {
        $seller = $this->request->seller;
        $note = $this->request->note ? " Their note: “{$this->request->note}”." : '';

        return "{$seller->name} ({$seller->email}) asked for a new brand, “{$this->request->name}”.{$note} Add it, or decline it with a reason.";
    }

    public function webPath(): ?string
    {
        return '/admin/brand-requests';
    }

    public function appPath(): ?string
    {
        return '/admin/brand-requests';
    }

    protected function actionLabel(): string
    {
        return 'Review the request';
    }
}
