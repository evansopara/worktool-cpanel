<?php

namespace Tests\Feature;

use App\Models\PushSubscription;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PushSubscriptionTest extends TestCase
{
    private const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/test-device-token';

    protected function setUp(): void
    {
        parent::setUp();

        // Several older migrations use MySQL-only SQL, so the in-memory SQLite
        // test database gets just the tables these tests touch.
        $this->artisan('migrate', ['--path' => [
            'database/migrations/2024_01_01_000001_create_users_table.php',
            'database/migrations/2026_10_18_000001_create_push_subscriptions_table.php',
        ]]);
    }

    private function makeUser(string $username): User
    {
        return User::forceCreate(['username' => $username, 'password' => bcrypt('secret'), 'status' => 'active']);
    }

    private function subscriptionPayload(): array
    {
        return [
            'endpoint'         => self::ENDPOINT,
            'keys'             => ['p256dh' => 'client-public-key', 'auth' => 'client-auth-secret'],
            'content_encoding' => 'aes128gcm',
        ];
    }

    public function test_public_key_is_returned(): void
    {
        config(['services.webpush.public_key' => 'test-public-key']);
        Sanctum::actingAs($this->makeUser('alice'));

        $this->getJson('/api/push/public-key')
            ->assertOk()
            ->assertJson(['public_key' => 'test-public-key']);
    }

    public function test_routes_require_authentication(): void
    {
        $this->getJson('/api/push/public-key')->assertUnauthorized();
        $this->postJson('/api/push/subscriptions', $this->subscriptionPayload())->assertUnauthorized();
    }

    public function test_subscribing_twice_from_the_same_browser_keeps_one_row(): void
    {
        $alice = $this->makeUser('alice');
        Sanctum::actingAs($alice);

        $this->postJson('/api/push/subscriptions', $this->subscriptionPayload())->assertCreated();
        $this->postJson('/api/push/subscriptions', $this->subscriptionPayload())->assertCreated();

        $this->assertSame(1, PushSubscription::count());
        $sub = PushSubscription::first();
        $this->assertSame($alice->id, $sub->user_id);
        $this->assertSame(self::ENDPOINT, $sub->endpoint);
        $this->assertSame('client-public-key', $sub->public_key);
    }

    public function test_shared_device_moves_to_the_user_who_logged_in_last(): void
    {
        $alice = $this->makeUser('alice');
        $bob = $this->makeUser('bob');

        Sanctum::actingAs($alice);
        $this->postJson('/api/push/subscriptions', $this->subscriptionPayload())->assertCreated();

        Sanctum::actingAs($bob);
        $this->postJson('/api/push/subscriptions', $this->subscriptionPayload())->assertCreated();

        $this->assertSame(1, PushSubscription::count());
        $this->assertSame($bob->id, PushSubscription::first()->user_id);
    }

    public function test_users_can_only_remove_their_own_subscription(): void
    {
        $alice = $this->makeUser('alice');
        $bob = $this->makeUser('bob');

        Sanctum::actingAs($alice);
        $this->postJson('/api/push/subscriptions', $this->subscriptionPayload())->assertCreated();

        Sanctum::actingAs($bob);
        $this->deleteJson('/api/push/subscriptions', ['endpoint' => self::ENDPOINT])->assertOk();
        $this->assertSame(1, PushSubscription::count());

        Sanctum::actingAs($alice);
        $this->deleteJson('/api/push/subscriptions', ['endpoint' => self::ENDPOINT])->assertOk();
        $this->assertSame(0, PushSubscription::count());
    }

    public function test_invalid_subscription_is_rejected(): void
    {
        Sanctum::actingAs($this->makeUser('alice'));

        $this->postJson('/api/push/subscriptions', ['endpoint' => 'not-a-url'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['endpoint', 'keys.p256dh', 'keys.auth']);
    }
}
