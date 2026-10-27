'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { notificationsApi } from '@/lib/api';
import { toast } from 'sonner';
import { subscribeToPush, type PushResult } from '@/lib/push';
import type { Notification as AppNotification } from '@/types';

const SOUND_URL = '/sounds/notification.wav';

// TEMPORARY push debugging: the last push-setup failure is kept on the device
// and shown under the header until push setup succeeds.
const PUSH_ERROR_KEY = 'push_debug_error';

function readStoredPushError(): string | null {
  try {
    return localStorage.getItem(PUSH_ERROR_KEY);
  } catch {
    return null;
  }
}

type PermissionState = NotificationPermission | 'unsupported';

interface NotificationAlertContextType {
  permission: PermissionState;
  requestPermission: () => Promise<void>;
  pushError: string | null;
  retryPush: () => Promise<void>;
}

const NotificationAlertContext = createContext<NotificationAlertContextType | null>(null);

export function NotificationAlertProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PermissionState>('default');
  const seenIds = useRef<Set<number> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  // True once this device is subscribed to push: the service worker then
  // delivers every notification, so the poller below must not alert again
  // (iOS ignores the shared tag and would show both).
  const pushActive = useRef(false);

  const recordPushResult = useCallback((result: PushResult) => {
    pushActive.current = result.ok;
    const message = result.ok ? null : `${result.step}: ${result.error}`;
    setPushError(message);
    try {
      if (message) localStorage.setItem(PUSH_ERROR_KEY, message);
      else localStorage.removeItem(PUSH_ERROR_KEY);
    } catch {}
    return result.ok;
  }, []);

  const retryPush = useCallback(async () => {
    setPushError('retrying…');
    recordPushResult(await subscribeToPush());
  }, [recordPushResult]);

  useEffect(() => {
    setPushError(readStoredPushError());
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    audioRef.current = new Audio(SOUND_URL);
    audioRef.current.volume = 0.5;
  }, []);

  // Reset the "seen" baseline whenever the logged-in user changes (login/logout).
  useEffect(() => {
    seenIds.current = null;
  }, [user?.id]);

  // If alerts were already enabled on this device, silently (re)link its push
  // subscription to whoever is logged in now. Also picks up subscriptions the
  // browser rotated while the app was closed.
  const userId = user?.id;
  useEffect(() => {
    if (!userId || permission !== 'granted') return;
    subscribeToPush().then(recordPushResult);
  }, [userId, permission, recordPushResult]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('This browser does not support notifications.');
      return;
    }
    // Ask the browser directly, inside the click, so the prompt always appears
    // (iOS only allows it from a user tap). The push subscription below then
    // uses the already-granted permission, through /sw.js.
    let result: NotificationPermission;
    try {
      result = await Notification.requestPermission();
    } catch {
      result = Notification.permission;
    }
    setPermission(result);

    if (result === 'denied') {
      toast.error('Notifications are blocked. Allow them in your browser’s site settings, then reload the page.');
      return;
    }
    if (result !== 'granted') return; // prompt dismissed; the button stays so they can try again

    if (recordPushResult(await subscribeToPush())) {
      toast.success('Alerts enabled. You’ll get browser and push notifications.');
    } else {
      toast.warning('Browser alerts enabled, but push notifications could not be set up. You’ll still get alerts while the app is open.');
    }
  }, [recordPushResult]);

  const { data: notifications = [] } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
    refetchInterval: 20_000,
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;

    if (seenIds.current === null) {
      // First load after login: establish a baseline silently, don't alert
      // for notifications that already existed before this session started.
      seenIds.current = new Set(notifications.map((n) => n.id));
      return;
    }

    const fresh = notifications.filter((n) => !n.read && !seenIds.current!.has(n.id));
    notifications.forEach((n) => seenIds.current!.add(n.id));

    if (fresh.length === 0 || pushActive.current) return;

    audioRef.current?.play().catch(() => {});

    if (permission === 'granted') {
      fresh.slice(0, 3).forEach((n) => {
        try {
          const browserNotif = new window.Notification(n.title, {
            body: n.message,
            tag: `notif-${n.id}`,
          });
          browserNotif.onclick = () => {
            window.focus();
            browserNotif.close();
          };
        } catch {
          // Some browsers throw if the page isn't allowed to show notifications
          // right now (e.g. Safari without a service worker) — sound already played.
        }
      });
    }
  }, [notifications, user, permission]);

  return (
    <NotificationAlertContext.Provider value={{ permission, requestPermission, pushError, retryPush }}>
      {children}
    </NotificationAlertContext.Provider>
  );
}

export function useNotificationAlert() {
  const ctx = useContext(NotificationAlertContext);
  if (!ctx) throw new Error('useNotificationAlert must be used within NotificationAlertProvider');
  return ctx;
}
