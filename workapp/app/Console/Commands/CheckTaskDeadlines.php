<?php

    namespace App\Console\Commands;

    use App\Models\Task;
    use App\Models\TaskSession;
    use Illuminate\Console\Command;
    use Carbon\Carbon;

        class CheckTaskDeadlines extends Command
        {
            protected $signature = 'tasks:check-deadlines';
            protected $description = 'Auto-mark overdue tasks as deadline_missed and stop their timers';

            public function handle()
            {
                $tasks = Task::whereNotNull('deadline')
                    ->where('deadline', '<', now())
                    ->whereNotIn('status', ['review', 'completed', 'not_approved', 'deadline_missed'])
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

                $this->info("Marked {$count} task(s) as deadline_missed.");
                return 0;
            }
        }