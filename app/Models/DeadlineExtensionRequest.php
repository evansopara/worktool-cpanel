<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeadlineExtensionRequest extends Model
{
    protected $fillable = ['task_id', 'requester_id', 'project_manager_id', 'reason', 'requested_deadline', 'status', 'decision_reason', 'decided_by', 'decided_at', 'approved_deadline', 'approved_working_hours', 'approved_working_minutes'];
    protected $casts = ['requested_deadline' => 'datetime', 'decided_at' => 'datetime', 'approved_deadline' => 'datetime'];

    public function task() { return $this->belongsTo(Task::class); }
    public function requester() { return $this->belongsTo(User::class, 'requester_id'); }
    public function projectManager() { return $this->belongsTo(User::class, 'project_manager_id'); }
}
