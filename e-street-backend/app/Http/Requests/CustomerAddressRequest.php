<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CustomerAddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return self::addressRules();
    }

    public function messages(): array
    {
        return self::addressMessages();
    }

    /** Delivery-address rules, shared with customer registration. */
    public static function addressRules(): array
    {
        return [
            'label' => ['nullable', 'string', 'max:60'],
            'full_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:40', 'regex:/^[0-9+\-\s()]{7,40}$/'],
            'address' => ['required', 'string', 'max:2000'],
            'city' => ['required', 'string', 'max:120'],
            'state' => ['required', 'string', 'max:120'],
            'postal_code' => ['required', 'string', 'max:30'],
            'country' => ['nullable', 'string', 'max:120'],
            'is_default' => ['sometimes', 'boolean'],
        ];
    }

    public static function addressMessages(): array
    {
        return ['phone.regex' => 'Enter a valid phone number.'];
    }
}
