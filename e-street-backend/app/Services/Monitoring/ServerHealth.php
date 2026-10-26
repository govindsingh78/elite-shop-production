<?php

namespace App\Services\Monitoring;

use App\Models\Setting;
use App\Models\TempImage;
use App\Services\ProductImages;
use FilesystemIterator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Throwable;

/**
 * The server's vital signs (disk, memory, CPU, database, PHP and Laravel settings), what fills the disk, the
 * log file, and clean-ups that free space. Readings that aren't available (e.g. memory on Windows) are null.
 */
class ServerHealth
{
    public const DISK_WARNING = 80;
    public const DISK_CRITICAL = 90;
    private const HEARTBEAT = 'monitor.last_check';
    /** The scheduler runs every minute; checks run every 10, so no heartbeat for 30 minutes means it stopped. */
    private const HEARTBEAT_STALE_MINUTES = 30;
    private const LOG_TRIM_OVER = 10 * 1024 * 1024;
    private const LOG_KEEP = 2 * 1024 * 1024;

    public static function snapshot(): array
    {
        return [
            'checked_at' => now()->toIso8601String(),
            'disk' => self::disk(),
            'memory' => self::memory(),
            'cpu' => self::cpu(),
            'uptime_seconds' => self::uptime(),
            'database' => self::database(),
            'app' => self::app(),
            'background' => self::background(),
        ];
    }

    public static function disk(): ?array
    {
        $total = @disk_total_space(base_path());
        $free = @disk_free_space(base_path());
        if (!$total || $free === false) {
            return null;
        }
        $percent = round(($total - $free) / $total * 100, 1);

        return [
            'total' => (int) $total,
            'used' => (int) ($total - $free),
            'free' => (int) $free,
            'percent' => $percent,
            'status' => $percent >= self::DISK_CRITICAL ? 'critical' : ($percent >= self::DISK_WARNING ? 'warning' : 'ok'),
        ];
    }

    /** From /proc/meminfo (Linux). */
    public static function memory(): ?array
    {
        $info = @file_get_contents('/proc/meminfo');
        if (!$info || !preg_match_all('/^(\w+):\s+(\d+) kB/m', $info, $matches)) {
            return null;
        }
        $kb = array_combine($matches[1], array_map('intval', $matches[2]));
        $total = ($kb['MemTotal'] ?? 0) * 1024;
        if (!$total) {
            return null;
        }
        $available = ($kb['MemAvailable'] ?? $kb['MemFree'] ?? 0) * 1024;
        $availableShare = $available / $total * 100;

        return [
            'total' => $total,
            'available' => $available,
            'percent' => round(100 - $availableShare, 1),
            'swap_total' => ($kb['SwapTotal'] ?? 0) * 1024,
            'swap_used' => (($kb['SwapTotal'] ?? 0) - ($kb['SwapFree'] ?? 0)) * 1024,
            'status' => $availableShare < 5 ? 'critical' : ($availableShare < 12 ? 'warning' : 'ok'),
        ];
    }

    /** Load averages over 1, 5 and 15 minutes; above the number of CPU cores means work is queueing up. */
    public static function cpu(): ?array
    {
        $load = function_exists('sys_getloadavg') ? @sys_getloadavg() : false;
        if (!$load) {
            return null;
        }
        $cpuinfo = @file_get_contents('/proc/cpuinfo');
        $cores = max(1, $cpuinfo ? preg_match_all('/^processor\s*:/m', $cpuinfo) : 1);

        return [
            'load' => array_map(fn ($value) => round($value, 2), $load),
            'cores' => $cores,
            'status' => $load[1] > $cores * 2 ? 'critical' : ($load[1] > $cores ? 'warning' : 'ok'),
        ];
    }

    public static function uptime(): ?int
    {
        $uptime = @file_get_contents('/proc/uptime');

        return $uptime ? (int) explode(' ', $uptime)[0] : null;
    }

