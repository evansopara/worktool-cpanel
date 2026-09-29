<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    protected $fillable = ['title', 'description', 'type', 'scheduled_by', 'participants', 'start_time', 'end_time', 'status', 'meeting_link', 'notes', 'start_notified', 'end_notified'];
    protected $casts = ['participants' => 'array', 'start_time' => 'datetime', 'end_time' => 'datetime'];

    public function scheduler() { return $this->belongsTo(User::class, 'scheduled_by'); }
}
