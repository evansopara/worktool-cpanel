<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskSession;
use App\Models\TaskIteration;
use App\Models\DeadlineExtensionRequest;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Carbon\Carbon;

class TaskController extends Controller
{
    /**
     * Auto-mark a task as deadline_missed if the deadline has passed
     * and the task is not yet submitted/completed.
     * Also stops the timer if running.
     */
    private function checkDeadline(Task $task): Task
    {
        if (!$task->deadline) return $task;
        if (in_array($task->status, ['review', 'completed', 'not_approved', 'deadline_missed'])) {
            return $task;
        }

        $deadline = Carbon::parse($task->deadline);
        if ($deadline->isPast()) {
            // If timer is running, stop it and accumulate time
            if ($task->is_timer_running && $task->timer_start_time) {
                $elapsed = (int) Carbon::parse($task->timer_start_time)->diffInSeconds(now());
                $session = TaskSession::where('task_id', $task->id)
                    ->whereNull('ended_at')
                    ->latest()
                    ->first();
                if ($session) {
                    $session->update(['ended_at' => now(), 'duration_seconds' => $elapsed]);
                }
                $task->update([
                    'is_timer_running' => false,
                    'timer_start_time' => null,
                    'timer_stopped_at' => now(),
                    'time_spent' => ($task->time_spent ?? 0) + $elapsed,
                    'status' => 'deadline_missed',
                ]);
            } else {
                $task->update(['status' => 'deadline_missed']);
            }
            $task->refresh();
            $task->notifyDeadlineMissed();
        }

        return $task;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Task::with(['project', 'assignee', 'assigner']);

        // Operations managers, team leads, project managers, and customer support
        // officers see all tasks regardless of project membership, so they can check
        // a user's existing workload before assigning a new task.
        if (in_array($user->role, ['staff', 'intern'])) {
            $query->where('assignee_id', $user->id);
        }

        if ($request->project_id) $query->where('project_id', $request->project_id);
        if ($request->status)     $query->where('status', $request->status);

        $tasks = $query->orderBy('created_at', 'desc')->get();

        // Auto-check deadlines for active tasks
        $tasks->each(fn($t) => $this->checkDeadline($t));

        return response()->json($tasks);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'description' => 'nullable|string',
            'project_id' => 'required|integer|exists:projects,id',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'priority' => 'nullable|string|in:low,medium,high',
            'status' => 'nullable|string|in:not_started,todo,in_progress,review,deadline_missed,completed,not_approved,on_hold,pending,technical_support',
            'deadline' => 'nullable|date',
            'start_date' => 'nullable|date',
            'working_hours' => 'nullable|integer',
            'working_minutes' => 'nullable|integer',
            'estimated_hours' => 'nullable|numeric',
            'progress' => 'nullable|integer|min:0|max:100',
        ]);

        if (!empty($data['assignee_id'])) {
            $assignee = \App\Models\User::find($data['assignee_id']);
            if (!$assignee || !in_array($assignee->role, ['staff', 'intern', 'project_manager'])) {
                return response()->json(['message' => 'Tasks can only be assigned to staff, interns, or project managers.'], 422);
            }
        }

        $data['assigned_by'] = $request->user()->id;
        $task = Task::create($data);

        if (!empty($task->assignee_id) && $task->assignee_id !== $request->user()->id) {
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

    public function show(Task $task)
    {
        $this->checkDeadline($task);
        return response()->json($task->load(['project', 'assignee', 'assigner', 'sessions', 'iterations']));
    }

    public function update(Request $request, Task $task)
    {
        $data = $request->validate([
            'title' => 'sometimes|string',
            'description' => 'nullable|string',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'priority' => 'nullable|string|in:low,medium,high',
            'status' => 'nullable|string|in:not_started,todo,in_progress,review,deadline_missed,completed,not_approved,on_hold,pending,technical_support',
            'deadline' => 'nullable|date',
            'start_date' => 'nullable|date',
            'working_hours' => 'nullable|integer',
            'working_minutes' => 'nullable|integer',
            'estimated_hours' => 'nullable|numeric',
            'progress' => 'nullable|integer|min:0|max:100',
        ]);

        if (isset($data['status']) && $data['status'] === 'review' && $task->status !== 'review') {
            $data['timer_stopped_at'] = now();
            $data['submitted_at']     = now();
            $data['submitted_by']     = $request->user()->id;
        }

        // If this task was auto-marked deadline_missed and the edit pushes the
        // deadline back into the future (or clears it) without the caller
        // explicitly picking a different status, restore it to an active status.
        if ($task->status === 'deadline_missed' && ($data['status'] ?? $task->status) === 'deadline_missed') {
            $newDeadline = array_key_exists('deadline', $data) ? $data['deadline'] : $task->deadline;
            if (!$newDeadline || Carbon::parse($newDeadline)->isFuture()) {
                $data['status'] = 'todo';
            }
        }

        $oldStatus = $task->status;
        $task->update($data);

        if (isset($data['status']) && $data['status'] !== $oldStatus) {
            if ($data['status'] === 'not_approved' && $task->assignee_id) {
                NotificationService::send(
                    $task->assignee_id,
                    'task_not_approved',
                    'Task Not Approved',
                    "Your task \"{$task->title}\" requires revision.",
                    $task->id,
                    'task',
                );
            }
            if ($data['status'] === 'completed' && $task->assignee_id) {
                NotificationService::send(
                    $task->assignee_id,
                    'task_completed',
                    'Task Completed',
                    "Your task \"{$task->title}\" has been marked complete.",
                    $task->id,
                    'task',
                );
            }
        }

        return response()->json($task->load(['project', 'assignee']));
    }

    public function destroy(Task $task)
    {
        $task->delete();
        return response()->json(['message' => 'Task deleted.']);
    }

    /**
     * Submit a task for review.
     * Sets status to 'review', stops timer, records who submitted and when.
     */
    public function submit(Request $request, Task $task)
    {
        // Stop running timer if active
        $elapsed = 0;
        if ($task->is_timer_running && $task->timer_start_time) {
            $elapsed = (int) Carbon::parse($task->timer_start_time)->diffInSeconds(now());
            $session = TaskSession::where('task_id', $task->id)
                ->whereNull('ended_at')
                ->latest()
                ->first();
            if ($session) {
                $session->update(['ended_at' => now(), 'duration_seconds' => $elapsed]);
            }
        }

        $task->update([
            'status' => 'review',
            'is_timer_running' => false,
            'timer_start_time' => null,
            'timer_stopped_at' => now(),
            'submitted_at' => now(),
            'submitted_by' => $request->user()->id,
            'time_spent' => ($task->time_spent ?? 0) + $elapsed,
        ]);

        $task->load('project');
        if ($task->project && $task->project->manager_id && $task->project->manager_id !== $request->user()->id) {
            NotificationService::send(
                $task->project->manager_id,
                'task_review',
                'Task Ready for Review',
                "{$request->user()->name} submitted \"{$task->title}\" for review.",
                $task->id,
                'task',
            );
        }

        return response()->json($task->fresh()->load(['project', 'assignee']));
    }

    // Timer
    public function startTimer(Request $request, Task $task)
    {
        $this->checkDeadline($task);

        // Allow starting even if deadline_missed (per requirements)
        if ($task->is_timer_running) {
            return response()->json(['message' => 'Timer already running.'], 422);
        }

        $task->update([
            'is_timer_running' => true,
            'timer_start_time' => now(),
            'has_been_started' => true,
            'status' => $task->status === 'deadline_missed' ? 'deadline_missed' : 'in_progress',
            'actual_start_time' => $task->actual_start_time ?? now(),
        ]);

        TaskSession::create([
            'task_id' => $task->id,
            'user_id' => $request->user()->id,
            'started_at' => now(),
        ]);

        return response()->json($task->fresh());
    }

    public function stopTimer(Request $request, Task $task)
    {
        if (!$task->is_timer_running) {
            return response()->json(['message' => 'Timer is not running.'], 422);
        }

        $elapsed = $task->timer_start_time
            ? (int) Carbon::parse($task->timer_start_time)->diffInSeconds(now())
            : 0;

        $session = TaskSession::where('task_id', $task->id)
            ->whereNull('ended_at')
            ->latest()
            ->first();
        if ($session) {
            $session->update(['ended_at' => now(), 'duration_seconds' => $elapsed]);
        }

        // Don't downgrade deadline_missed status when pausing
        $newStatus = $task->status === 'deadline_missed' ? 'deadline_missed' : 'on_hold';

        $task->update([
            'is_timer_running' => false,
            'timer_start_time' => null,
            'timer_stopped_at' => now(),
            'time_spent' => ($task->time_spent ?? 0) + $elapsed,
            'status' => $newStatus,
        ]);

        return response()->json($task->fresh());
    }

    // Iterations
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

    // Deadline extension requests
    public function deadlineRequests(Request $request)
    {
        $user = $request->user();
        $query = DeadlineExtensionRequest::with(['task', 'requester', 'projectManager']);

        if ($user->role === 'project_manager') {
            $query->where('project_manager_id', $user->id);
        } elseif (in_array($user->role, ['staff', 'intern'])) {
            $query->where('requester_id', $user->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function storeDeadlineRequest(Request $request)
    {
        $data = $request->validate([
            'task_id' => 'required|integer|exists:tasks,id',
            'project_manager_id' => 'required|integer|exists:users,id',
            'reason' => 'required|string',
            'requested_deadline' => 'required|date',
        ]);
        $data['requester_id'] = $request->user()->id;
        $data['status'] = 'pending';

        $req = DeadlineExtensionRequest::create($data);
        $req->load(['task', 'requester']);

        NotificationService::send(
            $data['project_manager_id'],
            'deadline_extension_request',
            'Deadline Extension Request',
            "{$request->user()->name} requested a deadline extension for task: \"{$req->task->title}\"",
            $req->id,
            'deadline_extension_request',
        );

        return response()->json($req, 201);
    }

    public function decideDeadlineRequest(Request $request, DeadlineExtensionRequest $extensionRequest)
    {
        $data = $request->validate([
            'status' => 'required|in:approved,rejected',
            'decision_reason' => 'nullable|string',
            'approved_deadline' => 'nullable|date',
            'approved_working_hours' => 'nullable|integer|min:0',
            'approved_working_minutes' => 'nullable|integer|min:0|max:59',
        ]);
        $data['decided_by'] = $request->user()->id;
        $data['decided_at'] = now();

        $extensionRequest->update($data);

        if ($data['status'] === 'approved' && isset($data['approved_deadline'])) {
            $extensionRequest->task->update([
                'deadline' => $data['approved_deadline'],
                'status' => 'in_progress',
            ]);
        }

        $extensionRequest->load(['task', 'requester']);
        $label = $data['status'] === 'approved' ? 'Approved' : 'Rejected';
        NotificationService::send(
            $extensionRequest->requester_id,
            'deadline_extension_decided',
            "Deadline Extension {$label}",
            "Your deadline extension for \"{$extensionRequest->task->title}\" was {$data['status']}.",
            $extensionRequest->id,
            'deadline_extension_request',
        );

        return response()->json($extensionRequest);
    }
}