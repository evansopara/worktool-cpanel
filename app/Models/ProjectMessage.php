<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectMessage extends Model
{
    protected $fillable = ['project_id', 'sender_id', 'content', 'is_edited'];
    protected $casts = ['is_edited' => 'boolean'];

    public function project() { return $this->belongsTo(Project::class); }
    public function sender() { return $this->belongsTo(User::class, 'sender_id'); }
}
