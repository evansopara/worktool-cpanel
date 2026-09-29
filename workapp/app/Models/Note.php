<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Note extends Model
{
    protected $fillable = ['title', 'content', 'todo_items', 'color', 'user_id'];
    protected $casts = ['todo_items' => 'array'];

    public function user() { return $this->belongsTo(User::class); }
}
