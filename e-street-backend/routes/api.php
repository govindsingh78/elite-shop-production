<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\GeoController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\PolicyController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\BulkProductController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\TempImageController;
use App\Http\Controllers\PasswordController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ShippingMethodController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\CommissionController;
use App\Http\Controllers\Vendor\EarningsController as VendorEarningsController;
use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\EnsureCustomer;
use App\Http\Middleware\EnsureVendor;
use App\Http\Controllers\Vendor\ProductController as VendorProductController;
use App\Http\Controllers\Vendor\OrderController as VendorOrderController;
use App\Http\Controllers\Vendor\OrderTrackingController as VendorOrderTrackingController;
use App\Http\Controllers\Customer\AccountController as CustomerAccountController;
use App\Http\Controllers\Customer\WishlistController as CustomerWishlistController;
use App\Http\Controllers\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\OrderTrackingController as AdminOrderTrackingController;
use App\Models\ShippingMethod;
 
Route::post('/admin/login', [AuthController::class, 'login']);
Route::post('/vendor/login', [AuthController::class, 'vendorLogin'])->middleware('throttle:10,1');
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/customer/login', [AuthController::class, 'customerLogin'])->middleware('throttle:10,1');
Route::post('/customer/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/vendor/register', [AuthController::class, 'registerVendor'])->middleware('throttle:5,1');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
Route::get('/auth/providers', [GoogleAuthController::class, 'providers']);
// Its own rate-limit bucket ("google-signin"): unnamed throttles share one count per IP across routes.
Route::middleware('throttle:60,1,google-signin')->prefix('auth/google')->group(function () {
    Route::get('redirect', [GoogleAuthController::class, 'redirect']);
    Route::get('callback', [GoogleAuthController::class, 'callback']);
    Route::post('exchange', [GoogleAuthController::class, 'exchange']);
});
Route::post('/orders', [AdminOrderController::class, 'store'])->middleware('throttle:10,1');
Route::get('/storefront/payment-methods', [PaymentController::class, 'methods']);
Route::middleware('throttle:20,1')->group(function () {
    Route::post('/orders/{order}/payment/start', [PaymentController::class, 'start'])->whereNumber('order');
    Route::post('/orders/{order}/payment/verify', [PaymentController::class, 'verify'])->whereNumber('order');
    Route::post('/orders/{order}/payment/cod', [PaymentController::class, 'payOnDelivery'])->whereNumber('order');
});
Route::post('/payments/razorpay/webhook', [PaymentController::class, 'webhook']);
Route::get('/storefront/categories', [CategoryController::class, 'navigation']);
Route::get('/sitemap.xml', [SitemapController::class, 'index'])->middleware('throttle:30,1');
Route::get('/storefront/policies/{policy}', [PolicyController::class, 'show'])->where('policy', '[a-z-]+');
Route::get('/storefront/products', [ProductController::class, 'storefrontIndex']);
Route::get('/storefront/products/{id}', [ProductController::class, 'storefrontShow'])->whereNumber('id');
Route::get('/storefront/products/{product}/reviews', [ReviewController::class, 'index'])->whereNumber('product');
Route::middleware('throttle:120,1')->prefix('geo')->group(function () {
    Route::get('countries', [GeoController::class, 'countries']);
    Route::get('countries/{country}/states', [GeoController::class, 'states'])->where('country', '[A-Za-z]{2}');
    Route::get('countries/{country}/states/{state}/cities', [GeoController::class, 'cities'])
        ->where(['country' => '[A-Za-z]{2}', 'state' => '[A-Za-z0-9]{1,8}']);
});
Route::get('/storefront/shipping-methods', fn () => response()->json(
    ShippingMethod::query()->where('status', 1)->orderBy('price')->get(['id', 'name', 'price']),
));


// Route::apiResource('categories', CategoryController::class);

