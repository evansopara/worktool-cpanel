<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Resource extends Model
{
    protected $fillable = ['name', 'type', 'size', 'path', 'link', 'project_id', 'uploaded_by'];

    public function project() { return $this->belongsTo(Project::class); }
    public function uploader() { return $this->belongsTo(User::class, 'uploaded_by'); }
}
