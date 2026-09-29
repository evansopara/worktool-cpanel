<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GeneralChannelMessage extends Model
{
    protected $fillable = ['content', 'sender_id', 'is_edited', 'is_pinned', 'reactions'];
    protected $casts = ['is_edited' => 'boolean', 'is_pinned' => 'boolean', 'reactions' => 'array'];

    public function sender() { return $this->belongsTo(User::class, 'sender_id'); }
}
