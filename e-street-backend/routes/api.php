<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CategoryRequestController;
use App\Http\Controllers\CouponController;
use App\Http\Controllers\DeliveryController;
use App\Http\Controllers\DeviceTokenController;
use App\Http\Controllers\GstController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\NotificationController;
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
use App\Http\Controllers\SizeController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\CommissionController;
use App\Http\Controllers\Admin\SellerController;
use App\Http\Controllers\Admin\CategoryRequestController as AdminCategoryRequestController;
use App\Http\Controllers\Admin\DeliveryController as AdminDeliveryController;
use App\Http\Controllers\Admin\CouponController as AdminCouponController;
use App\Http\Controllers\Admin\SecurityController;
use App\Http\Controllers\Admin\ServerController;
use App\Http\Controllers\AccountPhoneController;
use App\Http\Controllers\ConsentController;
use App\Http\Controllers\PhoneLoginController;
use App\Http\Controllers\MonitorController;
use App\Http\Controllers\Vendor\EarningsController as VendorEarningsController;
use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\EnsureCustomer;
use App\Http\Middleware\EnsureSellerCanSell;
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
 
Route::post('/admin/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/vendor/login', [AuthController::class, 'vendorLogin'])->middleware('throttle:10,1');
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/customer/login', [AuthController::class, 'customerLogin'])->middleware('throttle:10,1');
Route::post('/customer/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/vendor/register', [AuthController::class, 'registerVendor'])->middleware('throttle:5,1');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
Route::get('/auth/providers', [GoogleAuthController::class, 'providers']);
// Signing in with a mobile number and a code sent by SMS (for numbers confirmed on an account).
Route::post('/auth/otp/send', [PhoneLoginController::class, 'send'])->middleware('throttle:5,1,otp-send');
Route::post('/auth/otp/verify', [PhoneLoginController::class, 'verify'])->middleware('throttle:10,1,otp-verify');
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
// The product page's "Delivery to": whether we deliver to a PIN code, and roughly when.
Route::get('/storefront/delivery', [DeliveryController::class, 'check'])->middleware('throttle:60,1,delivery-check');
// Coupons: the offers on a product page or for a bag, and checking a code at checkout.
Route::get('/storefront/business', [GstController::class, 'publicDetails']);
Route::get('/storefront/coupons', [CouponController::class, 'index']);
Route::post('/storefront/coupons/check', [CouponController::class, 'check'])->middleware('throttle:30,1,coupon-check');
Route::get('/sitemap.xml', [SitemapController::class, 'index'])->middleware('throttle:30,1');
// The printable invoice, from a signed link (order pages, the app and emails), so no sign-in is needed.
Route::get('/invoices/{invoice}/print', [InvoiceController::class, 'print'])
    ->name('invoices.print')->middleware(['signed:relative', 'throttle:60,1'])->whereNumber('invoice');
// A month's GST report from a 10-minute signed link (the app opens it in the phone's browser).
Route::get('/invoices/report/{user}', [InvoiceController::class, 'signedReport'])
    ->name('invoices.report')->middleware(['signed:relative', 'throttle:20,1,gst-report'])->whereNumber('user');
