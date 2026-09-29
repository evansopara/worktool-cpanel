<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TechnicalSupportRequest extends Model
{
    protected $fillable = ['title', 'description', 'task_id', 'requester_id', 'assigned_to_id', 'status', 'priority', 'resolution', 'resolved_at'];
    protected $casts = ['resolved_at' => 'datetime'];

    public function requester() { return $this->belongsTo(User::class, 'requester_id'); }
    public function assignedTo() { return $this->belongsTo(User::class, 'assigned_to_id'); }
}
