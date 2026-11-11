<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesTaskTables;
use Tests\TestCase;

/** Inbox (redesign step 6c): conversation list and the general channel. */
class InboxTest extends TestCase
{
    use CreatesTaskTables;

    private User $me;
    private User $ada;
    private User $bo;

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
        foreach (['direct_messages', 'general_channel_messages', 'project_messages'] as $table) {
            Schema::create($table, function (Blueprint $t) use ($table) {
                $t->id();
                $t->unsignedBigInteger('sender_id');
                if ($table === 'direct_messages') {
                    $t->unsignedBigInteger('receiver_id');
                    $t->boolean('read')->default(false);
                }
                if ($table === 'project_messages') {
                    $t->unsignedBigInteger('project_id');
                }
                $t->text('content');
                $t->timestamps();
            });
        }
        $this->me = User::forceCreate(['username' => 'me', 'first_name' => 'Victor', 'last_name' => 'Adeleye', 'role' => 'staff', 'password' => 'x']);
        $this->ada = User::forceCreate(['username' => 'ada', 'first_name' => 'Ada', 'last_name' => 'Obi', 'role' => 'staff', 'password' => 'x']);
        $this->bo = User::forceCreate(['username' => 'bo', 'first_name' => 'Bo', 'last_name' => 'Lee', 'role' => 'staff', 'password' => 'x']);
    }

    private function dm(User $from, User $to, string $text, int $minutesAgo, bool $read = false): void
    {
        $at = Carbon::now()->subMinutes($minutesAgo);
        DB::table('direct_messages')->insert(['sender_id' => $from->id, 'receiver_id' => $to->id, 'content' => $text, 'read' => $read, 'created_at' => $at, 'updated_at' => $at]);
    }

    public function test_inbox_lists_each_conversation_with_its_last_message(): void
    {
        $this->dm($this->ada, $this->me, 'Hi', 30);
        $this->dm($this->ada, $this->me, 'Are you there?', 20);
        $this->dm($this->me, $this->bo, 'Done', 10, read: true);
        $this->dm($this->bo, $this->ada, 'Not mine', 5);

        $mine = DB::table('projects')->insertGetId(['name' => 'TopMart', 'manager_id' => $this->ada->id]);
        $other = DB::table('projects')->insertGetId(['name' => 'Secret', 'manager_id' => $this->ada->id]);
        DB::table('project_members')->insert(['project_id' => $mine, 'user_id' => $this->me->id]);
        DB::table('project_messages')->insert([
            ['project_id' => $mine, 'sender_id' => $this->ada->id, 'content' => 'First', 'created_at' => now()->subHour()],
            ['project_id' => $mine, 'sender_id' => $this->ada->id, 'content' => 'Latest', 'created_at' => now()],
            ['project_id' => $other, 'sender_id' => $this->ada->id, 'content' => 'Hidden', 'created_at' => now()],
        ]);

        Sanctum::actingAs($this->me);
        $res = $this->getJson('/api/messages/inbox')->assertOk();

        // Newest conversation first; unread only counts messages to me.
        $this->assertSame([$this->bo->id, $this->ada->id], array_column($res->json('direct'), 'user_id'));
        $this->assertSame('Done', $res->json('direct.0.last.content'));
        $this->assertTrue($res->json('direct.0.last.mine'));
        $this->assertSame(0, $res->json('direct.0.unread'));
        $this->assertSame(2, $res->json('direct.1.unread'));
        $this->assertSame('Are you there?', $res->json('direct.1.last.content'));

        // Only projects I'm on, with their newest message.
        $this->assertSame([['id' => $mine, 'name' => 'TopMart']], array_map(fn ($p) => ['id' => $p['id'], 'name' => $p['name']], $res->json('projects')));
        $this->assertSame('Latest', $res->json('projects.0.last.content'));
    }

    public function test_general_channel_shows_the_newest_100_messages(): void
    {
        $rows = [];
        foreach (range(1, 105) as $i) {
            $rows[] = ['sender_id' => $this->ada->id, 'content' => "Message {$i}", 'created_at' => now()->subMinutes(200 - $i)];
        }
        DB::table('general_channel_messages')->insert($rows);

        Sanctum::actingAs($this->me);
        $messages = $this->getJson('/api/messages/general')->assertOk()->json();

        $this->assertCount(100, $messages);
        $this->assertSame('Message 6', $messages[0]['content']);
        $this->assertSame('Message 105', $messages[99]['content']);
    }
}
