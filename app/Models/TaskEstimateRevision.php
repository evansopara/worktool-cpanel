<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskEstimateRevision extends Model
{
    protected $fillable = ['task_id', 'user_id', 'old_minutes', 'new_minutes', 'reason'];

    public function task() { return $this->belongsTo(Task::class); }
    public function user() { return $this->belongsTo(User::class); }
}
