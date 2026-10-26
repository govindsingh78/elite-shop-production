<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Str;
use App\Models\User;
use App\Http\Requests\CustomerAddressRequest;
use App\Models\LoginBlock;
use App\Notifications\SellerJoined;
use App\Services\Messenger;
use App\Services\Security\LoginGuard;

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

    public function customerLogin(Request $request)
    {
        return $this->authenticateForPortal($request, 'customer');
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

        // A locked account or blocked address is turned away before the password is even checked.
        if ($block = LoginGuard::blockFor($request->email, $request->ip())) {
            LoginGuard::refused($request, $request->email, $portal, $user);

            return self::blockedResponse($block);
        }

        // Unknown emails are checked against a dummy hash, so the reply takes as long either way.
        if (!Hash::check($request->password, $user?->password ?? self::DUMMY_HASH) || !$user) {
            $result = LoginGuard::failed($request, $request->email, $portal, $user);
            if ($result['block']) {
                return self::blockedResponse($result['block']);
            }

            return response()->json([
                'message' => LoginGuard::wrongPasswordMessage($result['remaining']),
                'attempts_left' => $result['remaining'],
                'status' => 401,
            ], 401);
        }

        if (!$user->canUsePortal($portal)) {
            return response()->json([
                'message' => "This account cannot access the {$portal} portal.",
                'status' => 403,
            ], 403);
        }

        LoginGuard::succeeded($request, $user, $portal);

        return self::sessionResponse($user, $portal);
    }

    /** Any bcrypt hash: compared against when no account has the email, so that takes as long as a real check. */
    private const DUMMY_HASH = '$2y$12$DVgTV1zUg.u3Hj2R8Fv4l.Alaefuz9j6hsXtgn1j4FIrCxo.bgvXe';

    /** 423 Locked: the account or the address can't sign in for now, and until when. */
    public static function blockedResponse(LoginBlock $block)
    {
        return response()->json([
            'message' => LoginGuard::message($block),
            'blocked_until' => $block->blocked_until?->toIso8601String(),
            'status' => 423,
        ], 423);
    }

    /** A new API token for the portal, in the shape every sign-in returns (password or Google). */
    public static function sessionResponse(User $user, string $portal, string $message = 'Login successful', int $status = 200)
    {
        return response()->json([
            'status' => $status,
            'message' => $message,
            'token' => $user->issueToken($portal),
            'user' => $user,
            'portal' => $portal,
        ], $status);
    }

    /** Register a customer account. A delivery address is mandatory and becomes the default. */
    public function register(Request $request)
    {
        $addressRules = CustomerAddressRequest::addressRules();
        unset($addressRules['full_name'], $addressRules['is_default']);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            ...$addressRules,
        ], CustomerAddressRequest::addressMessages());

        $user = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'],
                'password' => Hash::make($validated['password']),
                'role' => 'customer',
            ]);

            $user->addresses()->create([
                'label' => $validated['label'] ?? 'Home',
                'full_name' => $validated['name'],
                'phone' => $validated['phone'],
                'address' => $validated['address'],
                'city' => $validated['city'],
                'state' => $validated['state'],
                'postal_code' => $validated['postal_code'],
                'country' => $validated['country'] ?? 'India',
                'is_default' => true,
            ]);

            return $user;
        });

        return response()->json([
            'status' => 201,
            'message' => 'Account created successfully.',
            'token' => $user->issueToken('customer'),
            'user' => $user,
            'portal' => 'customer',
        ], 201);
    }

    /** Register a vendor account. New sellers wait for an admin to approve them before they can list products. */
    public function registerVendor(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = self::createSeller([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        return response()->json([
            'message' => 'Seller account created. Sign in to add your business details; you can list products once our team approves your account.',
            'user' => $user,
        ], 201);
    }

    /** A seller who signed up themselves (with a password or Google): waiting for approval, and the admins are told. */
    public static function createSeller(array $attributes): User
    {
        $user = User::forceCreate([...$attributes, 'role' => 'seller', 'seller_status' => User::SELLER_PENDING, 'seller_status_at' => now()]);
        Messenger::send(User::storeAdmins(), new SellerJoined($user));

        return $user;
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
                // Resetting proves the email's owner is asking, so a lock from wrong passwords is lifted.
                LoginGuard::release($user->email, 'Password reset by the account owner');
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
