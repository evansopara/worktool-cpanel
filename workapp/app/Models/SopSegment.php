<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SopSegment extends Model
{
    protected $fillable = ['sop_id', 'title', 'content', 'order_index'];

    public function sop() { return $this->belongsTo(Sop::class); }
}
