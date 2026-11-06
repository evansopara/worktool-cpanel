<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** The day's shared check time (Performance spec §5). */
class AttendanceDay extends Model
{
    protected $fillable = ['date', 'send_at', 'fired_at'];

    protected $casts = ['send_at' => 'datetime', 'fired_at' => 'datetime'];

    public function checks() { return $this->hasMany(AttendanceCheck::class, 'date', 'date'); }
}
