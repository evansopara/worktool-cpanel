<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One person's answer to one day's attendance check (Performance spec §5). */
class AttendanceCheck extends Model
{
    public const PENDING = 'pending';
    public const ANSWERED = 'answered';
    public const LATE = 'late';
    public const MISSED = 'missed';
    public const SKIPPED = 'skipped';

    protected $fillable = [
        'user_id', 'date', 'notified_at', 'responded_at', 'status',
        'device_session_id', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'notified_at' => 'datetime', 'responded_at' => 'datetime', 'reviewed_at' => 'datetime',
    ];

    public function user() { return $this->belongsTo(User::class); }
    public function reviewer() { return $this->belongsTo(User::class, 'reviewed_by'); }
}
