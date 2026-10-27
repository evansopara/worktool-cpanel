<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesTaskTables;
use Tests\TestCase;

/** Menu badges, notification links and review-link permissions (feedback round 2). */
class BadgesAndNotificationsTest extends TestCase
{
    use CreatesTaskTables;

    private User $manager;
    private User $staff;
    private User $lead;

    protected function setUp(): void
    {
        parent::setUp();
        $this->createTaskTables();
        Schema::table('users', fn (Blueprint $t) => $t->string('specialization')->nullable());
        Schema::create('direct_messages', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('sender_id');
            $t->unsignedBigInteger('receiver_id');
            $t->text('content');
            $t->boolean('read')->default(false);
            $t->timestamps();
        });
        Schema::create('memos', function (Blueprint $t) {
            $t->id();
            $t->string('subject');
            $t->text('content');
            $t->json('recipients')->nullable();
            $t->unsignedBigInteger('sender_id');
            $t->string('type')->default('individual');
            $t->string('department')->nullable();
            $t->timestamps();
        });
        Schema::create('memo_reads', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('memo_id');
            $t->unsignedBigInteger('user_id');
            $t->timestamp('read_at')->nullable();
            $t->timestamps();
        });
        foreach (['leave_applications', 'staff_complaints', 'complaints', 'technical_support_requests'] as $table) {
            Schema::create($table, function (Blueprint $t) {
                $t->id();
                $t->string('status')->default('pending');
                $t->timestamps();
            });
        }
        Schema::create('staff_queries', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('assigned_to');
            $t->string('status')->default('pending');
            $t->timestamps();
        });
        Schema::create('review_links', function (Blueprint $t) {
            $t->id();
            $t->string('title');
            $t->string('link_url');
            $t->unsignedBigInteger('sent_by')->nullable();
            $t->unsignedBigInteger('assigned_to')->nullable();
            $t->string('status')->default('pending');
            $t->text('review_comment')->nullable();
            $t->timestamp('reviewed_at')->nullable();
            $t->timestamps();
        });

        $this->manager = User::forceCreate(['username' => 'ige', 'first_name' => 'Olubukola', 'role' => 'operations_manager', 'password' => 'x']);
        $this->lead = User::forceCreate(['username' => 'emma', 'first_name' => 'Emmanuel', 'role' => 'team_lead', 'password' => 'x']);
        $this->staff = User::forceCreate(['username' => 'victor', 'first_name' => 'Victor', 'role' => 'staff', 'password' => 'x']);
    }

    public function test_badges_count_what_each_person_can_act_on(): void
    {
        $project = DB::table('projects')->insertGetId(['name' => 'TopMart', 'manager_id' => $this->manager->id]);
        $task = fn (array $a) => DB::table('tasks')->insertGetId($a + ['title' => 'T', 'project_id' => $project, 'assignee_id' => $this->staff->id, 'assigned_by' => $this->manager->id]);
        $task(['status' => 'review']);
        $task(['status' => 'todo', 'has_been_started' => false]);
        $task(['status' => 'not_approved']);
        $task(['status' => 'in_progress', 'has_been_started' => true]);

        DB::table('direct_messages')->insert([
            ['sender_id' => $this->manager->id, 'receiver_id' => $this->staff->id, 'content' => 'Hi', 'read' => false],
            ['sender_id' => $this->manager->id, 'receiver_id' => $this->staff->id, 'content' => 'Seen', 'read' => true],
        ]);
        $memo = DB::table('memos')->insertGetId(['subject' => 'Read', 'content' => 'x', 'recipients' => json_encode([$this->staff->id]), 'sender_id' => $this->manager->id]);
        DB::table('memos')->insert(['subject' => 'New', 'content' => 'x', 'recipients' => json_encode([$this->staff->id]), 'sender_id' => $this->manager->id]);
        DB::table('memo_reads')->insert(['memo_id' => $memo, 'user_id' => $this->staff->id]);

        DB::table('leave_applications')->insert([['status' => 'pending'], ['status' => 'approved']]);
        DB::table('staff_complaints')->insert(['status' => 'pending']);
        DB::table('complaints')->insert([['status' => 'pending'], ['status' => 'pending']]);
        DB::table('staff_queries')->insert(['assigned_to' => $this->staff->id, 'status' => 'pending']);

        Sanctum::actingAs($this->manager);
        $this->getJson('/api/badges')->assertOk()->assertJson(['tasks' => 1, 'people' => 2, 'clients' => 2, 'penalties' => 0]);

        Sanctum::actingAs($this->staff);
        // Not started + sent back; 1 unread message + 1 unopened memo; 1 query.
        $this->getJson('/api/badges')->assertOk()->assertJson(['tasks' => 2, 'inbox' => 2, 'people' => 0, 'penalties' => 1]);
    }

    public function test_notifications_link_to_the_page_they_are_about(): void
    {
        DB::table('notifications')->insert([
            ['user_id' => $this->staff->id, 'type' => 'task_assigned', 'reference_id' => 7, 'reference_type' => 'task', 'created_at' => now()],
            ['user_id' => $this->staff->id, 'type' => 'staff_query_issued', 'reference_id' => 3, 'reference_type' => 'staff_query', 'created_at' => now()->subMinute()],
            ['user_id' => $this->manager->id, 'type' => 'leave_request', 'reference_id' => 1, 'reference_type' => 'leave_application', 'created_at' => now()],
        ]);

        Sanctum::actingAs($this->staff);
        $links = $this->getJson('/api/notifications')->assertOk()->json('*.link');
        $this->assertSame(['/dashboard/tasks?task=7', '/dashboard/queries'], $links);

        Sanctum::actingAs($this->manager);
        $this->assertSame(['/dashboard/people'], $this->getJson('/api/notifications')->json('*.link'));
    }

    public function test_only_the_reviewer_or_a_lead_can_decide_a_review_link(): void
    {
        $link = DB::table('review_links')->insertGetId(['title' => 'Homepage', 'link_url' => 'https://example.com', 'assigned_to' => $this->lead->id]);

        Sanctum::actingAs($this->staff);
        $this->postJson("/api/review-links/{$link}/respond", ['status' => 'approved'])->assertForbidden();

        Sanctum::actingAs($this->lead);
        $this->postJson("/api/review-links/{$link}/respond", ['status' => 'approved'])->assertOk();
        $this->assertSame('approved', DB::table('review_links')->value('status'));
    }
}
