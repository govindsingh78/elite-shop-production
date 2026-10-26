<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GST and invoices. Prices stay GST-inclusive; checkout works out each line's GST (CGST + SGST within a
 * state, IGST between states) and keeps it on the order line. Invoices are issued per supplier (each seller,
 * and Elitezaar for its own products and delivery) when an order ships, and keep a frozen copy of everything
 * they show.
 */
return new class extends Migration
{
    public function up(): void
    {
        // A category's GST: `gst_rate`, or `gst_rate_high` when the value per piece is above `gst_threshold`
        // (e.g. clothing: 5% up to ₹2,500, 18% above). Subcategories without one use their parent's.
        Schema::table('categories', function (Blueprint $table) {
            $table->string('hsn_code', 8)->nullable();
            $table->decimal('gst_rate', 5, 2)->nullable();
            $table->decimal('gst_rate_high', 5, 2)->nullable();
            $table->decimal('gst_threshold', 10, 2)->nullable();
        });

        // Set only when a product differs from its category.
        Schema::table('products', function (Blueprint $table) {
            $table->string('hsn_code', 8)->nullable();
            $table->decimal('gst_rate', 5, 2)->nullable();
        });

        // A seller's business details for their invoices. No GSTIN = not registered (bill of supply, no GST).
        Schema::table('users', function (Blueprint $table) {
            $table->string('legal_name')->nullable();
            $table->string('gstin', 15)->nullable();
            $table->text('business_address')->nullable();
            $table->string('business_state', 2)->nullable();
        });

        Schema::table('orders', function (Blueprint $table) {
            // Business buyers can add their GSTIN to claim input tax credit.
            $table->string('billing_name')->nullable();
            $table->string('billing_gstin', 15)->nullable();
            $table->string('place_of_supply', 2)->nullable();
            $table->decimal('tax_total', 12, 2)->default(0);
            $table->decimal('shipping_gst_rate', 5, 2)->nullable();
            $table->decimal('shipping_tax', 12, 2)->default(0);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->string('hsn_code', 8)->nullable();
            $table->decimal('gst_rate', 5, 2)->nullable();
            $table->decimal('taxable_value', 12, 2)->nullable();
            $table->decimal('cgst', 12, 2)->default(0);
            $table->decimal('sgst', 12, 2)->default(0);
            $table->decimal('igst', 12, 2)->default(0);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            // Kept if the order is later deleted: an issued invoice is a tax record.
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('number', 16)->unique();
            $table->string('financial_year', 7);
            $table->unsignedInteger('sequence');
            $table->string('type', 20);
            $table->string('status', 12)->default('issued');
            $table->json('supplier');
            $table->json('buyer');
            $table->json('lines');
            $table->string('place_of_supply', 2)->nullable();
            $table->decimal('taxable_total', 12, 2);
            $table->decimal('cgst_total', 12, 2)->default(0);
            $table->decimal('sgst_total', 12, 2)->default(0);
            $table->decimal('igst_total', 12, 2)->default(0);
            $table->decimal('grand_total', 12, 2);
            $table->timestamp('issued_at');
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            $table->index(['vendor_id', 'financial_year', 'sequence']);
            $table->index('issued_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['hsn_code', 'gst_rate', 'taxable_value', 'cgst', 'sgst', 'igst']);
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['billing_name', 'billing_gstin', 'place_of_supply', 'tax_total', 'shipping_gst_rate', 'shipping_tax']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['legal_name', 'gstin', 'business_address', 'business_state']);
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['hsn_code', 'gst_rate']);
        });
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn(['hsn_code', 'gst_rate', 'gst_rate_high', 'gst_threshold']);
        });
    }
};
