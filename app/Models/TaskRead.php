<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Records that an assignee opened a task's instructions. Internal only: it
 * drives the once-per-task "read before you start" check and is never shown
 * to managers (no read receipts, design CHANGELOG #12).
 */
class TaskRead extends Model
{
    public $timestamps = false;

    protected $fillable = ['task_id', 'user_id', 'read_at', 'instructions_version'];
    protected $casts = ['read_at' => 'datetime', 'instructions_version' => 'datetime'];
}
