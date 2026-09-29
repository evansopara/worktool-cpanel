<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffComplaint extends Model
{
    protected $fillable = ['name', 'email', 'department', 'detailed_explanation', 'screenshot_url', 'status', 'review_comments', 'submitter_id', 'reviewed_at'];
    protected $casts = ['reviewed_at' => 'datetime'];

    public function submitter() { return $this->belongsTo(User::class, 'submitter_id'); }
}
