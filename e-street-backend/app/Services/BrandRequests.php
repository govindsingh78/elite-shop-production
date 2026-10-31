<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\BrandRequest;
use App\Models\User;
use App\Notifications\BrandRequested;
use App\Notifications\BrandRequestReviewed;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Sellers asking for a brand the store doesn't have yet, and admins adding it or declining. */
class BrandRequests
{
    /** How many a seller can ask for on the sign-up form. */
    public const AT_SIGN_UP = 3;

    /** How many a seller can have waiting at once. */
    public const MAX_PENDING = 5;

    /** Rules for one request; `$prefix` is "brand_requests.*." on the sign-up form. */
    public static function rules(string $prefix = ''): array
    {
        return [
            "{$prefix}name" => ['required', 'string', 'max:60'],
            "{$prefix}note" => ['nullable', 'string', 'max:300'],
        ];
    }

    public static function messages(string $prefix = ''): array
    {
        return [
            "{$prefix}name.required" => 'Enter the brand you need.',
            "{$prefix}name.max" => 'Keep the brand name under 60 characters.',
            "{$prefix}note.max" => 'Keep the note under 300 characters.',
        ];
    }

    /** Only the spacing changes: brands have their own capitals ("boAt", "adidas"). */
    public static function cleanName(string $name): string
    {
        return trim(preg_replace('/\s+/u', ' ', $name));
    }

    /** A brand with this name (case doesn't matter), switched on or not. */
    public static function existing(string $name): ?Brand
    {
        return Brand::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();
    }

    /**
     * Why this can't be asked for, or null: it's already in the store, or this seller is already waiting on it.
     * `$seller` is null on the sign-up form.
     */
    public static function problem(string $name, ?User $seller): ?string
    {
        $existing = self::existing($name);
        if ($existing && (int) $existing->status === 1) {
            return "“{$existing->name}” is already in the store. You can choose it when you list a product.";
        }
        if ($seller && BrandRequest::query()->pending()->where('seller_id', $seller->id)->sameAs($name)->exists()) {
            return 'You’ve already asked for this one. We’ll let you know once it’s added.';
        }

        return null;
    }

    /**
     * The brands asked for on the sign-up form, cleaned and checked. Errors are keyed like the form's fields
     * ("brand_requests.1.name").
     *
     * @return list<array{name: string, note: ?string}>
     */
    public static function forSignUp(array $items): array
    {
        $seen = [];
        $errors = [];
        $clean = [];
        foreach ($items as $index => $item) {
            $name = self::cleanName($item['name']);
            $key = mb_strtolower($name);
            $problem = isset($seen[$key]) ? 'You’ve asked for this one twice.' : self::problem($name, null);
            if ($problem) {
                $errors["brand_requests.{$index}.name"] = $problem;
            }
            $seen[$key] = true;
            $clean[] = ['name' => $name, 'note' => $item['note'] ?? null];
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return $clean;
    }

    /** A seller asks after signing up: the request is saved and the admins are told. Errors are keyed on `name`. */
    public static function file(User $seller, array $data): BrandRequest
    {
        $name = self::cleanName($data['name']);
        if ($problem = self::problem($name, $seller)) {
            throw ValidationException::withMessages(['name' => $problem]);
        }
        if (BrandRequest::query()->pending()->where('seller_id', $seller->id)->count() >= self::MAX_PENDING) {
            throw ValidationException::withMessages(['name' => 'You have ' . self::MAX_PENDING . ' requests waiting already. We’ll get to them soon.']);
        }

        $request = self::record($seller, $name, $data['note'] ?? null);
        Messenger::send(User::storeAdmins(), new BrandRequested($request));

        return $request;
    }

    /** Saves a request without telling anyone (at sign-up, the admins hear about it with the new seller). */
    public static function record(User $seller, string $name, ?string $note): BrandRequest
    {
        $request = new BrandRequest(['name' => $name, 'note' => filled($note) ? trim($note) : null]);
        $request->seller()->associate($seller);
        $request->save();

        return $request;
    }

    /**
     * An admin adds the brand. `$choice` is ['brand_id' => …] for one already in the store, or the name to add, which
     * defaults to what was asked for (the same name is reused, and switched on if it was off). Every seller waiting
     * on the same brand gets the answer.
     */
    public static function approve(BrandRequest $request, User $admin, array $choice): Brand
    {
        return DB::transaction(function () use ($request, $admin, $choice) {
            if (!empty($choice['brand_id'])) {
                $brand = Brand::query()->findOrFail($choice['brand_id']);
            } else {
                $name = self::cleanName($choice['name'] ?? $request->name);
                $brand = self::existing($name) ?? Brand::create(['name' => $name, 'status' => 1]);
            }
            if ((int) $brand->status !== 1) {
                $brand->update(['status' => 1]);
            }

            $waiting = BrandRequest::query()->pending()->sameAs($request->name)->whereKeyNot($request->id)->get()->prepend($request);
            foreach ($waiting as $each) {
                self::close($each, BrandRequest::APPROVED, $admin, ['brand_id' => $brand->id]);
            }

            return $brand;
        });
    }

    public static function decline(BrandRequest $request, User $admin, string $reason): void
    {
        self::close($request, BrandRequest::DECLINED, $admin, ['admin_note' => trim($reason)]);
    }

    /** Other sellers waiting on the same brand. */
    public static function alsoWaiting(BrandRequest $request): int
    {
        return BrandRequest::query()->pending()->sameAs($request->name)->whereKeyNot($request->id)->count();
    }

    private static function close(BrandRequest $request, string $status, User $admin, array $changes): void
    {
        $request->forceFill([...$changes, 'status' => $status, 'reviewed_by' => $admin->id, 'reviewed_at' => now()])->save();
        Messenger::send($request->seller, new BrandRequestReviewed($request->load('brand')));
    }
}
