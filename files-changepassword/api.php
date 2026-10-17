<?php
// routes/api.php
use App\Http\Controllers\Admin\PasswordController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'throttle:6,1'])->prefix('admin')->group(function () {
    Route::post('/change-password', [PasswordController::class, 'update']);
});
