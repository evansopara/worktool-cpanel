<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Deliverable extends Model
{
    protected $fillable = ['plan_id', 'title', 'description', 'start_date', 'due_date', 'status', 'dependencies', 'assigned_to'];
    protected $casts = ['dependencies' => 'array'];

    public function plan() { return $this->belongsTo(ProjectPlan::class, 'plan_id'); }
    public function assignee() { return $this->belongsTo(User::class, 'assigned_to'); }
}
