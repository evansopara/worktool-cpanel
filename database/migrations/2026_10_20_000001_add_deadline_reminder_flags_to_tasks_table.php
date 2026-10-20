<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->timestamp('halfway_notified_at')->nullable();
            $table->timestamp('deadline_warning_notified_at')->nullable();
        });

        // Mark reminders whose moment has already passed as sent, so the first
        // scheduler run after deploying doesn't push a halfway reminder for
        // every task that's already in progress.
        $now = now();
        DB::table('tasks')
            ->whereNotNull('deadline')
            ->whereNotIn('status', ['review', 'completed', 'not_approved', 'deadline_missed'])
            ->orderBy('id')
            ->chunk(500, function ($tasks) use ($now) {
                foreach ($tasks as $task) {
                    $deadline = Carbon::parse($task->deadline);
                    $start = Carbon::parse($task->start_date ?? $task->created_at ?? $deadline);
                    $halfway = $start->copy()->addSeconds(intdiv(max(0, (int) $start->diffInSeconds($deadline)), 2));

                    $updates = [];
                    if ($halfway->lte($now)) {
                        $updates['halfway_notified_at'] = $now;
                    }
                    if ($deadline->copy()->subMinutes(10)->lte($now)) {
                        $updates['halfway_notified_at'] = $now;
                        $updates['deadline_warning_notified_at'] = $now;
                    }
                    if ($updates) {
                        DB::table('tasks')->where('id', $task->id)->update($updates);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn(['halfway_notified_at', 'deadline_warning_notified_at']);
        });
    }
};
