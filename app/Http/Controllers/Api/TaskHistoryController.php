<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\TaskRuleException;
use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskEvent;
use App\Models\TaskSession;
use Illuminate\Http\Request;

/**
 * Task panel History tab (design/HANDOFF_SPEC.md §7.9): the event timeline,
 * newest first, plus the summary tiles. History is read-only.
 */
class TaskHistoryController extends Controller
{
    public function index(Request $request, Task $task)
    {
        $user = $request->user();
        if (!$user->isManager() && $task->assignee_id !== $user->id) {
            throw new TaskRuleException('forbidden', 'You can only see tasks assigned to you.', 403);
        }
        $request->validate(['type' => 'nullable|in:all,' . implode(',', array_keys(TaskEvent::FILTERS))]);

        $query = $task->events()->with('actor')->orderByDesc('created_at')->orderByDesc('id');
        if ($types = TaskEvent::FILTERS[$request->input('type')] ?? null) {
            $query->whereIn('type', $types);
        }

        return response()->json([
            'data' => $query->get()->map(fn (TaskEvent $e) => [
                'id' => $e->id,
                'type' => $e->type,
                // null actor = written by the system
                'actor' => $e->actor ? ['id' => $e->actor->id, 'name' => $e->actor->fullName(), 'role' => $e->actor->role] : null,
                'from' => $e->from,
                'to' => $e->to,
                'meta' => $e->meta,
                'created_at' => $e->created_at?->toIso8601String(),
            ]),
            'summary' => $this->summary($task),
        ]);
    }

    /** The four tiles above the timeline. */
    private function summary(Task $task): array
    {
        $sessions = TaskSession::where('task_id', $task->id)->orderBy('started_at')->get();
        $events = $task->events()->get();

        // Start: first timer start against the scheduled start.
        $start = ['state' => 'not_started', 'minutes' => null];
        if ($first = $sessions->first()?->started_at) {
            if (!$task->start_date) {
                $start = ['state' => 'started', 'minutes' => null];
            } else {
                $delta = (int) round($task->start_date->diffInMinutes($first, false));
                $start = match (true) {
                    $delta < 0 => ['state' => 'early', 'minutes' => -$delta],
                    $delta > Task::LATE_START_GRACE_MINUTES => ['state' => 'late', 'minutes' => $delta],
                    default => ['state' => 'on_time', 'minutes' => 0],
                };
            }
        }

        // Finish: first submission against the deadline; before that, the
        // logged time against the estimate.
        $submittedAt = $events->where('type', TaskEvent::SUBMITTED)->sortBy('created_at')->first()?->created_at
            ?? $task->submitted_at;
        $estimate = $task->estimateMinutes();
        $loggedMinutes = intdiv($task->loggedSeconds(), 60);
        if ($submittedAt && $task->deadline) {
            $delta = (int) round($task->deadline->diffInMinutes($submittedAt, false));
            $finish = ['state' => $delta > 0 ? 'late' : 'early', 'minutes' => abs($delta)];
        } elseif ($estimate > 0) {
            $finish = [
                'state' => $loggedMinutes > $estimate ? 'over_estimate' : 'within_estimate',
                'minutes' => abs($estimate - $loggedMinutes),
            ];
        } else {
            $finish = ['state' => 'no_estimate', 'minutes' => null];
        }

        $extension = $task->extensionRequests()->latest()->first();

        return [
            'worked' => ['seconds' => $task->loggedSeconds(), 'sessions' => $sessions->count()],
            'start' => $start,
            'finish' => $finish + ['logged_minutes' => $loggedMinutes, 'estimate_minutes' => $estimate],
            'changes' => [
                'edits' => $this->editsAfterCreation($events),
                'extension' => $extension ? ($extension->status === 'rejected' ? 'declined' : $extension->status) : null,
            ],
        ];
    }

    /**
     * Edits made after the task was created. Creating a task with an assignee
     * also writes an "assigned" entry (same moment, no previous assignee);
     * that's part of creating it, not a change.
     */
    private function editsAfterCreation($events): int
    {
        $createdAt = $events->firstWhere('type', TaskEvent::CREATED)?->created_at;

        return $events
            ->whereIn('type', TaskEvent::FILTERS['edits'])
            ->reject(fn (TaskEvent $e) => $e->type === TaskEvent::ASSIGNED
                && empty($e->from)
                && $createdAt
                && abs($e->created_at->diffInSeconds($createdAt)) <= 5)
            ->count();
    }
}
