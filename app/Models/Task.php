<?php

namespace App\Models;

use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon as SupportCarbon;
use Illuminate\Support\Facades\DB;

class Task extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'title', 'description', 'project_id', 'assignee_id', 'assigned_by',
        'status', 'iteration_number', 'priority', 'progress', 'start_date',
        'deadline', 'working_hours', 'working_minutes', 'time_spent',
        'is_timer_running', 'timer_start_time', 'timer_stopped_at', 'has_been_started',
        'actual_start_time', 'review_started_at', 'completed_at',
        'halfway_notified_at', 'deadline_warning_notified_at',
        'submitted_at', 'submitted_by',
        'original_deadline', 'original_estimate_minutes', 'instructions_updated_at',
        'lock_early_start', 'estimate_warned_at', 'estimate_reached_at',
    ];

    protected $casts = [
        'start_date' => 'datetime', 'deadline' => 'datetime',
        'is_timer_running' => 'boolean', 'has_been_started' => 'boolean',
        'timer_start_time' => 'datetime', 'timer_stopped_at' => 'datetime', 'actual_start_time' => 'datetime',
        'review_started_at' => 'datetime', 'completed_at' => 'datetime',
        'halfway_notified_at' => 'datetime', 'deadline_warning_notified_at' => 'datetime',
        'submitted_at' => 'datetime', 'original_deadline' => 'datetime',
        'instructions_updated_at' => 'datetime', 'lock_early_start' => 'boolean',
        'estimate_warned_at' => 'datetime', 'estimate_reached_at' => 'datetime',
    ];

    /** A first start this many minutes after the scheduled start counts as late. */
    public const LATE_START_GRACE_MINUTES = 5;

    /** Statuses that no longer need deadline reminders or deadline checks. */
    public const CLOSED_STATUSES = ['review', 'completed', 'not_approved', 'deadline_missed'];

    /** How long before the deadline the final warning goes out. */
    public const WARNING_MINUTES = 10;

    protected static function booted(): void
    {
        // New dates mean new reminder times, so let both reminders fire again.
        // Only flags that are set get cleared, so saving a task never touches
        // these columns otherwise (and keeps working before they exist).
        static::saving(function (Task $task) {
            if ($task->isDirty('deadline') || $task->isDirty('start_date')) {
                foreach (['halfway_notified_at', 'deadline_warning_notified_at'] as $flag) {
                    if ($task->getAttribute($flag) !== null) {
                        $task->setAttribute($flag, null);
                    }
                }
            }
            // A new estimate means new 80% / 100% alerts.
            if ($task->isDirty('working_hours') || $task->isDirty('working_minutes')) {
                foreach (['estimate_warned_at', 'estimate_reached_at'] as $flag) {
                    if ($task->getAttribute($flag) !== null) {
                        $task->setAttribute($flag, null);
                    }
                }
            }
        });

        // What was first agreed is kept for KPIs; later edits never change it.
        static::creating(function (Task $task) {
            $task->original_deadline ??= $task->deadline;
            if ($task->original_estimate_minutes === null && $task->estimateMinutes() > 0) {
                $task->original_estimate_minutes = $task->estimateMinutes();
            }
        });
    }

    public function project() { return $this->belongsTo(Project::class); }
    public function assignee() { return $this->belongsTo(User::class, 'assignee_id'); }
    public function assigner() { return $this->belongsTo(User::class, 'assigned_by'); }
    public function sessions() { return $this->hasMany(TaskSession::class); }
    public function iterations() { return $this->hasMany(TaskIteration::class); }
    public function events() { return $this->hasMany(TaskEvent::class); }
    public function extensionRequests() { return $this->hasMany(DeadlineExtensionRequest::class); }
    public function estimateRequests() { return $this->hasMany(EstimateRequest::class); }

    /** Effort budget in minutes (spec §7.8); 0 when no estimate is set. */
    public function estimateMinutes(): int
    {
        return ((int) $this->working_hours) * 60 + (int) $this->working_minutes;
    }

    /** Total time logged, including the session running now. */
    public function loggedSeconds(): int
    {
        $seconds = (int) $this->time_spent;
        if ($this->is_timer_running && $this->timer_start_time) {
            $seconds += max(0, (int) $this->timer_start_time->diffInSeconds(now()));
        }
        return $seconds;
    }

    public function hasInstructions(): bool
    {
        return trim((string) $this->description) !== '';
    }

    public function hasPendingExtension(): bool
    {
        return $this->extensionRequests()->where('status', 'pending')->exists();
    }

    /**
     * Close the running session and add its time to the task. Status is left
     * to the caller. Returns the session length in seconds.
     */
    public function stopRunningTimer(?int $actorId, bool $bySystem = false): int
    {
        if (!$this->is_timer_running) {
            return 0;
        }
        $elapsed = $this->timer_start_time ? max(0, (int) $this->timer_start_time->diffInSeconds(now())) : 0;

        TaskSession::where('task_id', $this->id)->whereNull('ended_at')->latest('id')->first()
            ?->update(['ended_at' => now(), 'duration_seconds' => $elapsed]);

        $this->update([
            'is_timer_running' => false,
            'timer_start_time' => null,
            'timer_stopped_at' => now(),
            'time_spent' => ((int) $this->time_spent) + $elapsed,
        ]);

        TaskEvent::record($this, TaskEvent::TIMER_STOPPED, $actorId, meta: [
            'session_seconds' => $elapsed,
            'by_system' => $bySystem ?: null,
        ]);

        return $elapsed;
    }

    /**
     * Mark an overdue task as missed: stop its timer, tag the likely cause
     * (spec §7.8) and notify. Returns false if it wasn't due to be marked.
     */
    public function markDeadlineMissed(): bool
    {
        if (!$this->deadline || $this->deadline->isFuture() || in_array($this->status, self::CLOSED_STATUSES, true)) {
            return false;
        }

        DB::transaction(function () {
            $wasRunning = (bool) $this->is_timer_running;
            $this->stopRunningTimer(null, bySystem: true);
            $this->update(['status' => 'deadline_missed']);
            TaskEvent::record($this, TaskEvent::DEADLINE_MISSED, null, meta: [
                'timer_running' => $wasRunning ?: null,
                'cause' => $this->missCause(),
            ]);
        });

        $this->notifyDeadlineMissed();
        return true;
    }

    /**
     * Why the deadline was missed: waited_on_extension, manager_change,
     * not_started, late_start, over_estimate, or null if none applies.
     */
    public function missCause(): ?string
    {
        if ($this->hasPendingExtension()) {
            return 'waited_on_extension';
        }

        // The deadline was moved earlier after the task was set.
        $movedEarlier = $this->events()
            ->where('type', TaskEvent::FIELD_EDITED)
            ->get()
            ->contains(fn (TaskEvent $e) => ($e->meta['field'] ?? null) === 'deadline'
                && isset($e->from['value'], $e->to['value'])
                && SupportCarbon::parse($e->to['value'])->lt(SupportCarbon::parse($e->from['value'])));
        if ($movedEarlier) {
            return 'manager_change';
        }

        $firstStart = TaskSession::where('task_id', $this->id)->min('started_at');
        if (!$firstStart) {
            return 'not_started';
        }
        if ($this->start_date && SupportCarbon::parse($firstStart)->gt($this->start_date->copy()->addMinutes(self::LATE_START_GRACE_MINUTES))) {
            return 'late_start';
        }
        if ($this->estimateMinutes() > 0 && $this->loggedSeconds() > $this->estimateMinutes() * 60) {
            return 'over_estimate';
        }
        return null;
    }

    /**
     * Another open task of the same assignee that is scheduled right now
     * (spec §7.7 clash warning).
     */
    public function clashingTask(): ?Task
    {
        $now = now();
        return self::where('assignee_id', $this->assignee_id)
            ->where('id', '!=', $this->id)
            ->whereNotIn('status', ['completed', 'review'])
            ->whereNotNull('start_date')
            ->where('start_date', '<=', $now)
            ->where(fn ($q) => $q->whereNull('deadline')->orWhere('deadline', '>', $now))
            ->orderBy('start_date')
            ->first();
    }

    /** Row shape for the redesigned task lists. */
    public function toListItem(): array
    {
        $person = fn (?User $u) => $u ? ['id' => $u->id, 'name' => $u->fullName()] : null;
        return [
            'id' => $this->id,
            'title' => $this->title,
            'status' => $this->status,
            'priority' => $this->priority,
            'project' => $this->project ? ['id' => $this->project->id, 'name' => $this->project->name] : null,
            'assignee' => $person($this->assignee),
            'assigned_by' => $person($this->assigner),
            'start_date' => $this->start_date?->toIso8601String(),
            'deadline' => $this->deadline?->toIso8601String(),
            'estimate_minutes' => $this->estimateMinutes(),
            'logged_seconds' => $this->loggedSeconds(),
            'is_timer_running' => (bool) $this->is_timer_running,
            'timer_start_time' => $this->timer_start_time?->toIso8601String(),
            'has_instructions' => $this->hasInstructions(),
            'pending_extension' => (bool) ($this->pending_extensions_count ?? 0),
            'lock_early_start' => (bool) $this->lock_early_start,
        ];
    }

    /**
     * Halfway between the task's start (its start date, or when it was
     * created) and its deadline.
     */
    public function halfwayPoint(): ?\Carbon\Carbon
    {
        if (!$this->deadline) {
            return null;
        }
        $start = $this->start_date ?? $this->created_at ?? $this->deadline;
        $seconds = max(0, (int) $start->diffInSeconds($this->deadline));

        return $start->copy()->addSeconds(intdiv($seconds, 2));
    }

    /** "3:30 PM" for a deadline today, "Oct 22, 3:30 PM" otherwise. */
    private function deadlineLabel(): string
    {
        return $this->deadline->format($this->deadline->isToday() ? 'g:i A' : 'M j, g:i A');
    }

    /** Push tag shared by this task's deadline alerts, so each replaces the last. */
    public function deadlinePushTag(): string
    {
        return "task-deadline-{$this->id}";
    }

    /** Remind the assignee that the task is halfway to its deadline. */
    public function notifyHalfway(): void
    {
        NotificationService::send(
            $this->assignee_id,
            'task_deadline_reminder',
            'Halfway to deadline',
            "\"{$this->title}\" is halfway to its deadline (due {$this->deadlineLabel()}).",
            $this->id,
            'task',
            pushTag: $this->deadlinePushTag(),
            email: false,
        );
    }

    /** Warn the assignee shortly before the deadline. */
    public function notifyDeadlineWarning(): void
    {
        TaskEvent::record($this, TaskEvent::DEADLINE_SOON, null, meta: ['minutes' => self::WARNING_MINUTES]);
        NotificationService::send(
            $this->assignee_id,
            'task_deadline_reminder',
            'Deadline in ' . self::WARNING_MINUTES . ' minutes',
            "\"{$this->title}\" is due at {$this->deadlineLabel()}. Wrap up or submit it for review.",
            $this->id,
            'task',
            pushTag: $this->deadlinePushTag(),
            email: false,
        );
    }

    /**
     * Notify the assignee and project manager that this task's deadline
     * has passed. Called once, at the point the task transitions into
     * 'deadline_missed' status.
     */
    public function notifyDeadlineMissed(): void
    {
        $this->loadMissing(['project', 'assignee']);

        if ($this->assignee_id) {
            NotificationService::send(
                $this->assignee_id,
                'task_deadline_missed',
                'Deadline Missed',
                "The deadline for your task \"{$this->title}\" has passed.",
                $this->id,
                'task',
                pushTag: $this->deadlinePushTag(),
            );
        }

        $assigneeName = $this->assignee->first_name ?? 'A staff member';
        $managerIds = collect([$this->project->manager_id ?? null])
            ->filter()
            ->unique()
            ->reject(fn ($id) => $id === $this->assignee_id);

        foreach ($managerIds as $managerId) {
            NotificationService::send(
                $managerId,
                'task_deadline_missed',
                'Task Deadline Missed',
                "\"{$this->title}\" assigned to {$assigneeName} has missed its deadline.",
                $this->id,
                'task',
            );
        }
    }
}
