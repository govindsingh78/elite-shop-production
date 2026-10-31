<?php

namespace App\Services\Monitoring;

use App\Models\Order;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PDO;
use RuntimeException;
use Symfony\Component\Process\ExecutableFinder;
use Throwable;

/**
 * Admin › Server & health › Backups: copies of the MySQL database, taken with mysqldump and kept as .sql.gz
 * files outside the web root. Each has a small .json record beside it instead of a row in the database,
 * because restoring a backup would rewind that history along with everything else.
 */
class Backups
{
    public const MANUAL = 'manual';
    public const AUTOMATIC = 'automatic';
    public const SAFETY = 'safety';

    public const INSTALL_COMMAND = 'sudo apt-get install -y mysql-client';
    public const RESTORE_COMMAND = 'php artisan backups:restore';

    private const SETTINGS = 'backups.settings';
    private const DEFAULTS = ['enabled' => true, 'hour' => 2, 'keep' => 14];
    private const TIMEZONE = 'Asia/Kolkata';
    private const RESTORE_RECORD = 'last-restore.state';
    /** Room to leave on the disk: a backup should never be what fills it. */
    private const MIN_FREE = 200 * 1024 * 1024;
    private const FAILED_KEEP_DAYS = 7;
    /** A backup still marked running after this long, with nothing working on it, has died. */
    private const STALE_MINUTES = 2;
    private const OVERDUE_HOURS = 48;

    public static function folder(): string
    {
        return rtrim((string) config('backups.path'), '/\\');
    }

    /** Why backups can't run on this server, or null if they can. */
    public static function problem(): ?string
    {
        $driver = self::connection()['driver'] ?? 'none';
        if (!in_array($driver, ['mysql', 'mariadb'], true)) {
            return "Backups need a MySQL database, and this server uses {$driver}.";
        }
        if (!function_exists('proc_open')) {
            return 'PHP isn’t allowed to run other programs here (proc_open is switched off in php.ini).';
        }
        if (!self::tool('mysqldump') || !self::tool('mysql')) {
            return 'The MySQL client tools aren’t installed on this server.';
        }

        return null;
    }

    /** Everything Admin › Server & health › Backups shows. */
    public static function overview(): array
    {
        $backups = self::all();
        $ready = $backups->firstWhere('status', 'ready');
        $problem = self::problem();

        return [
            'problem' => $problem,
            'install_command' => $problem && str_contains($problem, 'client tools') ? self::INSTALL_COMMAND : null,
            'restore_command' => self::RESTORE_COMMAND,
            'settings' => self::settings(),
            'next_automatic_at' => self::nextAutomatic()?->toIso8601String(),
            'working' => self::working(),
            'last_ready_at' => $ready['finished_at'] ?? null,
            'last_copied_at' => $backups->max('downloaded_at'),
            'total_size' => (int) $backups->sum('size'),
            'restore' => self::lastRestore(),
            'backups' => $backups->values()->all(),
        ];
    }

    /** Every backup, newest first. */
    public static function all(): Collection
    {
        return collect(glob(self::folder() . '/*.json') ?: [])
            ->map(fn (string $path) => json_decode((string) @file_get_contents($path), true))
            ->filter(fn ($record) => is_array($record) && isset($record['id']))
            ->map(fn (array $record) => self::settled($record))
            ->sortByDesc('started_at')
            ->values();
    }

    public static function find(string $id): ?array
    {
        return self::all()->firstWhere('id', $id);
    }

    public static function settings(): array
    {
        $saved = json_decode((string) Setting::read(self::SETTINGS, ''), true);

        return [...self::DEFAULTS, ...(is_array($saved) ? $saved : [])];
    }

    public static function saveSettings(array $settings): array
    {
        Setting::write(self::SETTINGS, json_encode([...self::settings(), ...$settings]));
        self::prune();

        return self::settings();
    }

    /** Takes a backup now, and waits for it. */
    public static function create(string $trigger, ?string $by = null): array
    {
        return self::run(self::begin($trigger, $by)['id']);
    }

    /** Lists a backup as running, so the page can show it while the work happens after the response. */
    public static function begin(string $trigger, ?string $by = null): array
    {
        File::ensureDirectoryExists(self::folder(), 0770);
        $now = now();
        $record = [
            'id' => 'elitezaar-' . $now->copy()->timezone(self::TIMEZONE)->format('Y-m-d-His'),
            'status' => 'running',
            'trigger' => $trigger,
            'by' => $by,
            'started_at' => $now->toIso8601String(),
            'finished_at' => null,
            'size' => 0,
            'sha256' => null,
            'error' => null,
            'downloaded_at' => null,
            'downloaded_by' => null,
        ];
        self::remember($record);

        return $record;
    }

