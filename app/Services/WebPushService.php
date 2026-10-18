<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class WebPushService
{
    /**
     * Send a push notification to every browser/device the user has
     * subscribed from. Subscriptions the push service reports as gone
     * (permission revoked, app uninstalled) are deleted.
     */
    public static function sendToUser(int $userId, string $title, string $message, string $url, ?string $tag = null): void
    {
        $publicKey = config('services.webpush.public_key');
        $privateKey = config('services.webpush.private_key');

        if (!$publicKey || !$privateKey) {
            return;
        }

        $subscriptions = PushSubscription::where('user_id', $userId)->get();
        if ($subscriptions->isEmpty()) {
            return;
        }

        try {
            $webPush = new WebPush(
                [
                    'VAPID' => [
                        'subject'    => config('services.webpush.subject'),
                        'publicKey'  => $publicKey,
                        'privateKey' => $privateKey,
                    ],
                ],
                // Keep it for a day so a phone that's offline still gets it
                // when it reconnects, without delivering stale alerts later.
                ['TTL' => 86400, 'urgency' => 'high'],
                logger: app('log'),
            );

            $payload = json_encode([
                'title' => $title,
                'body'  => $message,
                'url'   => $url,
                'tag'   => $tag,
                'icon'  => '/icon-192.png',
            ]);

            $byEndpoint = [];
            foreach ($subscriptions as $sub) {
                $byEndpoint[$sub->endpoint] = $sub;
                $webPush->queueNotification(
                    Subscription::create([
                        'endpoint'        => $sub->endpoint,
                        'publicKey'       => $sub->public_key,
                        'authToken'       => $sub->auth_token,
                        'contentEncoding' => $sub->content_encoding,
                    ]),
                    $payload,
                );
            }

            foreach ($webPush->flush() as $report) {
                if ($report->isSuccess()) {
                    continue;
                }
                if ($report->isSubscriptionExpired()) {
                    ($byEndpoint[$report->getEndpoint()] ?? null)?->delete();
                    continue;
                }
                Log::warning("Web push failed for user {$userId}: " . $report->getReason());
            }
        } catch (\Throwable $e) {
            Log::warning("Web push failed for user {$userId}: " . $e->getMessage());
        }
    }
}
