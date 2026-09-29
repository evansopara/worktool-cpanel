<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Projects: add type and progress
        Schema::table('projects', function (Blueprint $table) {
            $table->string('type')->nullable()->after('description');
            $table->integer('progress')->default(0)->after('status');
        });

        // Tasks: add missing columns
        Schema::table('tasks', function (Blueprint $table) {
            $table->integer('progress')->default(0)->after('priority');
            $table->integer('iteration_number')->default(1)->after('progress');
            $table->datetime('start_date')->nullable()->after('iteration_number');
            $table->datetime('deadline')->nullable()->after('start_date');
            $table->integer('working_hours')->nullable()->after('deadline');
            $table->integer('working_minutes')->nullable()->after('working_hours');
            $table->datetime('actual_start_time')->nullable()->after('working_minutes');
            $table->datetime('review_started_at')->nullable()->after('actual_start_time');
            $table->datetime('completed_at')->nullable()->after('review_started_at');
        });

        // Rename assigned_to -> assignee_id (drop FK, rename, re-add FK)
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['assigned_to']);
            $table->renameColumn('assigned_to', 'assignee_id');
        });
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreign('assignee_id')->references('id')->on('users')->nullOnDelete();
        });

        // Rename due_date -> deadline is handled above (deadline added, due_date kept for data migration)
        // Copy due_date data into deadline, then drop due_date
        DB::statement('UPDATE tasks SET deadline = due_date WHERE deadline IS NULL AND due_date IS NOT NULL');
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('due_date');
        });

        // Migrate task statuses: pending -> todo
        DB::table('tasks')->where('status', 'pending')->update(['status' => 'todo']);

        // Migrate task priorities: urgent -> high
        DB::table('tasks')->where('priority', 'urgent')->update(['priority' => 'high']);

        // Migrate project statuses: completed/on_hold/cancelled -> inactive
        DB::table('projects')
            ->whereIn('status', ['completed', 'on_hold', 'cancelled'])
            ->update(['status' => 'inactive']);
    }

    public function down(): void
    {
        // Revert project statuses
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['type', 'progress']);
        });

        // Revert task changes
        Schema::table('tasks', function (Blueprint $table) {
            $table->date('due_date')->nullable()->after('deadline');
        });
        DB::statement('UPDATE tasks SET due_date = DATE(deadline) WHERE deadline IS NOT NULL');

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['assignee_id']);
            $table->renameColumn('assignee_id', 'assigned_to');
        });
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreign('assigned_to')->references('id')->on('users')->nullOnDelete();
            $table->dropColumn([
                'progress', 'iteration_number', 'start_date', 'deadline',
                'working_hours', 'working_minutes', 'actual_start_time',
                'review_started_at', 'completed_at',
            ]);
        });

        DB::table('tasks')->where('status', 'todo')->update(['status' => 'pending']);
    }
};