    public static function run(string $id): array
    {
        $record = self::record($id);
        $done = self::exclusively(fn () => self::take($record));

        return $done ?? self::remember([...$record, 'status' => 'failed', 'finished_at' => now()->toIso8601String(), 'error' => 'Another backup or restore was running. Try again when it finishes.']);
    }

    /** Whether a backup or a restore is working, or has been asked for and is about to start. */
    public static function working(): bool
    {
        return self::busy() || self::all()->contains('status', 'running') || (self::lastRestore()['status'] ?? null) === 'running';
    }

    /** Run by the scheduler every few minutes: the day's automatic backup, once, from the chosen hour (India time). */
    public static function runIfDue(): ?array
    {
        $settings = self::settings();
        $now = now(self::TIMEZONE);
        if (!$settings['enabled'] || $now->hour < $settings['hour'] || self::problem() || self::ranOn($now->toDateString())) {
            return null;
        }

        return self::create(self::AUTOMATIC);
    }

    public static function delete(string $id): void
    {
        File::delete([self::path("{$id}.sql.gz"), self::path("{$id}.json")]);
    }

    /** Remembers who took a copy off the server, which the page uses to say when that last happened. */
    public static function markDownloaded(string $id, ?string $by): void
    {
        self::remember([...self::record($id), 'downloaded_at' => now()->toIso8601String(), 'downloaded_by' => $by]);
    }

    public static function filePath(array $backup): string
    {
        return self::path("{$backup['id']}.sql.gz");
    }

    /** What restoring would undo: the things added since this backup was taken. */
    public static function changesSince(array $backup): array
    {
        $since = Carbon::parse($backup['finished_at'] ?? $backup['started_at']);

        return [
            'orders' => Order::query()->where('created_at', '>', $since)->count(),
            'customers' => User::query()->where('role', 'customer')->where('created_at', '>', $since)->count(),
            'products' => Product::query()->where('created_at', '>', $since)->count(),
        ];
    }

    public static function lastRestore(): ?array
    {
        $record = json_decode((string) @file_get_contents(self::path(self::RESTORE_RECORD)), true);
        if (!is_array($record)) {
            return null;
        }
        // Nothing is working on it any more: a deploy restarted PHP part-way, say.
        if ($record['status'] === 'running' && Carbon::parse($record['started_at'])->lt(now()->subMinutes(self::STALE_MINUTES)) && !self::busy()) {
            return self::rememberRestore([...$record, 'status' => 'failed', 'finished_at' => now()->toIso8601String(), 'error' => 'It stopped before finishing, possibly because the server restarted. The database may be incomplete, so restore the newest safety copy.']);
        }

        return $record;
    }

    /** Lists a restore as running, so the page can follow it while the work happens after the response. */
    public static function beginRestore(array $backup, ?string $by): void
    {
        self::rememberRestore(['status' => 'running', 'backup' => $backup['id'], 'backup_taken_at' => $backup['started_at'], 'by' => $by, 'started_at' => now()->toIso8601String(), 'finished_at' => null, 'safety_copy' => null, 'error' => null]);
    }

    /**
     * Puts the database back as it was when the backup was taken. The store goes offline, so nothing is lost in
     * between; a safety copy is taken first and goes back automatically if anything fails. Afterwards the
     * migrations run, so a backup from before the latest code still works with it. From the server, where a
     * broken database may not be readable, the safety copy can be skipped.
     */
    public static function restore(string $id, bool $safetyCopy = true): array
    {
        @set_time_limit(0);
        $status = self::lastRestore() ?: [];
        $ran = self::exclusively(function () use ($id, $safetyCopy, $status) {
            $temporary = [];
            $unpack = function (string $from) use (&$temporary) {
                return $temporary[] = self::unpack($from);
            };
            Artisan::call('down', ['--retry' => 30]);
            try {
                $sql = $unpack($id);
                $safety = null;
                if ($safetyCopy) {
                    $safety = self::take(self::begin(self::SAFETY, $status['by'] ?? null));
                    if ($safety['status'] !== 'ready') {
                        throw new RuntimeException("The safety copy failed, so nothing was changed. {$safety['error']}");
                    }
                }
                try {
                    self::replaceDatabase($sql);
                } catch (Throwable $exception) {
                    if (!$safety) {
                        throw $exception;
                    }
                    self::replaceDatabase($unpack($safety['id']));
                    throw new RuntimeException('The restore failed, so the database was put back as it was. ' . self::reason($exception));
                }

                return self::rememberRestore([...$status, 'status' => 'done', 'finished_at' => now()->toIso8601String(), 'safety_copy' => $safety['id'] ?? null, 'error' => null]);
            } catch (Throwable $exception) {
                Log::error('Database restore failed: ' . self::reason($exception), ['backup' => $id]);

                return self::rememberRestore([...$status, 'status' => 'failed', 'finished_at' => now()->toIso8601String(), 'error' => self::reason($exception)]);
            } finally {
                File::delete($temporary);
                Artisan::call('up');
            }
        });

        return $ran ?? self::rememberRestore([...$status, 'status' => 'failed', 'finished_at' => now()->toIso8601String(), 'error' => 'Another backup or restore was running. Try again when it finishes.']);
    }

