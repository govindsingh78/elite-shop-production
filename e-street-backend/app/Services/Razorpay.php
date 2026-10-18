<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/** Minimal Razorpay client: create orders and verify signatures. */
class Razorpay
{
    private const API = 'https://api.razorpay.com/v1';

    public function configured(): bool
    {
        return filled(config('services.razorpay.key_id')) && filled(config('services.razorpay.key_secret'));
    }

    public function keyId(): ?string
    {
        return config('services.razorpay.key_id');
    }

    /** Creates a Razorpay order for an amount in rupees and returns its id. */
    public function createOrder(float $amount, string $receipt, array $notes = []): string
    {
        $response = Http::withBasicAuth(config('services.razorpay.key_id'), config('services.razorpay.key_secret'))
            ->acceptJson()
            ->timeout(15)
            ->post(self::API . '/orders', [
                'amount' => self::toPaise($amount),
                'currency' => 'INR',
                'receipt' => $receipt,
                'notes' => $notes,
            ]);

        if (!$response->successful() || !$response->json('id')) {
            throw new RuntimeException($response->json('error.description') ?: 'Razorpay did not accept the payment request.');
        }

        return $response->json('id');
    }

    /** Checkout handler signature: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
    public function validCheckoutSignature(string $razorpayOrderId, string $paymentId, string $signature): bool
    {
        $expected = hash_hmac('sha256', $razorpayOrderId . '|' . $paymentId, (string) config('services.razorpay.key_secret'));

        return hash_equals($expected, $signature);
    }

    /** Webhook signature: HMAC-SHA256 of the raw request body with the webhook secret. */
    public function validWebhookSignature(string $payload, string $signature): bool
    {
        $secret = config('services.razorpay.webhook_secret');
        if (blank($secret)) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $payload, $secret), $signature);
    }

    public static function toPaise(float $amount): int
    {
        return (int) round($amount * 100);
    }
}