Route::middleware('auth:sanctum')->group(function () {
    // Catalog setup is admin-only; vendors manage their own products under /vendor/products.
    Route::middleware(EnsureAdmin::class)->group(function () {
        Route::apiResource('categories', CategoryController::class);
        Route::apiResource('brands', BrandController::class);
        Route::apiResource('products', ProductController::class);
        Route::apiResource('shipping-methods', ShippingMethodController::class)->except(['create', 'edit']);
    });
    Route::apiResource('temp-images', TempImageController::class);

    Route::middleware(EnsureVendor::class)->prefix('vendor')->group(function () {
        Route::get('dashboard', [VendorOrderController::class, 'dashboard']);
        Route::get('product-options', [VendorProductController::class, 'options']);
        Route::get('earnings', [VendorEarningsController::class, 'index']);
        Route::get('bulk-products/template', [BulkProductController::class, 'template']);
        Route::get('bulk-products/export', [BulkProductController::class, 'export']);
        Route::post('bulk-products/check', [BulkProductController::class, 'check'])->middleware('throttle:30,1,bulk-products');
        Route::post('bulk-products/import', [BulkProductController::class, 'import'])->middleware('throttle:10,1,bulk-products-import');
        Route::apiResource('products', VendorProductController::class)->except(['create', 'edit'])->names('vendor.products');
        Route::get('orders', [VendorOrderController::class, 'index']);
        Route::get('orders/{order}', [VendorOrderController::class, 'show']);
        Route::put('orders/{order}', [VendorOrderController::class, 'update']);
        Route::post('orders/{order}/tracking', [VendorOrderTrackingController::class, 'store']);
        Route::delete('orders/{order}/tracking/{event}', [VendorOrderTrackingController::class, 'destroy']);
    });

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/change-password', [PasswordController::class, 'update']);

    Route::middleware(EnsureCustomer::class)->prefix('customer')->group(function () {
        Route::get('dashboard', [CustomerAccountController::class, 'dashboard']);
        Route::get('profile', [CustomerAccountController::class, 'profile']);
        Route::put('profile', [CustomerAccountController::class, 'updateProfile']);
        Route::get('orders', [CustomerAccountController::class, 'orders']);
        Route::get('orders/{order}', [CustomerAccountController::class, 'showOrder'])->whereNumber('order');
        Route::get('addresses', [CustomerAccountController::class, 'addresses']);
        Route::post('addresses', [CustomerAccountController::class, 'storeAddress']);
        Route::put('addresses/{address}', [CustomerAccountController::class, 'updateAddress'])->whereNumber('address');
        Route::patch('addresses/{address}/default', [CustomerAccountController::class, 'setDefaultAddress'])->whereNumber('address');
        Route::delete('addresses/{address}', [CustomerAccountController::class, 'destroyAddress'])->whereNumber('address');
        Route::get('wishlist', [CustomerWishlistController::class, 'index']);
        Route::post('wishlist', [CustomerWishlistController::class, 'store']);
        Route::post('wishlist/sync', [CustomerWishlistController::class, 'sync']);
        Route::delete('wishlist/{product}', [CustomerWishlistController::class, 'destroy'])->whereNumber('product');
        Route::get('reviews/{product}', [ReviewController::class, 'mine'])->whereNumber('product');
        Route::put('reviews/{product}', [ReviewController::class, 'save'])->whereNumber('product')->middleware('throttle:20,1');
        Route::delete('reviews/{product}', [ReviewController::class, 'destroy'])->whereNumber('product');
    });

    Route::middleware(EnsureAdmin::class)->apiResource('admin/users', UserController::class)
        ->except(['create', 'edit'])->names('admin.users');

    Route::middleware(EnsureAdmin::class)->group(function () {
        Route::get('admin/product-options', [AdminProductController::class, 'options']);
        Route::apiResource('admin/products', AdminProductController::class)->except(['create', 'edit'])->names('admin.products');
        Route::patch('admin/products/{product}/review', [AdminProductController::class, 'review'])->name('admin.products.review');
        Route::get('admin/bulk-products/template', [BulkProductController::class, 'template']);
        Route::get('admin/bulk-products/export', [BulkProductController::class, 'export']);
        Route::post('admin/bulk-products/check', [BulkProductController::class, 'check'])->middleware('throttle:30,1,bulk-products');
        Route::post('admin/bulk-products/import', [BulkProductController::class, 'import'])->middleware('throttle:10,1,bulk-products-import');
        Route::get('admin/commissions', [CommissionController::class, 'index']);
        Route::put('admin/commissions/settings', [CommissionController::class, 'updateSettings']);
        Route::get('admin/commissions/sellers/{seller}', [CommissionController::class, 'show'])->whereNumber('seller');
        Route::put('admin/commissions/sellers/{seller}', [CommissionController::class, 'updateSeller'])->whereNumber('seller');
        Route::post('admin/commissions/sellers/{seller}/payouts', [CommissionController::class, 'storePayout'])->whereNumber('seller');
        Route::delete('admin/commissions/payouts/{payout}', [CommissionController::class, 'destroyPayout'])->whereNumber('payout');
        Route::get('admin/reviews', [ReviewController::class, 'adminIndex']);
        Route::patch('admin/reviews/{review}', [ReviewController::class, 'moderate']);
        Route::delete('admin/reviews/{review}', [ReviewController::class, 'adminDestroy']);
        Route::get('admin/orders/{order}/tracking', [AdminOrderTrackingController::class, 'index']);
        Route::post('admin/orders/{order}/tracking', [AdminOrderTrackingController::class, 'store']);
        Route::delete('admin/orders/{order}/tracking/{event}', [AdminOrderTrackingController::class, 'destroy']);
        Route::apiResource('admin/orders', AdminOrderController::class)
            ->only(['index', 'show', 'update', 'destroy'])->names('admin.orders');
    });
});



// Route::get('/ping', function () {
//     return response()->json(['message' => 'API working!']);
// });