<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One entry in a task's history (design/HANDOFF_SPEC.md §7.9, §8).
 * Written by the server in the same transaction as the action; never
 * updated or deleted.
 */
class TaskEvent extends Model
{
    public const UPDATED_AT = null;

    public const CREATED = 'created';
    public const ASSIGNED = 'assigned';               // assigned or reassigned
    public const FIELD_EDITED = 'field_edited';       // one per field, old → new
    public const INSTRUCTIONS_EDITED = 'instructions_edited';
    public const TIMER_STARTED = 'timer_started';     // meta: early_minutes, clash
    public const TIMER_STOPPED = 'timer_stopped';     // meta: session_seconds, by_system
    public const TIMER_RESTARTED = 'timer_restarted'; // started again after submit
    public const DEADLINE_SOON = 'deadline_soon';     // system reminder
    public const DEADLINE_MISSED = 'deadline_missed'; // system; meta: timer_running, cause
    public const ESTIMATE_REACHED = 'estimate_reached';
    public const EXTENSION_REQUESTED = 'extension_requested';
    public const EXTENSION_APPROVED = 'extension_approved';
    public const EXTENSION_DECLINED = 'extension_declined';
    public const ESTIMATE_REQUESTED = 'estimate_requested';
    public const ESTIMATE_APPROVED = 'estimate_approved';
    public const ESTIMATE_DECLINED = 'estimate_declined';
    public const SUBMITTED = 'submitted';
    public const APPROVED = 'approved';
    public const SENT_BACK = 'sent_back';
    public const DELETED = 'deleted';

    /** History filter chips → event types (GET /tasks/{id}/events?type=). */
    public const FILTERS = [
        'sessions' => [self::TIMER_STARTED, self::TIMER_STOPPED, self::TIMER_RESTARTED],
        'edits' => [self::FIELD_EDITED, self::INSTRUCTIONS_EDITED, self::ASSIGNED],
        'deadlines' => [
            self::DEADLINE_SOON, self::DEADLINE_MISSED, self::ESTIMATE_REACHED,
            self::EXTENSION_REQUESTED, self::EXTENSION_APPROVED, self::EXTENSION_DECLINED,
            self::ESTIMATE_REQUESTED, self::ESTIMATE_APPROVED, self::ESTIMATE_DECLINED,
        ],
    ];

    protected $fillable = ['task_id', 'actor_id', 'type', 'from', 'to', 'meta'];

    protected $casts = ['from' => 'array', 'to' => 'array', 'meta' => 'array', 'created_at' => 'datetime'];

    public function task() { return $this->belongsTo(Task::class)->withTrashed(); }
    public function actor() { return $this->belongsTo(User::class, 'actor_id'); }

    public static function record(Task $task, string $type, ?int $actorId, ?array $from = null, ?array $to = null, ?array $meta = null): self
    {
        return self::create([
            'task_id' => $task->id,
            'actor_id' => $actorId,
            'type' => $type,
            'from' => $from,
            'to' => $to,
            'meta' => $meta ? array_filter($meta, fn ($v) => $v !== null) : null,
        ]);
    }
}
