'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';

const DISMISSED_KEY = 'ios_install_banner_dismissed';

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function IOSInstallBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    // Deliberately deferred to post-mount: isIos()/isStandalone() read window/navigator,
    // which aren't available during the static export's build-time render, so this can't
    // be derived synchronously without a server/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIos() && !isStandalone()) setShow(true);
  }, [user]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-lg border bg-background p-4 shadow-lg sm:left-auto sm:right-4">
      <div className="flex-1 text-sm">
        <p className="font-medium">Enable notifications on iPhone/iPad</p>
        <p className="mt-1 text-muted-foreground">
          Tap the Share button in Safari, then &quot;Add to Home Screen&quot;. Open Worktool from the
          home screen icon to receive push notifications.
        </p>
      </div>
      <button
        onClick={() => {
          sessionStorage.setItem(DISMISSED_KEY, '1');
          setShow(false);
        }}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
