<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/** The signed-in user's inbox: every store message they were sent, newest first. */
class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:50']]);
        $user = $request->user();
        $page = $user->notifications()->latest()->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => collect($page->items())->map(fn (DatabaseNotification $notification) => self::present($notification))->values(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
            'unread' => $user->unreadNotifications()->count(),
        ], 200);
    }

    public function read(Request $request, string $notification)
    {
        $request->user()->notifications()->whereKey($notification)->firstOrFail()->markAsRead();

        return response()->json(['unread' => $request->user()->unreadNotifications()->count()], 200);
    }

    public function readAll(Request $request)
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['unread' => 0], 200);
    }

    private static function present(DatabaseNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'kind' => $notification->data['kind'] ?? 'order',
            'title' => $notification->data['title'] ?? '',
            'body' => $notification->data['body'] ?? '',
            'url' => $notification->data['url'] ?? null,
            'app_url' => $notification->data['app_url'] ?? null,
            'read' => $notification->read_at !== null,
            'created_at' => $notification->created_at,
        ];
    }
}
