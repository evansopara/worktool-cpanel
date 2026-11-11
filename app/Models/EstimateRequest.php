<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A staff request for more estimate time; mirrors DeadlineExtensionRequest. */
class EstimateRequest extends Model
{
    protected $fillable = [
        'task_id', 'requester_id', 'requested_minutes', 'reason', 'status',
        'approved_minutes', 'decision_reason', 'decided_by', 'decided_at',
    ];

    protected $casts = ['decided_at' => 'datetime'];

    public function task() { return $this->belongsTo(Task::class); }
    public function requester() { return $this->belongsTo(User::class, 'requester_id'); }
}
