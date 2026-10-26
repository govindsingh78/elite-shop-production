<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MonitorProblem;
use App\Services\Monitoring\Advisor;
use App\Services\Monitoring\MailCheck;
use App\Services\Monitoring\ServerHealth;
use App\Services\Monitoring\Speed;
use App\Services\ProductImages;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Admin › Server & health: the server's vital signs, problems people ran into, speed, storage and the log. */
class ServerController extends Controller
{
    private const AUDIENCES = ['customer', 'seller', 'admin', 'guest', 'system'];

    public function overview()
    {
        $health = ServerHealth::snapshot();
        $open = MonitorProblem::query()->where('status', MonitorProblem::OPEN);

        return response()->json([
            'health' => $health,
            'attention' => Advisor::attention($health),
            'suggestions' => Advisor::suggestions(),
            'problems' => [
                'open' => (clone $open)->count(),
                'last_day' => (clone $open)->where('last_seen_at', '>=', now()->subDay())->count(),
                'latest' => (clone $open)->orderByDesc('last_seen_at')->limit(5)->get()->map->summary(),
            ],
            'slowest' => Speed::routes(1)->take(3)->values(),
        ]);
    }

    public function problems(Request $request)
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in([MonitorProblem::OPEN, MonitorProblem::RESOLVED, 'all'])],
            'source' => ['nullable', Rule::in(['server', 'website', 'app'])],
            'audience' => ['nullable', Rule::in(self::AUDIENCES)],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $status = $filters['status'] ?? MonitorProblem::OPEN;

        $problems = MonitorProblem::query()
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            ->when($filters['source'] ?? null, fn ($query, $source) => $query->where('source', $source))
            // JSON counts per kind of user: matching the key's presence works on MySQL and SQLite alike.
            ->when($filters['audience'] ?? null, fn ($query, $audience) => $query->where('affected', 'like', '%"' . $audience . '"%'))
            ->when($filters['search'] ?? null, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('title', 'like', "%{$search}%")->orWhere('url', 'like', "%{$search}%")->orWhere('location', 'like', "%{$search}%")))
            ->orderByDesc('last_seen_at')
            ->paginate(20);
        $problems->setCollection($problems->getCollection()->map->summary());

        return response()->json([
            ...$problems->toArray(),
            'counts' => [
                'open' => MonitorProblem::query()->where('status', MonitorProblem::OPEN)->count(),
                'resolved' => MonitorProblem::query()->where('status', MonitorProblem::RESOLVED)->count(),
            ],
        ]);
    }

    public function problem(MonitorProblem $problem)
    {
        return response()->json(['problem' => $problem->details()]);
    }

    /** Marks a problem fixed (it reopens by itself if it happens again), or open again. */
    public function updateProblem(Request $request, MonitorProblem $problem)
    {
        $validated = $request->validate(['status' => ['required', Rule::in([MonitorProblem::OPEN, MonitorProblem::RESOLVED])]]);
        $resolved = $validated['status'] === MonitorProblem::RESOLVED;
        $problem->forceFill(['status' => $validated['status'], 'resolved_at' => $resolved ? now() : null])->save();

        return response()->json([
            'message' => $resolved ? 'Marked as fixed. If it happens again it reopens and you’ll be told.' : 'Reopened.',
            'problem' => $problem->details(),
        ]);
    }

    public function destroyProblem(MonitorProblem $problem)
    {
        $problem->delete();

        return response()->json(['message' => 'Problem removed.']);
    }

    /** Resolves every open problem at once, e.g. after a deploy that fixed them. */
    public function resolveAll()
    {
        $count = MonitorProblem::query()->where('status', MonitorProblem::OPEN)->update(['status' => MonitorProblem::RESOLVED, 'resolved_at' => now()]);

        return response()->json(['message' => $count ? "Marked {$count} " . ($count === 1 ? 'problem' : 'problems') . ' as fixed.' : 'There were no open problems.']);
    }

    public function speed(Request $request)
    {
        $request->validate(['days' => ['nullable', Rule::in([1, 7, 30])]]);
        $days = (int) $request->input('days', 7);

        return response()->json([
            'days' => $days,
            'slow_ms' => Speed::SLOW_MS,
            'routes' => Speed::routes($days),
            'pages' => Speed::pages($days),
        ]);
    }

    public function storage(Request $request)
    {
        return response()->json([
            'disk' => ServerHealth::disk(),
            'storage' => ServerHealth::storage($request->boolean('fresh')),
            'photo_sides' => ProductImages::SIDES,
        ]);
    }

    public function cleanup(Request $request)
    {
        $action = $request->validate(['action' => ['required', Rule::in(['logs', 'temp-uploads', 'photos'])]])['action'];
        $result = match ($action) {
            'logs' => ServerHealth::cleanLogs(),
            'temp-uploads' => ServerHealth::cleanTempUploads(24),
            'photos' => self::optimisePhotos(),
        };

        return response()->json([...$result, 'disk' => ServerHealth::disk(), 'storage' => ServerHealth::storage($action !== 'photos' || ($result['remaining'] ?? 0) === 0)]);
    }

    /** One batch of photo optimising; the page calls again while photos remain. */
    private static function optimisePhotos(): array
    {
        $result = ProductImages::optimiseExisting(15);
        $message = $result['optimised']
            ? "Optimised {$result['optimised']} " . ($result['optimised'] === 1 ? 'photo' : 'photos') . ', saving ' . ServerHealth::bytes($result['freed']) . '.'
            : 'All product photos are already the right size.';
        if ($result['remaining']) {
            $message .= " {$result['remaining']} to go…";
        } elseif ($result['skipped']) {
            $message .= " {$result['skipped']} couldn’t be shrunk (animated or extremely large) and were left as they are.";
        }

        return [...$result, 'message' => $message];
    }

    /** Sends a test email to the signed-in admin, to check the mail settings (e.g. Amazon SES) work. */
    public function testEmail(Request $request)
    {
        $result = MailCheck::send($request->user()->email);

        return response()->json($result, $result['sent'] ? 200 : 422);
    }

    public function logs(Request $request)
    {
        $filters = $request->validate([
            'file' => ['nullable', 'string', 'max:120'],
            'level' => ['nullable', Rule::in(['all', 'error', 'warning'])],
        ]);

        return response()->json(ServerHealth::logEntries($filters['file'] ?? null, $filters['level'] ?? 'all'));
    }
}
