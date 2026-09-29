<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientSentiment extends Model
{
    // Actual table name is singular ('client_sentiment'), not Eloquent's default plural guess.
    protected $table = 'client_sentiment';

    protected $fillable = ['project_id', 'client_id', 'sentiment', 'is_flagged', 'feedback', 'recorded_by', 'recorded_at'];
    protected $casts = ['recorded_at' => 'datetime', 'is_flagged' => 'boolean'];

    public function project() { return $this->belongsTo(Project::class); }
    public function client() { return $this->belongsTo(User::class, 'client_id'); }
    public function recorder() { return $this->belongsTo(User::class, 'recorded_by'); }
}
