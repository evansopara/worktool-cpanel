<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sop extends Model
{
    protected $fillable = ['title', 'description', 'category', 'created_by', 'status'];

    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function segments() { return $this->hasMany(SopSegment::class); }
}
