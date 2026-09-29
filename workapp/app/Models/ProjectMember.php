<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectMember extends Model
{
    public $timestamps = false;
    protected $fillable = ['project_id', 'user_id', 'role', 'invitation_status', 'invited_by', 'invited_at', 'joined_at'];
    protected $casts = ['invited_at' => 'datetime', 'joined_at' => 'datetime'];

    public function project() { return $this->belongsTo(Project::class); }
    public function user() { return $this->belongsTo(User::class); }
}
