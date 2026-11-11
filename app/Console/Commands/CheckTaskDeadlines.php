<?php

    namespace App\Console\Commands;

    use App\Models\Task;
    use App\Models\TaskEvent;
    use Illuminate\Console\Command;
    use Illuminate\Support\Facades\DB;
    use Illuminate\Support\Facades\Schema;
    use Throwable;

        class CheckTaskDeadlines extends Command
        {
            protected $signature = 'tasks:check-deadlines';
            protected $description = 'Mark overdue tasks as deadline_missed and stop their timers, send the final deadline warning, and log estimates reached';

            public function handle()
            {
                // Stopping timers at the deadline comes first, and each task is
                // handled on its own, so a failing reminder or one bad row can't
                // leave timers running past their deadline.
                $tasks = Task::whereNotNull('deadline')
                    ->where('deadline', '<=', now())
                    ->whereNotIn('status', Task::CLOSED_STATUSES)
                    ->get();

                $count = 0;
                foreach ($tasks as $task) {
                    try {
                        $count += $task->markDeadlineMissed() ? 1 : 0;
                    } catch (Throwable $e) {
                        report($e);
                    }
                }

                [, $warningCount] = $this->attempt(fn () => $this->sendReminders());
                [, $reachedCount] = $this->attempt(fn () => $this->checkEstimates());

                $this->info("Marked {$count} task(s) as deadline_missed. Sent {$warningCount} deadline warning(s); {$reachedCount} task(s) reached their estimate.");
                return 0;
            }

            /**
             * Warn the assignee once, shortly before the deadline: 10 minutes
             * before, or 5 for tasks 10 minutes long or shorter. The halfway
             * reminder was dropped (decided 2026-10-30).
             *
             * @return array{int, int} halfway (always 0) and final-warning counts
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
                $dueSoon = Task::whereNull('deadline_warning_notified_at')
                    ->whereNotNull('assignee_id')
                    ->whereNotIn('status', Task::CLOSED_STATUSES)
                    ->where('deadline', '>', $now)
                    ->where('deadline', '<=', $now->copy()->addMinutes(Task::WARNING_MINUTES))
                    ->get()
                    ->filter(fn (Task $task) => $task->deadline->lte($now->copy()->addMinutes($task->warningMinutes())));

                foreach ($dueSoon as $task) {
                    $task->notifyDeadlineWarning();
                    $task->update(['deadline_warning_notified_at' => $now]);
                }

                return [0, $dueSoon->count()];
            }

            /**
             * Running timers against the estimate (spec §7.8): reaching it is
             * written to the task's history. No notifications (the 80% and
             * "estimate reached" alerts were dropped, 2026-10-30). The timer
             * keeps running.
             *
             * @return array{int, int} warning (always 0) and reached counts
             */
            private function checkEstimates(): array
            {
                $now = now();
                $running = Task::where('is_timer_running', true)
                    ->whereNull('estimate_reached_at')
                    ->where(fn ($q) => $q->where('working_hours', '>', 0)->orWhere('working_minutes', '>', 0))
                    ->get();

                $reached = 0;
                foreach ($running as $task) {
                    $logged = $task->loggedSeconds();
                    if ($logged < $task->estimateMinutes() * 60) {
                        continue;
                    }
                    DB::transaction(function () use ($task, $now, $logged) {
                        $task->update(['estimate_reached_at' => $now, 'estimate_warned_at' => $task->estimate_warned_at ?? $now]);
                        TaskEvent::record($task, TaskEvent::ESTIMATE_REACHED, null, meta: [
                            'estimate_minutes' => $task->estimateMinutes(),
                            'logged_seconds' => $logged,
                        ]);
                    });
                    $reached++;
                }

                return [0, $reached];
            }

            /** @return array{int, int} */
            private function attempt(callable $step): array
            {
                try {
                    return $step();
                } catch (Throwable $e) {
                    report($e);
                    return [0, 0];
                }
            }
        }
