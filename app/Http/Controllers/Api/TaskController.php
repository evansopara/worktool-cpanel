<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\TaskRuleException;
use App\Http\Controllers\Controller;
use App\Models\DeadlineExtensionRequest;
use App\Models\EstimateRequest;
use App\Models\Task;
use App\Models\TaskEvent;
use App\Models\TaskIteration;
use App\Models\TaskRead;
use App\Models\TaskSession;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Tasks, timers and requests. Rules follow design/HANDOFF_SPEC.md §5 and §8:
 * managers create and change tasks; assignees run timers and submit; every
 * action writes a task_events row in the same transaction.
 */
class TaskController extends Controller
{
    public const PER_PAGE = 10;

    private const STATUSES = 'not_started,todo,in_progress,review,deadline_missed,completed,not_approved,on_hold,pending,technical_support';

    // ── Access ──────────────────────────────────────────────────────────

    private function requireManager(User $user): void
    {
        if (!$user->isManager()) {
            throw new TaskRuleException('forbidden', 'Only managers can do this.', 403);
        }
    }

    private function requireAssignee(User $user, Task $task): void
    {
        if ($task->assignee_id !== $user->id) {
            throw new TaskRuleException('not_assignee', 'Only the person assigned to this task can do this.', 403);
        }
    }

    /** Once the deadline passes, the timer and Submit stay locked until the deadline is moved. */
    private function requireBeforeDeadline(Task $task): void
    {
        if ($task->deadline && !$task->deadline->isFuture()) {
            throw new TaskRuleException('deadline_passed', 'The deadline has passed. Ask for an extension to keep working on this task.');
        }
    }

    /** A deadline at or before the start means the task is missed the moment it opens. */
    private function requireDeadlineAfterStart($start, $deadline): void
    {
        if ($start && $deadline && !Carbon::parse($deadline)->gt(Carbon::parse($start))) {
            throw new TaskRuleException('deadline_before_start', 'The deadline must be after the start date and time.');
        }
    }

    private function requireViewer(User $user, Task $task): void
    {
        if (!$user->isManager() && $task->assignee_id !== $user->id) {
            throw new TaskRuleException('forbidden', 'You can only see tasks assigned to you.', 403);
        }
    }

    // ── List ────────────────────────────────────────────────────────────

    /**
     * Without `page` or `tab` this returns the full array the old pages
     * expect. With either, it returns the redesigned list: 10 per page with
     * meta.total, filtered by tab, search (q) and date range (from, to).
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$request->hasAny(['page', 'tab'])) {
            $query = Task::with(['project', 'assignee', 'assigner']);
            // Managers see every task so they can check workload before
            // assigning; staff and interns only see their own.
            if (!$user->isManager()) {
                $query->where('assignee_id', $user->id);
            }
            if ($request->project_id) $query->where('project_id', $request->project_id);
            if ($request->status)     $query->where('status', $request->status);

            $tasks = $query->orderBy('created_at', 'desc')->get();
            $tasks->each(fn (Task $t) => $t->markDeadlineMissed());
            return response()->json($tasks);
        }

        $request->validate([
            'tab' => 'nullable|in:all,mine,active,completed',
            'state' => 'nullable|in:active,completed',
            'q' => 'nullable|string|max:200',
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d',
            'page' => 'nullable|integer|min:1',
        ]);

        $page = $this->listQuery($request, $user)->paginate(self::PER_PAGE);
        $page->getCollection()->each(fn (Task $t) => $t->markDeadlineMissed());

        return response()->json([
            'data' => $page->getCollection()->map->toListItem()->values(),
            'meta' => [
                'total' => $page->total(),
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    /** Tab, search and date filters shared by the list and the export. */
    public function listQuery(Request $request, User $user): Builder
    {
        $query = Task::with(['project', 'assignee', 'assigner'])
            ->withCount(['extensionRequests as pending_extensions_count' => fn ($q) => $q->where('status', 'pending')]);

        $tab = $request->input('tab');
        if ($user->isManager()) {
            // "My tasks" for a manager: tasks assigned to them or set by them.
            if ($tab === 'mine') {
                $query->where(fn ($q) => $q->where('assignee_id', $user->id)->orWhere('assigned_by', $user->id));
            }
        } else {
            $query->where('assignee_id', $user->id);
            if ($tab === 'completed') {
                $query->where('status', 'completed');
            } elseif ($tab === 'active') {
                $query->where('status', '!=', 'completed');
            }
        }

        if ($request->project_id) $query->where('project_id', $request->project_id);
        if ($request->status)     $query->where('status', $request->status);
        // Home's Active / Completed toggle, for any tab.
        if ($request->input('state') === 'completed') {
            $query->where('status', 'completed');
        } elseif ($request->input('state') === 'active') {
            $query->where('status', '!=', 'completed');
        }

        if ($q = trim((string) $request->input('q'))) {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $q) . '%';
            $query->where(fn ($w) => $w
                ->where('title', 'like', $like)
                ->orWhereHas('project', fn ($p) => $p->where('name', 'like', $like))
                ->orWhereHas('assignee', fn ($a) => $a->where('first_name', 'like', $like)->orWhere('last_name', 'like', $like)));
        }

