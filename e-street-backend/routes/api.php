<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\BrandController;
 
Route::post('/admin/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

// Route::apiResource('categories', CategoryController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('brands', BrandController::class);
});



// Route::get('/ping', function () {
//     return response()->json(['message' => 'API working!']);
// });