<?php

namespace App\Services;

use App\Mail\AppNotification;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    /**
     * Create a DB notification, then push it to the recipient's devices and email it.
     *
     * @param int    $userId        Recipient user ID
     * @param string $type          Notification type slug
     * @param string $title         Short title
     * @param string $message       Full message body
     * @param int|null $referenceId  ID of the related model
     * @param string|null $referenceType Model type (e.g. 'task', 'memo')
     */
    public static function send(
        int $userId,
        string $type,
        string $title,
        string $message,
        ?int $referenceId = null,
        ?string $referenceType = null,
    ): void {
        // Deactivated users get no new in-app notifications and no emails.
        $user = User::find($userId);
        if (!$user || !$user->is_active) {
            return;
        }

        // 1. Persist in-app notification (wrapped so a schema/DB issue here
        // never breaks the primary action that triggered the notification)
        $notification = null;
        try {
            $notification = Notification::create([
                'user_id'        => $userId,
                'type'           => $type,
                'title'          => $title,
                'message'        => $message,
                'reference_id'   => $referenceId,
                'reference_type' => $referenceType,
            ]);
        } catch (\Throwable $e) {
            Log::error("Failed to persist notification for user {$userId}: " . $e->getMessage());
        }

        $dashboardUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/') . '/dashboard';

        // 2. Send a push notification to the user's devices (no-ops if VAPID keys
        // aren't configured). Sent before the email so a slow SMTP server doesn't
        // delay it. The tag matches the in-app poller's, so the browser shows a
        // single alert when the app is open.
        WebPushService::sendToUser($userId, $title, $message, $dashboardUrl, $notification ? "notif-{$notification->id}" : null);

        // 3. Send email (wrapped so a mail failure never breaks the API response)
        try {
            if (!empty($user->email)) {
                Mail::to($user->email)
                    ->send(new AppNotification($title, $message, $dashboardUrl));
            }
        } catch (\Throwable $e) {
            Log::warning("Notification email failed for user {$userId}: " . $e->getMessage());
        }
    }
}