    public static function database(): array
    {
        try {
            $started = hrtime(true);
            DB::select('select 1');
            $latency = round((hrtime(true) - $started) / 1e6, 1);
            $driver = DB::connection()->getDriverName();
            $size = null;
            $tables = [];
            if (in_array($driver, ['mysql', 'mariadb'], true)) {
                $size = (int) DB::selectOne('select coalesce(sum(data_length + index_length), 0) as size from information_schema.tables where table_schema = database()')->size;
                $tables = collect(DB::select('select table_name as name, table_rows as row_count, data_length + index_length as size from information_schema.tables where table_schema = database() order by size desc limit 6'))
                    ->map(fn ($table) => ['name' => $table->name, 'rows' => (int) $table->row_count, 'size' => (int) $table->size])->all();
            } elseif ($driver === 'sqlite' && is_file($file = DB::connection()->getDatabaseName())) {
                $size = filesize($file);
            }

            return ['status' => $latency > 250 ? 'warning' : 'ok', 'driver' => $driver, 'latency_ms' => $latency, 'size' => $size, 'largest_tables' => $tables];
        } catch (Throwable $exception) {
            return ['status' => 'critical', 'error' => Str::limit($exception->getMessage(), 300)];
        }
    }

    public static function app(): array
    {
        return [
            'php' => PHP_VERSION,
            'laravel' => app()->version(),
            'environment' => app()->environment(),
            'debug' => (bool) config('app.debug'),
            'config_cached' => app()->configurationIsCached(),
            'routes_cached' => app()->routesAreCached(),
            'opcache' => self::opcache(),
            'cache_store' => config('cache.default'),
            'mailer' => config('mail.default'),
            'log_channel' => config('logging.default') === 'stack' ? implode(', ', (array) config('logging.channels.stack.channels')) : config('logging.default'),
            'memory_limit' => ini_get('memory_limit'),
            'upload_max' => ini_get('upload_max_filesize'),
            'post_max' => ini_get('post_max_size'),
            'os' => PHP_OS_FAMILY . ' ' . php_uname('r'),
            'exif' => function_exists('exif_read_data'),
        ];
    }

    /** Whether PHP keeps compiled code in memory. Unknown from the command line, which has its own setting. */
    private static function opcache(): ?bool
    {
        if (app()->runningInConsole() && !app()->runningUnitTests()) {
            return null;
        }
        if (!function_exists('opcache_get_status')) {
            return false;
        }
        try {
            $status = @opcache_get_status(false);
        } catch (Throwable) {
            return null;
        }

        return is_array($status) ? (bool) ($status['opcache_enabled'] ?? false) : (bool) ini_get('opcache.enable');
    }

    /** Whether the scheduled checks (monitor:check) run, which needs the server's cron to run Laravel's scheduler. */
    public static function background(): array
    {
        $last = Setting::read(self::HEARTBEAT);
        $lastAt = $last ? Carbon::parse($last) : null;

        return [
            'last_check_at' => $lastAt?->toIso8601String(),
            'running' => $lastAt !== null && $lastAt->gt(now()->subMinutes(self::HEARTBEAT_STALE_MINUTES)),
            'cron' => '* * * * * cd ' . base_path() . ' && php artisan schedule:run >> /dev/null 2>&1',
        ];
    }

    public static function heartbeat(): void
    {
        Setting::write(self::HEARTBEAT, now()->toIso8601String());
    }

    /** What takes up the disk, measured every 10 minutes at most (walking big folders takes a moment). */
    public static function storage(bool $fresh = false): array
    {
        if ($fresh) {
            self::forgetStorage();
        }

        return Cache::remember('monitor.storage', 600, function () {
            $root = dirname(base_path());
            $folders = collect([
                ['key' => 'photos', 'label' => 'Product photos', 'path' => public_path('uploads/products')],
                ['key' => 'temp', 'label' => 'Temporary photo uploads', 'path' => public_path('uploads/temp'), 'cleanup' => 'temp-uploads'],
                ['key' => 'logs', 'label' => 'Log files', 'path' => storage_path('logs'), 'cleanup' => 'logs'],
                ['key' => 'cache', 'label' => 'Cache & compiled pages', 'path' => storage_path('framework')],
                ['key' => 'files', 'label' => 'Other stored files', 'path' => storage_path('app')],
                ['key' => 'website', 'label' => 'Website files', 'path' => $root . '/e-shop-frontend/dist'],
                ['key' => 'code', 'label' => 'Code libraries (vendor)', 'path' => base_path('vendor')],
                ['key' => 'git', 'label' => 'Deploy history (git)', 'path' => $root . '/.git'],
            ])->map(fn ($folder) => [...$folder, ...self::folderSize($folder['path']), 'path' => str_replace('\\', '/', $folder['path'])])
                ->filter(fn ($folder) => $folder['exists'])
                ->sortByDesc('bytes')
                ->values();

            $disk = self::disk();
            $app = (int) $folders->sum('bytes');

            return [
                'measured_at' => now()->toIso8601String(),
                'folders' => $folders->all(),
                'app_total' => $app,
                // The rest of the used space: the operating system, packages, other logs and caches.
                'outside_app' => $disk ? max(0, $disk['used'] - $app) : null,
                'photos' => self::photoStats(),
            ];
        });
    }

