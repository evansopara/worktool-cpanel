<?php

namespace Tests\Concerns;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The production tables were created by SQL import and several older
 * migrations are MySQL-only, so SQLite test databases get the task tables
 * built here, with the columns the app uses, and then the task history
 * migration is run on top for real.
 */
trait CreatesTaskTables
{
    protected function createTaskTables(bool $withHistoryMigration = true): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username');
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
            $table->string('password');
            $table->string('role')->default('staff');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('name')->default('Project');
            $table->unsignedBigInteger('manager_id')->nullable();
            $table->timestamps();
        });
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('type');
            $table->string('title')->nullable();
            $table->text('message')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reference_type')->nullable();
            $table->boolean('read')->default(false);
            $table->timestamps();
        });
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('assignee_id')->nullable();
            $table->unsignedBigInteger('assigned_by')->nullable();
            $table->string('status')->default('todo');
            $table->string('priority')->default('medium');
            $table->integer('progress')->default(0);
            $table->dateTime('start_date')->nullable();
            $table->dateTime('deadline')->nullable();
            $table->integer('working_hours')->nullable();
            $table->integer('working_minutes')->nullable();
            $table->unsignedInteger('time_spent')->default(0);
            $table->boolean('is_timer_running')->default(false);
            $table->dateTime('timer_start_time')->nullable();
            $table->dateTime('timer_stopped_at')->nullable();
            $table->boolean('has_been_started')->default(false);
            $table->dateTime('actual_start_time')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->timestamps();
        });
        Schema::create('task_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('task_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->integer('duration_seconds')->nullable();
        });
        Schema::create('deadline_extension_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('task_id');
            $table->unsignedBigInteger('requester_id');
            $table->unsignedBigInteger('project_manager_id')->nullable();
            $table->text('reason')->nullable();
            $table->dateTime('requested_deadline')->nullable();
            $table->string('status')->default('pending');
            $table->text('decision_reason')->nullable();
            $table->unsignedBigInteger('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->dateTime('approved_deadline')->nullable();
            $table->integer('approved_working_hours')->nullable();
            $table->integer('approved_working_minutes')->nullable();
            $table->timestamps();
        });

        if ($withHistoryMigration) {
            $this->artisan('migrate', ['--path' => 'database/migrations/2026_10_27_000001_add_task_history_and_rules.php']);
        }
    }
}
