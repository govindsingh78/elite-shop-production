<?php

namespace App\Services\Monitoring;

use App\Models\MonitorProblem;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Str;
use PDOException;
use Throwable;

/**
 * Turns what goes wrong into problems the admin can see: every server error or warning that is logged, and
 * crashes the website and app report. Repeats of the same problem add to its count instead of piling up.
 */
class Problems
{
    private const LOGGED_LEVELS = ['warning' => 'warning', 'error' => 'error', 'critical' => 'critical', 'alert' => 'critical', 'emergency' => 'critical'];

    /** At most this many new website/app problems an hour, so a flood of fake reports can't bury real ones. */
    private const NEW_CLIENT_PROBLEMS_PER_HOUR = 30;

    /** Set while a problem is being saved, so a failure while saving can't log (and record) itself forever. */
    private static bool $recording = false;

    /** When saving failed because the database was unreachable: later errors don't each wait on it for a minute. */
    private static int $databaseDownUntil = 0;

    /** A log entry, warning or worse, becomes a problem or adds to the one it repeats. */
    public static function fromLog(MessageLogged $event): void
    {
        $level = self::LOGGED_LEVELS[$event->level] ?? null;
        if (!$level || self::$recording) {
            return;
        }
        $exception = $event->context['exception'] ?? null;
        $message = trim((string) $event->message);
        // PHP deprecation notices are for developers; nobody using the store runs into them.
        if (!$exception instanceof Throwable && stripos($message, 'deprecated') !== false) {
            return;
        }
        // The database itself is unreachable, so this can't be saved there; the log file has it, and Server &
        // health shows the database as down.
        if ($exception instanceof Throwable && self::isConnectionError($exception)) {
            return;
        }

        self::guarded(function () use ($level, $exception, $message, $event) {
            if ($exception instanceof Throwable) {
                $location = self::appFrame($exception);
                $problem = [
                    'title' => class_basename($exception) . ': ' . $exception->getMessage(),
                    'message' => $exception->getMessage(),
                    'location' => $location,
                    'trace' => self::trace($exception),
                    'key' => get_class($exception) . '|' . $location . '|' . self::normalise($exception->getMessage()),
                ];
            } else {
                $headline = strtok($message, "\n") ?: 'Logged ' . $level;
                $extra = array_diff_key($event->context, ['exception' => true]);
                $problem = [
                    'title' => $headline,
                    'message' => $extra ? $message . "\n" . json_encode($extra, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR) : $message,
                    'location' => null,
                    'trace' => null,
                    'key' => $level . '|' . self::normalise($headline),
                ];
            }

            self::record('server', $level, $problem, self::requestDetails());
        });
    }

    /**
     * A crash reported by the website or the app.
     *
     * @param array{source: string, message: string, stack?: ?string, page?: ?string, component?: ?string, platform?: ?string, version?: ?string} $report
     */
    public static function fromClient(array $report, ?User $user): void
    {
        self::guarded(function () use ($report, $user) {
            $headline = Str::limit(trim(strtok($report['message'], "\n") ?: 'Unknown error'), 250, '…');
            $page = $report['page'] ?? null;
            $problem = [
                'title' => $headline,
                'message' => $report['message'],
                'location' => $report['component'] ?? $page,
                'trace' => isset($report['stack']) ? Str::limit($report['stack'], 6000, '…') : null,
                'key' => self::normalise($headline) . '|' . $page,
            ];
            $details = [
                'url' => $page,
                'method' => null,
                'user_id' => $user?->id,
                'audience' => self::audience($user),
                'context' => array_filter(['platform' => $report['platform'] ?? null, 'version' => $report['version'] ?? null]),
                'limit_new' => true,
            ];

            self::record($report['source'], 'error', $problem, $details);
        });
    }

