<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectBriefing extends Model
{
    protected $fillable = ['project_id', 'content', 'created_by', 'updated_by'];

    public function project() { return $this->belongsTo(Project::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function updater() { return $this->belongsTo(User::class, 'updated_by'); }
}
