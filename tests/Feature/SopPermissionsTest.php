<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesTaskTables;
use Tests\TestCase;

/** Everyone reads SOPs; only Operations Managers change them (redesign step 6, Library). */
class SopPermissionsTest extends TestCase
{
    use CreatesTaskTables;

    private User $manager;
    private User $staff;
    private int $sopId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->createTaskTables(withHistoryMigration: false);
        Schema::create('sops', function (Blueprint $t) {
            $t->id();
            $t->string('title');
            // As on the live database: required, no default.
            $t->string('department', 100);
            $t->text('description')->nullable();
            $t->string('category')->nullable();
            $t->string('status')->default('active');
            $t->unsignedBigInteger('created_by')->nullable();
            $t->timestamps();
        });
        Schema::create('sop_segments', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('sop_id');
            $t->string('title');
            $t->text('content');
            $t->integer('order_index')->nullable();
            $t->timestamps();
        });

        $this->manager = User::forceCreate(['username' => 'ige', 'first_name' => 'Olubukola', 'role' => 'operations_manager', 'password' => 'x']);
        $this->staff = User::forceCreate(['username' => 'victor', 'first_name' => 'Victor', 'role' => 'staff', 'password' => 'x']);
        $this->sopId = DB::table('sops')->insertGetId(['title' => 'Website delivery', 'department' => 'General', 'created_by' => $this->manager->id]);
    }

    public function test_staff_can_read_but_not_change_sops(): void
    {
        $segment = DB::table('sop_segments')->insertGetId(['sop_id' => $this->sopId, 'title' => 'Kickoff', 'content' => 'Call the client']);

        Sanctum::actingAs($this->staff);
        $this->getJson('/api/sops')->assertOk()->assertJsonCount(1);
        $this->postJson('/api/sops', ['title' => 'Mine'])->assertForbidden();
        $this->putJson("/api/sops/{$this->sopId}", ['title' => 'Hacked'])->assertForbidden();
        $this->deleteJson("/api/sops/{$this->sopId}")->assertForbidden();
        $this->postJson("/api/sops/{$this->sopId}/segments", ['title' => 'x', 'content' => 'y'])->assertForbidden();
        $this->deleteJson("/api/sops/{$this->sopId}/segments/{$segment}")->assertForbidden();

        $this->assertSame('Website delivery', DB::table('sops')->value('title'));
        $this->assertSame(1, DB::table('sop_segments')->count());
    }

    public function test_managers_change_sops_and_segments_must_match_their_sop(): void
    {
        $otherSop = DB::table('sops')->insertGetId(['title' => 'Other', 'department' => 'General']);
        $foreign = DB::table('sop_segments')->insertGetId(['sop_id' => $otherSop, 'title' => 'Keep', 'content' => 'me']);

        Sanctum::actingAs($this->manager);
        $this->postJson('/api/sops', ['title' => 'Onboarding', 'category' => null])->assertCreated();
        $this->postJson("/api/sops/{$this->sopId}/segments", ['title' => 'Kickoff', 'content' => 'Call the client'])->assertCreated();
        $this->putJson("/api/sops/{$this->sopId}", ['title' => 'Website delivery v2'])->assertOk();
        $this->deleteJson("/api/sops/{$this->sopId}/segments/{$foreign}")->assertNotFound();

        $this->assertSame('Website delivery v2', DB::table('sops')->where('id', $this->sopId)->value('title'));
        $this->assertTrue(DB::table('sop_segments')->where('id', $foreign)->exists());
    }
}
