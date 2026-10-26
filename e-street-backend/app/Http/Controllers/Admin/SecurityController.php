<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LoginAttempt;
use App\Models\LoginBlock;
use App\Services\Security\LoginGuard;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Admin › Security: the sign-in log, locked accounts and blocked addresses, and unblocking or blocking by hand. */
class SecurityController extends Controller
{
    public function index()
    {
        $day = now()->subDay();
        $count = fn (string $outcome) => LoginAttempt::query()->where('outcome', $outcome)->where('created_at', '>=', $day)->count();

        return response()->json([
            'stats' => [
                'failed' => $count(LoginAttempt::FAILED),
                'refused' => $count(LoginAttempt::BLOCKED),
                'succeeded' => $count(LoginAttempt::SUCCESS),
                'blocked_now' => LoginBlock::query()->active()->count(),
                'failed_addresses' => LoginAttempt::query()->where('outcome', LoginAttempt::FAILED)->where('created_at', '>=', $day)->distinct()->count('ip'),
            ],
            'rules' => [
                'max_failures' => LoginGuard::MAX_FAILURES,
                'ip_max_failures' => LoginGuard::IP_MAX_FAILURES,
                'block_hours' => LoginGuard::BLOCK_HOURS,
            ],
            'blocks' => LoginBlock::query()->with('admin:id,name')
                ->where(fn ($query) => $query->active()->orWhere('created_at', '>=', now()->subDays(7)))
                ->orderByDesc('created_at')->limit(100)->get()
                ->map(fn (LoginBlock $block) => $this->present($block)),
            'your_ip' => request()->ip(),
        ]);
    }

    /** The sign-in log, newest first. */
    public function attempts(Request $request)
    {
        $filters = $request->validate([
            'outcome' => ['nullable', Rule::in([LoginAttempt::SUCCESS, LoginAttempt::FAILED, LoginAttempt::BLOCKED])],
            'portal' => ['nullable', Rule::in(['admin', 'vendor', 'customer'])],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        return response()->json(LoginAttempt::query()
            ->when($filters['outcome'] ?? null, fn ($query, $outcome) => $query->where('outcome', $outcome))
            ->when($filters['portal'] ?? null, fn ($query, $portal) => $query->where('portal', $portal))
            ->when($filters['search'] ?? null, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('email', 'like', '%' . strtolower($search) . '%')->orWhere('ip', 'like', "%{$search}%")))
            ->orderByDesc('id')
            ->paginate(30));
    }

    /** Blocks an IP address from the whole store (or only from signing in) for a while, or until unblocked. */
    public function block(Request $request)
    {
        $validated = $request->validate([
            'ip' => ['required', 'ip'],
            'hours' => ['nullable', 'integer', Rule::in([24, 168, 720])],
            'scope' => ['nullable', Rule::in([LoginBlock::ALL, LoginBlock::SIGN_IN])],
            'reason' => ['nullable', 'string', 'max:200'],
        ]);
        if ($validated['ip'] === $request->ip()) {
            throw ValidationException::withMessages(['ip' => 'That’s the address you’re using right now, so blocking it would lock you out too.']);
        }
        if (LoginBlock::query()->active()->where('type', LoginBlock::IP)->where('value', $validated['ip'])->where('scope', $validated['scope'] ?? LoginBlock::ALL)->exists()) {
            throw ValidationException::withMessages(['ip' => 'That address is already blocked.']);
        }

        $block = LoginBlock::query()->create([
            'type' => LoginBlock::IP,
            'value' => $validated['ip'],
            'scope' => $validated['scope'] ?? LoginBlock::ALL,
            'reason' => filled($validated['reason'] ?? null) ? $validated['reason'] : 'Blocked by an admin',
            'blocked_until' => isset($validated['hours']) ? now()->addHours($validated['hours']) : null,
            'created_by' => $request->user()->id,
        ]);
        LoginGuard::forgetBlockedIps();

        return response()->json([
            'message' => "{$block->value} is blocked " . ($block->scope === LoginBlock::ALL ? 'from the whole store' : 'from signing in') . ($block->blocked_until ? ' for ' . $this->duration($validated['hours']) . '.' : ' until you unblock it.'),
            'block' => $this->present($block->load('admin:id,name')),
        ], 201);
    }

    public function unblock(Request $request, LoginBlock $block)
    {
        if (!$block->isActive()) {
            throw ValidationException::withMessages(['block' => 'This block has already ended.']);
        }
        $block->forceFill(['unblocked_at' => now(), 'unblock_reason' => 'Unblocked by ' . $request->user()->name])->save();
        LoginGuard::forgetBlockedIps();

        return response()->json([
            'message' => $block->type === LoginBlock::ACCOUNT ? "{$block->value} can sign in again." : "{$block->value} is no longer blocked.",
            'block' => $this->present($block->load('admin:id,name')),
        ]);
    }

    private function present(LoginBlock $block): array
    {
        return [
            ...$block->only(['id', 'type', 'value', 'scope', 'reason', 'attempts', 'blocked_until', 'unblocked_at', 'unblock_reason', 'created_at']),
            'active' => $block->isActive(),
            'blocked_by' => $block->admin?->name,
        ];
    }

    private function duration(int $hours): string
    {
        return [24 => '24 hours', 168 => '7 days', 720 => '30 days'][$hours];
    }
}