    /** What the scheduled check alerts the admins about. */
    public static function attention(): array
    {
        $items = [];
        $settings = self::settings();
        $backups = self::all();

        $restore = self::lastRestore();
        if (($restore['status'] ?? null) === 'failed' && Carbon::parse($restore['finished_at'])->gt(now()->subDay())) {
            $items[] = ['key' => 'restore-failed', 'severity' => 'critical', 'title' => 'A database restore failed', 'detail' => (string) $restore['error'], 'commands' => []];
        }

        if ($settings['enabled'] && ($problem = self::problem()) && app()->environment('production')) {
            $items[] = ['key' => 'backups-blocked', 'severity' => 'warning', 'title' => 'Database backups can’t run', 'detail' => $problem,
                'commands' => str_contains($problem, 'client tools') ? [self::INSTALL_COMMAND] : []];
        }
        $automatic = $backups->firstWhere('trigger', self::AUTOMATIC);
        if ($settings['enabled'] && ($automatic['status'] ?? null) === 'failed') {
            $items[] = ['key' => 'backup-failed', 'severity' => 'warning', 'title' => 'The last automatic backup failed', 'detail' => (string) $automatic['error'], 'commands' => []];
        }
        $latest = $backups->firstWhere('status', 'ready');
        if ($settings['enabled'] && $latest && Carbon::parse($latest['finished_at'])->lt(now()->subHours(self::OVERDUE_HOURS))) {
            $items[] = ['key' => 'backup-overdue', 'severity' => 'warning', 'title' => 'No recent database backup', 'detail' => 'The latest is ' . Carbon::parse($latest['finished_at'])->diffForHumans() . '. Check that automatic checks are running, or take one now.', 'commands' => []];
        }

        return $items;
    }

    /** The commands below take a copy of the database into a file: mysqldump's own, then compressed. */
    private static function take(array $record): array
    {
        @set_time_limit(0);
        $raw = self::path("{$record['id']}.sql.tmp");
        $partial = self::path("{$record['id']}.sql.gz.tmp");
        try {
            self::ensureRoom();
            self::withLogin(function (string $login, string $database) use ($raw) {
                $result = self::program()->run([self::tool('mysqldump'), "--defaults-extra-file={$login}", '--single-transaction', '--quick', '--no-tablespaces', '--hex-blob', '--default-character-set=utf8mb4', ...self::dumpOptions(), "--result-file={$raw}", $database]);
                if (!$result->successful()) {
                    throw new RuntimeException(trim($result->errorOutput()) ?: 'mysqldump stopped with an error.');
                }
            });
            // A dump cut short can still end cleanly, and would only be found out when it was needed.
            if (!self::isComplete($raw)) {
                throw new RuntimeException('mysqldump stopped before the end of the database.');
            }
            self::compress($raw, $partial);
            $file = self::path("{$record['id']}.sql.gz");
            rename($partial, $file);
            @chmod($file, 0660);

            $done = self::remember([...$record, 'status' => 'ready', 'finished_at' => now()->toIso8601String(), 'size' => filesize($file), 'sha256' => hash_file('sha256', $file)]);
            self::prune();
            Log::notice("Database backup taken: {$record['id']}", ['trigger' => $record['trigger'], 'by' => $record['by'], 'size' => $done['size']]);

            return $done;
        } catch (Throwable $exception) {
            Log::error('Database backup failed: ' . self::reason($exception), ['backup' => $record['id']]);

            return self::remember([...$record, 'status' => 'failed', 'finished_at' => now()->toIso8601String(), 'error' => self::reason($exception)]);
        } finally {
            File::delete([$raw, $partial]);
        }
    }

