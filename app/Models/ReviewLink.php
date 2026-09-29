<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReviewLink extends Model
{
    protected $fillable = ['title', 'link_url', 'description', 'sent_by', 'assigned_to', 'status', 'reviewed_at', 'review_comment', 'commented_at'];
    protected $casts = ['reviewed_at' => 'datetime', 'commented_at' => 'datetime'];

    public function sender() { return $this->belongsTo(User::class, 'sent_by'); }
    public function assignee() { return $this->belongsTo(User::class, 'assigned_to'); }
}
