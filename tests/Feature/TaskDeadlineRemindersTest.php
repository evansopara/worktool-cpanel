<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\CreatesTaskTables;
use Tests\TestCase;

class TaskDeadlineRemindersTest extends TestCase
{
    use CreatesTaskTables;

    private User $assignee;
    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['services.webpush.public_key' => null, 'services.webpush.private_key' => null]);
        Carbon::setTestNow(Carbon::parse('2026-10-20 09:00:00'));

        // Task tables built like production, including the task history
        // migration; the reminder-flags migration is run per test.
        $this->createTaskTables();

        $this->assignee = User::forceCreate(['username' => 'staff', 'first_name' => 'Ada', 'email' => 'ada@example.com', 'password' => 'x']);
        $this->manager = User::forceCreate(['username' => 'pm', 'email' => 'pm@example.com', 'password' => 'x']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function migrateReminderFlags(): void
    {
        $this->artisan('migrate', ['--path' => 'database/migrations/2026_10_20_000001_add_deadline_reminder_flags_to_tasks_table.php']);
    }

    private function makeTask(string $start, string $deadline, string $status = 'in_progress'): Task
    {
        $project = \DB::table('projects')->insertGetId(['manager_id' => $this->manager->id]);

        return Task::create([
            'title' => 'Website mockup',
            'project_id' => $project,
            'assignee_id' => $this->assignee->id,
            'status' => $status,
            'start_date' => $start,
            'deadline' => $deadline,
        ]);
    }

    private function runAt(string $time): void
    {
        Carbon::setTestNow(Carbon::parse($time));
        $this->artisan('tasks:check-deadlines')->assertSuccessful();
    }

    /** @return string[] notification titles, oldest first */
    private function titlesFor(User $user): array
    {
        return Notification::where('user_id', $user->id)->orderBy('id')->pluck('title')->all();
    }

    public function test_two_hour_task_gets_one_warning_ten_minutes_before(): void
    {
        $this->migrateReminderFlags();
        $this->makeTask('2026-10-20 09:00:00', '2026-10-20 11:00:00');

        // No halfway reminder any more (2026-10-30).
        $this->runAt('2026-10-20 10:00:00');
        $this->runAt('2026-10-20 10:49:00');
        $this->assertSame([], $this->titlesFor($this->assignee));

        $this->runAt('2026-10-20 10:50:00');
        $this->runAt('2026-10-20 10:55:00');
        $this->assertSame(['Deadline in 10 minutes'], $this->titlesFor($this->assignee));

        $message = Notification::where('title', 'Deadline in 10 minutes')->value('message');
        $this->assertSame('"Website mockup" is due at 11:00 AM. Wrap up or submit it for review.', $message);
    }

    public function test_tasks_of_ten_minutes_or_less_are_warned_five_minutes_before(): void
    {
        $this->migrateReminderFlags();
        $this->makeTask('2026-10-20 09:00:00', '2026-10-20 09:08:00');

        $this->runAt('2026-10-20 09:02:00');
        $this->assertSame([], $this->titlesFor($this->assignee));

        $this->runAt('2026-10-20 09:03:00');
        $this->runAt('2026-10-20 09:05:00');
        $this->assertSame(['Deadline in 5 minutes'], $this->titlesFor($this->assignee));
    }

    public function test_reminders_are_assignee_only_and_not_emailed(): void
    {
        $this->migrateReminderFlags();
        $this->makeTask('2026-10-20 09:00:00', '2026-10-20 11:00:00');

        $this->runAt('2026-10-20 10:00:00');
        $this->runAt('2026-10-20 10:50:00');

        $this->assertSame([], $this->titlesFor($this->manager));
        Mail::assertNothingSent();
    }

    public function test_multi_day_task_gets_no_halfway_reminder(): void
    {
        $this->migrateReminderFlags();
        $this->makeTask('2026-10-20 09:00:00', '2026-10-22 09:00:00');

        $this->runAt('2026-10-21 09:00:00');

        $this->assertSame([], $this->titlesFor($this->assignee));
    }

    public function test_short_task_gets_only_the_final_warning(): void
    {
        $this->migrateReminderFlags();
        $this->makeTask('2026-10-20 09:00:00', '2026-10-20 09:15:00');

        $this->runAt('2026-10-20 09:05:00');
        $this->runAt('2026-10-20 09:08:00');
        $this->runAt('2026-10-20 09:12:00');

        $this->assertSame(['Deadline in 10 minutes'], $this->titlesFor($this->assignee));
    }

    public function test_closed_tasks_get_no_reminders(): void
    {
        $this->migrateReminderFlags();
        $this->makeTask('2026-10-20 09:00:00', '2026-10-20 11:00:00', 'completed');
        $this->makeTask('2026-10-20 09:00:00', '2026-10-20 11:00:00', 'review');

        $this->runAt('2026-10-20 10:00:00');
        $this->runAt('2026-10-20 10:55:00');

        $this->assertSame([], $this->titlesFor($this->assignee));
    }

    public function test_changing_the_deadline_lets_reminders_fire_again(): void
    {
        $this->migrateReminderFlags();
        $task = $this->makeTask('2026-10-20 09:00:00', '2026-10-20 11:00:00');

        $this->runAt('2026-10-20 10:50:00');
        $this->assertCount(1, $this->titlesFor($this->assignee));

        // Extension approved: the deadline moves to 13:00.
        $task->refresh()->update(['deadline' => '2026-10-20 13:00:00']);
        $this->assertNull($task->deadline_warning_notified_at);

        $this->runAt('2026-10-20 12:50:00');
        $this->assertSame(['Deadline in 10 minutes', 'Deadline in 10 minutes'], $this->titlesFor($this->assignee));
    }

    public function test_tasks_and_missed_deadlines_still_work_before_the_migration_runs(): void
    {
        $task = $this->makeTask('2026-10-20 09:00:00', '2026-10-20 11:00:00');
        $task->update(['deadline' => '2026-10-20 10:00:00']);

        $this->runAt('2026-10-20 10:01:00');

        $this->assertSame(['Deadline Missed'], $this->titlesFor($this->assignee));
    }

    public function test_migration_backfills_reminders_that_already_passed(): void
    {
        // Existing tasks at deploy time: one already past halfway, one inside
        // the final 10 minutes, one still before halfway.
        Carbon::setTestNow(Carbon::parse('2026-10-20 10:30:00'));
        $pastHalfway = $this->makeTask('2026-10-20 09:00:00', '2026-10-20 11:30:00');
        $inWarning = $this->makeTask('2026-10-20 09:00:00', '2026-10-20 10:35:00');
        $beforeHalfway = $this->makeTask('2026-10-20 10:00:00', '2026-10-20 14:00:00');

        $this->migrateReminderFlags();
        $this->runAt('2026-10-20 10:30:00');

        $this->assertSame([], $this->titlesFor($this->assignee));
        $this->assertNotNull($pastHalfway->refresh()->halfway_notified_at);
        $this->assertNull($pastHalfway->deadline_warning_notified_at);
        $this->assertNotNull($inWarning->refresh()->deadline_warning_notified_at);
        $this->assertNull($beforeHalfway->refresh()->halfway_notified_at);

        // The task that was already past halfway still gets its final warning
        // (and the one due at 10:35 has now genuinely missed its deadline).
        $this->runAt('2026-10-20 11:20:00');
        // Two different tasks, so the order doesn't matter.
        $this->assertEqualsCanonicalizing(['Deadline in 10 minutes', 'Deadline Missed'], $this->titlesFor($this->assignee));
    }
}
