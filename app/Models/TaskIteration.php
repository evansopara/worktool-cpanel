<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskIteration extends Model
{
    protected $fillable = [
        'task_id', 'iteration_number', 'assignee_id', 'assigned_by',
        'description', 'status', 'start_date', 'deadline', 'working_hours',
        'working_minutes', 'time_spent', 'notes', 'reassigned_by', 'completed_at',
    ];
    protected $casts = ['start_date' => 'datetime', 'deadline' => 'datetime', 'completed_at' => 'datetime'];

    public function task() { return $this->belongsTo(Task::class); }
    public function assignee() { return $this->belongsTo(User::class, 'assignee_id'); }
}
