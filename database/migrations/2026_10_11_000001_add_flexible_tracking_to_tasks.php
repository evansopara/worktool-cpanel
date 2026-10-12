<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Technical-support tasks rarely fit a fixed estimate + hard deadline: they
// run long and get interrupted by urgent work. "Flexible" tasks keep their
// original estimate, log every revision, and record why each work session
// was paused, so managers can see estimate drift instead of missed deadlines.
return new class extends Migration {
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'is_flexible')) {
                $table->boolean('is_flexible')->default(false);
            }
            if (!Schema::hasColumn('tasks', 'original_estimate_minutes')) {
                $table->integer('original_estimate_minutes')->nullable();
            }
        });

        Schema::table('task_sessions', function (Blueprint $table) {
            if (!Schema::hasColumn('task_sessions', 'pause_reason')) {
                $table->string('pause_reason')->nullable();
            }
            if (!Schema::hasColumn('task_sessions', 'pause_note')) {
                $table->text('pause_note')->nullable();
            }
        });

        if (!Schema::hasTable('task_estimate_revisions')) {
            Schema::create('task_estimate_revisions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->integer('old_minutes')->nullable();
                $table->integer('new_minutes');
                $table->text('reason')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('task_estimate_revisions');

        Schema::table('task_sessions', function (Blueprint $table) {
            foreach (['pause_reason', 'pause_note'] as $col) {
                if (Schema::hasColumn('task_sessions', $col)) $table->dropColumn($col);
            }
        });

        Schema::table('tasks', function (Blueprint $table) {
            foreach (['is_flexible', 'original_estimate_minutes'] as $col) {
                if (Schema::hasColumn('tasks', $col)) $table->dropColumn($col);
            }
        });
    }
};
