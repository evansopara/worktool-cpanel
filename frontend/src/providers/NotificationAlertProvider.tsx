'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { notificationsApi } from '@/lib/api';
import { toast } from 'sonner';
import { subscribeToPush, unsubscribeFromPush, type PushResult } from '@/lib/push';
import type { Notification as AppNotification } from '@/types';

const SOUND_URL = '/sounds/notification.wav';

// TEMPORARY push debugging: the last push-setup failure is kept on the device
// and shown under the header until push setup succeeds.
const PUSH_ERROR_KEY = 'push_debug_error';
// The in-app poller never alerts for notifications older than this.
const ALERT_WINDOW_MS = 10 * 60_000;
// Set when someone turns alerts off in Settings: no push, pop-ups or sound on
// this device until they turn them back on.
const ALERTS_OFF_KEY = 'alerts_off';

function readAlertsOff(): boolean {
  try {
    return localStorage.getItem(ALERTS_OFF_KEY) === '1';
  } catch {
    return false;
  }
}

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
  /** Alerts are on for this device: permission granted and not turned off in Settings. */
  enabled: boolean;
  setEnabled: (on: boolean) => Promise<void>;
}

const NotificationAlertContext = createContext<NotificationAlertContextType | null>(null);

export function NotificationAlertProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PermissionState>('default');
  const seenIds = useRef<Set<number> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [alertsOff, setAlertsOff] = useState(false);
  // True only when push could not be set up on this device. Until then the
  // service worker delivers every notification, so the poller below must not
  // show its own pop-up as well (iOS ignores the shared tag and shows both).
  const pushFailed = useRef(false);

  const recordPushResult = useCallback((result: PushResult) => {
    pushFailed.current = !result.ok;
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
    setAlertsOff(readAlertsOff());
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  // Opening the app (or switching back to it) clears this app's notifications
  // from the phone's notification bar, like chat apps do. They stay unread in
  // the app's own bell until looked at.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const clearTray = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.serviceWorker
        .getRegistration('/')
        .then((reg) => reg?.getNotifications())
        .then((list) => list?.forEach((n) => n.close()))
        .catch(() => {});
    };
    clearTray();
    document.addEventListener('visibilitychange', clearTray);
    return () => document.removeEventListener('visibilitychange', clearTray);
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
    if (!userId || permission !== 'granted' || alertsOff) return;
    subscribeToPush().then(recordPushResult);
  }, [userId, permission, alertsOff, recordPushResult]);

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

  const { data: notifications = [], isSuccess: listLoaded } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
    refetchInterval: 20_000,
    enabled: !!user,
  });

  useEffect(() => {
    // Wait for the real list: a baseline taken from the empty placeholder
    // made every unread notification look new each time the app opened.
    if (!user || !listLoaded) return;

    if (seenIds.current === null) {
      // First load after login: establish a baseline silently, don't alert
      // for notifications that already existed before this session started.
      seenIds.current = new Set(notifications.map((n) => n.id));
      return;
    }

    // Only notifications that arrived while the app was open, and never
    // anything older than a few minutes (an app resumed after hours).
    const recent = Date.now() - ALERT_WINDOW_MS;
    const fresh = notifications.filter((n) => !n.read && !seenIds.current!.has(n.id) && new Date(n.created_at).getTime() >= recent);
    notifications.forEach((n) => seenIds.current!.add(n.id));

    if (fresh.length === 0 || alertsOff) return;
    // With push working on this device, the service worker already showed
    // these (with sound); the app adds nothing.
    const pushDelivers = permission === 'granted' && !pushFailed.current;
    if (pushDelivers) return;

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
  }, [notifications, listLoaded, user, permission, alertsOff]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      try {
        if (on) localStorage.removeItem(ALERTS_OFF_KEY);
        else localStorage.setItem(ALERTS_OFF_KEY, '1');
      } catch {}
      setAlertsOff(!on);
      if (on) {
        if (Notification.permission === 'granted') {
          if (recordPushResult(await subscribeToPush())) toast.success('Notifications are on for this device.');
          else toast.warning('Alerts are on, but push could not be set up. You’ll still get alerts while the app is open.');
        } else {
          await requestPermission();
        }
      } else {
        await unsubscribeFromPush();
        toast.success('Notifications are off for this device.');
      }
    },
    [recordPushResult, requestPermission],
  );
  const enabled = permission === 'granted' && !alertsOff;

  return (
    <NotificationAlertContext.Provider value={{ permission, requestPermission, pushError, retryPush, enabled, setEnabled }}>
      {children}
    </NotificationAlertContext.Provider>
  );
}

export function useNotificationAlert() {
  const ctx = useContext(NotificationAlertContext);
  if (!ctx) throw new Error('useNotificationAlert must be used within NotificationAlertProvider');
  return ctx;
}