    /** Empties the database and loads a dump into it, then brings it up to date with the code. */
    private static function replaceDatabase(string $sql): void
    {
        Schema::dropAllTables();
        self::withLogin(function (string $login, string $database) use ($sql) {
            $input = fopen($sql, 'rb');
            try {
                $result = self::program()->input($input)->run([self::tool('mysql'), "--defaults-extra-file={$login}", '--default-character-set=utf8mb4', $database]);
            } finally {
                fclose($input);
            }
            if (!$result->successful()) {
                throw new RuntimeException(trim($result->errorOutput()) ?: 'mysql stopped with an error.');
            }
        });
        if (Artisan::call('migrate', ['--force' => true]) !== 0) {
            throw new RuntimeException('The database was loaded, but bringing it up to date failed: ' . trim(Artisan::output()));
        }
    }

    /** Unpacks a backup for loading, after checking it's the file that was saved and that it's whole. */
    private static function unpack(string $id): string
    {
        $record = self::record($id);
        $file = self::path("{$id}.sql.gz");
        if (!is_file($file) || ($record['sha256'] && !hash_equals($record['sha256'], (string) hash_file('sha256', $file)))) {
            throw new RuntimeException('This backup’s file is missing or has changed since it was taken, so it wasn’t used.');
        }

        $sql = self::path("{$id}.restore.tmp");
        $in = gzopen($file, 'rb');
        $out = fopen($sql, 'wb');
        while (!gzeof($in)) {
            fwrite($out, (string) gzread($in, 1024 * 1024));
        }
        gzclose($in);
        fclose($out);
        if (!self::isComplete($sql)) {
            File::delete($sql);
            throw new RuntimeException('This backup is incomplete, so it wasn’t used.');
        }

        return $sql;
    }

    private static function compress(string $from, string $to): void
    {
        $in = fopen($from, 'rb');
        $out = gzopen($to, 'wb6');
        while (!feof($in)) {
            $chunk = (string) fread($in, 1024 * 1024);
            if ($chunk !== '' && !gzwrite($out, $chunk)) {
                gzclose($out);
                fclose($in);
                throw new RuntimeException('The backup couldn’t be saved. Is the disk full?');
            }
        }
        fclose($in);
        if (!gzclose($out)) {
            throw new RuntimeException('The backup couldn’t be saved. Is the disk full?');
        }
    }

    /** mysqldump's last line says it reached the end. */
    private static function isComplete(string $sql): bool
    {
        if (!is_file($sql) || ($size = filesize($sql)) === 0) {
            return false;
        }
        $handle = fopen($sql, 'rb');
        fseek($handle, max(0, $size - 256));
        $tail = (string) fread($handle, 256);
        fclose($handle);

        return str_contains($tail, '-- Dump completed');
    }

    private static function ensureRoom(): void
    {
        File::ensureDirectoryExists(self::folder(), 0770);
        $free = @disk_free_space(self::folder());
        $needed = max(self::MIN_FREE, (int) ((ServerHealth::database()['size'] ?? 0) * 2));
        if ($free !== false && $free < $needed) {
            throw new RuntimeException('Only ' . ServerHealth::bytes($free) . ' free on the disk, and this needs ' . ServerHealth::bytes($needed) . '. Free some space under Storage, or delete old backups.');
        }
    }

    /** Oracle's client only: without these, RDS can refuse the dump's GTID lines, and older servers fail on column statistics. */
    private static function dumpOptions(): array
    {
        $version = Process::run([self::tool('mysqldump'), '--version'])->output();
        if (stripos($version, 'mariadb') !== false) {
            return [];
        }

        return ['--set-gtid-purged=OFF', ...(preg_match('/Ver [89]\./', $version) ? ['--column-statistics=0'] : [])];
    }

    /**
     * Gives $work a private file with the database login: on the command line, the password would show in the
     * server's list of running programs.
     */
    private static function withLogin(callable $work): mixed
    {
        $config = self::connection();
        $quote = fn ($value) => '"' . addcslashes((string) $value, '\\"') . '"';
        $lines = ['[client]', 'user=' . $quote($config['username'] ?? ''), 'password=' . $quote($config['password'] ?? '')];
        array_push($lines, ...(!empty($config['unix_socket'])
            ? ['socket=' . $quote($config['unix_socket'])]
            : ['host=' . $quote($config['host'] ?? '127.0.0.1'), 'port=' . (int) ($config['port'] ?? 3306)]));
        if ($certificate = $config['options'][PDO::MYSQL_ATTR_SSL_CA] ?? null) {
            $lines[] = 'ssl-ca=' . $quote($certificate);
        }

        File::ensureDirectoryExists(self::folder(), 0770);
        $login = (string) tempnam(self::folder(), 'login');
        @chmod($login, 0600);
        try {
            file_put_contents($login, implode("\n", $lines) . "\n");

            return $work($login, (string) $config['database']);
        } finally {
            File::delete($login);
        }
    }

