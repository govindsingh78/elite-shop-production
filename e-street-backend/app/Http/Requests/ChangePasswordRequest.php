<?php
// app/Http/Requests/Admin/ChangePasswordRequest.php
namespace App\Http\Requests;

use App\Services\Security\LoginGuard;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class ChangePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'current_password'], // checks against logged-in user
            'password' => [
                'required',
                'confirmed',              // needs password_confirmation
                'different:current_password',
                Password::min(8)->letters()->mixedCase()->numbers()->symbols(),
            ],
        ];
    }

    /**
     * A wrong current password counts like a wrong sign-in, so someone using a signed-in device can't guess the
     * password here either; once the account is locked, password changes wait until it's unlocked.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $user = $this->user();
            $portal = $user->hasAdminRole() ? 'admin' : ($user->role === 'seller' ? 'vendor' : 'customer');
            $errors = $validator->errors();

            if ($block = LoginGuard::blockFor($user->email, $this->ip())) {
                LoginGuard::refused($this, $user->email, $portal, $user, 'password_change');
                $errors->forget('current_password');
                $errors->add('current_password', LoginGuard::message($block));

                return;
            }
            if ($errors->has('current_password') && filled($this->input('current_password'))) {
                $result = LoginGuard::failed($this, $user->email, $portal, $user, 'password_change');
                $errors->forget('current_password');
                $errors->add('current_password', $result['block']
                    ? LoginGuard::message($result['block'])
                    : 'Current password is incorrect. ' . ($result['remaining'] === 1 ? '1 more wrong attempt locks your account for 24 hours.' : "{$result['remaining']} attempts left before your account is locked for 24 hours."));
            }
        });
    }

    public function messages(): array
    {
        return [
            'current_password.current_password' => 'Current password is incorrect.',
            'password.different' => 'New password must be different from the current password.',
        ];
    }
}
