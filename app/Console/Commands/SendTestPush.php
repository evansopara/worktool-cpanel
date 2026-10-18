<?php

namespace App\Console\Commands;

use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Console\Command;

class SendTestPush extends Command
{
    protected $signature = 'push:test {userId}';
    protected $description = 'Send a test push notification to every device a user has subscribed from';

    public function handle()
    {
        $userId = (int) $this->argument('userId');

        if (!config('services.webpush.public_key') || !config('services.webpush.private_key')) {
            $this->error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set in .env.');
            return self::FAILURE;
        }

        $before = PushSubscription::where('user_id', $userId)->count();
        if ($before === 0) {
            $this->warn("User {$userId} has no push subscriptions. Log in as them and tap \"Enable alerts\" first.");
            return self::FAILURE;
        }

        $url = rtrim(env('FRONTEND_URL', config('app.url')), '/') . '/dashboard';
        WebPushService::sendToUser($userId, 'Test notification', 'Push notifications are working on this device.', $url, 'push-test');

        $removed = $before - PushSubscription::where('user_id', $userId)->count();
        $this->info("Sent to {$before} device(s)." . ($removed ? " {$removed} expired subscription(s) removed." : ''));
        $this->line('Any delivery errors are in storage/logs.');

        return self::SUCCESS;
    }
}
