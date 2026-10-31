<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Setting;
use App\Models\User;
use App\Services\Monitoring\Advisor;
use App\Services\Monitoring\Backups;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class DatabaseBackupTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Password123!';
    private const DUMP = "-- MySQL dump\nCREATE TABLE test (id int);\n-- Dump completed on 2026-11-01\n";

    private User $admin;
    private string $folder;
    /** What the pretend mysqldump writes, and how it ends. */
    private string $dump = self::DUMP;
    private int $dumpExit = 0;
    private int $loadExit = 0;
    /** Every command run, as text, in order. */
    private array $ran = [];

    /** Skip the two early migrations that duplicate later tables, so a fresh schema can be built. */
    protected function migrateFreshUsing()
    {
        $stale = ['2025_03_17_082921_create_personal_access_tokens_table.php', '2025_03_17_083746_create_products_table.php'];
        $paths = array_values(array_filter(
            glob(database_path('migrations/*.php')),
            fn ($path) => !in_array(basename($path), $stale, true),
        ));

        return ['--drop-views' => false, '--drop-types' => false, '--seed' => false, '--path' => $paths, '--realpath' => true];
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutDefer();
        $this->folder = sys_get_temp_dir() . '/ez-backups-' . uniqid();
        config([
            'backups.path' => $this->folder,
            'backups.connection' => 'mysql',
            'backups.mysqldump' => PHP_BINARY,
            'backups.mysql' => PHP_BINARY,
            'database.connections.mysql.username' => 'shop',
            'database.connections.mysql.password' => 'pa"ss\\word#1',
            'database.connections.mysql.host' => 'db.example.com',
            'database.connections.mysql.database' => 'e_street_db',
        ]);
        Log::spy();
        $this->admin = User::factory()->create(['role' => 'admin', 'email' => config('admin.emails')[0], 'password' => self::PASSWORD]);
        $this->fakeTools();
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->folder);
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Stands in for the MySQL tools: mysqldump writes its --result-file, as the real one does. */
    private function fakeTools(): void
    {
        Process::fake(function (PendingProcess $process) {
            $command = (array) $process->command;
            $this->ran[] = implode(' ', $command);
            if (in_array('--version', $command, true)) {
                return Process::result('mysqldump  Ver 8.0.40 for Linux on x86_64');
            }
            if ($target = collect($command)->first(fn ($part) => str_starts_with($part, '--result-file='))) {
                file_put_contents(substr($target, strlen('--result-file=')), $this->dump);

                return Process::result(exitCode: $this->dumpExit, errorOutput: $this->dumpExit ? 'mysqldump: Access denied' : '');
            }

            return Process::result(exitCode: $this->loadExit, errorOutput: $this->loadExit ? 'ERROR 1064 at line 3' : '');
        });
    }

    private function asAdmin(): static
    {
        return $this->actingAs($this->admin, 'sanctum');
    }

    private function takeBackup(string $trigger = Backups::MANUAL): array
    {
        $backup = Backups::create($trigger, 'Test');
        Carbon::setTestNow(now()->addSecond());

        return $backup;
    }

    public function test_only_admins_can_reach_backups(): void
    {
        $this->getJson('/api/admin/server/backups')->assertUnauthorized();
        $customer = User::factory()->create(['role' => 'customer']);
        $this->actingAs($customer, 'sanctum')->getJson('/api/admin/server/backups')->assertForbidden();
        $this->actingAs($customer, 'sanctum')->postJson('/api/admin/server/backups')->assertForbidden();
    }

    public function test_an_admin_takes_a_backup_and_it_is_listed(): void
    {
        $this->asAdmin()->postJson('/api/admin/server/backups')->assertStatus(202)->assertJsonPath('backup.status', 'running');

        $list = $this->asAdmin()->getJson('/api/admin/server/backups')->assertOk()->json();
        $this->assertCount(1, $list['backups']);
        $backup = $list['backups'][0];
        $this->assertSame('ready', $backup['status']);
        $this->assertSame('manual', $backup['trigger']);
        $this->assertSame($this->admin->name, $backup['by']);
        $this->assertGreaterThan(0, $backup['size']);
        $this->assertFalse($list['working']);
        $this->assertSame(self::DUMP, gzdecode(file_get_contents("{$this->folder}/{$backup['id']}.sql.gz")));
    }

    public function test_the_password_is_never_on_the_command_line_and_its_file_is_removed(): void
    {
        $this->takeBackup();

        $dump = collect($this->ran)->first(fn ($command) => str_contains($command, '--result-file='));
        $this->assertStringContainsString('--defaults-extra-file=', $dump);
        $this->assertStringContainsString('--single-transaction', $dump);
        $this->assertStringContainsString('--set-gtid-purged=OFF', $dump);
        $this->assertStringNotContainsString('word#1', implode("\n", $this->ran));
        $this->assertSame([], glob("{$this->folder}/login*"));
    }

    public function test_a_failed_dump_is_reported_and_leaves_no_file(): void
    {
        $this->dumpExit = 2;
        $backup = $this->takeBackup();

        $this->assertSame('failed', $backup['status']);
        $this->assertStringContainsString('Access denied', $backup['error']);
        $this->assertFileDoesNotExist("{$this->folder}/{$backup['id']}.sql.gz");
        $this->assertSame([], glob("{$this->folder}/*.tmp"));
        Log::shouldHaveReceived('error')->once();
    }

    public function test_a_dump_cut_short_counts_as_failed(): void
    {
        $this->dump = "-- MySQL dump\nCREATE TABLE test (id int);\n";
        $backup = $this->takeBackup();

        $this->assertSame('failed', $backup['status']);
        $this->assertStringContainsString('before the end', $backup['error']);
        $this->assertFileDoesNotExist("{$this->folder}/{$backup['id']}.sql.gz");
    }

    public function test_a_backup_that_died_is_marked_failed(): void
    {
        $backup = Backups::begin(Backups::MANUAL, 'Test');
        Carbon::setTestNow(now()->addMinutes(3));

        $found = Backups::find($backup['id']);
        $this->assertSame('failed', $found['status']);
        $this->assertStringContainsString('stopped before finishing', $found['error']);
    }

    public function test_a_restore_that_died_says_what_to_do(): void
    {
        $backup = $this->takeBackup();
        Backups::beginRestore($backup, 'Test');
        $this->assertSame('running', Backups::lastRestore()['status']);
        $this->assertTrue(Backups::working());

        Carbon::setTestNow(now()->addMinutes(3));
        $restore = Backups::lastRestore();
        $this->assertSame('failed', $restore['status']);
        $this->assertStringContainsString('restore the newest safety copy', $restore['error']);
        $this->assertFalse(Backups::working());
        $this->assertSame('critical', collect(Advisor::attention())->firstWhere('key', 'restore-failed')['severity']);
    }

    public function test_a_second_backup_cant_start_while_the_first_is_starting(): void
    {
        Backups::begin(Backups::MANUAL, 'Test');

        $this->asAdmin()->postJson('/api/admin/server/backups')->assertUnprocessable()->assertJsonValidationErrors('backup');
    }

    public function test_the_next_automatic_backup_is_shown_in_the_right_place(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-02 01:00', 'Asia/Kolkata'));
        $this->assertSame('2026-11-02 02:00', Carbon::parse(Backups::overview()['next_automatic_at'])->timezone('Asia/Kolkata')->format('Y-m-d H:i'));

        // Past its hour and not yet run: the scheduler's next check.
        Carbon::setTestNow(Carbon::parse('2026-11-02 13:07', 'Asia/Kolkata'));
        $this->assertSame('2026-11-02 13:15', Carbon::parse(Backups::overview()['next_automatic_at'])->timezone('Asia/Kolkata')->format('Y-m-d H:i'));

        $this->takeBackup(Backups::AUTOMATIC);
        $this->assertSame('2026-11-03 02:00', Carbon::parse(Backups::overview()['next_automatic_at'])->timezone('Asia/Kolkata')->format('Y-m-d H:i'));

        Backups::saveSettings(['enabled' => false]);
        $this->assertNull(Backups::overview()['next_automatic_at']);
    }

    public function test_a_download_needs_the_password_and_gives_a_short_signed_link(): void
    {
        $backup = $this->takeBackup();
        $link = "/api/admin/server/backups/{$backup['id']}/download-link";

        $this->asAdmin()->postJson($link)->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->asAdmin()->postJson($link, ['password' => 'wrong-password'])->assertUnprocessable()->assertJsonValidationErrors('password');

        $url = $this->asAdmin()->postJson($link, ['password' => self::PASSWORD])->assertOk()->json('url');
        $this->assertStringStartsWith("/api/backups/{$backup['id']}/download?", $url);

        // The link needs no sign-in, but its signature must be intact.
        $this->flushHeaders();
        $this->get($url)->assertOk()->assertDownload("{$backup['id']}.sql.gz");
        $this->assertSame($this->admin->name, Backups::find($backup['id'])['downloaded_by']);
        $this->get(str_replace($backup['id'], 'elitezaar-other', $url))->assertForbidden();
        $this->get("/api/backups/{$backup['id']}/download")->assertForbidden();

        Carbon::setTestNow(now()->addMinutes(6));
        $this->get($url)->assertForbidden();
    }

    public function test_backups_cant_be_reached_from_the_web_folder(): void
    {
        $this->assertStringStartsNotWith(public_path(), storage_path('app/private/backups'));
    }

    public function test_names_cant_climb_out_of_the_backup_folder(): void
    {
        $this->asAdmin()->deleteJson('/api/admin/server/backups/..%2F..%2F.env')->assertNotFound();
        $this->asAdmin()->deleteJson('/api/admin/server/backups/missing-backup')->assertNotFound();
    }

    public function test_an_admin_deletes_a_backup(): void
    {
        $backup = $this->takeBackup();
        $this->asAdmin()->deleteJson("/api/admin/server/backups/{$backup['id']}")->assertOk();

        $this->assertNull(Backups::find($backup['id']));
        $this->assertFileDoesNotExist("{$this->folder}/{$backup['id']}.sql.gz");
    }

    public function test_settings_are_checked_and_saved(): void
    {
        $this->assertSame(['enabled' => true, 'hour' => 2, 'keep' => 14], Backups::settings());

        $this->asAdmin()->putJson('/api/admin/server/backups/settings', ['enabled' => true, 'hour' => 25, 'keep' => 1])->assertUnprocessable()->assertJsonValidationErrors(['hour', 'keep']);
        $this->asAdmin()->putJson('/api/admin/server/backups/settings', ['enabled' => false, 'hour' => 4, 'keep' => 7])->assertOk();

        $this->assertSame(['enabled' => false, 'hour' => 4, 'keep' => 7], Backups::settings());
    }

    public function test_the_automatic_backup_runs_once_a_day_from_its_hour(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-02 01:30', 'Asia/Kolkata'));
        $this->artisan('backups:auto')->assertSuccessful();
        $this->assertCount(0, Backups::all());

        Carbon::setTestNow(Carbon::parse('2026-11-02 02:05', 'Asia/Kolkata'));
        $this->artisan('backups:auto')->assertSuccessful();
        $this->assertCount(1, Backups::all());
        $this->assertSame('automatic', Backups::all()->first()['trigger']);

        Carbon::setTestNow(Carbon::parse('2026-11-02 09:00', 'Asia/Kolkata'));
        $this->artisan('backups:auto')->assertSuccessful();
        $this->assertCount(1, Backups::all());

        Carbon::setTestNow(Carbon::parse('2026-11-03 02:00', 'Asia/Kolkata'));
        $this->artisan('backups:auto')->assertSuccessful();
        $this->assertCount(2, Backups::all());
    }

    public function test_switching_automatic_backups_off_stops_them(): void
    {
        Backups::saveSettings(['enabled' => false]);
        Carbon::setTestNow(Carbon::parse('2026-11-02 05:00', 'Asia/Kolkata'));
        $this->artisan('backups:auto')->assertSuccessful();

        $this->assertCount(0, Backups::all());
    }

    public function test_only_the_newest_automatic_backups_are_kept(): void
    {
        Backups::saveSettings(['keep' => 3]);
        $manual = $this->takeBackup(Backups::MANUAL);
        foreach (range(1, 5) as $day) {
            $this->takeBackup(Backups::AUTOMATIC);
        }

        $this->assertCount(3, Backups::all()->where('trigger', Backups::AUTOMATIC));
        $this->assertNotNull(Backups::find($manual['id']), 'Manual backups stay until someone deletes them.');
        $this->assertCount(4, glob("{$this->folder}/*.sql.gz"));
    }

    public function test_restoring_needs_the_word_and_the_password(): void
    {
        $backup = $this->takeBackup();
        $url = "/api/admin/server/backups/{$backup['id']}/restore";

        $this->asAdmin()->postJson($url, ['password' => self::PASSWORD])->assertUnprocessable()->assertJsonValidationErrors('confirm');
        $this->asAdmin()->postJson($url, ['password' => self::PASSWORD, 'confirm' => 'restore'])->assertUnprocessable()->assertJsonValidationErrors('confirm');
        $this->asAdmin()->postJson($url, ['confirm' => 'RESTORE', 'password' => 'wrong-password'])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->assertNull(Backups::lastRestore());
        $this->assertCount(1, Backups::all());
    }

    public function test_a_failed_backup_cant_be_restored_or_downloaded(): void
    {
        $this->dumpExit = 1;
        $backup = $this->takeBackup();

        $this->asAdmin()->postJson("/api/admin/server/backups/{$backup['id']}/restore", ['confirm' => 'RESTORE', 'password' => self::PASSWORD])->assertUnprocessable()->assertJsonValidationErrors('backup');
        $this->asAdmin()->postJson("/api/admin/server/backups/{$backup['id']}/download-link", ['password' => self::PASSWORD])->assertUnprocessable()->assertJsonValidationErrors('backup');
    }

    public function test_the_restore_check_counts_what_would_be_lost(): void
    {
        $backup = $this->takeBackup();
        Carbon::setTestNow(now()->addHour());
        User::factory()->create(['role' => 'customer']);
        Order::create(['customer_name' => 'Asha', 'customer_email' => 'asha@example.com', 'address' => 'x', 'city' => 'y', 'total' => 500]);

        $this->asAdmin()->getJson("/api/admin/server/backups/{$backup['id']}/restore-check")
            ->assertOk()->assertJsonPath('changes.orders', 1)->assertJsonPath('changes.customers', 1)->assertJsonPath('changes.products', 0);
    }

    public function test_a_restore_goes_offline_copies_first_replaces_migrates_and_comes_back(): void
    {
        $backup = $this->takeBackup();
        $this->ran = [];
        $steps = [];
        Artisan::shouldReceive('call')->andReturnUsing(function (string $command) use (&$steps) {
            $steps[] = $command;

            return 0;
        });
        Schema::shouldReceive('dropAllTables')->once()->andReturnUsing(function () use (&$steps) {
            $steps[] = 'drop';
        });

        $this->asAdmin()->postJson("/api/admin/server/backups/{$backup['id']}/restore", ['confirm' => 'RESTORE', 'password' => self::PASSWORD])->assertStatus(202);

        $this->assertSame(['down', 'drop', 'migrate', 'up'], $steps);
        $restore = Backups::lastRestore();
        $this->assertSame('done', $restore['status']);
        $this->assertSame($backup['id'], $restore['backup']);
        $this->assertSame($this->admin->name, $restore['by']);
        $safety = Backups::find($restore['safety_copy']);
        $this->assertSame(Backups::SAFETY, $safety['trigger']);
        $this->assertSame('ready', $safety['status']);
        $this->assertSame([], glob("{$this->folder}/*.tmp"));
        // The safety copy was taken before the load.
        $this->assertLessThan(
            collect($this->ran)->search(fn ($command) => str_contains($command, 'e_street_db') && !str_contains($command, '--result-file=')),
            collect($this->ran)->search(fn ($command) => str_contains($command, '--result-file=')),
        );
    }

    public function test_a_restore_that_fails_puts_the_database_back(): void
    {
        $backup = $this->takeBackup();
        $steps = [];
        Artisan::shouldReceive('call')->andReturnUsing(function (string $command) use (&$steps) {
            $steps[] = $command;

            return 0;
        });
        Schema::shouldReceive('dropAllTables')->twice();
        // The chosen backup fails to load; the safety copy goes back in.
        $loads = 0;
        Process::fake(function (PendingProcess $process) use (&$loads) {
            $command = (array) $process->command;
            if (in_array('--version', $command, true)) {
                return Process::result('mysqldump  Ver 8.0.40');
            }
            if ($target = collect($command)->first(fn ($part) => str_starts_with($part, '--result-file='))) {
                file_put_contents(substr($target, strlen('--result-file=')), self::DUMP);

                return Process::result();
            }
            $loads++;

            return Process::result(exitCode: $loads === 1 ? 1 : 0, errorOutput: 'ERROR 1064 at line 3');
        });

        $result = Backups::restore($backup['id']);

        $this->assertSame('failed', $result['status']);
        $this->assertStringContainsString('put back as it was', $result['error']);
        $this->assertSame(2, $loads);
        $this->assertSame(['down', 'migrate', 'up'], $steps);
    }

    public function test_a_damaged_backup_is_never_loaded(): void
    {
        $backup = $this->takeBackup();
        file_put_contents("{$this->folder}/{$backup['id']}.sql.gz", gzencode('-- half a dump'));
        Artisan::shouldReceive('call')->twice()->andReturn(0);
        Schema::shouldReceive('dropAllTables')->never();

        $result = Backups::restore($backup['id']);

        $this->assertSame('failed', $result['status']);
        $this->assertStringContainsString('changed since it was taken', $result['error']);
    }

    public function test_the_store_comes_back_online_if_the_safety_copy_fails(): void
    {
        $backup = $this->takeBackup();
        $this->dumpExit = 1;
        $steps = [];
        Artisan::shouldReceive('call')->andReturnUsing(function (string $command) use (&$steps) {
            $steps[] = $command;

            return 0;
        });
        Schema::shouldReceive('dropAllTables')->never();

        $result = Backups::restore($backup['id']);

        $this->assertSame('failed', $result['status']);
        $this->assertStringContainsString('nothing was changed', $result['error']);
        $this->assertSame(['down', 'up'], $steps);
    }

    public function test_only_one_backup_or_restore_runs_at_a_time(): void
    {
        File::ensureDirectoryExists($this->folder);
        $lock = fopen("{$this->folder}/.lock", 'c');
        flock($lock, LOCK_EX);

        $this->asAdmin()->postJson('/api/admin/server/backups')->assertUnprocessable()->assertJsonValidationErrors('backup');

        flock($lock, LOCK_UN);
        fclose($lock);
    }

    public function test_missing_tools_are_explained_with_the_command_to_fix_them(): void
    {
        config(['backups.mysqldump' => 'no-such-mysqldump-tool']);

        $overview = $this->asAdmin()->getJson('/api/admin/server/backups')->assertOk()->json();
        $this->assertStringContainsString('client tools', $overview['problem']);
        $this->assertSame(Backups::INSTALL_COMMAND, $overview['install_command']);
        $this->asAdmin()->postJson('/api/admin/server/backups')->assertUnprocessable()->assertJsonValidationErrors('backup');
    }

    public function test_a_failed_automatic_backup_alerts_the_admins(): void
    {
        $this->dumpExit = 1;
        Carbon::setTestNow(Carbon::parse('2026-11-02 03:00', 'Asia/Kolkata'));
        $this->artisan('backups:auto')->assertFailed();

        $item = collect(Advisor::attention())->firstWhere('key', 'backup-failed');
        $this->assertSame('warning', $item['severity']);
        $this->assertSame('backups', $item['tab']);
    }

    public function test_an_overdue_backup_alerts_the_admins(): void
    {
        $this->takeBackup(Backups::AUTOMATIC);
        $this->assertNull(collect(Advisor::attention())->firstWhere('key', 'backup-overdue'));

        Carbon::setTestNow(now()->addHours(49));
        $this->assertNotNull(collect(Advisor::attention())->firstWhere('key', 'backup-overdue'));
    }

    public function test_backups_are_part_of_the_disk_report_and_counted_once(): void
    {
        File::ensureDirectoryExists(storage_path('app/private'));
        $this->takeBackup();

        $folders = collect(\App\Services\Monitoring\ServerHealth::storage(true)['folders']);
        $this->assertSame(filesize(glob("{$this->folder}/*.sql.gz")[0]) + filesize(glob("{$this->folder}/*.json")[0]), $folders->firstWhere('key', 'backups')['bytes']);
    }

    public function test_the_settings_survive_being_read_with_nothing_saved(): void
    {
        Setting::write('backups.settings', 'not json');

        $this->assertSame(['enabled' => true, 'hour' => 2, 'keep' => 14], Backups::settings());
    }
}
