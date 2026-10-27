<?php

namespace App\Services;

use App\Models\Category;
use App\Models\CategoryRequest;
use App\Models\User;
use App\Notifications\CategoryRequested;
use App\Notifications\CategoryRequestReviewed;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Sellers asking for a category or subcategory the store doesn't have yet, and admins adding it or declining.
 * A request goes under one of the main collections (a subcategory) or asks for a new main collection: the
 * store's categories are one level deep.
 */
class CategoryRequests
{
    /** How many a seller can ask for on the sign-up form. */
    public const AT_SIGN_UP = 3;

    /** How many a seller can have waiting at once. */
    public const MAX_PENDING = 5;

    /** Rules for one request; `$prefix` is "category_requests.*." on the sign-up form. */
    public static function rules(string $prefix = ''): array
    {
        return [
            "{$prefix}name" => ['required', 'string', 'max:60'],
            "{$prefix}parent_id" => ['nullable', 'integer', Rule::exists('categories', 'id')->whereNull('parent_id')],
            "{$prefix}note" => ['nullable', 'string', 'max:300'],
        ];
    }

    public static function messages(string $prefix = ''): array
    {
        return [
            "{$prefix}name.required" => 'Enter the category you need.',
            "{$prefix}name.max" => 'Keep the category name under 60 characters.',
            "{$prefix}parent_id.exists" => 'Choose one of the main collections, or ask for a new one.',
            "{$prefix}note.max" => 'Keep the note under 300 characters.',
        ];
    }

    /** "  kids   party wear " → "Kids party wear" */
    public static function cleanName(string $name): string
    {
        $name = trim(preg_replace('/\s+/u', ' ', $name));

        return mb_strtoupper(mb_substr($name, 0, 1)) . mb_substr($name, 1);
    }

    /** A category with this name in this place (case doesn't matter), switched on or not. */
    public static function existing(string $name, ?int $parentId): ?Category
    {
        return Category::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->when($parentId, fn ($query) => $query->where('parent_id', $parentId), fn ($query) => $query->whereNull('parent_id'))
            ->first();
    }

    /**
     * Why this can't be asked for, or null: it's already in the store, or this seller is already waiting on it.
     * `$seller` is null on the sign-up form.
     */
    public static function problem(string $name, ?int $parentId, ?User $seller): ?string
    {
        $existing = self::existing($name, $parentId);
        if ($existing && (int) $existing->status === 1) {
            $where = $parentId ? 'under ' . Category::query()->whereKey($parentId)->value('name') : 'as a main collection';

            return "“{$existing->name}” is already in the store {$where}. You can choose it when you list a product.";
        }
        if ($seller && CategoryRequest::query()->pending()->where('seller_id', $seller->id)->sameAs($name, $parentId)->exists()) {
            return 'You’ve already asked for this one. We’ll let you know once it’s added.';
        }

        return null;
    }

    /**
     * The categories asked for on the sign-up form, cleaned and checked. Errors are keyed like the form's fields
     * ("category_requests.1.name").
     *
     * @return list<array{name: string, parent_id: ?int, note: ?string}>
     */
    public static function forSignUp(array $items): array
    {
        $seen = [];
        $errors = [];
        $clean = [];
        foreach ($items as $index => $item) {
            $name = self::cleanName($item['name']);
            $parentId = isset($item['parent_id']) ? (int) $item['parent_id'] : null;
            $key = ($parentId ?? 0) . '|' . mb_strtolower($name);
            $problem = isset($seen[$key]) ? 'You’ve asked for this one twice.' : self::problem($name, $parentId, null);
            if ($problem) {
                $errors["category_requests.{$index}.name"] = $problem;
            }
            $seen[$key] = true;
            $clean[] = ['name' => $name, 'parent_id' => $parentId, 'note' => $item['note'] ?? null];
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return $clean;
    }

    /** A seller asks after signing up: the request is saved and the admins are told. Errors are keyed on `name`. */
    public static function file(User $seller, array $data): CategoryRequest
    {
        $name = self::cleanName($data['name']);
        $parentId = isset($data['parent_id']) ? (int) $data['parent_id'] : null;
        if ($problem = self::problem($name, $parentId, $seller)) {
            throw ValidationException::withMessages(['name' => $problem]);
        }
        if (CategoryRequest::query()->pending()->where('seller_id', $seller->id)->count() >= self::MAX_PENDING) {
            throw ValidationException::withMessages(['name' => 'You have ' . self::MAX_PENDING . ' requests waiting already. We’ll get to them soon.']);
        }

        $request = self::record($seller, $name, $parentId, $data['note'] ?? null);
        Messenger::send(User::storeAdmins(), new CategoryRequested($request));

        return $request;
    }

    /** Saves a request without telling anyone (at sign-up, the admins hear about it with the new seller). */
    public static function record(User $seller, string $name, ?int $parentId, ?string $note): CategoryRequest
    {
        $request = new CategoryRequest(['name' => $name, 'parent_id' => $parentId, 'note' => filled($note) ? trim($note) : null]);
        $request->seller()->associate($seller);
        $request->save();

        return $request->load('parent');
    }

    /**
     * An admin adds the category. `$choice` is ['category_id' => …] for one already in the store, or the name and
     * parent to add, which default to what was asked for (the same name in the same place is reused, and switched
     * on if it was off). Every seller waiting on the same request gets the answer.
     */
    public static function approve(CategoryRequest $request, User $admin, array $choice): Category
    {
        return DB::transaction(function () use ($request, $admin, $choice) {
            if (!empty($choice['category_id'])) {
                $category = Category::query()->findOrFail($choice['category_id']);
            } else {
                $name = self::cleanName($choice['name'] ?? $request->name);
                $parentId = array_key_exists('parent_id', $choice) ? $choice['parent_id'] : $request->parent_id;
                $category = self::existing($name, $parentId) ?? Category::create(['name' => $name, 'parent_id' => $parentId, 'status' => 1]);
            }
            if ((int) $category->status !== 1) {
                $category->update(['status' => 1]);
            }

            $waiting = CategoryRequest::query()->pending()->sameAs($request->name, $request->parent_id)->whereKeyNot($request->id)->get()->prepend($request);
            foreach ($waiting as $each) {
                self::close($each, CategoryRequest::APPROVED, $admin, ['category_id' => $category->id]);
            }

            return $category;
        });
    }

    public static function decline(CategoryRequest $request, User $admin, string $reason): void
    {
        self::close($request, CategoryRequest::DECLINED, $admin, ['admin_note' => trim($reason)]);
    }

    /** Other sellers waiting on the same request. */
    public static function alsoWaiting(CategoryRequest $request): int
    {
        return CategoryRequest::query()->pending()->sameAs($request->name, $request->parent_id)->whereKeyNot($request->id)->count();
    }

    private static function close(CategoryRequest $request, string $status, User $admin, array $changes): void
    {
        $request->forceFill([...$changes, 'status' => $status, 'reviewed_by' => $admin->id, 'reviewed_at' => now()])->save();
        Messenger::send($request->seller, new CategoryRequestReviewed($request->load(['parent', 'category.parent'])));
    }
}