    private static function record(string $source, string $level, array $problem, array $details): void
    {
        $fingerprint = hash('sha256', $source . '|' . $problem['key']);
        $now = now();
        $latest = [
            'url' => isset($details['url']) ? Str::limit($details['url'], 490, '') : null,
            'method' => $details['method'],
            'last_user_id' => $details['user_id'],
            'context' => $details['context'] ?: null,
            'last_seen_at' => $now,
        ];

        $existing = MonitorProblem::query()->where('fingerprint', $fingerprint)->first();
        if ($existing) {
            $affected = $existing->affected ?? [];
            $affected[$details['audience']] = ($affected[$details['audience']] ?? 0) + 1;
            $existing->fill([
                ...$latest,
                'affected' => $affected,
                'trace' => $problem['trace'] ?? $existing->trace,
                // Back again after being marked fixed: reopen it, and alert the admins again.
                ...($existing->status === MonitorProblem::RESOLVED ? ['status' => MonitorProblem::OPEN, 'resolved_at' => null, 'notified_at' => null] : []),
            ]);
            $existing->hits++;
            $existing->save();

            return;
        }

        if (!empty($details['limit_new']) && MonitorProblem::query()->where('source', '!=', 'server')
            ->where('first_seen_at', '>=', $now->copy()->subHour())->count() >= self::NEW_CLIENT_PROBLEMS_PER_HOUR) {
            return;
        }

        MonitorProblem::query()->create([
            ...$latest,
            'fingerprint' => $fingerprint,
            'source' => $source,
            'level' => $level,
            'title' => Str::limit($problem['title'], 250, '…'),
            'message' => Str::limit((string) $problem['message'], 4000, '…'),
            'location' => $problem['location'] ? Str::limit($problem['location'], 250, '…') : null,
            'trace' => $problem['trace'],
            'affected' => [$details['audience'] => 1],
            'first_seen_at' => $now,
        ]);
    }

    /** Runs `$work`, never letting recording a problem break the request or log itself again. */
    private static function guarded(callable $work): void
    {
        if (self::$recording || self::$databaseDownUntil > time()) {
            return;
        }
        self::$recording = true;
        try {
            $work();
        } catch (Throwable $exception) {
            // The log file still has the entry; the problem list just misses it.
            if (self::isConnectionError($exception)) {
                self::$databaseDownUntil = time() + 60;
            }
        } finally {
            self::$recording = false;
        }
    }

    /** "SQLSTATE[HY000] [2002] Connection refused", "[2006] MySQL server has gone away" and the like. */
    private static function isConnectionError(Throwable $exception): bool
    {
        return ($exception instanceof QueryException || $exception instanceof PDOException)
            && preg_match('/SQLSTATE\[(HY000\] \[\d+|08\w*)\]/', $exception->getMessage()) === 1;
    }

    /** Where it happened and who to: the request's address and the signed-in user, or the console command. */
    private static function requestDetails(): array
    {
        if (app()->runningInConsole() && !app()->runningUnitTests()) {
            return ['url' => 'php artisan ' . ($_SERVER['argv'][1] ?? ''), 'method' => 'CLI', 'user_id' => null, 'audience' => 'system', 'context' => []];
        }
        $request = request();
        // API sign-ins are tokens, so ask that guard even on routes that don't require signing in.
        $user = $request->user('sanctum');

        return [
            'url' => '/' . ltrim($request->path(), '/'),
            'method' => $request->method(),
            'user_id' => $user?->id,
            'audience' => self::audience($user),
            'context' => [],
        ];
    }

    /** Who ran into it: a shopper, seller, admin, or someone not signed in. */
    public static function audience(?User $user): string
    {
        return match (true) {
            !$user => 'guest',
            $user->hasAdminRole() => 'admin',
            $user->role === 'seller' => 'seller',
            default => 'customer',
        };
    }

    /** The first place in the store's own code (not a library) the error went through, e.g. app/Http/Controllers/X.php:42. */
    private static function appFrame(Throwable $exception): string
    {
        $frames = [['file' => $exception->getFile(), 'line' => $exception->getLine()], ...$exception->getTrace()];
        foreach ($frames as $frame) {
            $file = $frame['file'] ?? '';
            if ($file !== '' && !str_contains($file, DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR) && str_starts_with($file, base_path())) {
                return self::relative($file) . ':' . ($frame['line'] ?? 0);
            }
        }

        return self::relative($exception->getFile()) . ':' . $exception->getLine();
    }

    private static function trace(Throwable $exception): string
    {
        return Str::limit(str_replace(base_path() . DIRECTORY_SEPARATOR, '', $exception->getTraceAsString()), 6000, '…');
    }

    private static function relative(string $file): string
    {
        return str_replace('\\', '/', Str::after($file, base_path() . DIRECTORY_SEPARATOR));
    }

    /** The same problem with different ids or numbers in its message counts as one. */
    private static function normalise(string $message): string
    {
        $message = preg_replace('/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i', '#', $message);

        return Str::limit(preg_replace('/\d+/', '#', $message), 300, '');
    }
}
