<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Task history and the redesign's task rules (design/HANDOFF_SPEC.md §8).
 *
 * The spec's new task columns map onto existing ones where they already
 * exist: scheduled_start_at = start_date, deadline_at = deadline,
 * estimate_minutes = working_hours * 60 + working_minutes, instructions =
 * description, timer_sessions = task_sessions. Only the missing pieces are
 * added here, and nothing existing is changed, so this can run before the new
 * code is deployed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            // Kept so KPIs can compare against what was first agreed.
            $table->dateTime('original_deadline')->nullable();
            $table->integer('original_estimate_minutes')->nullable();
            $table->timestamp('instructions_updated_at')->nullable();
            // Manager setting: "Can't start before scheduled time".
            $table->boolean('lock_early_start')->default(false);
            // Estimate 80% / 100% alerts already sent for the current estimate.
            $table->timestamp('estimate_warned_at')->nullable();
            $table->timestamp('estimate_reached_at')->nullable();
        });
        // Deleting a task keeps it (and its history) out of sight instead of
        // erasing it. The live table already has this column from its SQL import.
        if (!Schema::hasColumn('tasks', 'deleted_at')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        Schema::table('task_sessions', function (Blueprint $table) {
            $table->boolean('started_early')->default(false);
            $table->unsignedBigInteger('clash_task_id')->nullable();
        });

        // Append-only: there are no update or delete routes for these rows.
        Schema::create('task_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('task_id');
            $table->unsignedBigInteger('actor_id')->nullable(); // null = system
            $table->string('type', 40);
            $table->json('from')->nullable();
            $table->json('to')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['task_id', 'created_at']);
        });

        // Internal only: drives the once-per-task "read before you start" check.
        Schema::create('task_reads', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('task_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamp('read_at')->useCurrent();
            $table->timestamp('instructions_version')->nullable();
            $table->unique(['task_id', 'user_id']);
        });

        // Mirrors deadline_extension_requests, for more estimate time.
        Schema::create('estimate_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('task_id')->index();
            $table->unsignedBigInteger('requester_id');
            $table->integer('requested_minutes');
            $table->text('reason');
            $table->string('status', 20)->default('pending');
            $table->integer('approved_minutes')->nullable();
            $table->text('decision_reason')->nullable();
            $table->unsignedBigInteger('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
        });

        // Existing tasks: today's deadline and estimate become the originals.
        DB::table('tasks')->whereNotNull('deadline')->update(['original_deadline' => DB::raw('deadline')]);
        DB::table('tasks')
            ->where(fn ($q) => $q->whereNotNull('working_hours')->orWhereNotNull('working_minutes'))
            ->update(['original_estimate_minutes' => DB::raw('COALESCE(working_hours, 0) * 60 + COALESCE(working_minutes, 0)')]);

        // Mark estimate alerts that are already due as sent, so the first
        // scheduler run after deploying doesn't send a burst of old alerts.
        $now = now();
        DB::table('tasks')
            ->whereNotIn('status', ['completed'])
            ->where(fn ($q) => $q->where('working_hours', '>', 0)->orWhere('working_minutes', '>', 0))
            ->orderBy('id')
            ->chunk(500, function ($tasks) use ($now) {
                foreach ($tasks as $task) {
                    $estimate = ((int) $task->working_hours) * 60 + (int) $task->working_minutes;
                    $logged = (int) $task->time_spent;
                    if ($task->is_timer_running && $task->timer_start_time) {
                        $logged += max(0, (int) Carbon::parse($task->timer_start_time)->diffInSeconds($now));
                    }
                    $updates = [];
                    if ($logged >= $estimate * 60 * 0.8) {
                        $updates['estimate_warned_at'] = $now;
                    }
                    if ($logged >= $estimate * 60) {
                        $updates['estimate_reached_at'] = $now;
                    }
                    if ($updates) {
                        DB::table('tasks')->where('id', $task->id)->update($updates);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('estimate_requests');
        Schema::dropIfExists('task_reads');
        Schema::dropIfExists('task_events');
        Schema::table('task_sessions', function (Blueprint $table) {
            $table->dropColumn(['started_early', 'clash_task_id']);
        });
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn([
                'original_deadline', 'original_estimate_minutes', 'instructions_updated_at',
                'lock_early_start', 'estimate_warned_at', 'estimate_reached_at',
            ]);
            // deleted_at stays: the live table had it before this migration.
        });
    }
};
