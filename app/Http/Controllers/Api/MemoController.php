<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Memo;
use App\Models\MemoRead;
use App\Models\MemoResponse;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class MemoController extends Controller
{
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        $memos = Memo::with(['sender', 'reads', 'responses.user'])
            ->where('sender_id', $userId)
            ->orWhereJsonContains('recipients', $userId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($memos);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'subject' => 'required|string',
            'content' => 'required|string',
            'type' => 'required|in:individual,general,department',
            'department' => 'required_if:type,department|string',
            'recipients' => 'required_unless:type,department|array',
            'recipients.*' => 'integer|exists:users,id',
        ]);

        $data['sender_id'] = $request->user()->id;

        if ($data['type'] === 'department') {
            $data['recipients'] = User::where('department', $data['department'])
                ->where('id', '!=', $request->user()->id)
                ->pluck('id')
                ->toArray();
        }

        $memo = Memo::create($data);

        foreach ($memo->recipients as $recipientId) {
            if ($recipientId !== $request->user()->id) {
                NotificationService::send(
                    $recipientId,
                    'memo_received',
                    'New Memo',
                    "You received a memo: \"{$memo->subject}\"",
                    $memo->id,
                    'memo',
                );
            }
        }

        return response()->json($memo->load(['sender', 'reads', 'responses']), 201);
    }

    public function show(Request $request, Memo $memo)
    {
        $userId = $request->user()->id;

        // Mark as read (and refresh read_at so newer replies can be detected as unread)
        if (in_array($userId, $memo->recipients ?? [])) {
            MemoRead::updateOrCreate(
                ['memo_id' => $memo->id, 'user_id' => $userId],
                ['read_at' => now()],
            );
        }

        return response()->json($memo->load(['sender', 'reads', 'responses.user']));
    }

    public function destroy(Request $request, Memo $memo)
    {
        if ($memo->sender_id !== $request->user()->id && !in_array($request->user()->role, ['operations_manager'])) {
            abort(403);
        }

        $memo->delete();
        return response()->json(['message' => 'Memo deleted.']);
    }

    public function respond(Request $request, Memo $memo)
    {
        $data = $request->validate(['content' => 'required|string']);

        $response = MemoResponse::create([
            'memo_id' => $memo->id,
            'user_id' => $request->user()->id,
            'content' => $data['content'],
        ]);

        if ($memo->sender_id !== $request->user()->id) {
            NotificationService::send(
                $memo->sender_id,
                'memo_response',
                'Memo Response Received',
                "{$request->user()->name} responded to your memo: \"{$memo->subject}\"",
                $memo->id,
                'memo',
            );
        }

        return response()->json($response->load('user'), 201);
    }
}
