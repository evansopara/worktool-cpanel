<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectPlan extends Model
{
    protected $fillable = ['project_id', 'title', 'description', 'status', 'start_date', 'end_date', 'created_by'];

    public function project() { return $this->belongsTo(Project::class); }
    public function deliverables() { return $this->hasMany(Deliverable::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
}
