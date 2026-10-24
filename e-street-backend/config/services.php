<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Online payments (UPI, net banking, cards). Online checkout is hidden until both keys are set.
    'razorpay' => [
        'key_id' => env('RAZORPAY_KEY_ID'),
        'key_secret' => env('RAZORPAY_KEY_SECRET'),
        'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET'),
    ],

    // "Continue with Google" on the sign-in screens, using a Google Cloud OAuth client of type "Web application".
    // The buttons are hidden until both keys are set.
    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        // Must be listed under "Authorised redirect URIs" on the OAuth client. Defaults to <this site>/api/auth/google/callback.
        'redirect' => env('GOOGLE_REDIRECT_URI'),
        // Where a finished sign-in may return: the website's callback page and the app. Add more, comma-separated,
        // in GOOGLE_RETURN_URLS (e.g. "exp://" while testing the app in Expo Go).
        'return_urls' => array_values(array_filter(array_map('trim', [
            rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/') . '/auth/google/callback',
            'elitezaar://auth/google',
            ...explode(',', (string) env('GOOGLE_RETURN_URLS', '')),
        ]))),
        'authorize_url' => 'https://accounts.google.com/o/oauth2/v2/auth',
        'token_url' => 'https://oauth2.googleapis.com/token',
    ],

];
