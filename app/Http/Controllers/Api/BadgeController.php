<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Complaint;
use App\Models\DeadlineExtensionRequest;
use App\Models\DirectMessage;
use App\Models\LeaveApplication;
use App\Models\Memo;
use App\Models\MemoRead;
use App\Models\ReviewLink;
use App\Models\StaffComplaint;
use App\Models\StaffQuery;
use App\Models\Task;
use App\Models\TechnicalSupportRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Throwable;

/**
 * GET /badges: pending counts for the menu, keyed by section (spec §4:
 * "Pending counts on yellow badges"). Each count is what the person can act
 * on in that section; a failing count is left out rather than failing all.
 */
class BadgeController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();
        $reviewer = in_array($user->role, ['operations_manager', 'team_lead'], true);

        $counts = [
            'tasks' => fn () => $user->isManager() ? $this->managerTasks($user) : $this->staffTasks($user),
            'inbox' => fn () => $this->inbox($user),
            'people' => fn () => $reviewer
                ? LeaveApplication::where('status', 'pending')->count() + StaffComplaint::where('status', 'pending')->count()
                : 0,
            'clients' => fn () => $reviewer ? Complaint::where('status', 'pending')->count() : 0,
            'reviews' => fn () => $user->role === 'team_lead'
                ? ReviewLink::where('status', 'pending')->where(fn ($q) => $q->where('assigned_to', $user->id)->orWhereNull('assigned_to'))->count()
                : 0,
            // Staff: queries waiting for their acknowledgement.
            'penalties' => fn () => $user->isManager() ? 0 : StaffQuery::where('assigned_to', $user->id)->where('status', 'pending')->count(),
            'support' => fn () => $user->role === 'staff' && $user->specialization === 'technical_support'
                ? TechnicalSupportRequest::where('status', 'open')->count()
                : 0,
        ];

        $out = [];
        foreach ($counts as $key => $count) {
            try {
                $out[$key] = (int) $count();
            } catch (Throwable $e) {
                report($e);
            }
        }

        return response()->json($out);
    }

    /** Tasks waiting for a manager: submitted for review, and extension requests to decide. */
    private function managerTasks(User $user): int
    {
        $review = Task::where('status', 'review');
        $ext = DeadlineExtensionRequest::where('status', 'pending')->whereHas('task');
        if ($user->role === 'project_manager') {
            // Project Managers: their own projects and the tasks they set.
            $review->where(fn ($q) => $q->where('assigned_by', $user->id)->orWhereHas('project', fn ($p) => $p->where('manager_id', $user->id)));
            $ext->where('project_manager_id', $user->id);
        }
        return $review->count() + $ext->count();
    }

    /** Staff: new tasks not started yet, and tasks sent back for changes. */
    private function staffTasks(User $user): int
    {
        return Task::where('assignee_id', $user->id)
            ->where(fn ($q) => $q
                ->where('status', 'not_approved')
                ->orWhere(fn ($n) => $n->whereIn('status', ['todo', 'not_started'])->where(fn ($s) => $s->whereNull('has_been_started')->orWhere('has_been_started', false))))
            ->count();
    }

    /** Unread direct messages to me, plus memos sent to me that I haven't opened. */
    private function inbox(User $user): int
    {
        $messages = DirectMessage::where('receiver_id', $user->id)->where('read', false)->count();

        $read = MemoRead::where('user_id', $user->id)->pluck('memo_id');
        $memos = Memo::where('sender_id', '!=', $user->id)
            ->whereJsonContains('recipients', $user->id)
            ->whereNotIn('id', $read)
            ->count();

        return $messages + $memos;
    }
}
