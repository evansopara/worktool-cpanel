<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Task;
use App\Models\TaskSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FlexibleTaskTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;
    private User $tech;
    private User $dev;
    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        Http::fake();

        $this->manager = $this->makeUser('ops', 'operations_manager');
        $this->tech = $this->makeUser('tech', 'staff', 'technical_support');
        $this->dev = $this->makeUser('dev', 'staff', 'development');
        $this->project = Project::create(['name' => 'Infra', 'manager_id' => $this->manager->id]);
    }

    private function makeUser(string $username, string $role, ?string $specialization = null): User
    {
        return User::create([
            'username' => $username,
            'email' => "{$username}@example.com",
            'password' => bcrypt('secret'),
            'first_name' => ucfirst($username),
            'last_name' => 'Test',
            'role' => $role,
            'specialization' => $specialization,
            'is_active' => true,
        ]);
    }

    private function createTask(User $assignee, array $extra = []): Task
    {
        Sanctum::actingAs($this->manager);
        $res = $this->postJson('/api/tasks', array_merge([
            'title' => 'Fix server',
            'project_id' => $this->project->id,
            'assignee_id' => $assignee->id,
            'working_hours' => 2,
            'working_minutes' => 0,
        ], $extra))->assertCreated();

        return Task::findOrFail($res->json('id'));
    }

    public function test_tasks_for_tech_support_are_flexible_with_original_estimate(): void
    {
        $task = $this->createTask($this->tech);
        $this->assertTrue($task->is_flexible);
        $this->assertSame(120, $task->original_estimate_minutes);

        $this->assertFalse($this->createTask($this->dev)->is_flexible);
    }

    public function test_deadline_sweep_skips_flexible_tasks(): void
    {
        $flex = $this->createTask($this->tech, ['deadline' => now()->subHour()->toDateTimeString()]);
        $rigid = $this->createTask($this->dev, ['deadline' => now()->subHour()->toDateTimeString()]);

        Artisan::call('tasks:check-deadlines');

        $this->assertNotSame('deadline_missed', $flex->fresh()->status);
        $this->assertSame('deadline_missed', $rigid->fresh()->status);
    }

    public function test_pausing_flexible_task_requires_reason(): void
    {
        $task = $this->createTask($this->tech);
        Sanctum::actingAs($this->tech);

        $this->postJson("/api/tasks/{$task->id}/timer/start")->assertOk();
        $this->postJson("/api/tasks/{$task->id}/timer/stop")->assertStatus(422);
        $this->postJson("/api/tasks/{$task->id}/timer/stop", [
            'pause_reason' => 'urgent_request',
            'pause_note' => 'Email server down',
        ])->assertOk();

        $session = TaskSession::where('task_id', $task->id)->first();
        $this->assertSame('urgent_request', $session->pause_reason);
        $this->assertSame('Email server down', $session->pause_note);
    }

    public function test_revising_estimate_keeps_history_and_notifies(): void
    {
        $task = $this->createTask($this->tech);
        Sanctum::actingAs($this->tech);

        $this->postJson("/api/tasks/{$task->id}/estimate", ['hours' => 4, 'minutes' => 0, 'reason' => 'Bigger than expected'])->assertOk();
        $this->postJson("/api/tasks/{$task->id}/estimate", ['hours' => 6, 'minutes' => 30, 'reason' => 'Vendor issue'])->assertOk();

        $task->refresh();
        $this->assertSame(120, $task->original_estimate_minutes);
        $this->assertSame(390, $task->estimateMinutes());
        $this->assertSame(2, $task->estimateRevisions()->count());
        $this->assertDatabaseHas('notifications', ['user_id' => $this->manager->id, 'type' => 'task_estimate_revised']);

        Sanctum::actingAs($this->dev);
        $this->postJson("/api/tasks/{$task->id}/estimate", ['hours' => 1, 'minutes' => 0, 'reason' => 'x'])->assertForbidden();
    }

    public function test_estimate_drift_report(): void
    {
        $task = $this->createTask($this->tech);
        Sanctum::actingAs($this->tech);
        $this->postJson("/api/tasks/{$task->id}/estimate", ['hours' => 3, 'minutes' => 0, 'reason' => 'More work'])->assertOk();
        TaskSession::create([
            'task_id' => $task->id, 'user_id' => $this->tech->id,
            'started_at' => now()->subHours(3), 'ended_at' => now(),
            'duration_seconds' => 3 * 3600, 'pause_reason' => 'blocked',
        ]);

        $this->getJson('/api/kpi-report/estimate-drift')->assertForbidden();

        Sanctum::actingAs($this->manager);
        $res = $this->getJson('/api/kpi-report/estimate-drift')->assertOk();

        $row = $res->json('tasks.0');
        $this->assertSame(120, $row['original_minutes']);
        $this->assertSame(180, $row['current_minutes']);
        $this->assertSame(180, $row['actual_minutes']);
        $this->assertSame(50, $row['drift_pct']);
        $this->assertSame(1, $row['revision_count']);
        $this->assertSame(['blocked' => 1], $row['pause_reasons']);
        $this->assertSame('blocked', $res->json('summary.0.top_pause_reason'));
    }
}
