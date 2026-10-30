<?php

namespace Tests\Feature;

use App\Models\DeadlineExtensionRequest;
use App\Models\Notification;
use App\Models\Task;
use App\Models\TaskEvent;
use App\Models\TaskRead;
use App\Models\TaskSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesTaskTables;
use Tests\TestCase;

/** Task rules and history from design/HANDOFF_SPEC.md §7–§9 (redesign step 3). */
class TaskRulesTest extends TestCase
{
    use CreatesTaskTables;

    private User $manager;
    private User $staff;
    private User $otherStaff;
    private int $projectId;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['services.webpush.public_key' => null, 'services.webpush.private_key' => null]);
        Carbon::setTestNow(Carbon::parse('2026-10-26 10:30:00'));

        $this->createTaskTables();
        $this->manager = User::forceCreate(['username' => 'ige', 'first_name' => 'Olubukola', 'last_name' => 'Ige', 'role' => 'operations_manager', 'password' => 'x']);
        $this->staff = User::forceCreate(['username' => 'victor', 'first_name' => 'Victor', 'last_name' => 'Adeleye', 'role' => 'staff', 'password' => 'x']);
        $this->otherStaff = User::forceCreate(['username' => 'ashe', 'first_name' => 'Asheoluwa', 'last_name' => 'Oke', 'role' => 'staff', 'password' => 'x']);
        $this->projectId = DB::table('projects')->insertGetId(['name' => 'WC Digital Agency', 'manager_id' => $this->manager->id]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function task(array $attrs = []): Task
    {
        return Task::create($attrs + [
            'title' => 'Website task',
            'project_id' => $this->projectId,
            'assignee_id' => $this->staff->id,
            'assigned_by' => $this->manager->id,
            'status' => 'todo',
            'start_date' => '2026-10-26 10:00:00',
            'deadline' => '2026-10-26 16:00:00',
            'working_hours' => 2,
            'working_minutes' => 0,
        ]);
    }

    private function types(Task $task): array
    {
        return TaskEvent::where('task_id', $task->id)->orderBy('id')->pluck('type')->all();
    }

    // ── Creating and editing ────────────────────────────────────────────

    public function test_manager_creates_a_task_and_history_records_it(): void
    {
        Sanctum::actingAs($this->manager);
        $id = $this->postJson('/api/tasks', [
            'title' => 'Homepage hero',
            'project_id' => $this->projectId,
            'assignee_id' => $this->staff->id,
            'deadline' => '2026-10-27 12:00:00',
            'working_hours' => 3,
        ])->assertCreated()->json('id');

        $task = Task::find($id);
        $this->assertSame([TaskEvent::CREATED, TaskEvent::ASSIGNED], $this->types($task));
        $this->assertSame(180, $task->original_estimate_minutes);
        $this->assertSame('2026-10-27 12:00:00', $task->original_deadline->format('Y-m-d H:i:s'));
    }

    public function test_staff_cannot_create_edit_or_delete_tasks(): void
    {
        $task = $this->task();
        Sanctum::actingAs($this->staff);
        $this->postJson('/api/tasks', ['title' => 'x', 'project_id' => $this->projectId])->assertForbidden();
        $this->patchJson("/api/tasks/{$task->id}", ['title' => 'y'])->assertForbidden();
        $this->deleteJson("/api/tasks/{$task->id}")->assertForbidden();
    }

    public function test_deadline_edit_without_a_reason_is_refused(): void
    {
        $task = $this->task();
        Sanctum::actingAs($this->manager);

        $this->patchJson("/api/tasks/{$task->id}", ['deadline' => '2026-10-27 16:00:00'])
            ->assertStatus(422)->assertJson(['code' => 'reason_required']);
        $this->patchJson("/api/tasks/{$task->id}", ['working_hours' => 4])
            ->assertStatus(422)->assertJson(['code' => 'reason_required']);

        $this->patchJson("/api/tasks/{$task->id}", ['deadline' => '2026-10-27 16:00:00', 'reason' => 'Client sent assets late'])
            ->assertOk();

        $event = TaskEvent::where('task_id', $task->id)->where('type', TaskEvent::FIELD_EDITED)->sole();
        $this->assertSame('deadline', $event->meta['field']);
        $this->assertSame('Client sent assets late', $event->meta['reason']);
        $this->assertStringStartsWith('2026-10-26T16:00:00', $event->from['value']);
        $this->assertStringStartsWith('2026-10-27T16:00:00', $event->to['value']);
        // The original deadline never changes.
        $this->assertSame('2026-10-26 16:00:00', $task->fresh()->original_deadline->format('Y-m-d H:i:s'));
    }

    public function test_each_changed_field_gets_its_own_history_entry(): void
    {
        $task = $this->task(['description' => 'Old steps']);
        Sanctum::actingAs($this->manager);

        $this->patchJson("/api/tasks/{$task->id}", [
            'title' => 'Website task v2',
            'description' => 'New steps',
            'assignee_id' => $this->otherStaff->id,
            'lock_early_start' => true,
        ])->assertOk();

        $events = TaskEvent::where('task_id', $task->id)->orderBy('id')->get();
        $this->assertSame([TaskEvent::ASSIGNED, TaskEvent::INSTRUCTIONS_EDITED, TaskEvent::FIELD_EDITED, TaskEvent::FIELD_EDITED], $events->pluck('type')->all());
        $this->assertSame(['title', 'lock_early_start'], $events->where('type', TaskEvent::FIELD_EDITED)->map(fn ($e) => $e->meta['field'])->values()->all());
        $this->assertSame('Asheoluwa Oke', $events[0]->to['name']);
        $this->assertNotNull($task->fresh()->instructions_updated_at);
    }

    public function test_deleting_keeps_the_task_and_its_history(): void
    {
        $task = $this->task();
        Sanctum::actingAs($this->manager);
        $this->deleteJson("/api/tasks/{$task->id}")->assertOk();

        $this->assertSoftDeleted('tasks', ['id' => $task->id]);
        $this->assertSame([TaskEvent::DELETED], $this->types($task));
        $this->getJson('/api/tasks?tab=all')->assertJsonPath('meta.total', 0);
    }

    // ── Starting the timer ──────────────────────────────────────────────

    public function test_only_the_assignee_can_start_the_timer(): void
    {
        $task = $this->task();
        Sanctum::actingAs($this->otherStaff);
        $this->postJson("/api/tasks/{$task->id}/timer/start")->assertForbidden()->assertJson(['code' => 'not_assignee']);
        Sanctum::actingAs($this->manager);
        $this->postJson("/api/tasks/{$task->id}/timer/start")->assertForbidden();
    }

    public function test_first_start_with_unread_instructions_needs_confirm_read(): void
    {
        $task = $this->task(['description' => 'Steps and links']);
        Sanctum::actingAs($this->staff);

        $this->postJson("/api/tasks/{$task->id}/timer/start")
            ->assertStatus(409)->assertJson(['code' => 'confirm_read', 'instructions' => 'Steps and links']);
        $this->assertFalse($task->fresh()->is_timer_running);

        $this->postJson("/api/tasks/{$task->id}/timer/start", ['confirm_read' => true])->assertOk();
        $this->assertTrue($task->fresh()->is_timer_running);
        $this->assertTrue(TaskRead::where('task_id', $task->id)->where('user_id', $this->staff->id)->exists());

        // Once per task: later starts don't ask again.
        $this->postJson("/api/tasks/{$task->id}/timer/stop")->assertOk();
        $this->postJson("/api/tasks/{$task->id}/timer/start")->assertOk();
    }

    public function test_opening_the_instructions_counts_as_read(): void
    {
        $task = $this->task(['description' => 'Steps']);
        Sanctum::actingAs($this->staff);
        $this->postJson("/api/tasks/{$task->id}/instructions/read")->assertOk();
        $this->postJson("/api/tasks/{$task->id}/timer/start")->assertOk();
    }

    public function test_early_start_without_confirmation_is_refused_and_shows_the_clash(): void
    {
        $now = $this->task(['title' => 'Logo files', 'start_date' => '2026-10-26 10:00:00', 'deadline' => '2026-10-26 12:00:00']);
        $later = $this->task(['title' => 'Website task', 'start_date' => '2026-10-26 13:01:00', 'deadline' => '2026-10-26 16:00:00']);
        Sanctum::actingAs($this->staff);

        $this->postJson("/api/tasks/{$later->id}/timer/start")
            ->assertStatus(409)
            ->assertJson(['code' => 'confirm_early', 'clash' => ['id' => $now->id, 'title' => 'Logo files']]);
        $this->assertFalse($later->fresh()->is_timer_running);

        $this->postJson("/api/tasks/{$later->id}/timer/start", ['confirm_early' => true])->assertOk();

        $session = TaskSession::where('task_id', $later->id)->sole();
        $this->assertTrue($session->started_early);
        $this->assertSame($now->id, $session->clash_task_id);
        $event = TaskEvent::where('task_id', $later->id)->where('type', TaskEvent::TIMER_STARTED)->sole();
        $this->assertSame(151, $event->meta['early_minutes']); // 2h 31m before 1:01 PM
        $this->assertSame('Logo files', $event->meta['clash_title']);
    }

    public function test_locked_tasks_cannot_start_early(): void
    {
        $task = $this->task(['start_date' => '2026-10-26 13:01:00', 'lock_early_start' => true]);
        Sanctum::actingAs($this->staff);
        $this->postJson("/api/tasks/{$task->id}/timer/start", ['confirm_early' => true])
            ->assertStatus(422)->assertJson(['code' => 'locked']);
    }

    public function test_in_review_tasks_can_restart_and_resubmit(): void
    {
        $task = $this->task();
        Sanctum::actingAs($this->staff);

        $this->postJson("/api/tasks/{$task->id}/timer/start")->assertOk();
        Carbon::setTestNow(now()->addMinutes(30));
        $this->postJson("/api/tasks/{$task->id}/submit")->assertOk();
        $this->assertSame('review', $task->fresh()->status);
        $this->assertSame(1800, $task->fresh()->time_spent);

        $this->postJson("/api/tasks/{$task->id}/timer/start")->assertOk();
        $this->assertSame('in_progress', $task->fresh()->status);
        $this->postJson("/api/tasks/{$task->id}/submit")->assertOk();
        $this->assertSame('review', $task->fresh()->status);

        $this->assertSame([
            TaskEvent::TIMER_STARTED, TaskEvent::TIMER_STOPPED, TaskEvent::SUBMITTED,
            TaskEvent::TIMER_RESTARTED, TaskEvent::TIMER_STARTED, TaskEvent::TIMER_STOPPED, TaskEvent::SUBMITTED,
        ], $this->types($task));
    }

    public function test_old_pages_submit_by_editing_the_status(): void
    {
        $task = $this->task();
        Sanctum::actingAs($this->staff);
        $this->putJson("/api/tasks/{$task->id}", ['status' => 'review'])->assertOk();
        $this->assertSame('review', $task->fresh()->status);
        $this->assertSame([TaskEvent::SUBMITTED], $this->types($task));

        // Any other edit by staff is still refused.
        $this->putJson("/api/tasks/{$task->id}", ['status' => 'completed'])->assertForbidden();
    }

    public function test_a_pending_extension_does_not_block_start_or_submit(): void
    {
        $task = $this->task();
        Sanctum::actingAs($this->staff);
        $this->postJson("/api/tasks/{$task->id}/extension-requests", [
            'requested_deadline' => '2026-10-27 11:00:00',
            'reason' => 'Waiting on client copy',
        ])->assertCreated();

        $this->postJson("/api/tasks/{$task->id}/timer/start")->assertOk();
        $this->postJson("/api/tasks/{$task->id}/submit")->assertOk();
        $this->assertSame(TaskEvent::EXTENSION_REQUESTED, $this->types($task)[0]);
    }

    // ── Requests ────────────────────────────────────────────────────────

    public function test_after_the_deadline_the_timer_and_submit_are_locked(): void
    {
        $task = $this->task(['deadline' => '2026-10-26 10:00:00', 'start_date' => '2026-10-26 09:00:00']);
        Sanctum::actingAs($this->staff);

        $this->postJson("/api/tasks/{$task->id}/timer/start", ['confirm_read' => true])->assertStatus(422)->assertJson(['code' => 'deadline_passed']);
        $this->postJson("/api/tasks/{$task->id}/submit")->assertStatus(422)->assertJson(['code' => 'deadline_passed']);
        $this->assertSame('deadline_missed', $task->fresh()->status);
    }

    public function test_stopping_after_the_deadline_finds_the_timer_already_stopped_by_the_system(): void
    {
        $task = $this->task(['deadline' => '2026-10-26 10:15:00', 'start_date' => '2026-10-26 09:00:00', 'is_timer_running' => true, 'timer_start_time' => '2026-10-26 10:00:00']);
        Sanctum::actingAs($this->staff);

        $this->postJson("/api/tasks/{$task->id}/timer/stop")->assertStatus(422)->assertJson(['code' => 'not_running']);
        $task->refresh();
        $this->assertFalse($task->is_timer_running);
        $this->assertSame('deadline_missed', $task->status);
    }

    public function test_only_one_timer_runs_at_a_time(): void
    {
        $running = $this->task(['title' => 'Homepage copy', 'is_timer_running' => true, 'timer_start_time' => now(), 'status' => 'in_progress']);
        $next = $this->task(['title' => 'Logo']);
        Sanctum::actingAs($this->staff);

        $this->postJson("/api/tasks/{$next->id}/timer/start")
            ->assertStatus(422)
            ->assertJson(['code' => 'other_running', 'running_task' => ['id' => $running->id]]);
        $this->assertFalse($next->fresh()->is_timer_running);
    }

    public function test_a_deadline_before_the_start_is_refused(): void
    {
        Sanctum::actingAs($this->manager);
        $this->postJson('/api/tasks', [
            'title' => 'Backwards', 'project_id' => $this->projectId, 'assignee_id' => $this->staff->id,
            'start_date' => '2026-10-27 12:00:00', 'deadline' => '2026-10-27 09:00:00',
        ])->assertStatus(422)->assertJson(['code' => 'deadline_before_start']);

        $task = $this->task();
        $this->putJson("/api/tasks/{$task->id}", ['start_date' => '2026-10-26 17:00:00'])
            ->assertStatus(422)->assertJson(['code' => 'deadline_before_start']);
    }

    public function test_the_deadline_check_stops_timers_even_if_reminders_fail(): void
    {
        $task = $this->task(['deadline' => '2026-10-26 10:15:00', 'is_timer_running' => true, 'timer_start_time' => '2026-10-26 10:00:00']);
        // Reminders and estimate checks need columns this table may not have.
        \Illuminate\Support\Facades\Schema::table('tasks', fn ($t) => $t->dropColumn('estimate_warned_at'));

        $this->artisan('tasks:check-deadlines')->assertSuccessful();
        $this->assertFalse($task->fresh()->is_timer_running);
        $this->assertSame('deadline_missed', $task->fresh()->status);
    }

    public function test_approved_extension_moves_the_deadline_but_not_the_original(): void
    {
        $task = $this->task();
        Sanctum::actingAs($this->staff);
        $reqId = $this->postJson("/api/tasks/{$task->id}/extension-requests", [
            'requested_deadline' => '2026-10-27 11:00:00',
            'reason' => 'Client delay',
        ])->json('id');
        $this->assertSame($this->manager->id, DeadlineExtensionRequest::find($reqId)->project_manager_id);

        $this->patchJson("/api/tasks/{$task->id}/extension-requests/{$reqId}", ['status' => 'approved'])->assertForbidden();

        Sanctum::actingAs($this->manager);
        $this->patchJson("/api/tasks/{$task->id}/extension-requests/{$reqId}", ['status' => 'approved'])->assertOk();

        $task->refresh();
        $this->assertSame('2026-10-27 11:00:00', $task->deadline->format('Y-m-d H:i:s'));
        $this->assertSame('2026-10-26 16:00:00', $task->original_deadline->format('Y-m-d H:i:s'));
        $this->assertSame(TaskEvent::EXTENSION_APPROVED, $this->types($task)[1]);
        $this->assertSame(['Deadline Extension Approved'], Notification::where('user_id', $this->staff->id)->pluck('title')->all());
    }

    public function test_approved_estimate_request_is_logged_as_an_estimate_edit(): void
    {
        $task = $this->task();
        Sanctum::actingAs($this->staff);
        $reqId = $this->postJson("/api/tasks/{$task->id}/estimate-requests", ['requested_minutes' => 150, 'reason' => 'More pages'])
            ->assertCreated()->json('id');

        Sanctum::actingAs($this->manager);
        $this->patchJson("/api/tasks/{$task->id}/estimate-requests/{$reqId}", ['status' => 'approved'])->assertOk();

        $this->assertSame(150, $task->fresh()->estimateMinutes());
        $event = TaskEvent::where('task_id', $task->id)->where('type', TaskEvent::ESTIMATE_APPROVED)->sole();
        $this->assertSame(['estimate_minutes' => 120], $event->from);
        $this->assertSame(['estimate_minutes' => 150], $event->to);
    }

    public function test_review_flow_approve_and_send_back(): void
    {
        $task = $this->task(['status' => 'review']);
        Sanctum::actingAs($this->manager);
        $this->postJson("/api/tasks/{$task->id}/send-back", ['reason' => 'Fix the footer'])->assertOk();
        $this->assertSame('not_approved', $task->fresh()->status);
        $this->postJson("/api/tasks/{$task->id}/approve")->assertOk();
        $this->assertSame('completed', $task->fresh()->status);
        $this->assertNotNull($task->fresh()->completed_at);
        $this->assertSame([TaskEvent::SENT_BACK, TaskEvent::APPROVED], $this->types($task));
    }

    // ── Scheduled job ───────────────────────────────────────────────────

    public function test_missed_deadline_is_written_by_the_system_with_a_cause(): void
    {
        $idle = $this->task(['title' => 'Never started', 'deadline' => '2026-10-26 10:00:00']);
        $running = $this->task(['title' => 'Running', 'deadline' => '2026-10-26 11:00:00']);
        Sanctum::actingAs($this->staff);
        $this->postJson("/api/tasks/{$running->id}/timer/start")->assertOk();

        Carbon::setTestNow('2026-10-26 11:01:00');
        $this->artisan('tasks:check-deadlines')->assertSuccessful();

        $missed = TaskEvent::where('type', TaskEvent::DEADLINE_MISSED)->get()->keyBy('task_id');
        $this->assertNull($missed[$idle->id]->actor_id);
        $this->assertSame('not_started', $missed[$idle->id]->meta['cause']);
        $this->assertTrue($missed[$running->id]->meta['timer_running']);
        $this->assertFalse($running->fresh()->is_timer_running);
        $stopped = TaskEvent::where('task_id', $running->id)->where('type', TaskEvent::TIMER_STOPPED)->sole();
        $this->assertTrue($stopped->meta['by_system']);
    }

    public function test_estimate_alerts_at_80_and_100_percent(): void
    {
        $task = $this->task(['deadline' => '2026-10-26 18:00:00', 'working_hours' => 1, 'working_minutes' => 0]);
        Sanctum::actingAs($this->staff);
        $this->postJson("/api/tasks/{$task->id}/timer/start")->assertOk();

        Carbon::setTestNow(now()->addMinutes(48));
        $this->artisan('tasks:check-deadlines')->assertSuccessful();
        $this->assertSame(['80% of estimate used'], Notification::where('user_id', $this->staff->id)->pluck('title')->all());

        Carbon::setTestNow(now()->addMinutes(12));
        $this->artisan('tasks:check-deadlines')->assertSuccessful();
        $this->artisan('tasks:check-deadlines')->assertSuccessful();
        $this->assertSame(['Estimate reached'], Notification::where('user_id', $this->manager->id)->pluck('title')->all());
        $this->assertSame(1, TaskEvent::where('type', TaskEvent::ESTIMATE_REACHED)->count());
        $this->assertTrue($task->fresh()->is_timer_running, 'the timer keeps running past the estimate');
    }

    // ── List, history and export ────────────────────────────────────────

    public function test_list_pages_by_ten_with_a_total(): void
    {
        foreach (range(1, 27) as $i) {
            $this->task(['title' => "Task {$i}"]);
        }
        Sanctum::actingAs($this->manager);

        $this->getJson('/api/tasks?tab=all&page=2')
            ->assertOk()
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('meta.total', 27)
            ->assertJsonPath('meta.page', 2)
            ->assertJsonPath('meta.last_page', 3);
        $this->getJson('/api/tasks?tab=all&page=3')->assertJsonCount(7, 'data');

        // Mobile cards get a short one-line preview of the instructions.
        $this->task(['title' => 'Briefed', 'description' => "Step one.\n\nStep two."]);
        $item = collect($this->getJson('/api/tasks?tab=all&q=Briefed')->json('data'))->first();
        $this->assertSame('Step one. Step two.', $item['instructions_preview']);
        $this->assertTrue($item['has_instructions']);

        // Without page or tab, the old array response is unchanged.
        $this->assertCount(28, $this->getJson('/api/tasks')->json());
    }

    public function test_list_filters_by_tab_search_and_date_range(): void
    {
        $this->task(['title' => 'Logo files', 'start_date' => '2026-10-20 09:00:00', 'deadline' => '2026-10-21 17:00:00']);
        $this->task(['title' => 'Checkout flow', 'start_date' => '2026-10-26 09:00:00', 'deadline' => '2026-10-28 17:00:00']);
        $this->task(['title' => 'Old report', 'status' => 'completed', 'start_date' => '2026-10-01 09:00:00', 'deadline' => '2026-10-02 17:00:00']);
        $this->task(['title' => 'Not mine', 'assignee_id' => $this->otherStaff->id]);

        Sanctum::actingAs($this->staff);
        $titles = fn (string $qs) => collect($this->getJson("/api/tasks?{$qs}")->assertOk()->json('data'))->pluck('title')->sort()->values()->all();

        $this->assertSame(['Checkout flow', 'Logo files'], $titles('tab=active'));
        $this->assertSame(['Old report'], $titles('tab=completed'));
        $this->assertSame(['Checkout flow'], $titles('tab=active&q=checkout'));
        $this->assertSame(['Checkout flow', 'Logo files'], $titles('tab=active&q=agency')); // project name
        $this->assertSame(['Checkout flow', 'Logo files'], $titles('tab=active&q=adeleye')); // assignee name
        // Overlap: the window 22–27 Oct catches the task running 26–28 Oct only.
        $this->assertSame(['Checkout flow'], $titles('tab=active&from=2026-10-22&to=2026-10-27'));
    }

    public function test_history_lists_events_newest_first_with_summary_and_filters(): void
    {
        $task = $this->task(['start_date' => '2026-10-26 10:00:00']);
        Sanctum::actingAs($this->staff);
        Carbon::setTestNow('2026-10-26 10:20:00');
        $this->postJson("/api/tasks/{$task->id}/timer/start")->assertOk();
        Carbon::setTestNow('2026-10-26 11:00:00');
        $this->postJson("/api/tasks/{$task->id}/timer/stop")->assertOk();

        $res = $this->getJson("/api/tasks/{$task->id}/events")->assertOk();
        $this->assertSame([TaskEvent::TIMER_STOPPED, TaskEvent::TIMER_STARTED], array_column($res->json('data'), 'type'));
        $this->assertSame('Victor Adeleye', $res->json('data.0.actor.name'));
        $this->assertSame(['seconds' => 2400, 'sessions' => 1], $res->json('summary.worked'));
        $this->assertSame(['state' => 'late', 'minutes' => 20], $res->json('summary.start'));

        $this->assertCount(0, $this->getJson("/api/tasks/{$task->id}/events?type=edits")->json('data'));
        $this->assertCount(2, $this->getJson("/api/tasks/{$task->id}/events?type=sessions")->json('data'));

        Sanctum::actingAs($this->otherStaff);
        $this->getJson("/api/tasks/{$task->id}/events")->assertForbidden();
    }

    public function test_assigning_while_creating_is_not_counted_as_a_change(): void
    {
        Sanctum::actingAs($this->manager);
        $id = $this->postJson('/api/tasks', ['title' => 'Logo', 'project_id' => $this->projectId, 'assignee_id' => $this->staff->id])->assertCreated()->json('id');
        $this->assertSame(0, $this->getJson("/api/tasks/{$id}/events")->json('summary.changes.edits'));

        Carbon::setTestNow('2026-10-26 12:00:00');
        $this->putJson("/api/tasks/{$id}", ['title' => 'Logo files'])->assertOk();
        $this->assertSame(1, $this->getJson("/api/tasks/{$id}/events")->json('summary.changes.edits'));
    }

    public function test_export_covers_every_matching_task(): void
    {
        foreach (range(1, 12) as $i) {
            $this->task(['title' => "Task {$i}"]);
        }
        Sanctum::actingAs($this->manager);

        $json = $this->getJson('/api/tasks/export?format=json&tab=all')->assertOk();
        $this->assertCount(12, $json->json('rows'));
        $this->assertSame('2h 00m', $json->json('rows.0.7'));

        $csv = $this->get('/api/tasks/export?format=csv&tab=all')->assertOk()->streamedContent();
        $this->assertSame(13, count(array_filter(explode("\n", trim($csv)))));

        $xlsx = $this->get('/api/tasks/export?format=xlsx&tab=all')->assertOk();
        $file = $xlsx->baseResponse->getFile()->getPathname();
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($file) === true);
        $this->assertStringContainsString('Task 12', $zip->getFromName('xl/worksheets/sheet1.xml'));
        $zip->close();
    }
}
