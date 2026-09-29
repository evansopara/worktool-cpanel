<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IssueReport extends Model
{
    protected $fillable = ['title', 'description', 'category', 'suggestions', 'reported_by', 'project_id', 'task_id', 'priority', 'status', 'resolution', 'resolved_at', 'screenshot_url'];
    protected $casts = ['resolved_at' => 'datetime'];

    public function reporter() { return $this->belongsTo(User::class, 'reported_by'); }
    public function project() { return $this->belongsTo(Project::class); }
    public function task() { return $this->belongsTo(Task::class); }
}
