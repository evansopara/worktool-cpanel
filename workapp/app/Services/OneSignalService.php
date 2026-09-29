<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OneSignalService
{
    /**
     * Send a push notification to a user, targeted by the external ID set
     * client-side via OneSignal.login(userId).
     */
    public static function sendToUser(int $userId, string $title, string $message, ?string $url = null): void
    {
        $appId = config('services.onesignal.app_id');
        $apiKey = config('services.onesignal.rest_api_key');

        if (!$appId || !$apiKey) {
            return;
        }

        try {
            Http::withToken($apiKey)
                ->post('https://onesignal.com/api/v1/notifications', [
                    'app_id' => $appId,
                    'target_channel' => 'push',
                    'include_aliases' => [
                        'external_id' => [(string) $userId],
                    ],
                    'headings' => ['en' => $title],
                    'contents' => ['en' => $message],
                    'url' => $url,
                ])
                ->throw();
        } catch (\Throwable $e) {
            Log::warning("OneSignal push failed for user {$userId}: " . $e->getMessage());
        }
    }
}
