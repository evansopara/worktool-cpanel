<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MemoRead extends Model
{
    public $timestamps = false;
    protected $fillable = ['memo_id', 'user_id', 'read_at'];
    protected $casts = ['read_at' => 'datetime'];
}
