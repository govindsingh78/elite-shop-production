<?php
namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChangePasswordRequest;
use Illuminate\Support\Facades\Hash;

class PasswordController extends Controller
{
    public function update(ChangePasswordRequest $request)
    {
        $user = $request->user();

        $user->forceFill([
            'password' => Hash::make($request->password),
        ])->save();

        // Log out other devices (token-based auth only)
        $current = $user->currentAccessToken();
        if ($current && method_exists($current, 'getKey')) {
            $user->tokens()->where('id', '!=', $current->getKey())->delete();
        }

        return response()->json(['message' => 'Password changed successfully.']);
    }
}
