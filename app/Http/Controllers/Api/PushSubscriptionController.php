<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use Illuminate\Http\Request;

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

    public function destroy(Request $request)
    {
        $data = $request->validate(['endpoint' => 'required|string|max:2048']);

        PushSubscription::where('endpoint_hash', PushSubscription::hashEndpoint($data['endpoint']))
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Push subscription removed.']);
    }
}
