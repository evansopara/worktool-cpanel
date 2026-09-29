<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Complaint extends Model
{
    protected $fillable = ['name', 'email', 'product_manager_name', 'developer_name', 'technical_manager_name', 'valuable_things', 'detailed_explanation', 'screenshot_url', 'status', 'review_comments', 'submitter_id', 'reviewed_by', 'reviewed_at'];
    protected $casts = ['valuable_things' => 'array', 'reviewed_at' => 'datetime'];
}
