<?php

namespace App\Http\Controllers;

use App\Models\CookieConsent;
use App\Services\Security\LoginGuard;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Cookie choices: recorded when a visitor makes one, and summarised for admins (Admin › Security). */
class ConsentController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'consent_id' => ['required', 'uuid'],
            'choice' => ['required', Rule::in([CookieConsent::ACCEPT_ALL, CookieConsent::NECESSARY_ONLY, CookieConsent::CUSTOM])],
            'performance' => ['required', 'boolean'],
            'version' => ['required', 'string', 'regex:/^\d{4}-\d{2}-\d{2}$/'],
            'page' => ['nullable', 'string', 'max:191', 'regex:/^\/[A-Za-z0-9\/:._-]*$/'],
        ]);

        CookieConsent::query()->create([
            ...$validated,
            // "Accept all" and "Necessary only" mean what they say, whatever else was sent.
            'performance' => match ($validated['choice']) {
                CookieConsent::ACCEPT_ALL => true,
                CookieConsent::NECESSARY_ONLY => false,
                default => (bool) $validated['performance'],
            },
            'user_id' => $request->user('sanctum')?->id,
            'device' => LoginGuard::device($request),
        ]);

        return response()->json(['message' => 'Your cookie choices are saved.'], 201);
    }

    /** Admin: how visitors chose over the last 30 days, and the latest choices. */
    public function index()
    {
        $recent = CookieConsent::query()->where('created_at', '>=', now()->subDays(30));
        $counts = (clone $recent)->selectRaw('choice, COUNT(*) as total')->groupBy('choice')->pluck('total', 'choice');
        $total = (int) $counts->sum();

        return response()->json([
            'policy_version' => PolicyController::version('cookies'),
            'last_30_days' => [
                'total' => $total,
                'accept_all' => (int) ($counts[CookieConsent::ACCEPT_ALL] ?? 0),
                'necessary_only' => (int) ($counts[CookieConsent::NECESSARY_ONLY] ?? 0),
                'custom' => (int) ($counts[CookieConsent::CUSTOM] ?? 0),
                'performance_share' => $total ? (int) round((clone $recent)->where('performance', true)->count() / $total * 100) : 0,
            ],
            'latest' => CookieConsent::query()->orderByDesc('id')->limit(25)
                ->get(['id', 'consent_id', 'choice', 'performance', 'version', 'user_id', 'page', 'device', 'created_at']),
        ]);
    }
}
