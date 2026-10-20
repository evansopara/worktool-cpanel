<?php

namespace App\Models;

use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    protected $fillable = [
        'title', 'description', 'project_id', 'assignee_id', 'assigned_by',
        'status', 'iteration_number', 'priority', 'progress', 'start_date',
        'deadline', 'working_hours', 'working_minutes', 'time_spent',
        'is_timer_running', 'timer_start_time', 'timer_stopped_at', 'has_been_started',
        'actual_start_time', 'review_started_at', 'completed_at',
        'halfway_notified_at', 'deadline_warning_notified_at',
    ];

    protected $casts = [
        'start_date' => 'datetime', 'deadline' => 'datetime',
        'is_timer_running' => 'boolean', 'has_been_started' => 'boolean',
        'timer_start_time' => 'datetime', 'timer_stopped_at' => 'datetime', 'actual_start_time' => 'datetime',
        'review_started_at' => 'datetime', 'completed_at' => 'datetime',
        'halfway_notified_at' => 'datetime', 'deadline_warning_notified_at' => 'datetime',
    ];

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
        });
    }

    public function project() { return $this->belongsTo(Project::class); }
    public function assignee() { return $this->belongsTo(User::class, 'assignee_id'); }
    public function assigner() { return $this->belongsTo(User::class, 'assigned_by'); }
    public function sessions() { return $this->hasMany(TaskSession::class); }
    public function iterations() { return $this->hasMany(TaskIteration::class); }

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
