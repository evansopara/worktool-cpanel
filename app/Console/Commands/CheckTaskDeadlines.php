<?php

    namespace App\Console\Commands;

    use App\Models\Task;
    use App\Models\TaskSession;
    use Illuminate\Console\Command;
    use Illuminate\Support\Facades\Schema;
    use Carbon\Carbon;

        class CheckTaskDeadlines extends Command
        {
            protected $signature = 'tasks:check-deadlines';
            protected $description = 'Send halfway and final deadline reminders, then auto-mark overdue tasks as deadline_missed and stop their timers';

            public function handle()
            {
                [$halfwayCount, $warningCount] = $this->sendReminders();

                $tasks = Task::whereNotNull('deadline')
                    ->where('deadline', '<', now())
                    ->whereNotIn('status', Task::CLOSED_STATUSES)
                    ->get();

                $count = 0;
                foreach ($tasks as $task) {
                    if ($task->is_timer_running && $task->timer_start_time) {
                        $elapsed = (int) Carbon::parse($task->timer_start_time)->diffInSeconds(now());
                        $session = TaskSession::where('task_id', $task->id)
                            ->whereNull('ended_at')
                            ->latest()
                            ->first();
                        if ($session) {
                            $session->update(['ended_at' => now(), 'duration_seconds' => $elapsed]);
                        }
                        $task->update([
                            'is_timer_running' => false,
                            'timer_start_time' => null,
                            'timer_stopped_at' => now(),
                            'time_spent' => ($task->time_spent ?? 0) + $elapsed,
                            'status' => 'deadline_missed',
                        ]);
                    } else {
                        $task->update(['status' => 'deadline_missed']);
                    }
                    $task->notifyDeadlineMissed();
                    $count++;
                }

                $this->info("Sent {$halfwayCount} halfway and {$warningCount} final reminder(s). Marked {$count} task(s) as deadline_missed.");
                return 0;
            }

            /**
             * Remind assignees once when a task is halfway between its start and
             * its deadline, and once more shortly before the deadline.
             *
             * @return array{int, int} halfway and final-warning counts
             */
            private function sendReminders(): array
            {
                // Code can go live before the reminder columns are added (the
                // migration is run by hand on cPanel); keep marking missed
                // deadlines in the meantime.
                if (!Schema::hasColumn('tasks', 'deadline_warning_notified_at')) {
                    return [0, 0];
                }

                $now = now();
                $warnFrom = $now->copy()->addMinutes(Task::WARNING_MINUTES);

                // Final warning first: a task already inside the warning window
                // skips its halfway reminder.
                $dueSoon = Task::whereNull('deadline_warning_notified_at')
                    ->whereNotNull('assignee_id')
                    ->whereNotIn('status', Task::CLOSED_STATUSES)
                    ->where('deadline', '>', $now)
                    ->where('deadline', '<=', $warnFrom)
                    ->get();

                foreach ($dueSoon as $task) {
                    $task->notifyDeadlineWarning();
                    $task->update([
                        'deadline_warning_notified_at' => $now,
                        'halfway_notified_at' => $task->halfway_notified_at ?? $now,
                    ]);
                }

                $halfwayDue = Task::whereNull('halfway_notified_at')
                    ->whereNotNull('assignee_id')
                    ->whereNotIn('status', Task::CLOSED_STATUSES)
                    ->where('deadline', '>', $warnFrom)
                    ->get()
                    ->filter(fn (Task $task) => $task->halfwayPoint()->lte($now));

                foreach ($halfwayDue as $task) {
                    $task->notifyHalfway();
                    $task->update(['halfway_notified_at' => $now]);
                }

                return [$halfwayDue->count(), $dueSoon->count()];
            }
        }