<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesTaskTables;
use Tests\TestCase;

/** Delete and pin in chats, and who can read a project chat (2026-10-30). */
class MessageActionsTest extends TestCase
{
    use CreatesTaskTables;

    private User $lead;
    private User $me;
    private User $ada;
    private int $project;

    protected function setUp(): void
    {
        parent::setUp();
        $this->createTaskTables(withHistoryMigration: false);
        Schema::create('project_members', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('project_id');
            $t->unsignedBigInteger('user_id');
            $t->timestamps();
        });
        Schema::create('direct_messages', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('sender_id');
            $t->unsignedBigInteger('receiver_id');
            $t->text('content');
            $t->boolean('read')->default(false);
            $t->boolean('is_pinned')->default(false);
            $t->timestamps();
        });
        Schema::create('general_channel_messages', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('sender_id');
            $t->text('content');
            $t->boolean('is_edited')->default(false);
            $t->boolean('is_pinned')->default(false);
            $t->json('reactions')->nullable();
            $t->timestamps();
        });
        Schema::create('project_messages', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('project_id');
            $t->unsignedBigInteger('sender_id');
            $t->text('content');
            $t->boolean('is_edited')->default(false);
            $t->boolean('is_pinned')->default(false);
            $t->unsignedBigInteger('parent_id')->nullable();
            $t->timestamps();
        });

        $this->lead = User::forceCreate(['username' => 'emma', 'first_name' => 'Emmanuel', 'role' => 'team_lead', 'password' => 'x']);
        $this->me = User::forceCreate(['username' => 'victor', 'first_name' => 'Victor', 'role' => 'staff', 'password' => 'x']);
        $this->ada = User::forceCreate(['username' => 'ada', 'first_name' => 'Ada', 'role' => 'staff', 'password' => 'x']);
        $this->project = DB::table('projects')->insertGetId(['name' => 'TopMart', 'manager_id' => $this->lead->id]);
        DB::table('project_members')->insert(['project_id' => $this->project, 'user_id' => $this->me->id]);
    }

    public function test_people_delete_only_their_own_direct_messages(): void
    {
        $mine = DB::table('direct_messages')->insertGetId(['sender_id' => $this->me->id, 'receiver_id' => $this->ada->id, 'content' => 'Hi']);
        $theirs = DB::table('direct_messages')->insertGetId(['sender_id' => $this->ada->id, 'receiver_id' => $this->me->id, 'content' => 'Hello']);

        Sanctum::actingAs($this->me);
        $this->deleteJson("/api/messages/direct/{$theirs}")->assertForbidden();
        $this->deleteJson("/api/messages/direct/{$mine}")->assertOk();
        $this->assertSame([$theirs], DB::table('direct_messages')->pluck('id')->all());
    }

    public function test_leads_moderate_the_general_channel(): void
    {
        $ada = DB::table('general_channel_messages')->insertGetId(['sender_id' => $this->ada->id, 'content' => 'Morning']);

        Sanctum::actingAs($this->me);
        $this->deleteJson("/api/messages/general/{$ada}")->assertForbidden();
        $this->postJson("/api/messages/general/{$ada}/pin", ['pinned' => true])->assertForbidden();

        Sanctum::actingAs($this->lead);
        $this->postJson("/api/messages/general/{$ada}/pin", ['pinned' => true])->assertOk();
        $this->assertTrue((bool) DB::table('general_channel_messages')->value('is_pinned'));
        $this->deleteJson("/api/messages/general/{$ada}")->assertOk();
    }

    public function test_either_person_pins_in_a_direct_chat_and_outsiders_cannot(): void
    {
        $dm = DB::table('direct_messages')->insertGetId(['sender_id' => $this->ada->id, 'receiver_id' => $this->me->id, 'content' => 'Brief attached']);

        Sanctum::actingAs($this->lead);
        $this->postJson("/api/messages/direct/{$dm}/pin", ['pinned' => true])->assertForbidden();

        Sanctum::actingAs($this->me);
        $this->postJson("/api/messages/direct/{$dm}/pin", ['pinned' => true])->assertOk()->assertJson(['is_pinned' => true]);
        $this->postJson("/api/messages/direct/{$dm}/pin", ['pinned' => false])->assertOk()->assertJson(['is_pinned' => false]);
    }

    public function test_project_chats_are_for_people_on_the_project(): void
    {
        DB::table('project_messages')->insert(['project_id' => $this->project, 'sender_id' => $this->lead->id, 'content' => 'Kickoff at 10']);
        $msg = DB::table('project_messages')->value('id');

        Sanctum::actingAs($this->ada);
        $this->getJson("/api/projects/{$this->project}/messages")->assertNotFound();
        $this->postJson("/api/projects/{$this->project}/messages", ['content' => 'Hi'])->assertNotFound();
        $this->postJson("/api/messages/project/{$msg}/pin", ['pinned' => true])->assertForbidden();

        Sanctum::actingAs($this->me);
        $this->getJson("/api/projects/{$this->project}/messages")->assertOk()->assertJsonCount(1);
        $this->postJson("/api/messages/project/{$msg}/pin", ['pinned' => true])->assertOk();
    }
}
