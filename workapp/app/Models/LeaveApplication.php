<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaveApplication extends Model
{
    protected $fillable = [
        'user_id', 'leave_type', 'reason', 'start_date', 'end_date',
        'total_days', 'proof_image_url', 'status', 'applied_at',
        'reviewed_at', 'reviewed_by', 'review_comment',
    ];
    protected $casts = [
        'start_date' => 'datetime', 'end_date' => 'datetime',
        'applied_at' => 'datetime', 'reviewed_at' => 'datetime',
    ];

    public function user() { return $this->belongsTo(User::class); }
    public function reviewer() { return $this->belongsTo(User::class, 'reviewed_by'); }
}
