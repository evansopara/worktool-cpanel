<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MemoResponse extends Model
{
    protected $fillable = ['memo_id', 'user_id', 'content'];

    public function user() { return $this->belongsTo(User::class); }
}
