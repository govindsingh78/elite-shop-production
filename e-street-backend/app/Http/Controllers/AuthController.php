<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Str;
use App\Models\User;

class AuthController extends Controller
{
     
    /**
     * Login and create a token
     */
    public function login(Request $request)
    {
        return $this->authenticateForPortal($request, 'admin');
    }

    public function vendorLogin(Request $request)
    {
        return $this->authenticateForPortal($request, 'vendor');
    }

    private function authenticateForPortal(Request $request, string $portal)
    {
        // Validate input
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(
                ['error' => $validator->errors(),
                'status' => 422
                ], 422);
        }

        $user = User::where('email', $request->email)->first();
        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(
                [
                    'message' => 'Invalid credentials',
                    'status' => 401
                ], 401);
        }

        $allowedRoles = $portal === 'admin' ? ['admin', 'superadmin'] : ['seller'];
        if (!in_array($user->role, $allowedRoles, true)) {
            return response()->json([
                'message' => $portal === 'admin'
                    ? 'This account cannot access the admin portal.'
                    : 'This account cannot access the vendor portal.',
                'status' => 403,
            ], 403);
        }

        $token = $user->createToken($portal . '_auth_token')->plainTextToken;

        return response()->json([
            'status' => 200,
            'message' => 'Login successful',
            'token' => $token,
            'user' => $user,
            'portal' => $portal,
        ]);
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => 'customer',
        ]);

        return response()->json(['message' => 'Account created successfully.', 'user' => $user], 201);
    }

    /** Register a vendor account. New vendors are sellers and await review. */
    public function registerVendor(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => 'seller',
        ]);

        return response()->json([
            'message' => 'Vendor account created. You can now sign in to the vendor portal.',
            'user' => $user,
        ], 201);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);

        $status = Password::sendResetLink($request->only('email'));

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json(['message' => 'If an account exists for that email, a password reset link has been sent.']);
        }

        // Do not reveal whether an email address is registered.
        if (in_array($status, [Password::INVALID_USER, Password::RESET_THROTTLED], true)) {
            return response()->json(['message' => 'If an account exists for that email, a password reset link has been sent.']);
        }

        return response()->json(['message' => 'Unable to send a password reset link right now.'], 500);
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            $validated,
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                $user->tokens()->delete();
                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Password reset successfully. You can now sign in.']);
        }

        return response()->json([
            'message' => $status === Password::INVALID_TOKEN
                ? 'This password reset link is invalid or has expired.'
                : 'Unable to reset the password. Please request a new link.',
        ], 422);
    }
 
}
