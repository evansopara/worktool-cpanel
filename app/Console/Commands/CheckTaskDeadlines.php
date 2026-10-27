<?php

    namespace App\Console\Commands;

    use App\Models\Task;
    use App\Models\TaskEvent;
    use App\Services\NotificationService;
    use Illuminate\Console\Command;
    use Illuminate\Support\Facades\DB;
    use Illuminate\Support\Facades\Schema;

        class CheckTaskDeadlines extends Command
        {
            protected $signature = 'tasks:check-deadlines';
            protected $description = 'Send deadline reminders and estimate alerts, then mark overdue tasks as deadline_missed and stop their timers';

            public function handle()
            {
                [$halfwayCount, $warningCount] = $this->sendReminders();
                [$warnedCount, $reachedCount] = $this->checkEstimates();

                $tasks = Task::whereNotNull('deadline')
                    ->where('deadline', '<', now())
                    ->whereNotIn('status', Task::CLOSED_STATUSES)
                    ->get();

                $count = $tasks->filter(fn (Task $task) => $task->markDeadlineMissed())->count();

                $this->info("Sent {$halfwayCount} halfway and {$warningCount} final reminder(s), {$warnedCount} estimate warning(s) and {$reachedCount} estimate-reached alert(s). Marked {$count} task(s) as deadline_missed.");
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

            /**
             * Running timers against the estimate (spec §7.8): at 80% tell the
             * assignee; at 100% tell the managers and write it to the history.
             * The timer keeps running either way.
             *
             * @return array{int, int} warning and reached counts
             */
            private function checkEstimates(): array
            {
                $now = now();
                $running = Task::where('is_timer_running', true)
                    ->where(fn ($q) => $q->whereNull('estimate_warned_at')->orWhereNull('estimate_reached_at'))
                    ->where(fn ($q) => $q->where('working_hours', '>', 0)->orWhere('working_minutes', '>', 0))
                    ->with('project')
                    ->get();

                $warned = 0;
                $reached = 0;
                foreach ($running as $task) {
                    $budget = $task->estimateMinutes() * 60;
                    $logged = $task->loggedSeconds();

                    if ($logged >= $budget && !$task->estimate_reached_at) {
                        DB::transaction(function () use ($task, $now, $logged) {
                            $task->update(['estimate_reached_at' => $now, 'estimate_warned_at' => $task->estimate_warned_at ?? $now]);
                            TaskEvent::record($task, TaskEvent::ESTIMATE_REACHED, null, meta: [
                                'estimate_minutes' => $task->estimateMinutes(),
                                'logged_seconds' => $logged,
                            ]);
                        });
                        $managers = collect([$task->project->manager_id ?? null, $task->assigned_by])
                            ->filter()->unique()->reject(fn ($id) => $id === $task->assignee_id);
                        foreach ($managers as $managerId) {
                            NotificationService::send($managerId, 'task_estimate_reached', 'Estimate reached',
                                "\"{$task->title}\" has used its {$this->label($task->estimateMinutes())} estimate and the timer is still running.",
                                $task->id, 'task', email: false);
                        }
                        $reached++;
                    } elseif ($logged >= $budget * 0.8 && !$task->estimate_warned_at) {
                        $task->update(['estimate_warned_at' => $now]);
                        if ($task->assignee_id) {
                            NotificationService::send($task->assignee_id, 'task_estimate_warning', '80% of estimate used',
                                "You've used 80% of the {$this->label($task->estimateMinutes())} estimate on \"{$task->title}\".",
                                $task->id, 'task', email: false);
                        }
                        $warned++;
                    }
                }

                return [$warned, $reached];
            }

            /** 150 → "2h 30m". */
            private function label(int $minutes): string
            {
                $h = intdiv($minutes, 60);
                $m = $minutes % 60;
                return trim(($h ? "{$h}h " : '') . ($m ? "{$m}m" : ''));
            }
        }