    private static function busy(): bool
    {
        return self::exclusively(fn () => true) === null;
    }

    /** Runs $work unless a backup or restore already is, in which case it returns null. The lock goes with the process, even if it's killed. */
    private static function exclusively(callable $work): mixed
    {
        File::ensureDirectoryExists(self::folder(), 0770);
        $lock = fopen(self::path('.lock'), 'c');
        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
            if ($lock) {
                fclose($lock);
            }

            return null;
        }
        try {
            return $work();
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /** Keeps the newest automatic backups. Manual ones and safety copies stay until someone deletes them. */
    private static function prune(): void
    {
        $backups = self::all();
        $backups->where('trigger', self::AUTOMATIC)->where('status', 'ready')->slice(self::settings()['keep'])
            ->each(fn (array $backup) => self::delete($backup['id']));
        $backups->where('status', 'failed')
            ->filter(fn (array $backup) => Carbon::parse($backup['started_at'])->lt(now()->subDays(self::FAILED_KEEP_DAYS)))
            ->each(fn (array $backup) => self::delete($backup['id']));
    }

    private static function ranOn(string $day): bool
    {
        return self::all()->where('trigger', self::AUTOMATIC)
            ->contains(fn (array $backup) => Carbon::parse($backup['started_at'])->timezone(self::TIMEZONE)->toDateString() === $day);
    }

    private static function nextAutomatic(): ?Carbon
    {
        $settings = self::settings();
        if (!$settings['enabled']) {
            return null;
        }
        $now = now(self::TIMEZONE);
        $next = $now->copy()->setTime($settings['hour'], 0);
        if (self::ranOn($now->toDateString())) {
            $next->addDay();
        } elseif ($next->lt($now)) {
            // It's due, so it runs at the scheduler's next check.
            $next = $now->copy()->ceilMinutes(15);
        }

        return $next;
    }

    /** A backup marked running that nothing is working on died part-way: a deploy restarted PHP, say. */
    private static function settled(array $record): array
    {
        if ($record['status'] !== 'running' || Carbon::parse($record['started_at'])->gt(now()->subMinutes(self::STALE_MINUTES)) || self::busy()) {
            return $record;
        }
        File::delete([self::path("{$record['id']}.sql.tmp"), self::path("{$record['id']}.sql.gz.tmp")]);

        return self::remember([...$record, 'status' => 'failed', 'finished_at' => now()->toIso8601String(), 'error' => 'It stopped before finishing, possibly because the server restarted.']);
    }

    private static function record(string $id): array
    {
        $record = json_decode((string) @file_get_contents(self::path("{$id}.json")), true);
        if (!is_array($record)) {
            throw new RuntimeException('That backup doesn’t exist.');
        }

        return $record;
    }

    private static function remember(array $record): array
    {
        file_put_contents(self::path("{$record['id']}.json"), json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);

        return $record;
    }

    private static function rememberRestore(array $record): array
    {
        File::ensureDirectoryExists(self::folder(), 0770);
        file_put_contents(self::path(self::RESTORE_RECORD), json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);

        return $record;
    }

    private static function path(string $file): string
    {
        return self::folder() . DIRECTORY_SEPARATOR . $file;
    }

    private static function connection(): array
    {
        return (array) config('database.connections.' . (config('backups.connection') ?: config('database.default')));
    }

    /** No time limit, however big the database. On Windows a program can't reach the network without SystemRoot, which PHP doesn't pass on behind a web server. */
    private static function program(): PendingProcess
    {
        return Process::forever()->env(array_filter(['SystemRoot' => getenv('SystemRoot')]));
    }

    /** The program's location, or null if it isn't there. */
    private static function tool(string $name): ?string
    {
        $tool = (string) config("backups.{$name}");

        // PHP-FPM clears PATH by default, so also look where Ubuntu puts them.
        return is_file($tool) ? $tool : (new ExecutableFinder)->find($tool, null, ['/usr/bin', '/usr/local/bin']);
    }

    private static function reason(Throwable $exception): string
    {
        return Str::limit(trim($exception->getMessage()), 500);
    }
}
