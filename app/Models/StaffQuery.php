<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffQuery extends Model
{
    protected $fillable = ['subject', 'message', 'submitted_by', 'assigned_to', 'status', 'response', 'responded_at'];
    protected $casts = ['responded_at' => 'datetime'];

    public function submitter() { return $this->belongsTo(User::class, 'submitted_by'); }
    public function assignee() { return $this->belongsTo(User::class, 'assigned_to'); }
}