    /** The quick part of storage() that suggestions need: product photo sizes and old uploads. */
    public static function quickStorage(): array
    {
        return Cache::remember('monitor.storage.quick', 600, fn () => [
            'photos' => self::photoStats(),
            'temp_bytes' => self::folderSize(public_path('uploads/temp'))['bytes'],
        ]);
    }

    private static function forgetStorage(): void
    {
        Cache::forget('monitor.storage');
        Cache::forget('monitor.storage.quick');
    }

    /** How heavy the product photos shoppers download are, and how many are bigger than they need to be. */
    private static function photoStats(): array
    {
        $stats = [];
        foreach (ProductImages::SIDES as $size => $maxSide) {
            $files = array_values(array_filter(glob(public_path("uploads/products/{$size}/*")) ?: [], 'is_file'));
            $stats[$size] = [
                'count' => count($files),
                'average' => $files ? (int) (array_sum(array_map('filesize', $files)) / count($files)) : 0,
                'max_side' => $maxSide,
                'oversized' => count(array_filter($files, fn ($file) => ($info = @getimagesize($file)) && max($info[0], $info[1]) > $maxSide)),
            ];
        }

        return $stats;
    }

    private static function folderSize(string $path): array
    {
        if (!is_dir($path)) {
            return ['bytes' => 0, 'files' => 0, 'exists' => false];
        }
        $bytes = 0;
        $files = 0;
        try {
            $items = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::LEAVES_ONLY,
                RecursiveIteratorIterator::CATCH_GET_CHILD,
            );
            foreach ($items as $item) {
                if ($item->isFile() && !$item->isLink()) {
                    $bytes += $item->getSize();
                    $files++;
                }
            }
        } catch (Throwable) {
            // A folder PHP can't read: count what it could.
        }

