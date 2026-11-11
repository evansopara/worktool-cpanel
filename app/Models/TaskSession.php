<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskSession extends Model
{
    public $timestamps = false;

    protected $fillable = ['task_id', 'user_id', 'started_at', 'ended_at', 'duration_seconds', 'started_early', 'clash_task_id'];
    protected $casts = ['started_at' => 'datetime', 'ended_at' => 'datetime', 'started_early' => 'boolean'];

    public function task() { return $this->belongsTo(Task::class); }
    public function user() { return $this->belongsTo(User::class); }
}
