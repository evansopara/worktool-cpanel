<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesTaskTables;
use Tests\TestCase;

/** Only managers may change projects (redesign step 6, Projects). */
class ProjectPermissionsTest extends TestCase
{
    use CreatesTaskTables;

    private User $manager;
    private User $staff;
    private int $projectId;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['services.webpush.public_key' => null, 'services.webpush.private_key' => null]);
        $this->createTaskTables();
        Schema::table('projects', function (Blueprint $t) {
            $t->text('description')->nullable();
            $t->string('category')->nullable();
            $t->string('status')->default('active');
            $t->unsignedTinyInteger('progress')->default(0);
            $t->unsignedBigInteger('client_id')->nullable();
            $t->unsignedBigInteger('created_by')->nullable();
            $t->date('start_date')->nullable();
            $t->date('end_date')->nullable();
            $t->date('domain_registered_at')->nullable();
            $t->date('domain_expires_at')->nullable();
            $t->timestamp('domain_expiry_notified_at')->nullable();
        });
        Schema::create('project_members', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('project_id');
            $t->unsignedBigInteger('user_id');
            $t->string('role')->nullable();
            $t->string('invitation_status')->default('accepted');
            $t->timestamps();
        });

        $this->manager = User::forceCreate(['username' => 'ige', 'first_name' => 'Olubukola', 'role' => 'operations_manager', 'password' => 'x']);
        $this->staff = User::forceCreate(['username' => 'victor', 'first_name' => 'Victor', 'role' => 'staff', 'password' => 'x']);
        $this->projectId = DB::table('projects')->insertGetId(['name' => 'TopMart', 'manager_id' => $this->manager->id, 'category' => 'website_development']);
        DB::table('project_members')->insert(['project_id' => $this->projectId, 'user_id' => $this->staff->id]);
    }

    public function test_staff_cannot_change_or_delete_projects(): void
    {
        Sanctum::actingAs($this->staff);
        $this->putJson("/api/projects/{$this->projectId}", ['name' => 'Hacked'])->assertForbidden();
        $this->deleteJson("/api/projects/{$this->projectId}")->assertForbidden();
        $this->deleteJson("/api/projects/{$this->projectId}/members/{$this->staff->id}")->assertForbidden();
        $this->postJson("/api/projects/{$this->projectId}/plans", ['title' => 'Plan'])->assertForbidden();

        $this->assertSame('TopMart', DB::table('projects')->where('id', $this->projectId)->value('name'));
        // Staff can still see the project they belong to.
        $this->getJson('/api/projects')->assertOk()->assertJsonCount(1);
    }

    public function test_managers_can_change_projects(): void
    {
        Sanctum::actingAs($this->manager);
        $this->putJson("/api/projects/{$this->projectId}", ['name' => 'TopMart Store'])->assertOk();
        $this->assertSame('TopMart Store', DB::table('projects')->where('id', $this->projectId)->value('name'));
        $this->deleteJson("/api/projects/{$this->projectId}/members/{$this->staff->id}")->assertOk();
    }
}
