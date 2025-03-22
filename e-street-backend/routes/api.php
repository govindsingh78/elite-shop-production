<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
 
Route::post('/admin/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

// Route::get('/ping', function () {
//     return response()->json(['message' => 'API working!']);
// });