<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectMessage;
use App\Models\DirectMessage;
use App\Models\GeneralChannelMessage;
use App\Models\MessageReadReceipt;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    // Project messages
    public function projectMessages(Request $request, $projectId)
    {
        $messages = ProjectMessage::with('sender')
            ->where('project_id', $projectId)
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json($messages);
    }

    public function sendProjectMessage(Request $request, $projectId)
    {
        $data = $request->validate([
            'content' => 'required|string',
            'parent_id' => 'nullable|integer|exists:project_messages,id',
        ]);

        $message = ProjectMessage::create([
            'project_id' => $projectId,
            'sender_id' => $request->user()->id,
            'content' => $data['content'],
            'parent_id' => $data['parent_id'] ?? null,
        ]);

        return response()->json($message->load('sender'), 201);
    }

    public function updateProjectMessage(Request $request, ProjectMessage $message)
    {
        if ($message->sender_id !== $request->user()->id) {
            abort(403, 'Unauthorized');
        }

        $message->update([
            'content' => $request->validate(['content' => 'required|string'])['content'],
            'is_edited' => true,
        ]);

        return response()->json($message);
    }

    public function deleteProjectMessage(Request $request, ProjectMessage $message)
    {
        if ($message->sender_id !== $request->user()->id && !in_array($request->user()->role, ['operations_manager', 'team_lead'])) {
            abort(403, 'Unauthorized');
        }

        $message->delete();
        return response()->json(['message' => 'Message deleted.']);
    }

    // Direct messages
    public function directMessages(Request $request, $userId)
    {
        $authId = $request->user()->id;

        $messages = DirectMessage::with(['sender', 'receiver'])
            ->where(fn($q) => $q->where('sender_id', $authId)->where('receiver_id', $userId))
            ->orWhere(fn($q) => $q->where('sender_id', $userId)->where('receiver_id', $authId))
            ->orderBy('created_at', 'asc')
            ->get();

        // Mark received messages as read
        DirectMessage::where('sender_id', $userId)
            ->where('receiver_id', $authId)
            ->where('read', false)
            ->update(['read' => true]);

        return response()->json($messages);
    }

    public function sendDirectMessage(Request $request, $userId)
    {
        $data = $request->validate(['content' => 'required|string']);

        $message = DirectMessage::create([
            'sender_id' => $request->user()->id,
            'receiver_id' => $userId,
            'content' => $data['content'],
            'read' => false,
        ]);

        return response()->json($message->load(['sender', 'receiver']), 201);
    }

    // General channel
    public function generalMessages(Request $request)
    {
        $messages = GeneralChannelMessage::with('sender')
            ->orderBy('created_at', 'asc')
            ->limit(100)
            ->get();

        return response()->json($messages);
    }

    public function sendGeneralMessage(Request $request)
    {
        $data = $request->validate(['content' => 'required|string']);

        $message = GeneralChannelMessage::create([
            'sender_id' => $request->user()->id,
            'content' => $data['content'],
        ]);

        return response()->json($message->load('sender'), 201);
    }

    public function reactToGeneralMessage(Request $request, GeneralChannelMessage $message)
    {
        $data = $request->validate(['emoji' => 'required|string']);
        $reactions = $message->reactions ?? [];
        $emoji = $data['emoji'];
        $userId = (string) $request->user()->id;

        if (!isset($reactions[$emoji])) {
            $reactions[$emoji] = [];
        }

        if (in_array($userId, $reactions[$emoji])) {
            $reactions[$emoji] = array_values(array_filter($reactions[$emoji], fn($id) => $id !== $userId));
            if (empty($reactions[$emoji])) unset($reactions[$emoji]);
        } else {
            $reactions[$emoji][] = $userId;
        }

        $message->update(['reactions' => $reactions]);
        return response()->json($message);
    }

    // Conversations list (for DM sidebar)
    public function conversations(Request $request)
    {
        $userId = $request->user()->id;

        $conversations = DirectMessage::selectRaw('
                CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_user_id,
                MAX(created_at) as last_message_at,
                SUM(CASE WHEN receiver_id = ? AND read = 0 THEN 1 ELSE 0 END) as unread_count
            ', [$userId, $userId])
            ->where(fn($q) => $q->where('sender_id', $userId)->orWhere('receiver_id', $userId))
            ->groupBy('other_user_id')
            ->orderBy('last_message_at', 'desc')
            ->get();

        return response()->json($conversations);
    }
}
