<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Monitoring\Backups;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;

/**
 * Admin › Server & health › Backups. A backup holds every customer's details, so taking one off the server or
 * restoring one asks for the admin's password again, and both are written to the log.
 */
class BackupController extends Controller
{
    private const CONFIRM_WORD = 'RESTORE';

    public function index()
    {
        return response()->json(Backups::overview());
    }

    /** Starts a backup after the response, so a big database can't outlast the web server's patience. */
    public function store(Request $request)
    {
        $this->ensureFree();
        $backup = Backups::begin(Backups::MANUAL, $request->user()->name);
        defer(fn () => Backups::run($backup['id']));

        return response()->json(['message' => 'Backup started.', 'backup' => $backup], 202);
    }

    public function updateSettings(Request $request)
    {
        $settings = $request->validate([
            'enabled' => ['required', 'boolean'],
            'hour' => ['required', 'integer', 'min:0', 'max:23'],
            'keep' => ['required', 'integer', 'min:3', 'max:60'],
        ]);

        return response()->json(['settings' => Backups::saveSettings($settings), 'message' => 'Backup settings saved.']);
    }

    public function destroy(Request $request, string $backup)
    {
        $found = $this->ready($backup, finished: true);
        Backups::delete($found['id']);
        Log::notice("Database backup deleted: {$found['id']}", ['by' => $request->user()->email]);

        return response()->json(['message' => 'Backup deleted.']);
    }

    /** A 5-minute link to the file, so the browser or phone can save it straight to disk. */
    public function downloadLink(Request $request, string $backup)
    {
        $found = $this->ready($backup);
        $this->confirmPassword($request);

        return response()->json(['url' => URL::temporarySignedRoute('backups.download', now()->addMinutes(5), ['backup' => $found['id'], 'by' => $request->user()->id], absolute: false)]);
    }

    /** The file itself, from a link made by downloadLink(). */
    public function download(Request $request, string $backup)
    {
        $found = $this->ready($backup);
        $by = User::query()->find($request->integer('by'));
        Backups::markDownloaded($found['id'], $by?->name);
        Log::notice("Database backup downloaded: {$found['id']}", ['by' => $by?->email, 'ip' => $request->ip()]);

        return response()->download(Backups::filePath($found), "{$found['id']}.sql.gz", ['Content-Type' => 'application/gzip']);
    }

    /** What restoring this backup would undo, for the admin to read first. */
    public function restoreCheck(string $backup)
    {
        return response()->json(['changes' => Backups::changesSince($this->ready($backup))]);
    }

    public function restore(Request $request, string $backup)
    {
        $found = $this->ready($backup);
        $validated = $request->validate(['confirm' => ['required', 'string']]);
        if ($validated['confirm'] !== self::CONFIRM_WORD) {
            throw ValidationException::withMessages(['confirm' => 'Type RESTORE in capitals to confirm.']);
        }
        $this->confirmPassword($request);
        $this->ensureFree();

        Backups::beginRestore($found, $request->user()->name);
        Log::notice("Database restore started: {$found['id']}", ['by' => $request->user()->email, 'ip' => $request->ip()]);
        defer(fn () => Backups::restore($found['id']));

        return response()->json(['message' => 'Restore started.'], 202);
    }

    private function ready(string $id, bool $finished = false): array
    {
        $backup = Backups::find($id);
        abort_unless($backup, 404, 'That backup no longer exists.');
        if ($finished ? $backup['status'] === 'running' : $backup['status'] !== 'ready') {
            throw ValidationException::withMessages(['backup' => $finished ? 'That backup is still running.' : 'That backup didn’t finish, so it can’t be used.']);
        }

        return $backup;
    }

    private function ensureFree(): void
    {
        if ($problem = Backups::problem()) {
            throw ValidationException::withMessages(['backup' => $problem]);
        }
        if (Backups::working()) {
            throw ValidationException::withMessages(['backup' => 'A backup or restore is already running.']);
        }
    }

    private function confirmPassword(Request $request): void
    {
        $password = $request->validate(['password' => ['required', 'string', 'max:255']])['password'];
        if (!Hash::check($password, (string) $request->user()->password)) {
            throw ValidationException::withMessages(['password' => 'That isn’t your password.']);
        }
    }
}
