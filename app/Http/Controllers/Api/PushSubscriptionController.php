<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PushSubscriptionController extends Controller
{
    public function publicKey()
    {
        return response()->json(['public_key' => config('services.webpush.public_key')]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'endpoint'         => 'required|url|max:2048',
            'keys.p256dh'      => 'required|string|max:255',
            'keys.auth'        => 'required|string|max:255',
            'content_encoding' => 'nullable|string|in:aes128gcm,aesgcm',
        ]);

        // Keyed on the endpoint, so a browser that was subscribed by another
        // user (shared device) is moved over to whoever is logged in now.
        $subscription = PushSubscription::updateOrCreate(
            ['endpoint_hash' => PushSubscription::hashEndpoint($data['endpoint'])],
            [
                'user_id'          => $request->user()->id,
                'endpoint'         => $data['endpoint'],
                'public_key'       => $data['keys']['p256dh'],
                'auth_token'       => $data['keys']['auth'],
                'content_encoding' => $data['content_encoding'] ?? 'aes128gcm',
                'user_agent'       => substr((string) $request->userAgent(), 0, 255),
            ]
        );

        return response()->json(['id' => $subscription->id], 201);
    }

    /**
     * "Send me a test notification" in Settings: pushes to this one device
     * and reports whether the push service accepted it, so a notification
     * that never shows can be told apart from one the server failed to send.
     */
    public function test(Request $request)
    {
        $data = $request->validate(['endpoint' => 'required|string|max:2048']);

        abort_unless(WebPushService::configured(), 503, 'Push notifications aren’t set up on the server.');
        $subscription = PushSubscription::where('endpoint_hash', PushSubscription::hashEndpoint($data['endpoint']))
            ->where('user_id', $request->user()->id)
            ->first();
        abort_unless($subscription, 404, 'This device isn’t linked to your account. Turn notifications off and on again.');

        $url = rtrim(env('FRONTEND_URL', config('app.url')), '/') . '/dashboard/settings#notifications';
        $reason = WebPushService::sendTo($subscription, 'Test notification',
            'Notifications are working on this device.', $url, 'push-test-' . now()->format('His'));

        if ($reason === 'expired') {
            abort(410, 'This device’s push link has expired. Turn notifications off and on again.');
        }
        if ($reason !== null) {
            Log::warning("Test push failed for user {$request->user()->id}: {$reason}");
            abort(502, 'The push service didn’t accept the notification. Try again in a minute.');
        }
        return response()->json(['sent' => true]);
    }

    public function destroy(Request $request)
    {
        $data = $request->validate(['endpoint' => 'required|string|max:2048']);

        PushSubscription::where('endpoint_hash', PushSubscription::hashEndpoint($data['endpoint']))
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Push subscription removed.']);
    }
}
