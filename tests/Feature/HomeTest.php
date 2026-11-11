<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesTaskTables;
use Tests\TestCase;

/** GET /home (redesign step 5). */
class HomeTest extends TestCase
{
    use CreatesTaskTables;

    private User $ops;
    private User $pm;
    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['services.webpush.public_key' => null, 'services.webpush.private_key' => null]);
        Carbon::setTestNow(Carbon::parse('2026-10-27 12:00:00'));
        $this->createTaskTables();

        Schema::table('projects', function (Blueprint $t) {
            $t->string('category')->nullable();
            $t->unsignedTinyInteger('progress')->default(0);
            $t->unsignedBigInteger('client_id')->nullable();
        });
        Schema::create('project_members', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('project_id');
            $t->unsignedBigInteger('user_id');
            $t->timestamps();
        });
        foreach (['leave_applications' => 'user_id', 'complaints' => 'submitter_id', 'staff_complaints' => 'submitter_id'] as $table => $owner) {
            Schema::create($table, function (Blueprint $t) use ($owner) {
                $t->id();
                $t->unsignedBigInteger($owner)->nullable();
                $t->string('status')->default('pending');
                $t->timestamps();
            });
        }

        $this->ops = User::forceCreate(['username' => 'ige', 'first_name' => 'Olubukola', 'last_name' => 'Ige', 'role' => 'operations_manager', 'password' => 'x']);
        $this->pm = User::forceCreate(['username' => 'titi', 'first_name' => 'Adeyemo', 'last_name' => 'Titilope', 'role' => 'project_manager', 'password' => 'x']);
        $this->staff = User::forceCreate(['username' => 'victor', 'first_name' => 'Victor', 'last_name' => 'Adeleye', 'role' => 'staff', 'password' => 'x']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function project(string $name, int $progress = 0): int
    {
        return DB::table('projects')->insertGetId(['name' => $name, 'manager_id' => $this->pm->id, 'category' => 'dpl_outright', 'progress' => $progress]);
    }

    private function task(int $project, array $attrs = []): Task
    {
        return Task::create($attrs + [
            'title' => 'Task', 'project_id' => $project, 'assignee_id' => $this->staff->id, 'assigned_by' => $this->pm->id,
            'status' => 'todo', 'start_date' => '2026-10-27 13:00:00', 'deadline' => '2026-10-27 17:00:00',
        ]);
    }

    public function test_manager_sees_counts_needs_and_pipeline(): void
    {
        $running = $this->project('TopMart');
        $this->task($running, ['status' => 'in_progress']);
        $this->task($running, ['status' => 'review']);
        $this->project('Temitope Oyewole');                       // no tasks → pending
        $stale = $this->project('SALAMAT');
        $old = $this->task($stale, ['status' => 'todo']);
        DB::table('tasks')->where('id', $old->id)->update(['updated_at' => now()->subDays(9)]);
        $this->project('QueenbodySecret', 100);                   // completed

        DB::table('leave_applications')->insert([['user_id' => $this->staff->id, 'status' => 'pending'], ['user_id' => $this->pm->id, 'status' => 'approved']]);
        DB::table('complaints')->insert([['status' => 'pending'], ['status' => 'pending']]);
        DB::table('staff_complaints')->insert([['status' => 'reviewed']]);

        Sanctum::actingAs($this->ops);
        $res = $this->getJson('/api/home')->assertOk();

        $res->assertJsonPath('status_counts.in_progress', 1)
            ->assertJsonPath('status_counts.review', 1)
            ->assertJsonPath('status_counts.todo', 1);
        $needs = collect($res->json('needs'))->keyBy('key');
        $this->assertSame(['leave', 'client_complaints'], $needs->keys()->all());
        $this->assertSame('Victor Adeleye', $needs['leave']['detail']);
        $this->assertSame('Complaints #1 and #2', $needs['client_complaints']['detail']);

        $this->assertSame(['TopMart'], array_column($res->json('pipeline.active.items'), 'name'));
        $this->assertSame(2, $res->json('pipeline.pending.total'));
        $this->assertSame(
            ['No tasks assigned', 'No work activity for 1+ week'],
            collect($res->json('pipeline.pending.items'))->sortBy('name')->reverse()->pluck('flag')->values()->all(),
        );
        $this->assertSame(['QueenbodySecret'], array_column($res->json('pipeline.completed.items'), 'name'));
    }

    public function test_project_manager_only_sees_extensions_sent_to_them(): void
    {
        $p = $this->project('Contour Fajaas Africa');
        $t = $this->task($p);
        DB::table('deadline_extension_requests')->insert([
            ['task_id' => $t->id, 'requester_id' => $this->staff->id, 'project_manager_id' => $this->pm->id, 'requested_deadline' => '2026-10-29 11:00:00', 'status' => 'pending'],
            ['task_id' => $t->id, 'requester_id' => $this->staff->id, 'project_manager_id' => $this->ops->id, 'requested_deadline' => '2026-10-29 11:00:00', 'status' => 'pending'],
        ]);
        DB::table('leave_applications')->insert(['user_id' => $this->staff->id, 'status' => 'pending']);

        Sanctum::actingAs($this->pm);
        $needs = $this->getJson('/api/home')->assertOk()->json('needs');
        // PMs decide only their own requests and don't review leave.
        $this->assertSame([['key' => 'extensions', 'count' => 1]], array_map(fn ($n) => ['key' => $n['key'], 'count' => $n['count']], $needs));
        $this->assertSame('Victor Adeleye · Contour Fajaas Africa', $needs[0]['detail']);
    }

    public function test_staff_get_their_current_task_and_extension(): void
    {
        $p = $this->project('WC Digital Agency');
        $this->task($p, ['title' => 'Long missed', 'status' => 'deadline_missed', 'start_date' => '2026-10-20 09:00:00', 'deadline' => '2026-10-20 12:00:00']);
        $this->task($p, ['title' => 'Later', 'start_date' => '2026-10-28 09:00:00', 'deadline' => '2026-10-28 12:00:00']);
        $next = $this->task($p, ['title' => 'Next up']);
        $this->task($p, ['title' => 'Someone else', 'assignee_id' => $this->pm->id, 'is_timer_running' => true]);
        DB::table('deadline_extension_requests')->insert(['task_id' => $next->id, 'requester_id' => $this->staff->id, 'project_manager_id' => $this->pm->id, 'requested_deadline' => '2026-10-29 11:00:00', 'status' => 'pending']);

        Sanctum::actingAs($this->staff);
        $res = $this->getJson('/api/home')->assertOk();
        $res->assertJsonPath('current.title', 'Next up')
            ->assertJsonPath('extension.task_title', 'Next up')
            ->assertJsonPath('extension.status', 'pending')
            ->assertJsonPath('status_counts.todo', 2)
            ->assertJsonMissingPath('needs');

        // A running timer wins over the schedule.
        Task::where('title', 'Later')->update(['is_timer_running' => true, 'timer_start_time' => now()]);
        $this->getJson('/api/home')->assertJsonPath('current.title', 'Later');
    }

    public function test_home_my_tasks_toggle_filters_by_state(): void
    {
        $p = $this->project('WC Digital Agency');
        $this->task($p, ['title' => 'Open']);
        $this->task($p, ['title' => 'Done', 'status' => 'completed']);

        Sanctum::actingAs($this->pm);
        $titles = fn (string $state) => array_column($this->getJson("/api/tasks?tab=mine&state={$state}")->json('data'), 'title');
        $this->assertSame(['Open'], $titles('active'));
        $this->assertSame(['Done'], $titles('completed'));
    }
}
