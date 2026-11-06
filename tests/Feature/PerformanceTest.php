<?php

namespace Tests\Feature;

use App\Models\AttendanceCheck;
use App\Models\AttendanceDay;
use App\Models\Notification;
use App\Models\Task;
use App\Models\TaskEvent;
use App\Models\User;
use App\Services\Attendance;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesTaskTables;
use Tests\TestCase;

/** Performance page: daily attendance check and leaderboard scores. */
class PerformanceTest extends TestCase
{
    use CreatesTaskTables;

    private User $ops;
    private User $lead;
    private User $staff;
    private User $intern;
    private User $onLeave;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['services.webpush.public_key' => null, 'services.webpush.private_key' => null]);
        // Monday
        Carbon::setTestNow(Carbon::parse('2026-10-26 08:00:00'));
        $this->createTaskTables();
        Schema::table('projects', function (Blueprint $t) {
            $t->string('status')->default('active');
            $t->unsignedTinyInteger('progress')->default(0);
            $t->date('start_date')->nullable();
            $t->date('end_date')->nullable();
        });
        Schema::create('leave_applications', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('user_id');
            $t->dateTime('start_date');
            $t->dateTime('end_date');
            $t->string('status')->default('pending');
            $t->timestamps();
        });
        $this->artisan('migrate', ['--path' => 'database/migrations/2026_11_06_000001_create_attendance_tables.php']);

        $make = fn (string $name, string $role) => User::forceCreate(['username' => $name, 'first_name' => ucfirst($name), 'password' => 'x', 'role' => $role]);
        $this->ops = $make('ops', 'operations_manager');
        $this->lead = $make('lead', 'team_lead');
        $this->staff = $make('victor', 'staff');
        $this->intern = $make('godwin', 'intern');
        $this->onLeave = $make('linda', 'staff');
        DB::table('leave_applications')->insert([
            'user_id' => $this->onLeave->id, 'status' => 'approved',
            'start_date' => '2026-10-26 00:00:00', 'end_date' => '2026-10-27 00:00:00',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Fire today's check at 2:12 PM. */
    private function fireAt(string $time = '14:12'): AttendanceDay
    {
        AttendanceDay::create(['date' => '2026-10-26', 'send_at' => "2026-10-26 {$time}:00"]);
        Carbon::setTestNow(Carbon::parse("2026-10-26 {$time}:00"));
        Attendance::tick();
        return AttendanceDay::first();
    }

    private function check(User $u): AttendanceCheck
    {
        return AttendanceCheck::where('user_id', $u->id)->firstOrFail();
    }

    public function test_send_time_is_in_the_window_and_outside_lunch(): void
    {
        for ($i = 0; $i < 25; $i++) {
            AttendanceDay::query()->delete();
            $at = Attendance::pickDay(Carbon::parse('2026-10-26 00:05'))->send_at;
            $this->assertTrue($at->format('H:i') >= '10:00' && $at->format('H:i') <= '16:30');
            $this->assertFalse($at->format('H') === '13');
        }
        $this->assertNull(Attendance::pickDay(Carbon::parse('2026-10-31 00:05')), 'no check on Saturday');
    }

    public function test_send_time_stays_hidden_until_it_fires(): void
    {
        Attendance::tick(Carbon::parse('2026-10-26 08:00'));
        Sanctum::actingAs($this->staff);
        $this->getJson('/api/attendance/me')->assertOk()->assertJson(['check' => null]);
        Sanctum::actingAs($this->ops);
        $this->getJson('/api/performance/attendance/today')->assertOk()->assertJson(['sent_at' => null]);
    }

    public function test_everyone_but_team_leads_gets_the_same_check_and_leave_is_skipped(): void
    {
        $this->fireAt();
        $this->assertSame(AttendanceCheck::PENDING, $this->check($this->staff)->status);
        $this->assertSame(AttendanceCheck::PENDING, $this->check($this->ops)->status);
        $this->assertSame(AttendanceCheck::SKIPPED, $this->check($this->onLeave)->status);
        $this->assertFalse(AttendanceCheck::where('user_id', $this->lead->id)->exists());

        // A second tick never sends again.
        Attendance::tick(Carbon::parse('2026-10-26 14:13'));
        $this->assertSame(4, AttendanceCheck::count());
    }

    public function test_answer_windows(): void
    {
        $this->fireAt();

        Carbon::setTestNow(Carbon::parse('2026-10-26 14:41:00')); // 29 min
        Sanctum::actingAs($this->staff);
        $this->postJson("/api/attendance/checks/{$this->check($this->staff)->id}/respond")->assertOk()->assertJson(['status' => 'answered']);

        Carbon::setTestNow(Carbon::parse('2026-10-26 14:43:00')); // 31 min
        Sanctum::actingAs($this->intern);
        $this->postJson("/api/attendance/checks/{$this->check($this->intern)->id}/respond")->assertOk()->assertJson(['status' => 'late']);

        Carbon::setTestNow(Carbon::parse('2026-10-26 15:13:00')); // 61 min
        Sanctum::actingAs($this->ops);
        $this->postJson("/api/attendance/checks/{$this->check($this->ops)->id}/respond")->assertStatus(422);
        $this->assertSame(AttendanceCheck::MISSED, $this->check($this->ops)->status);
    }

    public function test_cannot_answer_someone_elses_check(): void
    {
        $this->fireAt();
        Sanctum::actingAs($this->intern);
        $this->postJson("/api/attendance/checks/{$this->check($this->staff)->id}/respond")->assertForbidden();
    }

    public function test_unanswered_checks_become_missed_and_are_flagged_until_reviewed(): void
    {
        $this->fireAt();
        Attendance::tick(Carbon::parse('2026-10-26 15:11'));
        $this->assertSame(AttendanceCheck::PENDING, $this->check($this->staff)->status);
        Carbon::setTestNow(Carbon::parse('2026-10-26 15:12'));
        Attendance::tick();
        $this->assertSame(AttendanceCheck::MISSED, $this->check($this->staff)->status);
        $this->assertTrue(Notification::where('user_id', $this->lead->id)->where('type', 'attendance_missed')->exists());

        Sanctum::actingAs($this->lead);
        $flags = $this->getJson('/api/performance/attendance?from=2026-10-26&to=2026-11-01')->assertOk()->json('flags');
        $this->assertContains($this->staff->id, array_column(array_column($flags, 'user'), 'id'));
        $this->assertGreaterThan(0, $this->getJson('/api/badges')->json('performance'));

        $this->postJson("/api/attendance/checks/{$this->check($this->staff)->id}/review")->assertOk();
        $this->assertSame($this->lead->id, $this->check($this->staff)->reviewed_by);
        $flags = $this->getJson('/api/performance/attendance?from=2026-10-26&to=2026-11-01')->json('flags');
        $this->assertNotContains($this->staff->id, array_column(array_column($flags, 'user'), 'id'));
    }

    /** A closed task due today at 4 PM, submitted at $submitAt (null = never). */
    private function task(User $u, ?string $submitAt, int $estimate = 60, int $logged = 3600, bool $sentBack = false): Task
    {
        $t = Task::create([
            'title' => 'Task', 'assignee_id' => $u->id, 'status' => $submitAt ? 'completed' : 'deadline_missed',
            'start_date' => '2026-10-26 09:00:00', 'deadline' => '2026-10-26 16:00:00',
            'working_hours' => intdiv($estimate, 60), 'working_minutes' => $estimate % 60, 'time_spent' => $logged,
        ]);
        if ($submitAt) {
            TaskEvent::forceCreate(['task_id' => $t->id, 'type' => TaskEvent::SUBMITTED, 'created_at' => $submitAt]);
            if ($sentBack) {
                TaskEvent::forceCreate(['task_id' => $t->id, 'type' => TaskEvent::SENT_BACK, 'created_at' => $submitAt]);
            }
            TaskEvent::forceCreate(['task_id' => $t->id, 'type' => TaskEvent::APPROVED, 'created_at' => $submitAt]);
        }
        return $t;
    }

    public function test_staff_score_uses_the_weights_and_needs_five_tasks(): void
    {
        // Victor: 4 of 5 on time (80), 1 of 4 reviewed sent back (75),
        // logged 120% of estimate (80), attendance 1 of 1 (100).
        foreach (range(1, 3) as $_) {
            $this->task($this->staff, '2026-10-26 15:00:00', logged: 4320);
        }
        $this->task($this->staff, '2026-10-26 15:00:00', logged: 4320, sentBack: true);
        $this->task($this->staff, null, logged: 0);
        // Godwin: only 4 tasks.
        foreach (range(1, 4) as $_) {
            $this->task($this->intern, '2026-10-26 15:00:00');
        }
        $this->fireAt();
        Carbon::setTestNow(Carbon::parse('2026-10-26 14:20:00'));
        AttendanceCheck::where('user_id', $this->staff->id)->update(['status' => 'answered', 'responded_at' => now()]);
        Carbon::setTestNow(Carbon::parse('2026-10-27 09:00:00'));

        Sanctum::actingAs($this->staff);
        $res = $this->getJson('/api/performance/leaderboard?board=staff&from=2026-10-26&to=2026-11-01')->assertOk();
        $rows = collect($res->json('rows'))->keyBy('user.id');

        $victor = $rows[$this->staff->id];
        $this->assertSame(80, $victor['measures']['on_time']['value']);
        $this->assertSame(75, $victor['measures']['first_time']['value']);
        $this->assertSame(120, $victor['measures']['estimate']['value']);
        $this->assertSame(100, $victor['measures']['attendance']['value']);
        // 80*.40 + 75*.25 + 80*.15 + 100*.20 = 32 + 18.75 + 12 + 20 = 82.75
        $this->assertSame(83, $victor['score']);
        $this->assertSame(1, $victor['rank']);

        $godwin = $rows[$this->intern->id];
        $this->assertFalse($godwin['ranked']);
        $this->assertNull($godwin['rank']);

        // Staff see their own row and the measure that would lift them most.
        $this->assertSame($this->staff->id, $res->json('me.user.id'));
        $this->assertSame('on_time', $res->json('me.lift'));
    }

    public function test_approved_leave_days_are_excluded(): void
    {
        $this->task($this->onLeave, null);
        Carbon::setTestNow(Carbon::parse('2026-10-27 09:00:00'));
        Sanctum::actingAs($this->ops);
        $rows = collect($this->getJson('/api/performance/leaderboard?board=staff&from=2026-10-26&to=2026-11-01')->json('rows'))->keyBy('user.id');
        $this->assertSame(0, $rows[$this->onLeave->id]['tasks']);
    }

    public function test_staff_cannot_see_other_people_or_the_attendance_tab(): void
    {
        Sanctum::actingAs($this->staff);
        $this->getJson("/api/performance/people/{$this->intern->id}")->assertForbidden();
        $this->getJson('/api/performance/attendance')->assertForbidden();
        $this->getJson('/api/performance/attendance/today')->assertForbidden();
        $this->getJson('/api/performance/overview')->assertForbidden();
        $this->getJson("/api/performance/people/{$this->staff->id}")->assertOk();

        Sanctum::actingAs($this->lead);
        $this->getJson("/api/performance/people/{$this->staff->id}")->assertOk()->assertJsonCount(6, 'history');
        $this->getJson('/api/performance/overview')->assertOk();
    }
}
