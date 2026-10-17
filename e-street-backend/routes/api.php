<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\TempImageController;
use App\Http\Controllers\PasswordController;
use App\Http\Controllers\ShippingMethodController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Middleware\EnsureAdmin;
use App\Http\Controllers\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Models\ShippingMethod;
 
Route::post('/admin/login', [AuthController::class, 'login']);
Route::post('/vendor/login', [AuthController::class, 'vendorLogin'])->middleware('throttle:10,1');
Route::post('/register', [AuthController::class, 'register']);
Route::post('/vendor/register', [AuthController::class, 'registerVendor'])->middleware('throttle:5,1');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
Route::post('/orders', [AdminOrderController::class, 'store'])->middleware('throttle:10,1');
Route::get('/storefront/categories', [CategoryController::class, 'navigation']);
Route::get('/storefront/products', [ProductController::class, 'storefrontIndex']);
Route::get('/storefront/products/{id}', [ProductController::class, 'storefrontShow'])->whereNumber('id');
Route::get('/storefront/shipping-methods', fn () => response()->json(
    ShippingMethod::query()->where('status', 1)->orderBy('price')->get(['id', 'name', 'price']),
));


// Route::apiResource('categories', CategoryController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('brands', BrandController::class);
    Route::apiResource('products', ProductController::class);
    Route::apiResource('temp-images', TempImageController::class);
    Route::apiResource('shipping-methods', ShippingMethodController::class)->except(['create', 'edit']);

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/change-password', [PasswordController::class, 'update']);

    Route::middleware(EnsureAdmin::class)->apiResource('admin/users', UserController::class)
        ->except(['create', 'edit']);

    Route::middleware(EnsureAdmin::class)->group(function () {
        Route::get('admin/product-options', [AdminProductController::class, 'options']);
        Route::apiResource('admin/products', AdminProductController::class)->except(['create', 'edit']);
        Route::apiResource('admin/orders', AdminOrderController::class)
            ->only(['index', 'show', 'update', 'destroy']);
    });
});



// Route::get('/ping', function () {
//     return response()->json(['message' => 'API working!']);
// });