        return ['bytes' => $bytes, 'files' => $files, 'exists' => true];
    }

    /** The log files, newest first. */
    public static function logFiles(): array
    {
        return collect(glob(storage_path('logs/*.log')) ?: [])
            ->map(fn ($path) => ['name' => basename($path), 'size' => filesize($path), 'modified_at' => Carbon::createFromTimestamp(filemtime($path))->toIso8601String()])
            ->sortByDesc('modified_at')
            ->values()
            ->all();
    }

    /**
     * The latest entries of a log file (the newest file by default), newest first.
     *
     * @param string $level all, error (error and worse) or warning
     */
    public static function logEntries(?string $file = null, string $level = 'all', int $limit = 150): array
    {
        $files = self::logFiles();
        $names = array_column($files, 'name');
        $name = in_array($file, $names, true) ? $file : ($names[0] ?? null);
        if (!$name) {
            return ['file' => null, 'files' => $files, 'entries' => []];
        }

        $path = storage_path('logs/' . $name);
        $size = filesize($path);
        $handle = fopen($path, 'rb');
        fseek($handle, -min($size, 1_000_000), SEEK_END);
        $chunk = (string) stream_get_contents($handle);
        fclose($handle);

        preg_match_all('/^\[(\d{4}-\d{2}-\d{2}[T ][^\]]+)\] [\w-]+\.(\w+): /m', $chunk, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        $levels = ['error' => ['ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY'], 'warning' => ['WARNING']][$level] ?? null;
        $entries = [];
        foreach ($matches as $index => $match) {
            $start = $match[0][1] + strlen($match[0][0]);
            $end = isset($matches[$index + 1]) ? $matches[$index + 1][0][1] : strlen($chunk);
            $entryLevel = strtoupper($match[2][0]);
            if ($levels && !in_array($entryLevel, $levels, true)) {
                continue;
            }
            $body = rtrim(substr($chunk, $start, $end - $start));
            $firstLine = strtok($body, "\n");
            $entries[] = [
                'time' => $match[1][0],
                'level' => strtolower($entryLevel),
                'message' => Str::limit((string) $firstLine, 500, '…'),
                'details' => Str::limit(trim(substr($body, strlen((string) $firstLine))), 4000, '…') ?: null,
            ];
        }

        return ['file' => $name, 'files' => $files, 'entries' => array_slice(array_reverse($entries), 0, $limit)];
    }

    /** Deletes log files older than a week, and trims any log over 10 MB to its latest 2 MB. */
    public static function cleanLogs(): array
    {
        $files = self::logFiles();
        $current = $files[0]['name'] ?? null;
        $freed = 0;
        $removed = 0;
        foreach ($files as $file) {
            $path = storage_path('logs/' . $file['name']);
            if ($file['name'] !== $current && filemtime($path) < now()->subDays(7)->getTimestamp()) {
                if (@unlink($path)) {
                    $freed += $file['size'];
                    $removed++;
                }
                continue;
            }
            if ($file['size'] > self::LOG_TRIM_OVER) {
                $handle = fopen($path, 'rb');
                fseek($handle, -self::LOG_KEEP, SEEK_END);
                $tail = (string) stream_get_contents($handle);
                fclose($handle);
                // Start at a whole entry.
                $tail = preg_match('/^\[\d{4}-\d{2}-\d{2}/m', $tail, $match, PREG_OFFSET_CAPTURE) ? substr($tail, $match[0][1]) : $tail;
                if (file_put_contents($path, $tail, LOCK_EX) !== false) {
                    $freed += $file['size'] - strlen($tail);
                }
            }
        }
        clearstatcache();
        self::forgetStorage();

        return ['freed' => $freed, 'message' => $freed
            ? 'Freed ' . self::bytes($freed) . ($removed ? " ({$removed} old log " . ($removed === 1 ? 'file' : 'files') . ' removed).' : '.')
            : 'The logs are already small. Nothing to clean.'];
    }

    /**
     * Deletes photo uploads older than `$hours` (they have been copied into their products by then, or were
     * abandoned). Uploads are never removed otherwise, and full-size originals add up fast.
     */
    public static function cleanTempUploads(int $hours = 24): array
    {
        $cutoff = now()->subHours($hours);
        $freed = 0;
        $removed = 0;
        $remove = function (string $path) use (&$freed, &$removed) {
            $size = filesize($path);
            if (@unlink($path)) {
                $freed += $size;
                $removed++;
            }
        };

        TempImage::query()->where('created_at', '<', $cutoff)->chunkById(200, function ($images) use ($remove) {
            foreach ($images as $image) {
                foreach ([$image->original_path, $image->thumb_path] as $relative) {
                    if ($relative && is_file(public_path($relative))) {
                        $remove(public_path($relative));
                    }
                }
                $image->delete();
            }
        });
        // Files left behind without a record.
        foreach (['uploads/temp/original', 'uploads/temp/thumb'] as $folder) {
            foreach (glob(public_path($folder) . '/*') ?: [] as $path) {
                if (is_file($path) && filemtime($path) < $cutoff->getTimestamp()) {
                    $remove($path);
                }
            }
        }
        self::forgetStorage();

        return ['freed' => $freed, 'message' => $removed
            ? 'Removed ' . $removed . ' old upload ' . ($removed === 1 ? 'file' : 'files') . ', freeing ' . self::bytes($freed) . '.'
            : 'No uploads older than ' . $hours . ' hours. Nothing to clean.'];
    }

    public static function bytes(int|float $bytes): string
    {
        $units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
        $power = $bytes > 0 ? min((int) floor(log($bytes, 1024)), count($units) - 1) : 0;

        return round($bytes / (1024 ** $power), $power ? 1 : 0) . ' ' . $units[$power];
    }
}
