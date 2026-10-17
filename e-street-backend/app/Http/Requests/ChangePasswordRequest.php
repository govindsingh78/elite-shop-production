<?php
// app/Http/Requests/Admin/ChangePasswordRequest.php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

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

    public function messages(): array
    {
        return [
            'current_password.current_password' => 'Current password is incorrect.',
            'password.different' => 'New password must be different from the current password.',
        ];
    }
}
