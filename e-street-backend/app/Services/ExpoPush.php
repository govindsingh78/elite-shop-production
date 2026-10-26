<?php

namespace App\Services;

use App\Models\DeviceToken;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Sends push notifications to the app through Expo's push service, which passes them on to Apple and
 * Google. Phones that have uninstalled the app (DeviceNotRegistered) are forgotten.
 */
class ExpoPush
{
    public const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

    /** @param array<int, string> $tokens */
    public function send(array $tokens, string $title, string $body, array $data = []): void
    {
        foreach (array_chunk(array_values(array_unique($tokens)), 100) as $chunk) {
            $messages = array_map(fn (string $token) => array_filter([
                'to' => $token,
                'title' => $title,
                'body' => $body,
                'data' => $data ?: null,
                'sound' => 'default',
                'channelId' => 'default',
                'priority' => 'high',
            ], fn ($value) => $value !== null), $chunk);

            try {
                $response = Http::acceptJson()
                    // Only needed if "enhanced security for push notifications" is switched on for the Expo project.
                    ->when(config('services.expo.access_token'), fn ($request, $token) => $request->withToken($token))
                    ->timeout(10)
                    ->post(self::ENDPOINT, $messages);
            } catch (Throwable $exception) {
                Log::warning('Push notifications not sent', ['error' => $exception->getMessage()]);
                continue;
            }

            if (!$response->successful()) {
                Log::warning('Push notifications rejected', ['status' => $response->status(), 'body' => $response->body()]);
                continue;
            }
            foreach ($response->json('data', []) as $index => $ticket) {
                if (($ticket['details']['error'] ?? null) === 'DeviceNotRegistered' && isset($chunk[$index])) {
                    DeviceToken::query()->where('token', $chunk[$index])->delete();
                }
            }
        }
    }
}
