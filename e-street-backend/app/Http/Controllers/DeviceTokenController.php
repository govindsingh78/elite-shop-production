<?php

namespace App\Http\Controllers;

use App\Models\DeviceToken;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The app registers each phone for push notifications after sign-in, and forgets it on sign-out. */
class DeviceTokenController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:255', 'regex:/^Expo(nent)?PushToken\[[^\]]+\]$/'],
            'platform' => ['nullable', Rule::in(['ios', 'android'])],
        ], ['token.regex' => 'That isn’t a valid push token.']);

        // A phone belongs to whoever signed in on it last.
        DeviceToken::query()->updateOrCreate(
            ['token' => $validated['token']],
            ['user_id' => $request->user()->id, 'platform' => $validated['platform'] ?? null],
        );

        return response()->json(['message' => 'Notifications are on for this phone.'], 201);
    }

    public function destroy(Request $request)
    {
        $request->validate(['token' => ['required', 'string', 'max:255']]);
        DeviceToken::query()->where('token', $request->input('token'))->where('user_id', $request->user()->id)->delete();

        return response()->json(['message' => 'Notifications are off for this phone.'], 200);
    }
}
