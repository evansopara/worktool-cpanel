<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Memo extends Model
{
    protected $fillable = ['subject', 'content', 'recipients', 'sender_id', 'type', 'department'];
    protected $casts = ['recipients' => 'array'];

    public function sender() { return $this->belongsTo(User::class, 'sender_id'); }
    public function reads() { return $this->hasMany(MemoRead::class); }
    public function responses() { return $this->hasMany(MemoResponse::class); }
}
