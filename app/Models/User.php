<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'username', 'password', 'first_name', 'last_name', 'email', 'role', 'gender',
        'specialization', 'department', 'phone', 'profile_picture', 'project_manager_type',
        'status', 'work_status', 'break_start_time', 'break_count', 'absence_reason',
        'absence_end_date', 'break_one_time', 'current_task_id', 'task_start_time',
        'email_verified', 'verification_token', 'reset_password_token', 'reset_password_expires',
        'onboarding_status', 'product_service', 'client_type', 'must_set_password',
        'password_setup_token', 'last_active', 'last_seen', 'is_active',
    ];

    protected $hidden = ['password', 'remember_token', 'reset_password_token', 'password_setup_token'];

    protected $appends = ['first_name', 'last_name'];

    protected $casts = [
        'email_verified' => 'boolean',
        'must_set_password' => 'boolean',
        'is_active' => 'boolean',
        'break_start_time' => 'datetime',
        'absence_end_date' => 'datetime',
        'task_start_time' => 'datetime',
        'reset_password_expires' => 'datetime',
        'last_active' => 'datetime',
        'last_seen' => 'datetime',
    ];

    public function getFirstNameAttribute($value)
    {
        if ($value) return $value;
        if (!empty($this->attributes['first_name'])) return $this->attributes['first_name'];
        $parts = explode(' ', $this->attributes['name'] ?? '', 2);
        return $parts[0] ?? '';
    }

    public function getLastNameAttribute($value)
    {
        if ($value) return $value;
        if (!empty($this->attributes['last_name'])) return $this->attributes['last_name'];
        $parts = explode(' ', $this->attributes['name'] ?? '', 2);
        return $parts[1] ?? '';
    }

    public function currentTask() { return $this->belongsTo(Task::class, 'current_task_id'); }
    public function managedProjects() { return $this->hasMany(Project::class, 'manager_id'); }
    public function tasks() { return $this->hasMany(Task::class, 'assignee_id'); }
    public function notifications() { return $this->hasMany(Notification::class); }
    public function projectMemberships() { return $this->hasMany(ProjectMember::class); }
}
