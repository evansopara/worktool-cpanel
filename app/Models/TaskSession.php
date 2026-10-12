<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskSession extends Model
{
    public $timestamps = false;

    protected $fillable = ['task_id', 'user_id', 'started_at', 'ended_at', 'duration_seconds', 'pause_reason', 'pause_note'];

    public const PAUSE_REASONS = ['urgent_request', 'blocked', 'waiting_on_client', 'waiting_on_team', 'end_of_day', 'other'];
    protected $casts = ['started_at' => 'datetime', 'ended_at' => 'datetime'];

    public function task() { return $this->belongsTo(Task::class); }
    public function user() { return $this->belongsTo(User::class); }
}
