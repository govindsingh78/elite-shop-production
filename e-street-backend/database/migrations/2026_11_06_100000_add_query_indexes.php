<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for the queries the store runs most, so they stay fast as its tables grow. Each index starts with the columns
 * a query filters on exactly, and ends with the one it sorts or ranges on; InnoDB adds the primary key to every index,
 * which is why "newest first" (ORDER BY id DESC) needs nothing more.
 *
 * LIKE '%word%' searches can't use an index like these, so title and description aren't here.
 */
return new class extends Migration
{
    private const INDEXES = [
        // The shop: live products by price; then the count and price range, answered from the index alone.
        ['products', ['status', 'approval_status', 'price']],
        ['products', ['status', 'approval_status', 'vendor_id', 'price']],
        // In a category or brand, and on the home page.
        ['products', ['category_id', 'status', 'approval_status']],
        ['products', ['brand_id', 'status', 'approval_status']],
        ['products', ['is_featured', 'status', 'approval_status']],
        // A seller's listings, and matching SKUs in bulk uploads.
        ['products', ['vendor_id', 'status', 'approval_status']],
        ['products', ['sku']],

        // Guest orders claimed by email, and how often a coupon was used.
        ['orders', ['customer_email']],
        ['orders', ['coupon_id', 'status']],

        // A seller's orders and earnings.
        ['order_items', ['vendor_id', 'order_id']],
        ['invoices', ['vendor_id', 'issued_at']],

        // The bell: the latest messages, and the unread count on every page.
        ['notifications', ['notifiable_type', 'notifiable_id', 'created_at']],
        ['notifications', ['notifiable_type', 'notifiable_id', 'read_at']],

        // Sellers and staff, among all the customers.
        ['users', ['role', 'seller_status']],

        // Sign-in checks, which run most when someone is guessing passwords.
        ['login_attempts', ['email', 'outcome']],
        ['login_attempts', ['ip', 'outcome', 'created_at']],
        ['login_attempts', ['user_id', 'outcome']],
        ['login_attempts', ['outcome', 'created_at']],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as [$table, $columns]) {
            if (!$this->startsAnIndex($table, $columns)) {
                Schema::table($table, fn (Blueprint $blueprint) => $blueprint->index($columns));
            }
        }
    }

    public function down(): void
    {
        foreach (array_reverse(self::INDEXES) as [$table, $columns]) {
            $name = $table . '_' . implode('_', $columns) . '_index';
            if (!Schema::hasIndex($table, $name)) {
                continue;
            }
            Schema::table($table, function (Blueprint $blueprint) use ($table, $columns, $name) {
                // MySQL needs an index for a foreign key, and may have dropped its own in favour of this one.
                if (count($columns) > 1 && $this->isForeignKey($table, $columns[0]) && !$this->startsAnIndex($table, [$columns[0]], except: $name)) {
                    $blueprint->index($columns[0]);
                }
                $blueprint->dropIndex($name);
            });
        }
    }

    /** Whether an index already begins with these columns, so another would add nothing. */
    private function startsAnIndex(string $table, array $columns, ?string $except = null): bool
    {
        foreach (Schema::getIndexes($table) as $index) {
            if ($index['name'] !== $except && array_slice($index['columns'], 0, count($columns)) === $columns) {
                return true;
            }
        }

        return false;
    }

    private function isForeignKey(string $table, string $column): bool
    {
        foreach (Schema::getForeignKeys($table) as $key) {
            if ($key['columns'] === [$column]) {
                return true;
            }
        }

        return false;
    }
};
