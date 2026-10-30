<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesTaskTables;
use Tests\TestCase;

/** Daily break times: Operations Managers and Team Leads set them (2026-10-30). */
class BreakTimeTest extends TestCase
{
    use CreatesTaskTables;

    protected function setUp(): void
    {
        parent::setUp();
        $this->createTaskTables(withHistoryMigration: false);
        Schema::table('users', fn (Blueprint $t) => $t->string('break_one_time', 50)->nullable());
    }

    public function test_leads_set_break_times_and_staff_cannot(): void
    {
        $lead = User::forceCreate(['username' => 'emma', 'first_name' => 'Emmanuel', 'role' => 'team_lead', 'password' => 'x']);
        $pm = User::forceCreate(['username' => 'titi', 'first_name' => 'Titi', 'role' => 'project_manager', 'password' => 'x']);
        $staff = User::forceCreate(['username' => 'victor', 'first_name' => 'Victor', 'role' => 'staff', 'password' => 'x']);

        Sanctum::actingAs($staff);
        $this->putJson("/api/users/{$staff->id}/break", ['break_one_time' => '13:00'])->assertForbidden();
        Sanctum::actingAs($pm);
        $this->putJson("/api/users/{$staff->id}/break", ['break_one_time' => '13:00'])->assertForbidden();

        Sanctum::actingAs($lead);
        $this->putJson("/api/users/{$staff->id}/break", ['break_one_time' => '2pm'])->assertStatus(422);
        $this->putJson("/api/users/{$staff->id}/break", ['break_one_time' => '14:00'])->assertOk();
        $this->assertSame('14:00', DB::table('users')->where('id', $staff->id)->value('break_one_time'));

        // Everyone signed in sees it in the user list (task form).
        Sanctum::actingAs($pm);
        $this->assertSame('14:00', collect($this->getJson('/api/users')->json())->firstWhere('id', $staff->id)['break_one_time']);
    }
}
