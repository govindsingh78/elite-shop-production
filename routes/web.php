<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ImageController;

Route::post('/upload-temp-image', [ImageController::class, 'uploadTempImage']);