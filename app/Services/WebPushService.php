<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class WebPushService
{
    public static function configured(): bool
    {
        return config('services.webpush.public_key') && config('services.webpush.private_key');
    }

    /**
     * Send a push notification to every browser/device the user has
     * subscribed from. Subscriptions the push service reports as gone
     * (permission revoked, app uninstalled) are deleted.
     */
    public static function sendToUser(int $userId, string $title, string $message, string $url, ?string $tag = null): void
    {
        if (!self::configured()) {
            return;
        }

        $subscriptions = PushSubscription::where('user_id', $userId)->get();
        if ($subscriptions->isEmpty()) {
            return;
        }

        foreach (self::deliver($subscriptions, $title, $message, $url, $tag) as $reason) {
            if ($reason !== null && $reason !== 'expired') {
                Log::warning("Web push failed for user {$userId}: {$reason}");
            }
        }
    }

    /**
     * Send to one device and say how it went: null when the push service
     * accepted it, 'expired' when the subscription is gone (it is deleted),
     * otherwise the push service's reason.
     */
    public static function sendTo(PushSubscription $subscription, string $title, string $message, string $url, ?string $tag = null): ?string
    {
        return self::deliver(collect([$subscription]), $title, $message, $url, $tag)[$subscription->endpoint] ?? null;
    }

    /** @return array<string, ?string> endpoint => null on success, else the failure reason */
    private static function deliver(Collection $subscriptions, string $title, string $message, string $url, ?string $tag): array
    {
        $results = [];
        try {
            $webPush = new WebPush(
                [
                    'VAPID' => [
                        'subject'    => config('services.webpush.subject'),
                        'publicKey'  => config('services.webpush.public_key'),
                        'privateKey' => config('services.webpush.private_key'),
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
                $endpoint = $report->getEndpoint();
                if ($report->isSuccess()) {
                    $results[$endpoint] = null;
                } elseif ($report->isSubscriptionExpired()) {
                    ($byEndpoint[$endpoint] ?? null)?->delete();
                    $results[$endpoint] = 'expired';
                } else {
                    $results[$endpoint] = $report->getReason();
                }
            }
        } catch (\Throwable $e) {
            foreach ($subscriptions as $sub) {
                $results[$sub->endpoint] = $e->getMessage();
            }
        }
        return $results;
    }
}