        // A task matches when its schedule window overlaps the range (spec §7.2).
        if ($from = $request->input('from')) {
            $query->whereRaw('COALESCE(deadline, start_date, created_at) >= ?', [Carbon::parse($from)->startOfDay()]);
        }
        if ($to = $request->input('to')) {
            $query->whereRaw('COALESCE(start_date, created_at) <= ?', [Carbon::parse($to)->endOfDay()]);
        }

        // Most recently created first.
        return $query->orderByDesc('created_at')->orderByDesc('id');
    }

    // ── Create, read, edit, delete (managers) ───────────────────────────

    public function store(Request $request)
    {
        $user = $request->user();
        $this->requireManager($user);

        $data = $request->validate([
            'title' => 'required|string',
            'description' => 'nullable|string',
            'project_id' => 'required|integer|exists:projects,id',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'priority' => 'nullable|string|in:low,medium,high',
            'status' => 'nullable|string|in:' . self::STATUSES,
            'deadline' => 'nullable|date',
            'start_date' => 'nullable|date',
            'working_hours' => 'nullable|integer|min:0',
            'working_minutes' => 'nullable|integer|min:0|max:59',
            'progress' => 'nullable|integer|min:0|max:100',
            'lock_early_start' => 'nullable|boolean',
        ]);

        if (!empty($data['assignee_id'])) {
            $assignee = User::find($data['assignee_id']);
            if (!$assignee || !in_array($assignee->role, ['staff', 'intern', 'project_manager'])) {
                return response()->json(['message' => 'Tasks can only be assigned to staff, interns, or project managers.'], 422);
            }
        }

        $this->requireDeadlineAfterStart($data['start_date'] ?? null, $data['deadline'] ?? null);

        $data['assigned_by'] = $user->id;
        if (!empty($data['description'])) {
            $data['instructions_updated_at'] = now();
        }

        $task = DB::transaction(function () use ($data, $user) {
            $task = Task::create($data);
            TaskEvent::record($task, TaskEvent::CREATED, $user->id, to: [
                'title' => $task->title,
                'start_date' => $this->value($task->start_date),
                'deadline' => $this->value($task->deadline),
                'estimate_minutes' => $task->estimateMinutes() ?: null,
            ]);
            if ($task->assignee_id) {
                TaskEvent::record($task, TaskEvent::ASSIGNED, $user->id, to: $this->person($task->assignee));
            }
            return $task;
        });

        if ($task->assignee_id && $task->assignee_id !== $user->id) {
            NotificationService::send(
                $task->assignee_id,
                'task_assigned',
                'New Task Assigned',
                "You have been assigned the task: \"{$task->title}\"",
                $task->id,
                'task',
            );
        }

        return response()->json($task->load(['project', 'assignee', 'assigner']), 201);
    }

    /** Task panel details. */
    public function show(Request $request, Task $task)
    {
        $this->requireViewer($request->user(), $task);
        $task->markDeadlineMissed();

        $task->load(['project', 'assignee', 'assigner', 'sessions', 'iterations']);
        return response()->json($task->toArray() + [
            'estimate_minutes' => $task->estimateMinutes(),
            'logged_seconds' => $task->loggedSeconds(),
            'has_instructions' => $task->hasInstructions(),
            'pending_extension' => $task->extensionRequests()->where('status', 'pending')->latest()->first(),
            'pending_estimate_request' => $task->estimateRequests()->where('status', 'pending')->latest()->first(),
        ]);
    }

    /**
     * Manager edits. Changing the deadline or the estimate needs a `reason`;
     * each changed field is written to the history (old → new).
     */
    public function update(Request $request, Task $task)
    {
        $user = $request->user();

        // The old pages submit by sending { status: 'review' } as an edit;
        // treat that as a real submit so it keeps working for the assignee.
        if (!$user->isManager() && $request->keys() === ['status'] && $request->input('status') === 'review') {
            return $this->submit($request, $task);
        }

        $this->requireManager($user);

        $data = $request->validate([
            'title' => 'sometimes|string',
            'description' => 'nullable|string',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'priority' => 'nullable|string|in:low,medium,high',
            'status' => 'nullable|string|in:' . self::STATUSES,
            'deadline' => 'nullable|date',
            'start_date' => 'nullable|date',
            'working_hours' => 'nullable|integer|min:0',
            'working_minutes' => 'nullable|integer|min:0|max:59',
            'progress' => 'nullable|integer|min:0|max:100',
            'lock_early_start' => 'nullable|boolean',
            'reason' => 'nullable|string|max:1000',
        ]);
        $reason = trim((string) ($data['reason'] ?? '')) ?: null;
        unset($data['reason']);
        $this->requireDeadlineAfterStart(
            array_key_exists('start_date', $data) ? $data['start_date'] : $task->start_date,
            array_key_exists('deadline', $data) ? $data['deadline'] : $task->deadline,
        );

        $before = $task->replicate();
        $before->id = $task->id;

        $deadlineChanged = array_key_exists('deadline', $data)
            && $this->value($task->deadline) !== $this->value($data['deadline'] ? Carbon::parse($data['deadline']) : null);
        $newEstimate = (array_key_exists('working_hours', $data) || array_key_exists('working_minutes', $data))
            ? ((int) ($data['working_hours'] ?? $task->working_hours)) * 60 + (int) ($data['working_minutes'] ?? $task->working_minutes)
            : null;
        $estimateChanged = $newEstimate !== null && $newEstimate !== $task->estimateMinutes();

        if (($deadlineChanged || $estimateChanged) && !$reason) {
            throw new TaskRuleException('reason_required', 'Give a reason for changing the ' . ($deadlineChanged ? 'deadline' : 'estimate') . '.');
        }

        if (isset($data['status']) && $data['status'] === 'review' && $task->status !== 'review') {
            $data['timer_stopped_at'] = now();
            $data['submitted_at'] = now();
            $data['submitted_by'] = $user->id;
        }
        if (isset($data['status']) && $data['status'] === 'completed' && $task->status !== 'completed') {
            $data['completed_at'] = now();
        }

        // A missed task whose deadline moves back into the future (or is
        // cleared) goes back to To do unless a status was picked.
        if ($task->status === 'deadline_missed' && ($data['status'] ?? $task->status) === 'deadline_missed') {
            $newDeadline = array_key_exists('deadline', $data) ? $data['deadline'] : $task->deadline;
            if (!$newDeadline || Carbon::parse($newDeadline)->isFuture()) {
                $data['status'] = 'todo';
            }
        }

        if (array_key_exists('description', $data) && trim((string) $data['description']) !== trim((string) $task->description)) {
            $data['instructions_updated_at'] = now();
        }

        $oldStatus = $task->status;
        DB::transaction(function () use ($task, $data, $before, $user, $reason) {
            $task->update($data);
            $this->recordEdits($before, $task->fresh(['assignee']), $user->id, $reason);
        });

        if ($task->assignee_id && $task->assignee_id !== $before->assignee_id && $task->assignee_id !== $user->id) {
            NotificationService::send(
                $task->assignee_id,
                'task_assigned',
                'New Task Assigned',
                "You have been assigned the task: \"{$task->title}\"",
                $task->id,
                'task',
            );
        }

        if (isset($data['status']) && $data['status'] !== $oldStatus) {
            if ($data['status'] === 'not_approved' && $task->assignee_id) {
                NotificationService::send($task->assignee_id, 'task_not_approved', 'Task Not Approved',
                    "Your task \"{$task->title}\" requires revision.", $task->id, 'task');
            }
            if ($data['status'] === 'completed' && $task->assignee_id) {
                NotificationService::send($task->assignee_id, 'task_completed', 'Task Completed',
                    "Your task \"{$task->title}\" has been marked complete.", $task->id, 'task');
            }
        }

        return response()->json($task->fresh()->load(['project', 'assignee']));
    }

    /** One history entry per changed field. */
    private function recordEdits(Task $before, Task $after, int $actorId, ?string $reason): void
    {
        if ($before->assignee_id !== $after->assignee_id) {
            TaskEvent::record($after, TaskEvent::ASSIGNED, $actorId,
                $before->assignee_id ? $this->person(User::find($before->assignee_id)) : null,
                $after->assignee_id ? $this->person($after->assignee) : null);
        }

        if (trim((string) $before->description) !== trim((string) $after->description)) {
            TaskEvent::record($after, TaskEvent::INSTRUCTIONS_EDITED, $actorId,
                ['text' => $before->description], ['text' => $after->description]);
        }

        $fields = [
            'title' => fn (Task $t) => $t->title,
            'status' => fn (Task $t) => $t->status,
            'priority' => fn (Task $t) => $t->priority,
            'start_date' => fn (Task $t) => $this->value($t->start_date),
            'deadline' => fn (Task $t) => $this->value($t->deadline),
            'estimate_minutes' => fn (Task $t) => $t->estimateMinutes(),
            'progress' => fn (Task $t) => $t->progress,
            'lock_early_start' => fn (Task $t) => (bool) $t->lock_early_start,
        ];
        foreach ($fields as $field => $get) {
            $old = $get($before);
            $new = $get($after);
            if ($old !== $new) {
                $needsReason = in_array($field, ['deadline', 'estimate_minutes'], true);
                TaskEvent::record($after, TaskEvent::FIELD_EDITED, $actorId, ['value' => $old], ['value' => $new], [
                    'field' => $field,
                    'reason' => $needsReason ? $reason : null,
                ]);
            }
        }
    }

    public function destroy(Request $request, Task $task)
    {
        $user = $request->user();
        $this->requireManager($user);

        DB::transaction(function () use ($task, $user) {
            $task->stopRunningTimer($user->id);
            TaskEvent::record($task, TaskEvent::DELETED, $user->id);
            $task->delete();
        });

        return response()->json(['message' => 'Task deleted.']);
    }

    // ── Timer and review (assignee) ─────────────────────────────────────

    /**
     * Start the timer. Body: confirm_read, confirm_early.
     * - First start on a task with unread instructions → 409 confirm_read.
     * - Before the scheduled start → 409 confirm_early (with any clashing
     *   task), or 422 locked when the manager blocked early starts.
     * In-review and extension-pending tasks can be started (spec §7.4).
     */
    public function startTimer(Request $request, Task $task)
    {
        $user = $request->user();
        $this->requireAssignee($user, $task);
        $task->markDeadlineMissed();

        if ($task->status === 'completed') {
            throw new TaskRuleException('closed', 'This task is completed.');
        }
        if ($task->is_timer_running) {
            throw new TaskRuleException('running', 'Timer already running.');
        }
        $this->requireBeforeDeadline($task);
        // One timer at a time per person.
        $other = Task::where('assignee_id', $user->id)->where('id', '!=', $task->id)->where('is_timer_running', true)->first();
        if ($other) {
            throw new TaskRuleException('other_running', "Stop \"{$other->title}\" before starting another task.", 422, [
                'running_task' => ['id' => $other->id, 'title' => $other->title],
            ]);
        }

        $read = TaskRead::where('task_id', $task->id)->where('user_id', $user->id)->exists();
        if ($task->hasInstructions() && !$read) {
            if (!$request->boolean('confirm_read')) {
                throw new TaskRuleException('confirm_read', 'Read the instructions before you start.', 409, [
                    'instructions' => $task->description,
                ]);
            }
            $this->markRead($task, $user);
        }

        $early = $task->start_date && now()->lt($task->start_date);
        $clash = null;
        if ($early) {
            if ($task->lock_early_start) {
                throw new TaskRuleException('locked', 'This task opens at its scheduled start.', 422, [
                    'opens_at' => $task->start_date->toIso8601String(),
                ]);
            }
            $clash = $task->clashingTask();
            if (!$request->boolean('confirm_early')) {
                throw new TaskRuleException('confirm_early', 'This task is scheduled for later. Start early?', 409, [
                    'scheduled_start' => $task->start_date->toIso8601String(),
                    'clash' => $clash ? [
                        'id' => $clash->id,
                        'title' => $clash->title,
                        'deadline' => $clash->deadline?->toIso8601String(),
                    ] : null,
                ]);
            }
        }

        DB::transaction(function () use ($task, $user, $early, $clash) {
            if ($task->status === 'review') {
                TaskEvent::record($task, TaskEvent::TIMER_RESTARTED, $user->id, ['status' => 'review'], ['status' => 'in_progress']);
            }

            TaskSession::create([
                'task_id' => $task->id,
                'user_id' => $user->id,
                'started_at' => now(),
                'started_early' => $early,
                'clash_task_id' => $clash?->id,
            ]);

            $task->update([
                'is_timer_running' => true,
                'timer_start_time' => now(),
                'has_been_started' => true,
                'status' => $task->status === 'deadline_missed' ? 'deadline_missed' : 'in_progress',
                'actual_start_time' => $task->actual_start_time ?? now(),
            ]);

            TaskEvent::record($task, TaskEvent::TIMER_STARTED, $user->id, meta: [
                'early_minutes' => $early ? (int) now()->diffInMinutes($task->start_date) : null,
                'clash_task_id' => $clash?->id,
                'clash_title' => $clash?->title,
            ]);
        });

        return response()->json($task->fresh()->toArray() + ['logged_seconds' => $task->fresh()->loggedSeconds()]);
    }

    public function stopTimer(Request $request, Task $task)
    {
        $user = $request->user();
        $this->requireAssignee($user, $task);
        // Past the deadline the system stops the timer itself.
        $task->markDeadlineMissed();

        if (!$task->is_timer_running) {
            throw new TaskRuleException('not_running', 'Timer is not running.');
        }

        DB::transaction(function () use ($task, $user) {
            $task->stopRunningTimer($user->id);
            // Pausing never clears a missed deadline.
            $task->update(['status' => $task->status === 'deadline_missed' ? 'deadline_missed' : 'on_hold']);
        });

        return response()->json($task->fresh()->toArray() + ['logged_seconds' => $task->fresh()->loggedSeconds()]);
    }

    /** Stop the timer and send the task for review. Works again after a restart. */
    public function submit(Request $request, Task $task)
    {
        $user = $request->user();
        $this->requireAssignee($user, $task);

        if ($task->status === 'completed') {
            throw new TaskRuleException('closed', 'This task is completed.');
        }
        $task->markDeadlineMissed();
        $this->requireBeforeDeadline($task);

        DB::transaction(function () use ($task, $user) {
            $task->stopRunningTimer($user->id);
            $from = $task->status;
            $task->update([
                'status' => 'review',
                'submitted_at' => now(),
                'submitted_by' => $user->id,
            ]);
            TaskEvent::record($task, TaskEvent::SUBMITTED, $user->id, ['status' => $from], ['status' => 'review'], [
                'logged_seconds' => $task->loggedSeconds(),
            ]);
        });

        foreach ($this->managerIds($task, $user->id) as $managerId) {
            NotificationService::send($managerId, 'task_review', 'Task Ready for Review',
                "{$user->fullName()} submitted \"{$task->title}\" for review.", $task->id, 'task');
        }

        return response()->json($task->fresh()->load(['project', 'assignee']));
    }

    /** Records that the assignee opened the instructions (internal only). */
    public function instructionsRead(Request $request, Task $task)
    {
        $user = $request->user();
        $this->requireAssignee($user, $task);
        $this->markRead($task, $user);
        return response()->json(['read' => true]);
    }

    private function markRead(Task $task, User $user): void
    {
        TaskRead::updateOrCreate(
            ['task_id' => $task->id, 'user_id' => $user->id],
            ['read_at' => now(), 'instructions_version' => $task->instructions_updated_at],
        );
    }

    public function approve(Request $request, Task $task)
    {
        $user = $request->user();
        $this->requireManager($user);
        if ($task->status === 'completed') {
            throw new TaskRuleException('closed', 'This task is already completed.');
        }

        DB::transaction(function () use ($task, $user) {
            $task->stopRunningTimer($user->id);
            $from = $task->status;
            $task->update(['status' => 'completed', 'completed_at' => now()]);
            TaskEvent::record($task, TaskEvent::APPROVED, $user->id, ['status' => $from], ['status' => 'completed']);
        });

        if ($task->assignee_id) {
            NotificationService::send($task->assignee_id, 'task_completed', 'Task Completed',
                "Your task \"{$task->title}\" has been marked complete.", $task->id, 'task');
        }

        return response()->json($task->fresh()->load(['project', 'assignee']));
    }

    public function sendBack(Request $request, Task $task)
    {
        $user = $request->user();
        $this->requireManager($user);
        $data = $request->validate(['reason' => 'nullable|string|max:1000']);

        DB::transaction(function () use ($task, $user, $data) {
            $from = $task->status;
            $task->update(['status' => 'not_approved']);
            TaskEvent::record($task, TaskEvent::SENT_BACK, $user->id, ['status' => $from], ['status' => 'not_approved'], [
                'reason' => $data['reason'] ?? null,
            ]);
        });

        if ($task->assignee_id) {
            NotificationService::send($task->assignee_id, 'task_not_approved', 'Task Not Approved',
                "Your task \"{$task->title}\" requires revision.", $task->id, 'task');
        }

        return response()->json($task->fresh()->load(['project', 'assignee']));
    }

    // ── Iterations ──────────────────────────────────────────────────────

    public function iterations(Task $task)
    {
        return response()->json($task->iterations()->with('assignee')->get());
    }

    public function storeIteration(Request $request, Task $task)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'description' => 'nullable|string',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'due_date' => 'nullable|date',
            'status' => 'nullable|string',
        ]);
        $data['task_id'] = $task->id;

        $iteration = TaskIteration::create($data);
        return response()->json($iteration, 201);
    }

    public function updateIteration(Request $request, Task $task, TaskIteration $iteration)
    {
        $iteration->update($request->validate([
            'title' => 'sometimes|string',
            'status' => 'nullable|string',
            'description' => 'nullable|string',
        ]));
        return response()->json($iteration);
    }

    // ── Deadline extension requests ─────────────────────────────────────

    public function deadlineRequests(Request $request)
    {
        $user = $request->user();
        $query = DeadlineExtensionRequest::with(['task.project', 'requester', 'projectManager']);

        if ($user->role === 'project_manager') {
            $query->where('project_manager_id', $user->id);
        } elseif (!$user->isManager()) {
            $query->where('requester_id', $user->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    /** Old route: POST /deadline-requests with task_id and project_manager_id. */
    public function storeDeadlineRequest(Request $request)
    {
        $data = $request->validate([
            'task_id' => 'required|integer|exists:tasks,id',
            'project_manager_id' => 'required|integer|exists:users,id',
            'reason' => 'required|string',
            'requested_deadline' => 'required|date',
        ]);
        $task = Task::findOrFail($data['task_id']);
        $req = $this->createExtensionRequest($request->user(), $task, $data['project_manager_id'], $data['requested_deadline'], $data['reason']);
        return response()->json($req, 201);
    }

    /** POST /tasks/{task}/extension-requests — goes to the project's manager. */
    public function storeExtensionRequest(Request $request, Task $task)
    {
        $data = $request->validate([
            'reason' => 'required|string',
            'requested_deadline' => 'required|date',
        ]);
        $task->loadMissing('project');
        $deciderId = $task->project->manager_id ?? $task->assigned_by;
        if (!$deciderId) {
            throw new TaskRuleException('no_manager', 'This task has no manager to send the request to.');
        }
        $req = $this->createExtensionRequest($request->user(), $task, $deciderId, $data['requested_deadline'], $data['reason']);
        return response()->json($req, 201);
    }

    private function createExtensionRequest(User $user, Task $task, int $deciderId, string $deadline, string $reason): DeadlineExtensionRequest
    {
        $this->requireAssignee($user, $task);
        if ($task->hasPendingExtension()) {
            throw new TaskRuleException('pending', 'There is already a pending extension request for this task.');
        }

        $req = DB::transaction(function () use ($user, $task, $deciderId, $deadline, $reason) {
            $req = DeadlineExtensionRequest::create([
                'task_id' => $task->id,
                'requester_id' => $user->id,
                'project_manager_id' => $deciderId,
                'reason' => $reason,
                'requested_deadline' => $deadline,
                'status' => 'pending',
            ]);
            TaskEvent::record($task, TaskEvent::EXTENSION_REQUESTED, $user->id,
                ['deadline' => $this->value($task->deadline)],
                ['deadline' => $this->value($req->requested_deadline)],
                ['reason' => $reason, 'request_id' => $req->id]);
            return $req;
        });

        NotificationService::send($deciderId, 'deadline_extension_request', 'Deadline Extension Request',
            "{$user->fullName()} requested a deadline extension for task: \"{$task->title}\"",
            $req->id, 'deadline_extension_request');

        return $req->load(['task', 'requester']);
    }

    /** Old route: PUT /deadline-requests/{id}/decide with status approved|rejected. */
    public function decideDeadlineRequest(Request $request, DeadlineExtensionRequest $extensionRequest)
    {
        return response()->json($this->decideExtension($request, $extensionRequest));
    }

    /** PATCH /tasks/{task}/extension-requests/{extensionRequest} with status approved|declined. */
    public function decideExtensionRequest(Request $request, Task $task, DeadlineExtensionRequest $extensionRequest)
    {
        if ($extensionRequest->task_id !== $task->id) {
            abort(404);
        }
        return response()->json($this->decideExtension($request, $extensionRequest));
    }

    private function decideExtension(Request $request, DeadlineExtensionRequest $req): DeadlineExtensionRequest
    {
        $user = $request->user();
        $this->requireManager($user);

        $data = $request->validate([
            'status' => 'required|in:approved,rejected,declined',
            'decision_reason' => 'nullable|string',
            'approved_deadline' => 'nullable|date',
            'approved_working_hours' => 'nullable|integer|min:0',
            'approved_working_minutes' => 'nullable|integer|min:0|max:59',
        ]);
        if ($req->status !== 'pending') {
            throw new TaskRuleException('decided', 'This request has already been decided.');
        }
        $approved = $data['status'] === 'approved';
        $data['status'] = $approved ? 'approved' : 'rejected';
        $data['decided_by'] = $user->id;
        $data['decided_at'] = now();
        if ($approved) {
            $data['approved_deadline'] ??= $req->requested_deadline;
        }

        DB::transaction(function () use ($req, $data, $approved, $user) {
            $req->update($data);
            $task = $req->task;

            if (!$approved) {
                TaskEvent::record($task, TaskEvent::EXTENSION_DECLINED, $user->id, meta: [
                    'reason' => $data['decision_reason'] ?? null,
                    'request_id' => $req->id,
                ]);
                return;
            }

            // An approved extension moves the deadline; original_deadline stays.
            $oldDeadline = $this->value($task->deadline);
            $oldEstimate = $task->estimateMinutes();
            $changes = ['deadline' => $data['approved_deadline']];
            if ($task->status === 'deadline_missed' && Carbon::parse($data['approved_deadline'])->isFuture()) {
                $changes['status'] = $task->is_timer_running ? 'in_progress' : 'todo';
            }
            if (isset($data['approved_working_hours']) || isset($data['approved_working_minutes'])) {
                $changes['working_hours'] = $data['approved_working_hours'] ?? $task->working_hours;
                $changes['working_minutes'] = $data['approved_working_minutes'] ?? $task->working_minutes;
            }
            $task->update($changes);

            TaskEvent::record($task, TaskEvent::EXTENSION_APPROVED, $user->id,
                ['deadline' => $oldDeadline], ['deadline' => $this->value($task->deadline)], [
                    'reason' => $data['decision_reason'] ?? null,
                    'request_id' => $req->id,
                ]);
            if ($task->estimateMinutes() !== $oldEstimate) {
                TaskEvent::record($task, TaskEvent::FIELD_EDITED, $user->id, ['value' => $oldEstimate], ['value' => $task->estimateMinutes()], [
                    'field' => 'estimate_minutes',
                    'reason' => 'Extension approved',
                ]);
            }
        });

        $req->load(['task', 'requester']);
        $label = $approved ? 'Approved' : 'Declined';
        NotificationService::send($req->requester_id, 'deadline_extension_decided', "Deadline Extension {$label}",
            "Your deadline extension for \"{$req->task->title}\" was " . strtolower($label) . '.',
            $req->id, 'deadline_extension_request');

        return $req;
    }

    // ── Estimate requests ───────────────────────────────────────────────

    /**
     * POST /tasks/{task}/estimate-requests. `requested_minutes` is the new
     * total estimate the assignee is asking for, not the extra time.
     */
    public function storeEstimateRequest(Request $request, Task $task)
    {
        $user = $request->user();
        $this->requireAssignee($user, $task);
        $data = $request->validate([
            'requested_minutes' => 'required|integer|min:1|max:100000',
            'reason' => 'required|string',
        ]);
        if ($task->estimateRequests()->where('status', 'pending')->exists()) {
            throw new TaskRuleException('pending', 'There is already a pending estimate request for this task.');
        }

        $req = DB::transaction(function () use ($task, $user, $data) {
            $req = EstimateRequest::create($data + ['task_id' => $task->id, 'requester_id' => $user->id, 'status' => 'pending']);
            TaskEvent::record($task, TaskEvent::ESTIMATE_REQUESTED, $user->id,
                ['estimate_minutes' => $task->estimateMinutes()], ['estimate_minutes' => (int) $data['requested_minutes']],
                ['reason' => $data['reason'], 'request_id' => $req->id]);
            return $req;
        });

        foreach ($this->managerIds($task, $user->id) as $managerId) {
            NotificationService::send($managerId, 'estimate_request', 'More Time Requested',
                "{$user->fullName()} asked for more estimate time on \"{$task->title}\".", $task->id, 'task');
        }

        return response()->json($req, 201);
    }

    /** PATCH /tasks/{task}/estimate-requests/{estimateRequest}; approval is logged as an estimate edit. */
    public function decideEstimateRequest(Request $request, Task $task, EstimateRequest $estimateRequest)
    {
        $user = $request->user();
        $this->requireManager($user);
        if ($estimateRequest->task_id !== $task->id) {
            abort(404);
        }
        $data = $request->validate([
            'status' => 'required|in:approved,declined',
            'approved_minutes' => 'nullable|integer|min:1|max:100000',
            'decision_reason' => 'nullable|string',
        ]);
        if ($estimateRequest->status !== 'pending') {
            throw new TaskRuleException('decided', 'This request has already been decided.');
        }
        $approved = $data['status'] === 'approved';

        DB::transaction(function () use ($task, $estimateRequest, $data, $approved, $user) {
            $minutes = (int) ($data['approved_minutes'] ?? $estimateRequest->requested_minutes);
            $estimateRequest->update([
                'status' => $data['status'],
                'approved_minutes' => $approved ? $minutes : null,
                'decision_reason' => $data['decision_reason'] ?? null,
                'decided_by' => $user->id,
                'decided_at' => now(),
            ]);

            if (!$approved) {
                TaskEvent::record($task, TaskEvent::ESTIMATE_DECLINED, $user->id, meta: [
                    'reason' => $data['decision_reason'] ?? null,
                    'request_id' => $estimateRequest->id,
                ]);
                return;
            }

            $old = $task->estimateMinutes();
            $task->update(['working_hours' => intdiv($minutes, 60), 'working_minutes' => $minutes % 60]);
            TaskEvent::record($task, TaskEvent::ESTIMATE_APPROVED, $user->id,
                ['estimate_minutes' => $old], ['estimate_minutes' => $minutes], [
                    'reason' => $data['decision_reason'] ?? null,
                    'request_id' => $estimateRequest->id,
                ]);
        });

        NotificationService::send($estimateRequest->requester_id, 'estimate_request_decided',
            $approved ? 'More Time Approved' : 'More Time Declined',
            "Your request for more time on \"{$task->title}\" was " . ($approved ? 'approved' : 'declined') . '.',
            $task->id, 'task');

        return response()->json($estimateRequest->fresh());
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    /** The task's project manager and whoever assigned it, minus the actor. */
    private function managerIds(Task $task, int $exceptId): array
    {
        $task->loadMissing('project');
        return collect([$task->project->manager_id ?? null, $task->assigned_by])
            ->filter()
            ->unique()
            ->reject(fn ($id) => $id === $exceptId)
            ->values()
            ->all();
    }

    private function person(?User $user): ?array
    {
        return $user ? ['id' => $user->id, 'name' => $user->fullName()] : null;
    }

    /** Dates in history and comparisons, as ISO 8601 in the app timezone. */
    private function value($date): ?string
    {
        return $date ? Carbon::parse($date)->toIso8601String() : null;
    }
}
