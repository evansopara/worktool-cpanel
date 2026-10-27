import { pushApi } from '@/lib/api';

// Self-hosted Web Push: /sw.js receives pushes sent by the Laravel API using
// its VAPID keys. Each browser/device the user enables alerts on is stored
// server-side as a subscription.

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}

export type PushResult = { ok: true } | { ok: false; step: string; error: string };

function describeError(e: unknown): string {
  const err = e as { name?: string; message?: string; response?: { status?: number; data?: { message?: string } } };
  if (err?.response) {
    return `HTTP ${err.response.status ?? '?'}${err.response.data?.message ? `: ${err.response.data.message}` : ''}`;
  }
  if (err?.name || err?.message) return [err.name, err.message].filter(Boolean).join(': ');
  return String(e);
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms)),
  ]);
}

// Subscribes this browser to push (permission must already be granted) and
// saves the subscription for the logged-in user. Safe to call repeatedly:
// it reuses the existing subscription and the server upserts by endpoint.
// On failure it reports which step failed, so problems can be diagnosed on
// the device itself.
export async function subscribeToPush(): Promise<PushResult> {
  let step = 'support';
  try {
    if (typeof window === 'undefined') return { ok: false, step, error: 'not in a browser' };
    const missing = [
      !('serviceWorker' in navigator) && 'serviceWorker',
      !('PushManager' in window) && 'PushManager',
      !('Notification' in window) && 'Notification',
    ].filter(Boolean);
    if (missing.length) {
      const standalone = window.matchMedia('(display-mode: standalone)').matches;
      return { ok: false, step, error: `missing ${missing.join(', ')} (standalone=${standalone}, secure=${window.isSecureContext})` };
    }

    step = 'permission';
    if (Notification.permission !== 'granted') return { ok: false, step, error: `permission is '${Notification.permission}'` };

    step = 'register /sw.js';
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    step = 'service worker ready';
    const registration = await withTimeout(navigator.serviceWorker.ready, 10_000, 'navigator.serviceWorker.ready');

    step = 'get VAPID public key';
    const { data } = await pushApi.publicKey();
    if (!data.public_key) return { ok: false, step, error: 'server returned no key (VAPID_PUBLIC_KEY not set in .env, or config cached: run php artisan optimize:clear)' };
    const applicationServerKey = urlBase64ToUint8Array(data.public_key);

    step = 'pushManager.subscribe';
    let subscription = await registration.pushManager.getSubscription();
    // A subscription made with a different server key can't receive our pushes.
    if (subscription && !sameKey(subscription.options.applicationServerKey, applicationServerKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });

    step = 'save subscription to server';
    const json = subscription.toJSON();
    const encodings = (PushManager as unknown as { supportedContentEncodings?: string[] }).supportedContentEncodings;
    await pushApi.subscribe({
      endpoint: subscription.endpoint,
      keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
      content_encoding: encodings?.includes('aes128gcm') === false ? 'aesgcm' : 'aes128gcm',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, step, error: describeError(e) };
  }
}

// Called on logout (while the auth token is still valid) so this device
// stops receiving the previous user's notifications.
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await pushApi.unsubscribe(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  } catch {
    // Never block logout on push cleanup.
  }
}