// Cookie choices made on the website (Accept all / Necessary only / custom), kept as a record.
Route::post('/consents', [ConsentController::class, 'store'])->middleware('throttle:20,1,consents');
// The website and app report crashes people run into, and how fast pages loaded, for Server & health.
Route::post('/monitor/client-errors', [MonitorController::class, 'clientError'])->middleware('throttle:10,1,client-errors');
Route::post('/monitor/page-speed', [MonitorController::class, 'pageSpeed'])->middleware('throttle:30,1,page-speed');
Route::get('/storefront/policies/{policy}', [PolicyController::class, 'show'])->where('policy', '[a-z-]+');
Route::get('/storefront/products', [ProductController::class, 'storefrontIndex']);
// A product's readable address (/product/classic-linen-shirt), an earlier one, or its id for old links.
Route::get('/storefront/products/{handle}', [ProductController::class, 'storefrontShow'])->where('handle', '[A-Za-z0-9-]+');
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
        Route::apiResource('sizes', SizeController::class)->except(['show']);
    });
    // Photo uploads only (listing, viewing or deleting uploads isn't something anyone needs).
    Route::apiResource('temp-images', TempImageController::class)->only(['store'])->middleware('throttle:60,1,photo-uploads');

    // Every seller account can look around and keep its business details up to date, including one waiting
    // for approval or deactivated (they still need their orders, earnings and invoices).
    Route::middleware(EnsureVendor::class)->prefix('vendor')->group(function () {
        Route::get('dashboard', [VendorOrderController::class, 'dashboard']);
        Route::get('product-options', [VendorProductController::class, 'options']);
        Route::get('earnings', [VendorEarningsController::class, 'index']);
        Route::get('business', [GstController::class, 'business']);
        Route::put('business', [GstController::class, 'updateBusiness']);
        Route::get('gst/report', [InvoiceController::class, 'report'])->middleware('throttle:20,1,gst-report');
        Route::get('gst/report-link', [InvoiceController::class, 'reportLink'])->middleware('throttle:20,1,gst-report');
        Route::get('bulk-products/template', [BulkProductController::class, 'template']);
        Route::get('bulk-products/export', [BulkProductController::class, 'export']);
        Route::apiResource('products', VendorProductController::class)->only(['index', 'show'])->names('vendor.products');
        Route::get('orders', [VendorOrderController::class, 'index']);
        Route::get('orders/{order}', [VendorOrderController::class, 'show']);
        // Asking for a category the store doesn't have yet (also while waiting for approval).
        Route::get('category-requests', [CategoryRequestController::class, 'index']);
        Route::post('category-requests', [CategoryRequestController::class, 'store'])->middleware('throttle:10,1,category-requests');
        Route::delete('category-requests/{categoryRequest}', [CategoryRequestController::class, 'destroy'])->whereNumber('categoryRequest');

        // Listing products and handling orders: approved sellers only.
        Route::middleware(EnsureSellerCanSell::class)->group(function () {
            Route::post('bulk-products/check', [BulkProductController::class, 'check'])->middleware('throttle:30,1,bulk-products');
            Route::post('bulk-products/import', [BulkProductController::class, 'import'])->middleware('throttle:10,1,bulk-products-import');
            Route::apiResource('products', VendorProductController::class)->only(['store', 'update', 'destroy'])->names('vendor.products');
            Route::put('orders/{order}', [VendorOrderController::class, 'update']);
            Route::post('orders/{order}/tracking', [VendorOrderTrackingController::class, 'store']);
            Route::delete('orders/{order}/tracking/{event}', [VendorOrderTrackingController::class, 'destroy']);
        });
    });

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/change-password', [PasswordController::class, 'update']);
    // The sign-in phone number of whoever is signed in: confirm it with a code, or turn phone sign-in off.
    Route::get('account/phone', [AccountPhoneController::class, 'show']);
    Route::post('account/phone/send', [AccountPhoneController::class, 'send'])->middleware('throttle:5,1,otp-send');
    Route::post('account/phone/verify', [AccountPhoneController::class, 'verify'])->middleware('throttle:10,1,otp-verify');
    Route::delete('account/phone', [AccountPhoneController::class, 'destroy']);

    // Messages: this phone's push notifications, and the inbox of everything the user was sent.
    Route::middleware('throttle:30,1,device-tokens')->group(function () {
        Route::post('device-tokens', [DeviceTokenController::class, 'store']);
        Route::delete('device-tokens', [DeviceTokenController::class, 'destroy']);
    });
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::get('invoices', [InvoiceController::class, 'index']);
    Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'read'])->whereUuid('notification');

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
        Route::get('admin/gst/settings', [GstController::class, 'settings']);
        Route::put('admin/gst/settings', [GstController::class, 'updateSettings']);
        Route::get('admin/gst/report', [InvoiceController::class, 'report'])->middleware('throttle:20,1,gst-report');
        Route::get('admin/gst/report-link', [InvoiceController::class, 'reportLink'])->middleware('throttle:20,1,gst-report');
        Route::post('admin/orders/{order}/invoices', [AdminOrderController::class, 'issueInvoices']);
        Route::get('admin/security', [SecurityController::class, 'index']);
        Route::get('admin/consents', [ConsentController::class, 'index']);
        Route::get('admin/security/attempts', [SecurityController::class, 'attempts']);
        Route::post('admin/security/blocks', [SecurityController::class, 'block']);
        Route::delete('admin/security/blocks/{block}', [SecurityController::class, 'unblock'])->whereNumber('block');
        Route::get('admin/server', [ServerController::class, 'overview']);
        Route::get('admin/server/problems', [ServerController::class, 'problems']);
        Route::post('admin/server/problems/resolve-all', [ServerController::class, 'resolveAll']);
        Route::get('admin/server/problems/{problem}', [ServerController::class, 'problem'])->whereNumber('problem');
        Route::patch('admin/server/problems/{problem}', [ServerController::class, 'updateProblem'])->whereNumber('problem');
        Route::delete('admin/server/problems/{problem}', [ServerController::class, 'destroyProblem'])->whereNumber('problem');
        Route::get('admin/server/speed', [ServerController::class, 'speed']);
        Route::get('admin/server/storage', [ServerController::class, 'storage']);
        Route::post('admin/server/cleanup', [ServerController::class, 'cleanup'])->middleware('throttle:60,1,server-cleanup');
        Route::get('admin/server/logs', [ServerController::class, 'logs']);
        Route::post('admin/server/test-email', [ServerController::class, 'testEmail'])->middleware('throttle:5,1,test-email');
        Route::get('admin/sellers', [SellerController::class, 'index']);
        Route::get('admin/sellers/{seller}', [SellerController::class, 'show'])->whereNumber('seller');
        Route::patch('admin/sellers/{seller}/status', [SellerController::class, 'updateStatus'])->whereNumber('seller');
        Route::get('admin/coupons', [AdminCouponController::class, 'index']);
        Route::get('admin/coupons/products', [AdminCouponController::class, 'products']);
        Route::post('admin/coupons', [AdminCouponController::class, 'store']);
        Route::get('admin/coupons/{coupon}', [AdminCouponController::class, 'show'])->whereNumber('coupon');
        Route::put('admin/coupons/{coupon}', [AdminCouponController::class, 'update'])->whereNumber('coupon');
        Route::patch('admin/coupons/{coupon}/status', [AdminCouponController::class, 'setStatus'])->whereNumber('coupon');
        Route::delete('admin/coupons/{coupon}', [AdminCouponController::class, 'destroy'])->whereNumber('coupon');
        Route::get('admin/delivery', [AdminDeliveryController::class, 'index']);
        Route::put('admin/delivery/settings', [AdminDeliveryController::class, 'updateSettings']);
        Route::get('admin/delivery/check', [AdminDeliveryController::class, 'check']);
        Route::post('admin/delivery/areas', [AdminDeliveryController::class, 'store']);
        Route::put('admin/delivery/areas/{area}', [AdminDeliveryController::class, 'update'])->whereNumber('area');
        Route::delete('admin/delivery/areas/{area}', [AdminDeliveryController::class, 'destroy'])->whereNumber('area');
        Route::get('admin/category-requests', [AdminCategoryRequestController::class, 'index']);
        Route::post('admin/category-requests/{categoryRequest}/approve', [AdminCategoryRequestController::class, 'approve'])->whereNumber('categoryRequest');
        Route::post('admin/category-requests/{categoryRequest}/decline', [AdminCategoryRequestController::class, 'decline'])->whereNumber('categoryRequest');
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