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
    ];

    protected $casts = [
        'start_date' => 'datetime', 'deadline' => 'datetime',
        'is_timer_running' => 'boolean', 'has_been_started' => 'boolean',
        'timer_start_time' => 'datetime', 'timer_stopped_at' => 'datetime', 'actual_start_time' => 'datetime',
        'review_started_at' => 'datetime', 'completed_at' => 'datetime',
    ];

    public function project() { return $this->belongsTo(Project::class); }
    public function assignee() { return $this->belongsTo(User::class, 'assignee_id'); }
    public function assigner() { return $this->belongsTo(User::class, 'assigned_by'); }
    public function sessions() { return $this->hasMany(TaskSession::class); }
    public function iterations() { return $this->hasMany(TaskIteration::class); }

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
